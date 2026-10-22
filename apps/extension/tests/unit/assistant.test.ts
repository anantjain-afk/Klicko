import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAssistant, type AssistantRequest } from '../../src/lib/assistant';
import { createAssistantSession, type GuidanceState, type SessionClient } from '../../src/features/session/session';
import type { GuidanceIdentity, PageSnapshot } from '../../src/lib/messages';

const snapshot: PageSnapshot = { pageKey: 'page', snapshotId: 'snapshot', elements: [
  { id: 'el_1', role: 'button', name: 'Profile', context: 'Navigation', disabled: false, rect: { x: 1, y: 1, width: 100, height: 40 } },
  { id: 'el_2', role: 'button', name: 'person@example.com', context: '', disabled: false, rect: { x: 1, y: 1, width: 100, height: 40 } },
] };
const command: AssistantRequest = { type: 'ASK_ASSISTANT', tabId: 1, sessionId: '7bbf7fc2-9b30-4cf8-9563-66fdacb01d20', requestId: 1, pageKey: 'page', snapshotId: 'snapshot', userGoal: 'Find Profile', taskContext: { stepNumber: 1, previousStep: null } };
const envelope = (result: unknown, identity: GuidanceIdentity = command) => ({ protocolVersion: 3, ...identity, pageKey: 'page', snapshotId: 'snapshot', result });
const answer = { kind: 'answer', message: 'Profile is a visible control.' };
const guidance = { kind: 'guidance', nextStep: 'none', message: 'Open your profile here.', targetId: 'el_1', instruction: 'Click Profile.' };
afterEach(() => vi.unstubAllGlobals());

describe('extension API boundary — mocked fetch only', () => {
  it('filters before upload and sends only current task, site origin and eligible labels', async () => {
    // Deliberately omit command-only fields from the API envelope.
    const fetch = vi.fn(async () => Response.json(envelope(answer, { sessionId: command.sessionId, requestId: command.requestId })));
    vi.stubGlobal('fetch', fetch);
    await requestAssistant(command, snapshot, 'https://example.com/private-path?token=PRIVATE-MARKER#secret', new AbortController().signal);
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8787/v1/guidance/next');
    const body = JSON.parse(init.body as string);
    expect(body.page.url).toBe('https://example.com');
    expect(body.elements).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/person@|PRIVATE-|private-path|rect|viewport|GEMINI_API_KEY|history/);
  });

  it('blocks sensitive pages or questions before upload', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (const url of ['https://example.com/checkout', 'https://example.com/medical/records', 'https://user:secret@example.com']) {
      await expect(requestAssistant(command, snapshot, url, new AbortController().signal)).rejects.toThrow('sensitive');
    }
    await expect(requestAssistant({ ...command, userGoal: 'Use sk-private-marker' }, snapshot, 'https://example.com', new AbortController().signal)).rejects.toThrow('sensitive');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { ...guidance, targetId: 'el_2' }, { ...guidance, targetId: 'el_999' },
    { ...answer, targetId: 'el_1' }, { kind: 'complete', message: 'Done' },
  ])('rejects invalid model output %j again in the extension', async (result) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(envelope(result, { sessionId: command.sessionId, requestId: 1 }))));
    await expect(requestAssistant(command, snapshot, 'https://example.com', new AbortController().signal)).rejects.toThrow('invalid');
  });

  it('blocks sensitive last-action context before upload', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(requestAssistant({ ...command, taskContext: { stepNumber: 2, previousStep: {
      action: 'Use sk-private-marker', event: 'trusted_click', status: 'unverifiable',
    } } }, snapshot, 'https://example.com', new AbortController().signal)).rejects.toThrow('sensitive');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects stale text-only envelopes and oversized responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(envelope(answer, { sessionId: command.sessionId, requestId: 99 }))));
    await expect(requestAssistant(command, snapshot, 'https://example.com', new AbortController().signal)).rejects.toThrow('invalid');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(8193))));
    await expect(requestAssistant(command, snapshot, 'https://example.com', new AbortController().signal)).rejects.toThrow('large');
  });
});

function setup(result: unknown = answer) {
  const states: GuidanceState[] = [];
  const client = {
    inspect: vi.fn(async (requestId: number) => ({ type: 'INSPECTION_RESULT', requestId, tabId: 1, snapshot })),
    track: vi.fn(), clear: vi.fn(async () => ({ ok: true })),
    highlight: vi.fn(async () => ({ type: 'OVERLAY_RESULT', ok: true })),
    ask: vi.fn(async (_tabId: number, _snapshot: PageSnapshot, _task: string, identity: GuidanceIdentity, _signal: AbortSignal) => { expect(_signal).toBeInstanceOf(AbortSignal); return envelope(result, { sessionId: identity.sessionId, requestId: identity.requestId }); }),
  } satisfies SessionClient;
  return { client, states, session: createAssistantSession(client, (state) => states.push(state)) };
}

describe('assistant single-step session', () => {
  it.each(['answer', 'clarification', 'unsupported'])('displays %s without calling the overlay and clears it on navigation', async (kind) => {
    const { session, states, client } = setup({ kind, message: 'Short reply.' });
    await session.start('Question');
    expect(states.at(-1)).toEqual({ kind, message: 'Short reply.' });
    expect(client.highlight).not.toHaveBeenCalled();
    session.onPageEvent({ type: 'SNAPSHOT_INVALIDATED', pageKey: 'page', snapshotId: 'snapshot' }, 1);
    expect(states.at(-1)?.kind).toBe('paused');
  });

  it('only presents guidance narrative once the live highlight is accepted; one refresh maximum', async () => {
    const { session, states, client } = setup(guidance);
    client.highlight.mockResolvedValue({ type: 'OVERLAY_RESULT', ok: false });
    await session.start('Find Profile');
    expect(client.inspect).toHaveBeenCalledTimes(2);
    expect(client.ask).toHaveBeenCalledTimes(2);
    expect(states.some((state) => state.kind === 'waiting')).toBe(false);
    expect(JSON.stringify(states)).not.toContain(guidance.message);
  });

  it('a click acknowledges the action without requesting another model reply', async () => {
    const { session, states, client } = setup(guidance);
    await session.start('Find Profile');
    const identity = client.ask.mock.calls[0]![3];
    session.onPageEvent({ type: 'GUIDANCE_CLICKED', sessionId: identity.sessionId, requestId: identity.requestId,
      pageKey: 'page', snapshotId: 'snapshot', targetId: 'el_1' }, 1);
    expect(states.at(-1)?.kind).toBe('clicked');
    expect(client.ask).toHaveBeenCalledOnce();
  });

  it.each(['stop', 'replace', 'navigate', 'dispose'])('rejects late text after %s and propagates abort', async (action) => {
    const { session, states, client } = setup();
    let finish!: (value: unknown) => void;
    client.ask.mockImplementationOnce((_tabId, _snapshot, _task, identity) => new Promise((resolve) => {
      finish = () => resolve(envelope(answer, { sessionId: identity.sessionId, requestId: identity.requestId }));
    }));
    const pending = session.start('Old question');
    await Promise.resolve();
    if (action === 'stop') session.stop();
    if (action === 'replace') await session.start('New question');
    if (action === 'navigate') session.pause('Page changed');
    if (action === 'dispose') session.dispose();
    expect(client.ask.mock.calls[0]![4].aborted).toBe(true);
    const count = states.length;
    finish(null); await pending;
    expect(states).toHaveLength(count);
  });
});
