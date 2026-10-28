import { browser } from 'wxt/browser';
import { createTabAccess } from './tab-access';
import { AI_PREFERENCES_KEY, readAiPreferences } from './preferences';
import { isPageSnapshot, isOverlayResponse, type InspectionResponse, type OverlayResponse, type PanelRequest } from './messages';
import { isSensitivePage } from '@clickpilot/shared/privacy';
import { globallyEnabled, hasAllSiteAccess, supportedPage } from './activation';

async function probeAccess(tabId: number) {
  await browser.scripting.executeScript({ target: { tabId }, func: () => undefined });
}
const currentTabAccess = createTabAccess({
  read: async (key) => (await browser.storage.session.get(key))[key],
  write: (key, origin) => browser.storage.session.set({ [key]: origin }),
  remove: (key) => browser.storage.session.remove(key),
  probe: probeAccess,
});
export const tabAccess = {
  ...currentTabAccess,
  async allows(tabId: number, url: string) {
    if (!supportedPage(url)) return false;
    if (!await globallyEnabled()) return currentTabAccess.allows(tabId, url);
    if (!await hasAllSiteAccess()) return false;
    try { await probeAccess(tabId); return true; } catch { return false; }
  },
};
export async function sharingPreferences() {
  return readAiPreferences((await browser.storage.local.get(AI_PREFERENCES_KEY))[AI_PREFERENCES_KEY]);
}

function errorResponse(requestId: number, reason: 'no-tab' | 'unsupported' | 'reactivate' | 'changed'): InspectionResponse {
  return { type: 'INSPECTION_ERROR', requestId, reason };
}

const inspections = new Map<string, { abort: AbortController; tabId?: number }>();

export async function inspectActiveTab(requestId: number, ownedTabId?: number, settle = false, inspectionToken?: string): Promise<InspectionResponse> {
  const run = { abort: new AbortController(), tabId: ownedTabId };
  if (inspectionToken) inspections.set(inspectionToken, run);
  try {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) return errorResponse(requestId, 'no-tab');
    if (ownedTabId !== undefined && tab.id !== ownedTabId) return errorResponse(requestId, 'changed');
    if (!tab.url) return errorResponse(requestId, 'reactivate');
    if (!/^https?:\/\//.test(tab.url)) return errorResponse(requestId, 'unsupported');
    if (isSensitivePage(tab.url)) return errorResponse(requestId, 'unsupported');
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

export async function handlePanelRequest(request: PanelRequest): Promise<InspectionResponse | OverlayResponse | { ok: true }> {
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

