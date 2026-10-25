import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PAGE_MAX_WAIT_MS, PAGE_SETTLE_MS, settlePage } from '../../src/features/observer/settle-page';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button>Settings</button><p id="noise"></p>';
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
    DOMRect.fromRect({ x: 20, y: 30, width: 100, height: 40 }));
  Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => [] });
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('waits for eligible controls to settle while ignoring unrelated prose', async () => {
  const done = vi.fn();
  void settlePage(document, new AbortController().signal).then(done);
  await vi.advanceTimersByTimeAsync(200);
  document.body.insertAdjacentHTML('beforeend', '<button>Domains</button>');
  for (let i = 0; i < 4; i++) {
    document.getElementById('noise')!.textContent = `Noise ${i}`;
    await vi.advanceTimersByTimeAsync(100);
  }
  expect(done).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(PAGE_SETTLE_MS);
  expect(done).toHaveBeenCalledExactlyOnceWith(true);
  expect(vi.getTimerCount()).toBe(0);
});
it('bounds loading waits and releases timers without claiming readiness', async () => {
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  const pending = settlePage(document, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(PAGE_MAX_WAIT_MS);
  expect(await pending).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it('immediately cancels inspection, including an already aborted attempt', async () => {
  const abort = new AbortController();
  const pending = settlePage(document, abort.signal);
  abort.abort(); expect(await pending).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  expect(await settlePage(document, abort.signal)).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
