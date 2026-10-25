import { CHECKPOINT_KEY, createCheckpointStore, isCheckpointCommand } from '../src/features/session/checkpoint';
import { isAssistantRequest, requestAssistant, type AssistantRequest } from '../src/lib/assistant';
import { isTextCommand, requestText, type TextCommand } from '../src/lib/text-assistant';
import { TextIdentitySchema } from '@clickpilot/shared/text-assistant';
import { AI_PREFERENCES_KEY, readAiPreferences } from '../src/lib/preferences';
import { createTabAccess } from '../src/lib/tab-access';
import { isSensitivePage } from '@clickpilot/shared/privacy';
import { defineBackground } from 'wxt/utils/define-background';
import { browser, type Browser } from 'wxt/browser';
import {
  isPageSnapshot,
  isPanelRequest,
  isOverlayResponse,
  isTrackPageRequest,
  type InspectionResponse,
  type OverlayResponse,
  type PanelRequest,
} from '../src/lib/messages';

const tabAccess = createTabAccess({
  read: async (key) => (await browser.storage.session.get(key))[key],
  write: (key, origin) => browser.storage.session.set({ [key]: origin }),
  remove: (key) => browser.storage.session.remove(key),
  // A stored activation is intent, not proof that Chrome still grants access.
  probe: async (tabId) => { await browser.scripting.executeScript({ target: { tabId }, func: () => undefined }); },
});

async function sharingAllowed(kind: 'guidance' | 'selectedText'): Promise<boolean> {
  try { return readAiPreferences((await browser.storage.local.get(AI_PREFERENCES_KEY))[AI_PREFERENCES_KEY])[kind]; }
  catch { return false; }
}

function errorResponse(requestId: number, reason: 'no-tab' | 'unsupported' | 'reactivate' | 'changed'): InspectionResponse {
  return { type: 'INSPECTION_ERROR', requestId, reason };
}

const inspections = new Map<string, { abort: AbortController; tabId?: number }>();

async function inspectActiveTab(requestId: number, ownedTabId?: number, settle = false, inspectionToken?: string): Promise<InspectionResponse> {
  const run = { abort: new AbortController(), tabId: ownedTabId };
  if (inspectionToken) inspections.set(inspectionToken, run);
  try {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) return errorResponse(requestId, 'no-tab');
    if (ownedTabId !== undefined && tab.id !== ownedTabId) return errorResponse(requestId, 'changed');
    if (!tab.url) return errorResponse(requestId, 'reactivate');
    if (!/^https?:\/\//.test(tab.url)) return errorResponse(requestId, 'unsupported');
    if (!await tabAccess.allows(tab.id, tab.url)) return errorResponse(requestId, 'reactivate');

    run.tabId = tab.id;
    if (run.abort.signal.aborted) return errorResponse(requestId, 'changed');
    try {
      let snapshot: unknown;
      const collect = async () => {
        if (settle) {
          const ready: unknown = await browser.tabs.sendMessage(tab.id!, { type: 'WAIT_FOR_PAGE', inspectionToken }, { frameId: 0 });
          if (!ready || typeof ready !== 'object' || !('ok' in ready) || ready.ok !== true) return null;
        }
        if (run.abort.signal.aborted) return null;
        return browser.tabs.sendMessage(tab.id!, { type: 'COLLECT_ELEMENTS' }, { frameId: 0 });
      };
      try {
        // Reuse the live document observer. Reinjecting WXT invalidates its old
        // context, which would unnecessarily change page identity between steps.
        snapshot = await collect();
      } catch {
        if (run.abort.signal.aborted) return errorResponse(requestId, 'changed');
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content-scripts/content.js'],
        });
        snapshot = await collect();
      }
      if (run.abort.signal.aborted || !isPageSnapshot(snapshot)) return errorResponse(requestId, 'changed');

      const [currentTab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      if (currentTab?.id !== tab.id || currentTab.url !== tab.url) {
        await browser.tabs.sendMessage(tab.id, { type: 'CLEAR_ELEMENTS' }).catch(() => undefined);
        return errorResponse(requestId, 'changed');
      }

      return { type: 'INSPECTION_RESULT', requestId, tabId: tab.id, snapshot };
    } catch {
      return errorResponse(requestId, 'reactivate');
    }
  } finally { if (inspectionToken) inspections.delete(inspectionToken); }
}

async function handlePanelRequest(request: PanelRequest): Promise<InspectionResponse | OverlayResponse | { ok: true }> {
  if (request.type === 'CANCEL_INSPECTION') {
    const run = inspections.get(request.inspectionToken);
    run?.abort.abort();
    if (run?.tabId !== undefined) await browser.tabs.sendMessage(run.tabId, { type: 'CANCEL_PAGE_WAIT', inspectionToken: request.inspectionToken }, { frameId: 0 }).catch(() => undefined);
    return { ok: true };
  }
  if (request.type === 'INSPECT_ACTIVE_TAB') return inspectActiveTab(request.requestId, request.tabId, request.settle, request.inspectionToken);
  if (request.type === 'HIGHLIGHT_ELEMENT') {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id !== request.tabId) return { type: 'OVERLAY_RESULT', ok: false };
    const response: unknown = await browser.tabs.sendMessage(request.tabId, {
      ...request, type: 'SHOW_OVERLAY',
    }, { frameId: 0 });
    const [currentTab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (currentTab?.id !== request.tabId || currentTab.url !== tab.url) {
      await browser.tabs.sendMessage(request.tabId, { type: 'CLEAR_ELEMENTS' }).catch(() => undefined);
      return { type: 'OVERLAY_RESULT', ok: false };
    }
    return isOverlayResponse(response) ? response : { type: 'OVERLAY_RESULT', ok: false };
  }
  await browser.tabs.sendMessage(request.tabId, { type: 'CLEAR_ELEMENTS', snapshotId: request.snapshotId }, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

export default defineBackground(() => {
  // Explicitly retain Chrome's trusted-context boundary for session metadata.
  const storageReady = browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const checkpoints = createCheckpointStore({
    read: async () => { await storageReady; return (await browser.storage.session.get(CHECKPOINT_KEY))[CHECKPOINT_KEY]; },
    write: async (value) => { await storageReady; await browser.storage.session.set({ [CHECKPOINT_KEY]: value }); },
    remove: async () => { await storageReady; await browser.storage.session.remove(CHECKPOINT_KEY); },
    tabExists: async (tabId) => { try { await browser.tabs.get(tabId); return true; } catch { return false; } },
  });
  void storageReady.catch(() => undefined);
  void browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => undefined);
  // The page connection closes with its panel (or worker), so page cleanup does
  // not depend on an unload message or on service-worker memory surviving.
  browser.runtime.onConnect.addListener((panel) => {
    if (panel.name !== 'clickpilot-panel' || panel.sender?.id !== browser.runtime.id
      || panel.sender.url !== browser.runtime.getURL('/sidepanel.html')) return;
    const ownerId = crypto.randomUUID();
    checkpoints.claim(ownerId);
    let closed = false;
    void checkpoints.notice().then((interrupted) => {
      if (!closed) panel.postMessage({ type: 'CHECKPOINT_NOTICE', interrupted });
    }).catch(() => { if (!closed) panel.postMessage({ type: 'CHECKPOINT_UNAVAILABLE' }); });
    let page: Browser.runtime.Port | undefined;
    let connectedTabId: number | undefined;
    let pending: { command: AssistantRequest | TextCommand; abort: AbortController } | undefined;
    let armed: { sessionId: string; tabId: number; pageKey: string; consent: boolean } | undefined;
    let arming: { sessionId: string; tabId: number } | undefined;
    let armNumber = 0;
    function track(tabId: number) {
      if (page && connectedTabId === tabId) return;
      page?.disconnect();
      connectedTabId = tabId;
      page = browser.tabs.connect(tabId, { name: 'clickpilot-page', frameId: 0 });
      const connection = page;
      connection.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        if (page === connection) page = undefined;
      });
    }
    function stopText(clearPage = true) {
      ++armNumber;
      const previous = armed ?? arming; armed = undefined; arming = undefined;
      if (pending?.command.type === 'ASK_TEXT') { pending.abort.abort(); pending = undefined; }
      if (clearPage && previous) void browser.tabs.sendMessage(previous.tabId, { type: 'DISABLE_TEXT', sessionId: previous.sessionId }, { frameId: 0 }).catch(() => undefined);
    }
    async function armText(sessionId: string, consent: boolean) {
      const attempt = ++armNumber;
      try {
        if (!checkpoints.isOwner(ownerId)) return;
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (closed || attempt !== armNumber) return;
        if (tab?.url && isSensitivePage(tab.url)) {
          panel.postMessage({ type: 'TEXT_ARM_ERROR', reason: 'privacy' }); return;
        }
        if (tab?.id === undefined || !tab.url
          || !await tabAccess.allows(tab.id, tab.url)) throw new Error('Click the ClickPilot toolbar icon on a public page to enable text help.');
        if (armed && armed.tabId !== tab.id) {
          void browser.tabs.sendMessage(armed.tabId, { type: 'DISABLE_TEXT', sessionId: armed.sessionId }, { frameId: 0 }).catch(() => undefined);
          armed = undefined;
        }
        const command = { type: 'ENABLE_TEXT', sessionId, consent };
        arming = { sessionId, tabId: tab.id };
        let result: unknown;
        try { result = await browser.tabs.sendMessage(tab.id, command, { frameId: 0 }); }
        catch {
          if (closed || attempt !== armNumber) return;
          await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
          if (closed || attempt !== armNumber) return;
          result = await browser.tabs.sendMessage(tab.id, command, { frameId: 0 });
        }
        const [latest] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (closed || attempt !== armNumber || !checkpoints.isOwner(ownerId)) return;
        if (latest?.id !== tab.id || latest.url !== tab.url) {
          await browser.tabs.sendMessage(tab.id, { type: 'DISABLE_TEXT', sessionId }, { frameId: 0 }).catch(() => undefined); return;
        }
        if (!result || typeof result !== 'object' || !('pageKey' in result) || typeof result.pageKey !== 'string') throw new Error('Could not enable text help. Activate the toolbar and try again.');
        track(tab.id);
        armed = { sessionId, tabId: tab.id, pageKey: result.pageKey, consent };
        arming = undefined;
        const selectionId = 'selectionId' in result && TextIdentitySchema.safeParse({ sessionId, pageKey: result.pageKey, selectionId: result.selectionId }).success
          ? result.selectionId : undefined;
        panel.postMessage({ type: 'TEXT_ARMED', ...armed, selectionId });
      } catch (error) {
        if (!closed && attempt === armNumber) panel.postMessage({ type: 'TEXT_ARM_ERROR', message: error instanceof Error ? error.message : 'Text help could not connect.' });
      }
    }
    async function askText(command: TextCommand) {
      pending?.abort.abort();
      const run = { command, abort: new AbortController() }; pending = run;
      const timer = setTimeout(() => run.abort.abort(), 25_000);
      try {
        if (!await sharingAllowed('selectedText')) throw new Error('Selected-text sharing is off. You can change it in Settings.');
        if (!checkpoints.isOwner(ownerId) || !armed?.consent || armed.tabId !== command.tabId
          || armed.sessionId !== command.sessionId || armed.pageKey !== command.pageKey) throw new Error('Selected-text sharing is not enabled for this page.');
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id !== command.tabId || !tab.url || isSensitivePage(tab.url)
          || !await tabAccess.allows(tab.id, tab.url)) throw new Error('The active page changed. Select text again.');
        const check = () => browser.tabs.sendMessage(command.tabId, {
          type: 'CHECK_TEXT', sessionId: command.sessionId, pageKey: command.pageKey, selectionId: command.selectionId,
        }, { frameId: 0 });
        const before: unknown = await check();
        if (!before || typeof before !== 'object' || !('selectedText' in before) || before.selectedText !== command.selectedText
          || run.abort.signal.aborted) throw new Error('The selection changed. Select the passage again.');
        if (!await sharingAllowed('selectedText') || run.abort.signal.aborted) throw new Error('Selected-text sharing is off. You can change it in Settings.');
        const result = await requestText(command, run.abort.signal);
        const [latest] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        const after: unknown = await check();
        if (pending !== run || run.abort.signal.aborted) return;
        if (latest?.id !== command.tabId || latest.url !== tab.url || !after || typeof after !== 'object'
          || !('selectedText' in after) || after.selectedText !== command.selectedText) throw new Error('The selection changed while replying. Select text again.');
        await browser.tabs.sendMessage(command.tabId, { type: 'SHOW_TEXT', sessionId: command.sessionId,
          pageKey: command.pageKey, selectionId: command.selectionId, result: result.result }, { frameId: 0 });
        if (pending === run && !run.abort.signal.aborted) panel.postMessage({ type: 'TEXT_RESULT', sessionId: command.sessionId, requestId: command.requestId, value: result });
      } catch (error) {
        if (pending === run) {
          const message = run.abort.signal.aborted ? 'The text request timed out. Retry if needed.'
            : error instanceof Error && error.message.length <= 240 ? error.message : 'Could not reach the text service. Retry from the side panel.';
          panel.postMessage({ type: 'TEXT_RESULT', sessionId: command.sessionId, requestId: command.requestId, error: message });
          void browser.tabs.sendMessage(command.tabId, { type: 'SHOW_TEXT', sessionId: command.sessionId,
            pageKey: command.pageKey, selectionId: command.selectionId, error: message }, { frameId: 0 }).catch(() => undefined);
        }
      } finally { clearTimeout(timer); if (pending === run) pending = undefined; }
    }
    async function ask(command: AssistantRequest) {
      pending?.abort.abort();
      const run = { command, abort: new AbortController() };
      pending = run;
      const timer = setTimeout(() => run.abort.abort(), 25_000);
      try {
        if (!await sharingAllowed('guidance')) throw new Error('Webpage sharing is off. You can change it in Settings.');
        if (!checkpoints.isOwner(ownerId)) throw new Error('ClickPilot is active in another panel. Reopen this panel to start again.');
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id !== command.tabId || !tab.url || connectedTabId !== command.tabId
          || !await tabAccess.allows(command.tabId, tab.url)) throw new Error('This page changed or access expired. Click the ClickPilot toolbar icon on this tab, then try again.');
        const getSnapshot = () => browser.tabs.sendMessage(command.tabId, {
          type: 'GET_SNAPSHOT', pageKey: command.pageKey, snapshotId: command.snapshotId,
        }, { frameId: 0 });
        const snapshot: unknown = await getSnapshot();
        if (!isPageSnapshot(snapshot)) throw new Error('This page changed. Let’s check it again.');
        if (run.abort.signal.aborted) throw new Error('The request was cancelled.');
        if (!await sharingAllowed('guidance') || run.abort.signal.aborted) throw new Error('Webpage sharing is off. You can change it in Settings.');
        const result = await requestAssistant(command, snapshot, tab.url, run.abort.signal);
        const [current] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        const latest: unknown = await getSnapshot();
        if (current?.id !== command.tabId || current.url !== tab.url || !isPageSnapshot(latest)) throw new Error('The page changed while Gemini was replying. Retry.');
        if (pending === run && !run.abort.signal.aborted) panel.postMessage({ type: 'ASSISTANT_RESULT', sessionId: command.sessionId, requestId: command.requestId, value: result });
      } catch (error) {
        if (pending === run) panel.postMessage({ type: 'ASSISTANT_RESULT', sessionId: command.sessionId, requestId: command.requestId,
          error: run.abort.signal.aborted ? 'The request was cancelled or timed out. Retry if needed.'
            : error instanceof Error && error.message.length <= 240 ? error.message : 'Could not reach the local AI service. Check the backend and retry.' });
      } finally {
        clearTimeout(timer);
        if (pending === run) pending = undefined;
      }
    }
    panel.onMessage.addListener((message: unknown) => {
      if (isTextCommand(message)) { void askText(message); return; }
      if (message && typeof message === 'object' && 'type' in message) {
        if (message.type === 'STOP_TEXT') { stopText(); return; }
        if (message.type === 'ARM_TEXT' && 'sessionId' in message && 'consent' in message && typeof message.consent === 'boolean'
          && TextIdentitySchema.pick({ sessionId: true }).safeParse({ sessionId: message.sessionId }).success) {
          void armText(String(message.sessionId), message.consent); return;
        }
      }
      if (isCheckpointCommand(message)) {
        void checkpoints.apply(ownerId, message).then((ok) => {
          if (!closed) panel.postMessage({ type: 'CHECKPOINT_RESULT', revision: message.revision, ok });
        }).catch(() => { if (!closed) panel.postMessage({ type: 'CHECKPOINT_RESULT', revision: message.revision, ok: false }); });
        return;
      }
      if (isAssistantRequest(message)) { stopText(); void ask(message); return; }
      if (message && typeof message === 'object' && 'type' in message && message.type === 'CANCEL_ASSISTANT') {
        if (pending && 'sessionId' in message && 'requestId' in message && pending.command.sessionId === message.sessionId
          && pending.command.requestId === message.requestId) {
          const previous = pending;
          pending = undefined;
          previous.abort.abort();
        }
        return;
      }
      if (!isTrackPageRequest(message)) return;
      track(message.tabId);
    });
    const onSharingChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !(AI_PREFERENCES_KEY in changes)) return;
      const preferences = readAiPreferences(changes[AI_PREFERENCES_KEY]?.newValue);
      if (!preferences.selectedText) stopText();
      if (!preferences.guidance && pending?.command.type === 'ASK_ASSISTANT') {
        const previous = pending; pending = undefined; previous.abort.abort();
      }
    };
    browser.storage.onChanged.addListener(onSharingChanged);
    panel.onDisconnect.addListener(() => {
      browser.storage.onChanged.removeListener(onSharingChanged);
      closed = true;
      // Port loss may be worker suspension. The page suspends its surface;
      // explicit Stop/withdrawal still sends DISABLE_TEXT and discards drafts.
      stopText(false);
      void checkpoints.disconnect(ownerId).catch(() => undefined);
      pending?.abort.abort();
      pending = undefined;
      page?.disconnect();
      // Re-injection can replace the page connection before the panel closes.
      // Keep the last owned tab so closing still clears its current registry.
      if (connectedTabId !== undefined) {
        void browser.tabs.sendMessage(connectedTabId, { type: 'CLEAR_ELEMENTS' }, { frameId: 0 }).catch(() => undefined);
      }
    });
  });
  // Earlier builds used automatic panel opening, which can bypass onClicked.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error: unknown) => {
    console.error('Could not configure the ClickPilot toolbar action:', error);
  });

  browser.action.onClicked.addListener((tab) => {
    const activation = tab.id !== undefined && tab.url
      ? tabAccess.activate(tab.id, tab.url) : Promise.resolve();
    void browser.sidePanel.open({ windowId: tab.windowId }).catch((error: unknown) => {
      console.error('Could not open the ClickPilot side panel:', error);
    });
    void activation.then(() => browser.runtime.sendMessage({ type: 'TEXT_ACTIVATED', tabId: tab.id })).catch(() => undefined);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void tabAccess.remove(tabId).catch(() => undefined);
    void checkpoints.removeTab(tabId).catch(() => undefined);
  });
  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (!change.url && change.status !== 'loading' && change.status !== 'complete') return;
    const url = change.url ?? tab.url;
    // A destination Chrome no longer exposes cannot retain activation intent.
    void (url ? tabAccess.navigation(tabId, url) : tabAccess.remove(tabId)).catch(() => undefined);
  });

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || sender.url !== browser.runtime.getURL('/sidepanel.html')) return;
    if (!isPanelRequest(message)) return;
    void handlePanelRequest(message).then(sendResponse).catch(() => {
      sendResponse(message.type === 'INSPECT_ACTIVE_TAB'
        ? errorResponse(message.requestId, 'reactivate')
        : message.type === 'HIGHLIGHT_ELEMENT' ? { type: 'OVERLAY_RESULT', ok: false } : { ok: true });
    });
    return true;
  });
});
