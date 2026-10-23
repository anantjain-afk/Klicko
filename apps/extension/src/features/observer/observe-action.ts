import { OBSERVATION_MAX_MS, OBSERVATION_SETTLE_MS, type ExpectedOutcome } from '@clickpilot/shared/guidance';
import { eligibleElements } from '@clickpilot/shared/privacy';
import { collectElements, visibleRect } from './collect-elements';

const OBSERVATION_SAMPLE_MS = 100;
type Inventory = ReturnType<typeof collectElements>;

function controls(inventory: Inventory): Map<Element, string> {
  return new Map(eligibleElements(inventory.elements).map(({ id, role, name, context }) =>
    [inventory.registry.get(id)!, JSON.stringify([role, name, context])]));
}

function sameControls(a: Map<Element, string>, b: Map<Element, string>): boolean {
  // Ignore DOM reordering and equivalent re-renders, but retain duplicate-label counts.
  return JSON.stringify([...a.values()].sort()) === JSON.stringify([...b.values()].sort());
}

// Call during click capture, before the webpage handles the trusted action.
export function actionBaseline(doc: Document): Map<Element, string> {
  return controls(collectElements(doc));
}

export function observeAction(
  target: Element, before: Map<Element, string>, expandedBefore: string | null,
  outcome: ExpectedOutcome | undefined, isCurrent: () => boolean,
  onObserved: (result: { changed: boolean; status: 'verified' | 'not_verified' | 'unverifiable' }) => void,
): () => void {
  const doc = target.ownerDocument;
  const started = performance.now();
  let stableSince = started;
  let previous = before;
  let previousExpanded = expandedBefore;
  let stopped = false;
  let scheduled: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    stopped = true;
    observer.disconnect();
    clearTimeout(scheduled);
    clearInterval(poll);
  }

  function sample() {
    if (stopped) return;
    if (!isCurrent()) { stop(); return; }
    const current = controls(collectElements(doc));
    const expanded = target.getAttribute('aria-expanded');
    if (!sameControls(previous, current) || expanded !== previousExpanded) stableSince = performance.now();
    previous = current;
    previousExpanded = expanded;
    const changed = !sameControls(before, current) || expandedBefore !== expanded;
    const hidden = !(target instanceof HTMLElement) || !visibleRect(target, doc.defaultView!);
    const verified = outcome?.type === 'target_hidden' ? hidden
      : outcome?.type === 'target_expanded' && expandedBefore !== 'true' && expanded === 'true';
    const now = performance.now();
    const animating = (doc.getAnimations?.() ?? []).some((animation) => {
      const effect = animation.effect;
      if (animation.playState !== 'running' || !(effect instanceof KeyframeEffect) || !(effect.target instanceof Element)) return false;
      const animated = effect.target;
      return [...current.keys()].some((node) => animated.contains(node) || node.contains(animated));
    });
    if (now - started < OBSERVATION_MAX_MS
      && (!(changed || verified) || animating || now - stableSince < OBSERVATION_SETTLE_MS)) return;
    stop();
    onObserved({ changed, status: outcome ? (verified ? 'verified' : 'not_verified') : 'unverifiable' });
  }

  const observer = new MutationObserver((records) => {
    if (scheduled || records.every((record) => record.target instanceof Element
      && record.target.closest('#clickpilot-overlay'))) return;
    // Coalesce mutation bursts; only actionable-control changes reset the quiet period.
    scheduled = setTimeout(() => { scheduled = undefined; sample(); }, OBSERVATION_SAMPLE_MS);
  });
  observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'aria-expanded', 'aria-disabled',
      'disabled', 'class', 'style', 'role', 'aria-label', 'aria-labelledby'] });
  // CSS transitions can change visibility without another mutation. Bound all resampling to this attempt.
  const poll = setInterval(sample, OBSERVATION_SAMPLE_MS);
  return stop;
}
