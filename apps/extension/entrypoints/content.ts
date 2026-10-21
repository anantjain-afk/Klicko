import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { collectElements } from '../src/features/observer/collect-elements';
import { isContentRequest, type PageSnapshot } from '../src/lib/messages';

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
    let expiry: ReturnType<typeof setTimeout> | undefined;

    function clear() {
      registry.clear();
      if (expiry) clearTimeout(expiry);
      expiry = undefined;
    }

    function handleMessage(message: unknown, sender: { id?: string }, sendResponse: (response: PageSnapshot | { ok: true }) => void) {
      if (!ctx.isValid || sender.id !== browser.runtime.id || !isContentRequest(message)) return;
      if (message.type === 'CLEAR_ELEMENTS') {
        clear();
        sendResponse({ ok: true });
        return;
      }

      if (observedUrl !== location.href) {
        clear();
        observedUrl = location.href;
        pageKey = crypto.randomUUID();
      }
      const collected = collectElements(document);
      registry = collected.registry;
      if (expiry) clearTimeout(expiry);
      expiry = setTimeout(clear, 60_000);
      const snapshot: PageSnapshot = {
        pageKey,
        snapshotId: crypto.randomUUID(),
        elements: collected.elements,
      };
      sendResponse(snapshot);
    }

    browser.runtime.onMessage.addListener(handleMessage);
    const state: ObserverState = {
      isValid: () => ctx.isValid,
      dispose() {
        clear();
        if (ctx.isValid) browser.runtime.onMessage.removeListener(handleMessage);
      },
    };
    scope.clickpilotObserver = state;
    ctx.onInvalidated(() => {
      state.dispose();
      if (scope.clickpilotObserver === state) delete scope.clickpilotObserver;
    });
  },
});
