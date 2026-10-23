import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { OBSERVATION_MAX_MS, OBSERVATION_SETTLE_MS, GuidanceRequestSchema } from '@clickpilot/shared/guidance';
import { collectElements } from '../../src/features/observer/collect-elements';
import { actionBaseline, observeAction } from '../../src/features/observer/observe-action';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button id="target">Account</button><div id="portal"></div><p id="noise"></p>';
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
    DOMRect.fromRect({ x: 20, y: 30, width: 100, height: 40 }));
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function open() {
  document.querySelector('#portal')!.innerHTML = '<div role="menu"><div role="menuitem">Rename</div><div role="menuitemcheckbox">Pin</div><div role="menuitemradio">Plugins</div><div role="option">Switch account</div></div>';
}
function watch(outcome?: { type: 'target_expanded' }) {
  const target = document.querySelector('#target')!;
  const observed = vi.fn();
  const current = vi.fn(() => true);
  const stop = observeAction(target, actionBaseline(document), null, outcome, current, observed);
  return { target, observed, current, stop };
}
it('includes non-native menu roles, and accepts them at the API boundary', () => {
  open();
  const snapshot = collectElements(document);
  expect(snapshot.elements.map(e => e.name)).toEqual(['Rename', 'Pin', 'Plugins', 'Switch account', 'Account']);
  expect(GuidanceRequestSchema.safeParse({ protocolVersion: 3, operation: 'next', sessionId: crypto.randomUUID(), requestId: 1,
    userGoal: 'Switch accounts', taskContext: { stepNumber: 1, previousStep: null },
    page: { url: 'https://example.com', pageKey: 'page', snapshotId: 'snapshot' },
    elements: snapshot.elements.map(({ id, name, role, context, disabled }) => ({ id, name, role, context, disabled })) }).success).toBe(true);
});
it('keeps the cap, fills remaining slots with background controls and freezes each registry', () => {
  document.querySelector('#noise')!.innerHTML = '<button>Background</button>'.repeat(155);
  const old = collectElements(document);
  const oldEntries = [...old.registry];
  open();
  const fresh = collectElements(document);
  expect(fresh.elements).toHaveLength(150);
  expect(fresh.elements.filter(e => e.context === 'Menu')).toHaveLength(4);
  expect(fresh.elements.some(e => e.name === 'Account')).toBe(true);
  expect(fresh.elements.filter(e => e.name === 'Background')).toHaveLength(145);
  expect([...old.registry]).toEqual(oldEntries);
  for (const item of fresh.elements) expect(fresh.registry.get(item.id)?.textContent).toBe(item.name);
});
it('detects delayed portal controls after the former two-second cutoff, without claiming verification', async () => {
  const { observed, stop } = watch();
  await vi.advanceTimersByTimeAsync(2200); open();
  await vi.advanceTimersByTimeAsync(OBSERVATION_SETTLE_MS + 200);
  expect(observed).toHaveBeenCalledExactlyOnceWith({ changed: true, status: 'unverifiable' }); stop();
});
it('detects hidden-to-visible controls and waits for animation visibility', async () => {
  open(); const portal = document.querySelector<HTMLElement>('#portal')!;
  portal.hidden = true; const { observed, stop } = watch();
  portal.hidden = false; portal.style.opacity = '0';
  await vi.advanceTimersByTimeAsync(600); expect(observed).not.toHaveBeenCalled();
  portal.style.opacity = '1';
  await vi.advanceTimersByTimeAsync(600); expect(observed).toHaveBeenCalledWith({ changed: true, status: 'unverifiable' }); stop();
});
it('ignores unrelated mutations and transient menus that close before settling; times out once', async () => {
  const { observed, stop } = watch(); open();
  await vi.advanceTimersByTimeAsync(100); document.querySelector('#portal')!.replaceChildren();
  for (let i = 0; i < 10; i++) {
    document.querySelector('#noise')!.textContent = `Noise ${i}`;
    await vi.advanceTimersByTimeAsync(100);
  }
  expect(observed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(OBSERVATION_MAX_MS);
  expect(observed).toHaveBeenCalledExactlyOnceWith({ changed: false, status: 'unverifiable' }); stop();
});
it('reports a settled closing as change without verified success', async () => {
  open(); const { observed, stop } = watch(); document.querySelector('#portal')!.replaceChildren();
  await vi.advanceTimersByTimeAsync(600);
  expect(observed).toHaveBeenCalledWith({ changed: true, status: 'unverifiable' }); stop();
});
it('preserves failed explicit checks even when a menu opens', async () => {
  const { observed, stop } = watch({ type: 'target_expanded' }); open();
  await vi.advanceTimersByTimeAsync(600);
  expect(observed).toHaveBeenCalledWith({ changed: true, status: 'not_verified' }); stop();
});
it('stops all callbacks on cancellation or identity change', async () => {
  const first = watch(); first.stop(); open(); await vi.advanceTimersByTimeAsync(6000);
  expect(first.observed).not.toHaveBeenCalled();
  const next = watch(); next.current.mockReturnValue(false); await vi.advanceTimersByTimeAsync(6000);
  expect(next.observed).not.toHaveBeenCalled(); next.stop();
  expect(vi.getTimerCount()).toBe(0);
});
it('does not invent progress for an equivalent re-render of background controls', async () => {
  const { observed, stop } = watch();
  const target = document.querySelector('#target')!;
  target.replaceWith(target.cloneNode(true));
  await vi.advanceTimersByTimeAsync(OBSERVATION_MAX_MS + 100);
  expect(observed).toHaveBeenCalledWith({ changed: false, status: 'unverifiable' }); stop();
});
it('omits hidden/native-select options and never observes private values or disabled-only changes', async () => {
  const { observed, stop } = watch();
  document.querySelector('#portal')!.innerHTML = '<select><option role="option">Native closed option</option></select><div role="menuitem" hidden>Hidden</div><div role="menuitem" aria-disabled="true">Disabled</div><input type="password" value="PRIVATE-PASSWORD"><div contenteditable><div role="option">PRIVATE-EDITABLE</div></div>';
  const inventory = collectElements(document);
  expect(JSON.stringify(inventory.elements)).not.toMatch(/PRIVATE-|Hidden|Native closed option/);
  await vi.advanceTimersByTimeAsync(OBSERVATION_MAX_MS + 200);
  expect(observed).toHaveBeenCalledWith({ changed: false, status: 'unverifiable' }); stop();
});
