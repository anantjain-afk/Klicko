import { describe, expect, it, vi } from 'vitest';
import { createTaskCoordinator } from '../../src/features/session/coordinator';
import { createTaskRecoveryStore, isTaskRecovery, TASK_TTL_MS, type TaskRecovery } from '../../src/features/session/task-recovery';
import { DEFAULT_AI_PREFERENCES } from '../../src/lib/preferences';
import { isTaskCommand, isTaskView, type TaskCommand } from '../../src/lib/task-messages';
import type { SessionClient } from '../../src/features/session/session';
import { clampBuddy, defaultBuddyPosition, popupPosition } from '../../src/features/buddy/position';

const preferences = { ...DEFAULT_AI_PREFERENCES, onboardingComplete: true, guidance: true };
const snapshot = { pageKey: 'page', snapshotId: 'snapshot', elements: [
  { id: 'el_1', role: 'button', name: 'Settings', context: 'Navigation', disabled: false, rect: { x: 10, y: 10, width: 60, height: 30 } },
] };
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
function setup(saved: TaskRecovery | null = null) {
  let record: TaskRecovery | null = saved;
  const ask = vi.fn<NonNullable<SessionClient['ask']>>(async (_tabId, page, _goal, identity) => ({
    protocolVersion: 3, ...identity, pageKey: page.pageKey, snapshotId: page.snapshotId,
    result: { kind: 'answer', message: 'Settings controls your preferences.' },
  }));
  const clear = vi.fn(async () => ({ ok: true }));
  const client = { guidance: { inspect: vi.fn(async (requestId: number) => ({ type: 'INSPECTION_RESULT', requestId, tabId: 7, snapshot })),
    track: vi.fn(), ask, highlight: vi.fn(async () => ({ type: 'OVERLAY_RESULT', ok: true })), clear },
  textPost: vi.fn(), askText: vi.fn(async () => null), save: vi.fn(async (value: TaskRecovery | null) => { record = value; }), saveFlags: vi.fn(async () => undefined) };
  const task = createTaskCoordinator(7, client, preferences, { buddyVisible: true, textEnabled: false }, saved);
  function command(action: TaskCommand['action'], goal?: string) {
    const view = task.snapshot();
    return { type: 'TASK_COMMAND' as const, id: crypto.randomUUID(), epoch: view.epoch, taskId: view.taskId, action, ...(goal ? { goal } : {}) };
  }
  return { task, client, ask, command, record: () => record };
}

describe('shared per-tab task authority', () => {
  it('two subscribers share one request; detaching one does not end it; duplicate/stale commands do not restart it', async () => {
    const { task, ask, command } = setup();
    const buddy = vi.fn(); const panel = vi.fn(); const detach = task.subscribe(panel); task.subscribe(buddy);
    const start = command('start', 'Open Settings');
    await task.command(start); await task.command(start); detach(); await flush();
    expect(ask).toHaveBeenCalledOnce();
    expect(task.snapshot().messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(buddy.mock.calls.at(-1)?.[0].state.kind).toBe('answer');
    expect(isTaskView(task.snapshot())).toBe(true);
    await task.command({ ...start, id: crypto.randomUUID() }); expect(ask).toHaveBeenCalledOnce();
    task.dispose();
  });
  it('minimal recovery restores the original task paused without asking or highlighting until Continue', async () => {
    const first = setup(); await first.task.command(first.command('start', 'Open Settings')); await flush();
    const saved = first.record()!; expect(isTaskRecovery(saved, 7)).toBe(true);
    expect(Object.keys(saved).sort()).toEqual(['context', 'expiresAt', 'goal', 'requestId', 'sessionId', 'status', 'summary', 'tabId', 'version']);
    expect(JSON.stringify(saved)).not.toMatch(/el_1|snapshot|rect|Navigation|elements|selectedText/);
    const restored = setup(saved);
    expect(restored.ask).not.toHaveBeenCalled(); expect(restored.client.guidance.highlight).not.toHaveBeenCalled();
    expect(restored.task.snapshot()).toMatchObject({ goal: 'Open Settings', state: { kind: 'connection_paused', canContinue: true } });
    await restored.task.command(restored.command('continue')); await flush();
    expect(restored.ask).toHaveBeenCalledOnce();
    expect(restored.ask.mock.calls[0]?.[2]).toBe('Open Settings');
    expect(restored.ask.mock.calls[0]?.[3].sessionId).toBe(saved.sessionId);
    first.task.dispose(); restored.task.dispose();
  });
  it('Stop and revocation cancel pending work, erase recovery and reject late answers', async () => {
    const { task, ask, command, record } = setup(); let finish!: (value: unknown) => void;
    ask.mockImplementationOnce((_id, _page, _goal, identity) => new Promise((resolve) => {
      finish = (result) => resolve({ protocolVersion: 3, ...identity, pageKey: 'page', snapshotId: 'snapshot', result });
    }));
    await task.command(command('start', 'Open Settings')); await flush();
    expect(record()).not.toBeNull();
    await task.command(command('stop')); await flush();
    expect(ask.mock.calls[0]?.[4].aborted).toBe(true); expect(record()).toBeNull();
    finish({ kind: 'answer', message: 'A late answer' }); await flush();
    expect(task.snapshot().messages.some((m) => m.text === 'A late answer')).toBe(false);
    await task.command(command('start', 'Open Settings')); await flush();
    task.preferences({ ...preferences, guidance: false }); await flush();
    expect(record()).toBeNull(); expect(task.snapshot().active).toBe(false);
    task.dispose();
  });
});

it('recovery rejects extra/sensitive/expired fields; delayed writes cannot resurrect a cleared task', async () => {
  const { task, command, record } = setup(); await task.command(command('start', 'Open Settings')); await flush();
  const saved = record()!;
  for (const value of [{ ...saved, targetId: 'el_1' }, { ...saved, goal: 'person@example.com' },
    { ...saved, expiresAt: Date.now() - 1 }, { ...saved, expiresAt: Date.now() + TASK_TTL_MS + 1000 }]) expect(isTaskRecovery(value, 7)).toBe(false);
  const data = new Map<string, unknown>();
  const store = createTaskRecoveryStore({ read: async (key) => data.get(key), write: async (key, value) => { data.set(key, value); }, remove: async (key) => { data.delete(key); } });
  await Promise.all([store.save(7, saved), store.save(7, null)]); expect(await store.read(7)).toBeNull();
  task.dispose();
});
it('buddy and popup positions clamp to the visible viewport; invalid commands cannot carry page data', () => {
  const viewport = { left: 10, top: 20, width: 300, height: 400 };
  expect(defaultBuddyPosition(viewport)).toEqual({ x: 246, y: 356 });
  expect(clampBuddy({ x: -1000, y: 1000 }, viewport)).toEqual({ x: 22, y: 364 });
  expect(popupPosition({ x: 290, y: 30 }, { width: 250, height: 200 }, viewport)).toEqual({ x: 48, y: 86 });
  expect(isTaskCommand({ type: 'TASK_COMMAND', action: 'start', epoch: crypto.randomUUID(), taskId: crypto.randomUUID(), id: crypto.randomUUID(), goal: 'Hello', selectedText: 'private' })).toBe(false);
});
