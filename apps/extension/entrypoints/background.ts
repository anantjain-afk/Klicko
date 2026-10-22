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

async function inspectActiveTab(requestId: number): Promise<InspectionResponse> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return errorResponse(requestId, 'no-tab');
  if (!tab.url) return errorResponse(requestId, 'reactivate');
  if (!/^https?:\/\//.test(tab.url)) return errorResponse(requestId, 'unsupported');
  if (activatedOrigins.get(tab.id) !== new URL(tab.url).origin) return errorResponse(requestId, 'reactivate');

  try {
    let snapshot: unknown;
    try {
      // Reuse the live document observer. Reinjecting WXT invalidates its old
      // context, which would unnecessarily change page identity between steps.
      snapshot = await browser.tabs.sendMessage(tab.id, { type: 'COLLECT_ELEMENTS' }, { frameId: 0 });
    } catch {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/content.js'],
      });
      snapshot = await browser.tabs.sendMessage(tab.id, { type: 'COLLECT_ELEMENTS' }, { frameId: 0 });
    }
    if (!isPageSnapshot(snapshot)) return errorResponse(requestId, 'changed');

    const [currentTab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (currentTab?.id !== tab.id || currentTab.url !== tab.url) {
      await browser.tabs.sendMessage(tab.id, { type: 'CLEAR_ELEMENTS' }).catch(() => undefined);
      return errorResponse(requestId, 'changed');
    }

    return { type: 'INSPECTION_RESULT', requestId, tabId: tab.id, snapshot };
  } catch {
    return errorResponse(requestId, 'reactivate');
  }
}

async function handlePanelRequest(request: PanelRequest): Promise<InspectionResponse | OverlayResponse | { ok: true }> {
  if (request.type === 'INSPECT_ACTIVE_TAB') return inspectActiveTab(request.requestId);
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
  // The page connection closes with its panel (or worker), so page cleanup does
  // not depend on an unload message or on service-worker memory surviving.
  browser.runtime.onConnect.addListener((panel) => {
    if (panel.name !== 'clickpilot-panel' || panel.sender?.id !== browser.runtime.id
      || panel.sender.url !== browser.runtime.getURL('/sidepanel.html')) return;
    let page: Browser.runtime.Port | undefined;
    let connectedTabId: number | undefined;
    let pending: { command: AssistantRequest; abort: AbortController } | undefined;
    async function ask(command: AssistantRequest) {
      pending?.abort.abort();
      const run = { command, abort: new AbortController() };
      pending = run;
      const timer = setTimeout(() => run.abort.abort(), 25_000);
      try {
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id !== command.tabId || !tab.url || connectedTabId !== command.tabId) throw new Error('The active page changed. Retry on the current tab.');
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
  browser.tabs.onRemoved.addListener((tabId) => activatedOrigins.delete(tabId));

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
