import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import {
  isPageSnapshot,
  isPanelRequest,
  type InspectionResponse,
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
    const snapshot: unknown = await browser.tabs.sendMessage(tab.id, { type: 'COLLECT_ELEMENTS' });
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

async function handlePanelRequest(request: PanelRequest): Promise<InspectionResponse | { ok: true }> {
  if (request.type === 'INSPECT_ACTIVE_TAB') return inspectActiveTab(request.requestId);
  await browser.tabs.sendMessage(request.tabId, { type: 'CLEAR_ELEMENTS' }).catch(() => undefined);
  return { ok: true };
}

export default defineBackground(() => {
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
        : { ok: true });
    });
    return true;
  });
});
