import { describe, expect, it } from 'vitest';
import { CHECKPOINT_TTL_MS, createCheckpointStore, isCheckpoint, isCheckpointCommand, type Checkpoint } from '../../src/features/session/checkpoint';

function setup() {
  let value: unknown;
  let exists = true;
  let fail = false;
  let wait: Promise<void> | undefined;
  const store = createCheckpointStore({
    read: async () => { if (fail) throw new Error('unavailable'); return value; },
    write: async (next) => { if (wait) await wait; if (fail) throw new Error('unavailable'); value = structuredClone(next); },
    remove: async () => { if (fail) throw new Error('unavailable'); value = undefined; },
    tabExists: async () => exists,
  });
  store.claim('owner');
  const set = (revision: number, sessionId = 'task') => store.apply('owner', { type: 'CHECKPOINT_SET', sessionId, tabId: 1, revision });
  return { store, set, value: () => value, corrupt: (next: unknown) => { value = next; },
    missingTab: () => { exists = false; }, fail: () => { fail = true; }, delay: (next: Promise<void>) => { wait = next; } };
}

describe('minimal trusted interruption checkpoints', () => {
  it('stores only allowed metadata; disconnect leaves a restart marker, never task text', async () => {
    const { store, set, value } = setup();
    await set(1);
    expect(Object.keys(value() as object).sort()).toEqual(['version', 'ownerId', 'sessionId', 'tabId', 'status', 'revision', 'expiresAt'].sort());
    expect(isCheckpoint(value())).toBe(true);
    await store.disconnect('owner');
    expect((value() as Checkpoint).status).toBe('interrupted');
    expect(await store.notice()).toBe(true);
  });
  it('strictly rejects unknown fields, expired/future/version/missing-tab records', async () => {
    const h = setup(); await h.set(1); const valid = h.value() as Checkpoint;
    for (const bad of [null, { ...valid, goal: 'PRIVATE' }, { ...valid, version: 2 }, { ...valid, tabId: -1 },
      { ...valid, revision: 1.5 }, { ...valid, expiresAt: Date.now() - 1 }, { ...valid, expiresAt: Date.now() + CHECKPOINT_TTL_MS * 2 }]) {
      h.corrupt(bad); expect(await h.store.notice()).toBe(false); expect(h.value()).toBeUndefined();
    }
    h.corrupt(valid); h.missingTab(); expect(await h.store.notice()).toBe(false);
  });
  it('rejects unknown/unbounded commands', () => {
    for (const bad of [null, { type: 'CHECKPOINT_SET', sessionId: 'task', tabId: 1, revision: 1, goal: 'PRIVATE' },
      { type: 'CHECKPOINT_CLEAR', sessionId: 'x'.repeat(81), revision: 2 }]) expect(isCheckpointCommand(bad)).toBe(false);
  });
  it('ignores old owners and revisions after replacement', async () => {
    const h = setup(); await h.set(1);
    await h.store.apply('owner', { type: 'CHECKPOINT_CLEAR', sessionId: 'task', revision: 3 });
    expect(await h.set(2)).toBe(false); expect(h.value()).toBeUndefined();
    h.store.claim('replacement');
    await h.store.apply('replacement', { type: 'CHECKPOINT_SET', sessionId: 'new-task', tabId: 2, revision: 1 });
    await h.store.disconnect('owner'); expect(await h.set(4)).toBe(false);
    expect((h.value() as Checkpoint).sessionId).toBe('new-task');
  });
  it('serializes a delayed write before Stop so it cannot resurrect the marker', async () => {
    const h = setup(); let finish!: () => void;
    h.delay(new Promise<void>((resolve) => { finish = resolve; }));
    const pending = h.set(1); await Promise.resolve(); await Promise.resolve();
    const clear = h.store.apply('owner', { type: 'CHECKPOINT_CLEAR', sessionId: 'task', revision: 2 });
    finish(); await pending; await clear;
    expect(h.value()).toBeUndefined();
    await h.store.disconnect('owner'); expect(await h.set(3)).toBe(false);
    expect(h.value()).toBeUndefined();
  });
  it('clears tab closures and reports storage failure', async () => {
    const h = setup(); await h.set(1); await h.store.removeTab(1);
    expect(h.value()).toBeUndefined(); expect(await h.set(2)).toBe(false);
    const broken = setup(); broken.fail();
    await expect(broken.set(1)).rejects.toThrow('unavailable');
    await expect(broken.store.notice()).rejects.toThrow('unavailable');
  });
});
