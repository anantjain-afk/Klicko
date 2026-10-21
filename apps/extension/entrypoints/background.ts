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

function errorResponse(requestId: number, reason: 'no-tab' | 'unsupported' | 'reactivate' | 'changed'): InspectionResponse {
  return { type: 'INSPECTION_ERROR', requestId, reason };
}

async function inspectActiveTab(requestId: number): Promise<InspectionResponse> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return errorResponse(requestId, 'no-tab');
  if (!tab.url) return errorResponse(requestId, 'reactivate');
  if (!/^https?:\/\//.test(tab.url)) return errorResponse(requestId, 'unsupported');

  try {
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/content-scripts/content.js'],
    });
    const snapshot: unknown = await browser.tabs.sendMessage(tab.id, { type: 'COLLECT_ELEMENTS' }, { frameId: 0 });
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
  await browser.tabs.sendMessage(request.tabId, { type: 'CLEAR_ELEMENTS' }).catch(() => undefined);
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
    panel.onMessage.addListener((message: unknown) => {
      if (!isTrackPageRequest(message)) return;
      if (connectedTabId === message.tabId) return;
      page?.disconnect();
      connectedTabId = message.tabId;
      page = browser.tabs.connect(message.tabId, { name: 'clickpilot-page', frameId: 0 });
      const connection = page;
      connection.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        if (page === connection) { page = undefined; connectedTabId = undefined; }
      });
    });
    panel.onDisconnect.addListener(() => page?.disconnect());
  });
  // Earlier builds used automatic panel opening, which can bypass onClicked.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error: unknown) => {
    console.error('Could not configure the ClickPilot toolbar action:', error);
  });

  browser.action.onClicked.addListener((tab) => {
    void browser.sidePanel.open({ windowId: tab.windowId }).catch((error: unknown) => {
      console.error('Could not open the ClickPilot side panel:', error);
    });
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
