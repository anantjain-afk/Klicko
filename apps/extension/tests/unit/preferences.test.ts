import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AI_PREFERENCES_KEY, DEFAULT_AI_PREFERENCES } from '../../src/lib/preferences';
import { useAiPreferences } from '../../src/features/settings/useAiPreferences';

type StorageListener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;
const storage = vi.hoisted(() => ({
  get: vi.fn<() => Promise<Record<string, unknown>>>(),
  set: vi.fn<(value: Record<string, unknown>) => Promise<void>>(),
  listeners: new Set<StorageListener>(),
}));
vi.mock('wxt/browser', () => ({ browser: { storage: {
  local: { get: storage.get, set: storage.set },
  onChanged: { addListener: (listener: StorageListener) => storage.listeners.add(listener),
    removeListener: (listener: StorageListener) => storage.listeners.delete(listener) },
} } }));

let root: Root;
let sharing: ReturnType<typeof useAiPreferences>;
function Harness() { sharing = useAiPreferences(); return null; }
function notify(value: unknown) { for (const listener of storage.listeners) listener({ [AI_PREFERENCES_KEY]: { newValue: value } }, 'local'); }

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  storage.get.mockReset(); storage.set.mockReset(); storage.listeners.clear();
  storage.get.mockResolvedValue({ [AI_PREFERENCES_KEY]: { ...DEFAULT_AI_PREFERENCES, onboardingComplete: true } });
  storage.set.mockImplementation(async (value) => { notify(value[AI_PREFERENCES_KEY]); });
  root = createRoot(document.createElement('div'));
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

it('granting waits for saved consent; failed revocation stays off and can be retried', async () => {
  await act(async () => root.render(createElement(Harness)));
  let finish!: () => void;
  storage.set.mockImplementationOnce((value) => new Promise<void>((resolve) => {
    finish = () => { notify(value[AI_PREFERENCES_KEY]); resolve(); };
  }));
  let pending!: Promise<void>;
  act(() => { pending = sharing.save({ guidance: true }); });
  expect(sharing.preferences.guidance).toBe(true);
  expect(sharing.guidanceConsent).toBe(false);
  await act(async () => { finish(); await pending; });
  expect(sharing.guidanceConsent).toBe(true);
  storage.set.mockRejectedValueOnce(new Error('Storage unavailable'));
  await act(async () => { await sharing.save({ guidance: false }); });
  expect(sharing.guidanceConsent).toBe(false);
  expect(sharing.error).toContain('Couldn’t save');
  await act(async () => { await sharing.save({}); });
  expect(storage.set.mock.calls.at(-1)?.[0][AI_PREFERENCES_KEY]).toMatchObject({ guidance: false, selectedText: false });
  expect(sharing.error).toBe('');
});

it('loading blocks sharing and a late initial read cannot undo a newer revocation', async () => {
  let finish!: (value: Record<string, unknown>) => void;
  storage.get.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await act(async () => root.render(createElement(Harness)));
  expect(sharing.ready).toBe(false); expect(sharing.guidanceConsent).toBe(false);
  await act(async () => {
    notify({ ...DEFAULT_AI_PREFERENCES, onboardingComplete: true });
    finish({ [AI_PREFERENCES_KEY]: { ...DEFAULT_AI_PREFERENCES, onboardingComplete: true, guidance: true, selectedText: true } });
  });
  expect(sharing.ready).toBe(true);
  expect(sharing.guidanceConsent).toBe(false); expect(sharing.textConsent).toBe(false);
});
