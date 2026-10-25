import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_STEPS, OBSERVATION_MAX_MS, OBSERVATION_TIMEOUT_GRACE_MS, type TaskContext } from '@clickpilot/shared/guidance';
import { createAssistantSession, type GuidanceState, type SessionClient } from '../../src/features/session/session';
import type { GuidanceIdentity, PageSnapshot } from '../../src/lib/messages';

function setup(nextStep = 'after_user_action', check = false) {
  const states: GuidanceState[] = [];
  let inspection = 0;
  let result: Record<string, unknown> = { kind: 'guidance', targetId: 'el_1', message: 'Open the next control.', instruction: 'Click Settings.', nextStep, ...(check ? { expectedOutcome: { type: 'target_expanded' } } : {}) };
  const client = {
    inspect: vi.fn(async (requestId: number) => ({ type: 'INSPECTION_RESULT', requestId, tabId: 1, snapshot: {
      pageKey: 'page', snapshotId: `snapshot-${++inspection}`,
      elements: [{ id: 'el_1', role: 'button', name: `Control ${inspection}`, context: 'main', disabled: false,
        rect: { x: 0, y: 0, width: 100, height: 30 } }],
    } })),
    track: vi.fn(), clear: vi.fn(async () => ({ ok: true })),
    highlight: vi.fn(async () => ({ type: 'OVERLAY_RESULT', ok: true })),
    ask: vi.fn(async (_tabId: number, snapshot: PageSnapshot, _goal: string, identity: GuidanceIdentity,
      _signal: AbortSignal, _context: TaskContext): Promise<unknown> => {
      expect(_signal).toBeInstanceOf(AbortSignal); expect(_context).toBeDefined();
      return { protocolVersion: 3, ...identity, pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId, result };
    }),
  } satisfies SessionClient;
  const session = createAssistantSession(client, (state) => states.push(state));
  function event(type: string, extra = {}) {
    const call = client.ask.mock.calls.at(-1)!;
    return { type, navigationIntent: true, ...call[3], pageKey: call[1].pageKey, snapshotId: call[1].snapshotId, targetId: 'el_1', ...extra };
  }
  function click() { session.onPageEvent(event('GUIDANCE_CLICKED'), 1); }
  async function observed(changed = true, status = 'unverifiable') {
    session.onPageEvent(event('ACTION_OBSERVED', { changed, status }), 1);
    await vi.waitFor(() => expect(states.at(-1)?.kind).not.toBe('observing'));
    await Promise.resolve(); await Promise.resolve();
  }
  return { session, states, client, click, observed, event, result: (value: Record<string, unknown>) => { result = value; } };
}
afterEach(() => vi.useRealTimers());

describe('bounded AI continuation', () => {
  it('retains the original goal with fresh snapshots and only the immediately previous action', async () => {
    const { session, client, states, click, observed } = setup('after_user_action', true);
    await session.start('Change a Vercel domain');
    expect(client.ask.mock.calls[0]![5]).toEqual({ stepNumber: 1, previousStep: null });
    click(); await observed();
    expect(client.ask.mock.calls).toHaveLength(2);
    expect(client.ask.mock.calls[1]![2]).toBe('Change a Vercel domain');
    expect(client.ask.mock.calls[1]![5]).toEqual({ stepNumber: 2,
      previousStep: { action: 'Click Settings.', event: 'trusted_click', status: 'unverifiable' } });
    click(); await observed(true, 'verified');
    expect(client.ask.mock.calls[2]![5]).toEqual({ stepNumber: 3,
      previousStep: { action: 'Click Settings.', event: 'trusted_click', status: 'verified' } });
    expect(new Set(client.ask.mock.calls.map((call) => call[1].snapshotId)).size).toBe(3);
    expect(states.at(-1)).toMatchObject({ kind: 'waiting', previousStatus: 'verified' });
    session.dispose();
  });

  it('none keeps final guidance and never requests another step even after a verified changed page', async () => {
    const { session, client, states, click, observed } = setup('none', true);
    await session.start('Show Settings');
    click(); await observed(true, 'verified');
    expect(client.ask).toHaveBeenCalledOnce();
    expect(states.at(-1)).toMatchObject({ kind: 'clicked', message: expect.stringContaining('Overall task completion is not verified') });
    session.confirmComplete();
    expect(states.at(-1)).toMatchObject({ kind: 'confirmed', message: 'Task completion confirmed by you.' });
  });

  it.each(['answer', 'clarification', 'unsupported'])('text-only %s never automatically continues', async (kind) => {
    const { session, client, states, result, click, observed } = setup();
    result({ kind, message: 'A text reply.' });
    await session.start('Question'); click(); await observed();
    expect(states.at(-1)?.kind).toBe(kind);
    expect(client.ask).toHaveBeenCalledOnce();
    session.dispose();
  });

  it.each([[false, 'unverifiable'], [true, 'not_verified']])('pauses for no progress or failed checks (%s, %s)', async (changed, status) => {
    const { session, states, client, click, observed } = setup();
    await session.start('Change a Vercel domain'); click(); await observed(Boolean(changed), String(status));
    expect(states.at(-1)?.kind).toBe('recovery');
    expect(client.ask).toHaveBeenCalledOnce();
    await session.continueManually();
    expect(client.ask.mock.calls[1]![5].previousStep?.status).toBe('user_confirmed');
    expect(client.ask.mock.calls[1]![2]).toBe('Change a Vercel domain');
    session.dispose();
  });

  it('ignores unrelated, stale, duplicate or out-of-order observations', async () => {
    const { session, client, click, event, observed } = setup();
    await session.start('Task');
    const early = event('ACTION_OBSERVED', { changed: true, status: 'verified' });
    session.onPageEvent(early, 1);
    session.onPageEvent(event('GUIDANCE_CLICKED', { targetId: 'el_2' }), 1);
    session.onPageEvent(event('GUIDANCE_CLICKED', { requestId: 999 }), 1);
    expect(client.ask).toHaveBeenCalledOnce();
    click(); await observed();
    session.onPageEvent(early, 1);
    expect(client.ask).toHaveBeenCalledTimes(2);
    session.dispose();
  });

  it('Retry replaces the attempt without changing the goal, step or previous action/status', async () => {
    const { session, client, click, observed } = setup();
    await session.start('Original goal'); click(); await observed(false);
    const oldRequest = client.ask.mock.calls[0]![3];
    await session.retry();
    expect(client.ask.mock.calls[1]![2]).toBe('Original goal');
    expect(client.ask.mock.calls[1]![5].stepNumber).toBe(1);
    expect(client.ask.mock.calls[1]![5].previousStep?.status).toBe('unverifiable');
    expect(client.ask.mock.calls[1]![3].requestId).toBeGreaterThan(oldRequest.requestId);
    session.dispose();
  });

  it('enforces the step ceiling across retries and manual continuation', async () => {
    const { session, client, states, click, observed } = setup();
    await session.start('Long task');
    for (let index = 1; index <= MAX_STEPS; index++) { click(); await observed(); }
    expect(client.ask).toHaveBeenCalledTimes(MAX_STEPS);
    expect(states.at(-1)).toMatchObject({ kind: 'paused', message: expect.stringContaining('20-step limit') });
    expect(session.isActive()).toBe(false);
    await session.continueManually();
    expect(client.ask).toHaveBeenCalledTimes(MAX_STEPS);
  });

  it('pauses repeated identical guidance on unchanged inventory instead of looping', async () => {
    const { session, client, states, click, observed } = setup();
    const inspect = client.inspect.getMockImplementation()!;
    client.inspect.mockImplementation(async (id) => {
      const value = await inspect(id); value.snapshot.elements[0]!.name = 'Settings'; return value;
    });
    await session.start('Task'); click(); await observed(false);
    await session.continueManually();
    expect(states.at(-1)).toMatchObject({ kind: 'recovery', message: expect.stringContaining('same guidance') });
    expect(client.highlight).toHaveBeenCalledOnce();
    session.dispose();
  });

  it.each(['stop', 'dispose', 'navigate', 'replace'])('clears context and rejects an observation after %s', async (action) => {
    const { session, client, click, event } = setup();
    await session.start('Old goal'); click();
    const late = event('ACTION_OBSERVED', { changed: true, status: 'verified' });
    if (action === 'stop') session.stop();
    if (action === 'dispose') session.dispose();
    if (action === 'navigate') session.pause('Page changed');
    if (action === 'replace') await session.start('New goal');
    const calls = client.ask.mock.calls.length;
    session.onPageEvent(late, 1);
    expect(client.ask).toHaveBeenCalledTimes(calls);
    if (action !== 'replace') await session.start('New goal');
    expect(client.ask.mock.calls.at(-1)![5]).toEqual({ stepNumber: 1, previousStep: null });
    expect(client.ask.mock.calls.at(-1)![2]).toBe('New goal');
    session.dispose();
  });

  it('uses bounded observation timeout with no automatic request', async () => {
    vi.useFakeTimers();
    const { session, states, client, click } = setup();
    await session.start('Task'); click();
    await vi.advanceTimersByTimeAsync(OBSERVATION_MAX_MS + OBSERVATION_TIMEOUT_GRACE_MS + 1);
    expect(states.at(-1)).toMatchObject({ kind: 'recovery', message: expect.stringContaining('timed out') });
    expect(client.ask).toHaveBeenCalledOnce();
    session.stop(); await vi.advanceTimersByTimeAsync(10_000);
    expect(states.at(-1)?.kind).toBe('stopped');
  });
});

describe('surviving task recovery', () => {
  it('coalesces navigation signals, keeps the goal, advances once and records unload as unverified', async () => {
    const { session, client, click, states } = setup('after_user_action', true);
    await session.start('Change a Vercel domain'); click();
    session.navigation(1); session.navigation(1); session.navigation(1);
    await session.resumeNavigation(); await session.resumeNavigation();
    expect(client.ask).toHaveBeenCalledTimes(2);
    expect(client.ask.mock.calls[1]![2]).toBe('Change a Vercel domain');
    expect(client.ask.mock.calls[1]![5]).toEqual({ stepNumber: 2, previousStep: {
      action: 'Click Settings.', event: 'trusted_click', status: 'unverifiable',
    } });
    expect(states.at(-1)?.kind).toBe('waiting');
    session.dispose();
  });

  it.each(['manual', 'cross-origin', 'failed-check', 'final', 'answer'])('%s navigation waits for explicit Continue and keeps the same step', async (mode) => {
    const { session, client, click, observed, result, states } = setup(mode === 'final' ? 'none' : 'after_user_action', true);
    if (mode === 'answer') result({ kind: 'answer', message: 'A text answer.' });
    await session.start('Original goal');
    if (['cross-origin', 'failed-check', 'final'].includes(mode)) click();
    if (mode === 'failed-check') await observed(true, 'not_verified');
    session.navigation(1, mode !== 'cross-origin');
    await session.resumeNavigation();
    expect(client.ask).toHaveBeenCalledOnce();
    expect(states.at(-1)).toMatchObject({ kind: 'paused', canContinue: true });
    await session.continueTask();
    expect(client.ask.mock.calls[1]![2]).toBe('Original goal');
    expect(client.ask.mock.calls[1]![5].stepNumber).toBe(1);
    if (mode === 'failed-check') expect(client.ask.mock.calls[1]![5].previousStep?.status).toBe('not_verified');
    session.dispose();
  });

  it('ignores the old provider reply after navigation and retries the allocated step', async () => {
    const { session, client, states } = setup();
    const ask = client.ask.getMockImplementation()!;
    let finish!: () => void;
    client.ask.mockImplementationOnce(async (...args) => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return ask(...args);
    });
    const pending = session.start('Exact original goal');
    await vi.waitFor(() => expect(client.ask).toHaveBeenCalledOnce());
    session.navigation(1); await session.resumeNavigation();
    finish(); await pending;
    expect(client.highlight).not.toHaveBeenCalled();
    expect(states.at(-1)?.kind).toBe('paused');
    await session.continueTask();
    expect(client.ask.mock.calls[1]![5].stepNumber).toBe(1);
    expect(client.ask.mock.calls[1]![2]).toBe('Exact original goal');
    expect(client.ask.mock.calls[1]![3].requestId).toBeGreaterThan(client.ask.mock.calls[0]![3].requestId);
    session.dispose();
  });

  it('worker disconnect and tab change retain task ownership; Stop removes it', async () => {
    const { session, client, states } = setup();
    await session.start('Exact original goal');
    session.suspend('Worker disconnected', true);
    expect(states.at(-1)?.kind).toBe('connection_paused');
    expect(session.ownedTab()).toBe(1);
    await session.continueTask();
    expect(client.ask.mock.calls[1]![2]).toBe('Exact original goal');
    session.suspend('Tab changed');
    session.stop(); await session.continueTask();
    expect(client.ask).toHaveBeenCalledTimes(2);
    await session.start('New goal');
    expect(client.ask.mock.calls[2]![5]).toEqual({ stepNumber: 1, previousStep: null });
    session.dispose();
  });

  it('repeated navigation has a finite budget and late navigation cannot revive Stop', async () => {
    const { session, client, states, click } = setup();
    await session.start('Original'); click();
    for (let i = 0; i < 20; i++) session.navigation(1);
    await session.resumeNavigation();
    expect(states.at(-1)).toMatchObject({ kind: 'paused', canContinue: true });
    expect(client.ask).toHaveBeenCalledOnce();
    session.stop(); session.navigation(1); await session.resumeNavigation();
    expect(states.at(-1)?.kind).toBe('stopped');
  });
});

it('requires explicit continuation for navigation unrelated to the clicked control', async () => {
  const { session, client, states, event } = setup();
  await session.start('Original goal');
  session.onPageEvent(event('GUIDANCE_CLICKED', { navigationIntent: false }), 1);
  session.navigation(1); await session.resumeNavigation();
  expect(client.ask).toHaveBeenCalledOnce();
  expect(states.at(-1)).toMatchObject({ kind: 'paused', canContinue: true });
  await session.continueTask();
  expect(client.ask.mock.calls[1]![2]).toBe('Original goal');
  expect(client.ask.mock.calls[1]![5].stepNumber).toBe(1);
  session.dispose();
});

it('fresh recovery accepts a new document but never silently binds another tab', async () => {
  const { session, client, states } = setup();
  const inspect = client.inspect.getMockImplementation()!;
  await session.start('Bound goal'); session.suspend('Tab changed');
  client.inspect.mockImplementationOnce(async (id) => ({ ...await inspect(id), tabId: 2 }));
  await session.continueTask(); expect(client.ask).toHaveBeenCalledOnce();
  expect(session.ownedTab()).toBe(1);
  expect(states.at(-1)).toMatchObject({ kind: 'paused', canContinue: true });
  client.inspect.mockImplementationOnce(async (id) => {
    const next = await inspect(id); next.snapshot.pageKey = 'new-document'; return next;
  });
  await session.continueTask();
  expect(client.ask.mock.calls[1]![1].pageKey).toBe('new-document');
  expect(client.ask.mock.calls[1]![2]).toBe('Bound goal');
  session.dispose();
});
