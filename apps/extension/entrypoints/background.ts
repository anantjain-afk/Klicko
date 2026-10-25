import { CHECKPOINT_KEY, createCheckpointStore, isCheckpointCommand } from '../src/features/session/checkpoint';
import { isAssistantRequest, requestAssistant, type AssistantRequest } from '../src/lib/assistant';
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

// The loopback API grant must not implicitly activate page observation.
// After a worker restart, clicking the toolbar safely restores this small grant.
const activatedOrigins = new Map<number, string>();

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
    if (activatedOrigins.get(tab.id) !== new URL(tab.url).origin) return errorResponse(requestId, 'reactivate');

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
    let pending: { command: AssistantRequest; abort: AbortController } | undefined;
    async function ask(command: AssistantRequest) {
      pending?.abort.abort();
      const run = { command, abort: new AbortController() };
      pending = run;
      const timer = setTimeout(() => run.abort.abort(), 25_000);
      try {
        if (!checkpoints.isOwner(ownerId)) throw new Error('Another panel owns the task connection. Reopen this panel to start again.');
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id !== command.tabId || !tab.url || connectedTabId !== command.tabId
          || activatedOrigins.get(command.tabId) !== new URL(tab.url).origin) throw new Error('The active page changed. Retry on the current tab.');
        const getSnapshot = () => browser.tabs.sendMessage(command.tabId, {
          type: 'GET_SNAPSHOT', pageKey: command.pageKey, snapshotId: command.snapshotId,
        }, { frameId: 0 });
        const snapshot: unknown = await getSnapshot();
        if (!isPageSnapshot(snapshot)) throw new Error('The page snapshot expired. Retry for fresh context.');
        if (run.abort.signal.aborted) throw new Error('The request was cancelled.');
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
      if (isCheckpointCommand(message)) {
        void checkpoints.apply(ownerId, message).then((ok) => {
          if (!closed) panel.postMessage({ type: 'CHECKPOINT_RESULT', revision: message.revision, ok });
        }).catch(() => { if (!closed) panel.postMessage({ type: 'CHECKPOINT_RESULT', revision: message.revision, ok: false }); });
        return;
      }
      if (isAssistantRequest(message)) { void ask(message); return; }
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
      if (page && connectedTabId === message.tabId) return;
      page?.disconnect();
      connectedTabId = message.tabId;
      page = browser.tabs.connect(message.tabId, { name: 'clickpilot-page', frameId: 0 });
      const connection = page;
      connection.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        if (page === connection) page = undefined;
      });
    });
    panel.onDisconnect.addListener(() => {
      closed = true;
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
    if (tab.id !== undefined && tab.url && /^https?:\/\//.test(tab.url)) {
      activatedOrigins.set(tab.id, new URL(tab.url).origin);
    }
    void browser.sidePanel.open({ windowId: tab.windowId }).catch((error: unknown) => {
      console.error('Could not open the ClickPilot side panel:', error);
    });
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    activatedOrigins.delete(tabId);
    void checkpoints.removeTab(tabId).catch(() => undefined);
  });
  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.url && activatedOrigins.has(tabId)) {
      try { if (new URL(change.url).origin !== activatedOrigins.get(tabId)) activatedOrigins.delete(tabId); }
      catch { activatedOrigins.delete(tabId); }
    }
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
