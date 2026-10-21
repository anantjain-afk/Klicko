import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMockFixtureUrl, isMockSelection, selectMockTarget } from '../../src/features/session/mock';
import { createMockSession, type GuidanceState } from '../../src/features/session/session';
import type { GuidanceIdentity, PageSnapshot } from '../../src/lib/messages';

function snapshot(id = 'snapshot'): PageSnapshot {
  return {
    pageKey: 'page', snapshotId: id, mockFixture: true,
    elements: [
      ['Primary target', 'main'], ['Profile', 'Main navigation'], ['Settings', 'Main navigation'], ['Settings', 'Preferences'],
    ].map(([name, context], index) => ({
      id: `el_${index + 1}`, name: name!, context: context!, role: 'button', disabled: false,
      rect: { x: 20, y: 20, width: 100, height: 40 },
    })),
  };
}

function setup() {
  const states: GuidanceState[] = [];
  let identity: GuidanceIdentity | undefined;
  const client = {
    inspect: vi.fn(async (requestId: number) => ({
      type: 'INSPECTION_RESULT', requestId, tabId: 1, snapshot: snapshot(`snapshot-${requestId}`),
    })),
    track: vi.fn(),
    highlight: vi.fn(async (_tabId: number, _snapshot: PageSnapshot, _targetId: string, _instruction: string, request: GuidanceIdentity) => {
      identity = request;
      return { type: 'OVERLAY_RESULT', ok: true };
    }),
    clear: vi.fn(async () => ({ ok: true })),
  };
  const session = createMockSession(client, (state) => states.push(state));
  const click = () => ({ type: 'GUIDANCE_CLICKED', ...identity, pageKey: 'page', snapshotId: `snapshot-${identity!.requestId}`, targetId: 'el_1' });
  return { client, session, states, click };
}

afterEach(() => vi.useRealTimers());

describe('fixture mock selection', () => {
  it('only supports the explicit local fixture URL', () => {
    expect(isMockFixtureUrl('http://127.0.0.1:4173/guidance.html')).toBe(true);
    expect(isMockFixtureUrl('http://localhost:4173/guidance.html#changed')).toBe(true);
    for (const url of ['https://example.com/guidance.html', 'http://127.0.0.1:8000/guidance.html', 'http://127.0.0.1:4173/index.html']) {
      expect(isMockFixtureUrl(url)).toBe(false);
    }
    expect(selectMockTarget({ ...snapshot(), mockFixture: false }, 'find primary target').kind).toBe('unsupported');
  });

  it('selects exact IDs and distinguishes ambiguous, missing and unknown tasks', () => {
    expect(selectMockTarget(snapshot(), ' FIND   NAVIGATION SETTINGS? ')).toMatchObject({ kind: 'highlight', targetId: 'el_3' });
    expect(selectMockTarget(snapshot(), 'find dialog settings')).toMatchObject({ targetId: 'el_4' });
    expect(selectMockTarget(snapshot(), 'find settings').kind).toBe('clarification');
    expect(selectMockTarget(snapshot(), 'delete everything').kind).toBe('unsupported');
    const hidden = snapshot();
    hidden.elements = hidden.elements.filter((element) => element.name !== 'Profile');
    expect(selectMockTarget(hidden, 'find profile').kind).toBe('missing');
    hidden.elements[0]!.disabled = true;
    expect(selectMockTarget(hidden, 'find primary target').kind).toBe('missing');
  });

  it('rejects malformed or executable mock output', () => {
    for (const result of [null, { kind: 'execute', script: 'click()' }, { kind: 'highlight', targetId: '#selector', instruction: 'Use it' }, { kind: 'highlight', targetId: 'el_1', instruction: 42 }]) {
      expect(isMockSelection(result)).toBe(false);
    }
  });
});

describe('single-step session', () => {
  it('observes, selects and waits; acknowledges only matching clicks without completion', async () => {
    const { session, client, states, click } = setup();
    await session.start('find primary target', 'normal');
    expect(states.map((state) => state.kind)).toEqual(['observing', 'selecting', 'highlighting', 'waiting']);
    session.onPageEvent({ ...click(), requestId: 999 }, 1);
    session.onPageEvent({ ...click(), sessionId: 'old-session' }, 1);
    session.onPageEvent({ ...click(), targetId: 'el_2' }, 1);
    session.onPageEvent(click(), 2);
    expect(states.at(-1)?.kind).toBe('waiting');
    session.onPageEvent(click(), 1);
    expect(states.at(-1)).toMatchObject({ kind: 'clicked', message: expect.stringContaining('has not verified') });
    expect(client.clear).toHaveBeenCalledOnce();
    expect(session.isActive()).toBe(false);
  });

  it('does not highlight ambiguous, missing or unsupported requests', async () => {
    const { session, client, states } = setup();
    await session.start('find settings', 'normal');
    expect(states.at(-1)?.kind).toBe('clarification');
    await session.start('send a message', 'normal');
    expect(states.at(-1)?.kind).toBe('unsupported');
    await session.start('open help', 'normal');
    expect(states.at(-1)?.kind).toBe('paused');
    expect(client.highlight).not.toHaveBeenCalled();
  });

  it('refreshes once for an invalid ID then highlights a freshly observed target', async () => {
    const { session, client, states } = setup();
    await session.start('find primary target', 'stale-once');
    expect(client.inspect).toHaveBeenCalledTimes(2);
    expect(client.highlight).toHaveBeenCalledOnce();
    expect(states.at(-1)?.kind).toBe('waiting');
    expect(client.highlight.mock.calls[0]![1].snapshotId).toBe('snapshot-3');
  });

  it('stops after exactly one refresh if IDs or live targets remain invalid', async () => {
    const { session, client, states } = setup();
    await session.start('find primary target', 'stale-always');
    expect(client.inspect).toHaveBeenCalledTimes(2);
    expect(client.highlight).not.toHaveBeenCalled();
    expect(states.at(-1)).toMatchObject({ kind: 'paused', message: expect.stringContaining('after one refresh') });
    client.inspect.mockClear();
    client.highlight.mockResolvedValue({ type: 'OVERLAY_RESULT', ok: false });
    await session.start('find primary target', 'normal');
    expect(client.inspect).toHaveBeenCalledTimes(2);
    expect(client.highlight).toHaveBeenCalledTimes(2);
    expect(states.at(-1)?.kind).toBe('paused');
  });

  it('rejects malformed mock output without highlighting or claiming success', async () => {
    const { session, client, states } = setup();
    await session.start('find primary target', 'invalid-output');
    expect(client.inspect).toHaveBeenCalledOnce();
    expect(client.highlight).not.toHaveBeenCalled();
    expect(states.at(-1)?.kind).toBe('error');
  });

  it('cancels delayed selection on Stop and never paints afterward', async () => {
    vi.useFakeTimers();
    const { session, client, states } = setup();
    const pending = session.start('find primary target', 'delayed');
    await vi.advanceTimersByTimeAsync(1);
    session.stop();
    await vi.advanceTimersByTimeAsync(2500);
    await pending;
    expect(client.highlight).not.toHaveBeenCalled();
    expect(states.at(-1)?.kind).toBe('stopped');
  });

  it('a newer request replaces a delayed selection', async () => {
    vi.useFakeTimers();
    const { session, client, states } = setup();
    const previous = session.start('find primary target', 'delayed');
    await vi.advanceTimersByTimeAsync(1);
    await session.start('find profile', 'normal');
    await vi.advanceTimersByTimeAsync(2500);
    await previous;
    expect(client.highlight).toHaveBeenCalledOnce();
    expect(client.highlight.mock.calls[0]![2]).toBe('el_2');
    expect(states.at(-1)).toMatchObject({ kind: 'waiting', instruction: expect.stringContaining('Profile') });
  });

  it('cancels on page invalidation and ignores late results', async () => {
    vi.useFakeTimers();
    const { session, client, states } = setup();
    const pending = session.start('find primary target', 'delayed');
    await vi.advanceTimersByTimeAsync(1);
    session.onPageEvent({ type: 'SNAPSHOT_INVALIDATED', pageKey: 'page', snapshotId: 'snapshot-2' }, 1);
    await vi.advanceTimersByTimeAsync(2500);
    await pending;
    expect(client.highlight).not.toHaveBeenCalled();
    expect(states.at(-1)?.kind).toBe('paused');
  });

  it('scopes cleanup of a late inspection to its old snapshot', async () => {
    const { session, client, states } = setup();
    let resolveInspection!: (value: { type: string; requestId: number; tabId: number; snapshot: PageSnapshot }) => void;
    client.inspect.mockImplementationOnce(() => new Promise((resolve) => { resolveInspection = resolve; }));
    const pending = session.start('find primary target', 'normal');
    await session.start('find profile', 'normal');
    resolveInspection({ type: 'INSPECTION_RESULT', requestId: 2, tabId: 1, snapshot: snapshot('old-snapshot') });
    await pending;
    expect(client.clear).toHaveBeenCalledWith(1, 'old-snapshot');
    expect(client.highlight).toHaveBeenCalledOnce();
    expect(states.at(-1)?.kind).toBe('waiting');
  });

  it('does not return to waiting when a highlight reply arrives after Stop', async () => {
    const { session, client, states } = setup();
    let finishHighlight!: (value: { type: string; ok: boolean }) => void;
    client.highlight.mockImplementationOnce(() => new Promise((resolve) => { finishHighlight = resolve; }));
    const pending = session.start('find primary target', 'normal');
    await Promise.resolve();
    await Promise.resolve();
    expect(states.at(-1)?.kind).toBe('highlighting');
    session.stop();
    finishHighlight({ type: 'OVERLAY_RESULT', ok: true });
    await pending;
    expect(states.at(-1)?.kind).toBe('stopped');
    expect(client.clear).toHaveBeenCalledOnce();
  });
});
