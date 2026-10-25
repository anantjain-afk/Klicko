import { actionBaseline } from './observe-action';
export const PAGE_SETTLE_MS = 400;
export const PAGE_MAX_WAIT_MS = 5000;
const PAGE_SAMPLE_MS = 100;

// Temporary collections never replace the live snapshot registry.
export function settlePage(doc: Document, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const url = doc.location.href;
    const started = performance.now();
    let stableSince = started;
    let previous = '';
    function finish(ok: boolean) { clearInterval(timer); signal.removeEventListener('abort', cancel); resolve(ok); }
    function cancel() { finish(false); }
    function sample() {
      if (signal.aborted || doc.location.href !== url) { finish(false); return; }
      const controls = actionBaseline(doc);
      const current = JSON.stringify([...controls.values()].sort());
      if (current !== previous) stableSince = performance.now();
      previous = current;
      const animating = doc.getAnimations().some((animation) => animation.playState === 'running'
        && animation.effect instanceof KeyframeEffect && animation.effect.target instanceof Element
        && [...controls.keys()].some((node) => (animation.effect as KeyframeEffect).target?.contains(node)));
      if (doc.readyState === 'complete' && !animating && performance.now() - stableSince >= PAGE_SETTLE_MS) finish(true);
      else if (performance.now() - started >= PAGE_MAX_WAIT_MS) finish(false);
    }
    const timer = setInterval(sample, PAGE_SAMPLE_MS);
    signal.addEventListener('abort', cancel, { once: true });
    sample();
  });
}
