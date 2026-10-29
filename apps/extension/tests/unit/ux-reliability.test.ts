import { expect, it, vi } from 'vitest';
import { DEFAULT_AI_PREFERENCES, readAiPreferences } from '../../src/lib/preferences';
import { createTabAccess } from '../../src/lib/tab-access';
import { aiServiceError } from '../../src/lib/ai-errors';

it('unknown, missing, incomplete and unfinished consent records authorize no sharing', () => {
  for (const value of [null, {}, { version: 2, onboardingComplete: true, guidance: true, selectedText: true },
    { version: 1, onboardingComplete: true, guidance: true },
    { ...DEFAULT_AI_PREFERENCES, guidance: true, selectedText: true },
    { ...DEFAULT_AI_PREFERENCES, extra: true }]) {
    expect(readAiPreferences(value)).toMatchObject({ guidance: false, selectedText: false });
  }
  expect(readAiPreferences({ ...DEFAULT_AI_PREFERENCES, onboardingComplete: true, selectedText: true }))
    .toMatchObject({ guidance: false, selectedText: true });
});

it('worker recreation retains activation intent, but real access failure and cross-origin navigation revoke it', async () => {
  const data = new Map<string, unknown>();
  const storage = { read: async (key: string) => data.get(key),
    write: async (key: string, origin: string) => { data.set(key, origin); },
    remove: async (key: string) => { data.delete(key); }, probe: vi.fn(async (tabId: number) => { expect(tabId).toBe(1); }) };
  const first = createTabAccess(storage);
  expect(await first.allows(1, 'https://example.com')).toBe(false);
  expect(storage.probe).not.toHaveBeenCalled();
  await first.activate(1, 'https://example.com/private-path?secret=fake');
  const restarted = createTabAccess(storage);
  await restarted.navigation(1, 'https://example.com/next');
  expect(await restarted.allows(1, 'https://example.com/next')).toBe(true);
  expect(JSON.stringify([...data])).not.toMatch(/private-path|secret|fake/);
  storage.probe.mockRejectedValueOnce(new Error('Chrome denied scripting'));
  expect(await restarted.allows(1, 'https://example.com')).toBe(false);
  expect(data.size).toBe(0);
  await restarted.activate(1, 'https://example.com');
  await restarted.navigation(1, 'https://other.example');
  expect(await restarted.allows(1, 'https://example.com')).toBe(false);
  await restarted.activate(1, 'https://example.com'); await restarted.remove(1);
  expect(data.size).toBe(0);
});

it('storage failure never authorizes access; concurrent activation and navigation leave no stale grant', async () => {
  const data = new Map<string, unknown>();
  const storage = { read: async (key: string) => data.get(key),
    write: async (key: string, origin: string) => { data.set(key, origin); },
    remove: async (key: string) => { data.delete(key); }, probe: vi.fn(async () => undefined) };
  const access = createTabAccess(storage);
  await Promise.all([access.activate(1, 'https://example.com'), access.navigation(1, 'https://other.example')]);
  expect(await access.allows(1, 'https://example.com')).toBe(false);
  expect(storage.probe).not.toHaveBeenCalled();
  const broken = createTabAccess({ ...storage, read: async () => { throw new Error('unavailable'); } });
  expect(await broken.allows(1, 'https://example.com')).toBe(false);
});

it('an unresponsive tab access probe does not block another tab', async () => {
  const data = new Map<string, unknown>();
  let release!: () => void;
  const stalled = new Promise<void>((resolve) => { release = resolve; });
  const access = createTabAccess({ read: async (key) => data.get(key),
    write: async (key, origin) => { data.set(key, origin); }, remove: async (key) => { data.delete(key); },
    probe: async (tabId) => { if (tabId === 1) await stalled; } });
  await access.activate(1, 'https://example.com');
  const first = access.allows(1, 'https://example.com');
  await access.activate(2, 'https://other.example');
  expect(await access.allows(2, 'https://other.example')).toBe(true);
  release(); expect(await first).toBe(true);
});

it('service errors use plain messages and preserve only fixed diagnostic codes', () => {
  expect(aiServiceError('provider_unavailable').message).toContain('Choose a provider');
  expect(aiServiceError('invalid_reply').cause).toBe('invalid_reply');
  expect(aiServiceError('rate_limited').message).toContain('usage limit');
});
