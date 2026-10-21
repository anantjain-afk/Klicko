import { browser, type Browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { collectElements } from '../src/features/observer/collect-elements';
import { showOverlay } from '../src/features/overlay/renderer';
import { isContentRequest, type OverlayResponse, type PageSnapshot, type PageInvalidation } from '../src/lib/messages';

interface ObserverState {
  isValid: () => boolean;
  dispose: () => void;
}

export default defineContentScript({
  registration: 'runtime',
  main(ctx) {
    const scope = globalThis as typeof globalThis & { clickpilotObserver?: ObserverState };
    if (scope.clickpilotObserver?.isValid()) return;
    scope.clickpilotObserver?.dispose();

    let pageKey = crypto.randomUUID();
    let observedUrl = location.href;
    let registry = new Map<string, Element>();
    let snapshotId: string | null = null;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let navigationCheck: ReturnType<typeof setInterval> | undefined;
    let removeOverlay: (() => void) | null = null;

    function notify(type: PageInvalidation['type'], targetId?: string) {
      if (!snapshotId || !ctx.isValid) return;
      void browser.runtime.sendMessage({ type, pageKey, snapshotId, targetId }).catch(() => undefined);
    }

    function clear() {
      removeOverlay?.();
      removeOverlay = null;
      registry.clear();
      snapshotId = null;
      if (expiry) clearTimeout(expiry);
      if (navigationCheck) clearInterval(navigationCheck);
      expiry = undefined;
      navigationCheck = undefined;
    }

    function checkNavigation() {
      if (observedUrl === location.href) return;
      notify('SNAPSHOT_INVALIDATED');
      clear();
      observedUrl = location.href;
      pageKey = crypto.randomUUID();
    }

    function handleMessage(message: unknown, sender: { id?: string }, sendResponse: (response: PageSnapshot | OverlayResponse | { ok: true }) => void) {
      if (!ctx.isValid || sender.id !== browser.runtime.id || !isContentRequest(message)) return;
      if (message.type === 'CLEAR_ELEMENTS') {
        clear();
        sendResponse({ ok: true });
        return;
      }

      checkNavigation();
      if (message.type === 'SHOW_OVERLAY') {
        removeOverlay?.();
        removeOverlay = null;
        const target = registry.get(message.targetId);
        const isCurrent = () => ctx.isValid && observedUrl === location.href
          && pageKey === message.pageKey && snapshotId === message.snapshotId
          && registry.get(message.targetId) === target;
        if (target && isCurrent()) {
          removeOverlay = showOverlay(target, message.instruction, isCurrent, () => {
            removeOverlay = null;
            notify('OVERLAY_INVALIDATED', message.targetId);
          });
        }
        sendResponse({ type: 'OVERLAY_RESULT', ok: removeOverlay !== null });
        return;
      }
      clear();
      const collected = collectElements(document);
      registry = collected.registry;
      snapshotId = crypto.randomUUID();
      expiry = setTimeout(() => { notify('SNAPSHOT_INVALIDATED'); clear(); }, 60_000);
      navigationCheck = setInterval(checkNavigation, 250);
      const snapshot: PageSnapshot = {
        pageKey,
        snapshotId,
        elements: collected.elements,
      };
      sendResponse(snapshot);
    }

    function onConnect(port: Browser.runtime.Port) {
      if (port.name !== 'clickpilot-page' || port.sender?.id !== browser.runtime.id) return;
      port.onDisconnect.addListener(clear);
      ctx.onInvalidated(() => port.disconnect());
    }

    browser.runtime.onMessage.addListener(handleMessage);
    browser.runtime.onConnect.addListener(onConnect);
    const state: ObserverState = {
      isValid: () => ctx.isValid,
      dispose() {
        clear();
        if (ctx.isValid) {
          browser.runtime.onMessage.removeListener(handleMessage);
          browser.runtime.onConnect.removeListener(onConnect);
        }
      },
    };
    scope.clickpilotObserver = state;
    ctx.onInvalidated(() => {
      state.dispose();
      if (scope.clickpilotObserver === state) delete scope.clickpilotObserver;
    });
  },
});
