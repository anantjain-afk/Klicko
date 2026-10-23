import { browser, type Browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { collectElements } from '../src/features/observer/collect-elements';
import { actionBaseline, observeAction } from '../src/features/observer/observe-action';
import { showOverlay } from '../src/features/overlay/renderer';
import { reportHighlightFailure } from '../src/features/overlay/diagnostics';
import { isMockFixtureUrl } from '../src/features/session/mock';
import { isContentRequest, type OverlayResponse, type PageSnapshot, type PageInvalidation } from '../src/lib/messages';

interface ObserverState {
  isValid: () => boolean;
  dispose: () => void;
}

const ACTION_BASELINE_MAX_AGE_MS = 1500;

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
    let currentSnapshot: PageSnapshot | null = null;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let navigationCheck: ReturnType<typeof setInterval> | undefined;
    let removeOverlay: (() => void) | null = null;
    let removeClickListener: (() => void) | null = null;

    let stopObservation: (() => void) | undefined;

    function clearOverlay() {
      stopObservation?.();
      stopObservation = undefined;
      removeOverlay?.();
      removeOverlay = null;
      removeClickListener?.();
      removeClickListener = null;
    }

    function notify(type: PageInvalidation['type'], targetId?: string) {
      if (!snapshotId || !ctx.isValid) return;
      void browser.runtime.sendMessage({ type, pageKey, snapshotId, targetId }).catch(() => undefined);
    }

    function clear() {
      clearOverlay();
      registry.clear();
      snapshotId = null;
      currentSnapshot = null;
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

    function handleMessage(message: unknown, sender: { id?: string }, sendResponse: (response: PageSnapshot | OverlayResponse | { ok: boolean }) => void) {
      if (!ctx.isValid || sender.id !== browser.runtime.id || !isContentRequest(message)) return;
      if (message.type === 'CLEAR_ELEMENTS') {
        if (message.snapshotId === undefined || message.snapshotId === snapshotId) clear();
        sendResponse({ ok: true });
        return;
      }

      checkNavigation();
      if (message.type === 'GET_SNAPSHOT') {
        sendResponse(message.pageKey === pageKey && message.snapshotId === snapshotId && currentSnapshot
          ? currentSnapshot : { ok: false });
        return;
      }
      if (message.type === 'SHOW_OVERLAY') {
        const target = registry.get(message.targetId);
        const isCurrent = () => ctx.isValid && observedUrl === location.href
          && pageKey === message.pageKey && snapshotId === message.snapshotId
          && registry.get(message.targetId) === target;
        if (target && isCurrent()) {
          clearOverlay();
          removeOverlay = showOverlay(target, message.instruction, isCurrent, () => {
            clearOverlay();
            notify('OVERLAY_INVALIDATED', message.targetId);
          });
          const guidance = message.guidance;
          if (removeOverlay && guidance) {
            // Some menu libraries open on pointer-down, before the click reaches us.
            let prepared: { controls: ReturnType<typeof actionBaseline>; expanded: string | null; time: number } | undefined;
            const prepare = (event: PointerEvent | KeyboardEvent) => {
              if (!event.isTrusted) return;
              prepared = undefined;
              if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
              if (!(event.target instanceof Node) || !target.contains(event.target) || !isCurrent() || !removeOverlay) return;
              prepared = { controls: actionBaseline(document), expanded: target.getAttribute('aria-expanded'), time: performance.now() };
            };
            const onClick = (event: MouseEvent) => {
              if (!event.isTrusted || !(event.target instanceof Node) || !target.contains(event.target)
                || !isCurrent() || !removeOverlay) return;
              const baseline = prepared && performance.now() - prepared.time < ACTION_BASELINE_MAX_AGE_MS ? prepared : undefined;
              const before = baseline?.controls ?? actionBaseline(document);
              const expandedBefore = baseline ? baseline.expanded : target.getAttribute('aria-expanded');
              void browser.runtime.sendMessage({
                type: 'GUIDANCE_CLICKED', pageKey, snapshotId, targetId: message.targetId,
                sessionId: guidance.sessionId, requestId: guidance.requestId,
              }).catch(() => undefined);
              clearOverlay();
              if (guidance.observe) {
                stopObservation = observeAction(target, before, expandedBefore, guidance.expectedOutcome, isCurrent, (result) => {
                  stopObservation = undefined;
                  void browser.runtime.sendMessage({
                    type: 'ACTION_OBSERVED', pageKey, snapshotId, targetId: message.targetId,
                    sessionId: guidance.sessionId, requestId: guidance.requestId, ...result,
                  }).catch(() => undefined);
                });
              }
            };
            document.addEventListener('click', onClick, true);
            document.addEventListener('pointerdown', prepare, true);
            document.addEventListener('keydown', prepare, true);
            removeClickListener = () => {
              prepared = undefined;
              document.removeEventListener('click', onClick, true);
              document.removeEventListener('pointerdown', prepare, true);
              document.removeEventListener('keydown', prepare, true);
            };
          }
        } else {
          reportHighlightFailure(target ? 'identity_mismatch' : 'registry_missing');
        }
        sendResponse({ type: 'OVERLAY_RESULT', ok: !!target && isCurrent() && removeOverlay !== null });
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
        mockFixture: isMockFixtureUrl(location.href),
      };
      currentSnapshot = snapshot;
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
