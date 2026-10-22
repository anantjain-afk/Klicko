import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssistantResultSchema, GuidanceRequestSchema } from '@clickpilot/shared/guidance';
import { createApp } from '../src/app';
import { geminiReply, ProviderError } from '../src/gemini';
import fixture from './fixtures/valid-request.json';

const env = { GUIDANCE_ENABLED: 'true', GEMINI_API_KEY: 'synthetic-secret', GEMINI_MODEL: 'gemini-3.5-flash-lite' };
const context = { userGoal: 'Find Settings', page: { origin: 'https://example.com' }, elements: [{ id: 'el_1', role: 'button', name: 'Settings', context: 'Navigation' }] };
const reply = { kind: 'answer', message: 'Settings is available in navigation.' };
const wire = (value: unknown) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
const post = () => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fixture) });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Gemini REST adapter — mocked fetch only', () => {
  it('sends one sanitized turn, a JSON schema and the key only in the backend header', async () => {
    const fetch = vi.fn(async () => wire(reply));
    vi.stubGlobal('fetch', fetch);
    expect(await geminiReply(context, new AbortController().signal, env)).toEqual(reply);
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'synthetic-secret' });
    const body = JSON.parse(init.body as string);
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: JSON.stringify(context) }] }]);
    expect(JSON.stringify(body)).not.toMatch(/synthetic-secret|fixture-snapshot|viewport|rect|previous_interaction/);
    expect(body.generationConfig.responseFormat.text.schema.anyOf).toHaveLength(4);
  });

  it('fails closed for disabled service, absent credentials or invalid model without fetch', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (const config of [{}, { ...env, GUIDANCE_ENABLED: 'false' }]) {
      await expect(geminiReply(context, new AbortController().signal, config)).rejects.toMatchObject({ code: 'service_disabled' });
    }
    for (const config of [{ GUIDANCE_ENABLED: 'true' }, { ...env, GEMINI_MODEL: '../bad' }, { ...env, GEMINI_API_KEY: '' }]) {
      await expect(geminiReply(context, new AbortController().signal, config)).rejects.toMatchObject({ code: 'provider_unavailable' });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([429, 403, 500])('maps HTTP %s to a safe error without reading the upstream body', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('PRIVATE-MARKER', { status })));
    await expect(geminiReply(context, new AbortController().signal, env)).rejects.toMatchObject({ code: status === 429 ? 'rate_limited' : 'provider_error' });
    const response = await createApp().request('/v1/guidance/next', post(), env);
    expect(response.status).toBe(status === 429 ? 429 : 502);
    expect(await response.text()).not.toContain('PRIVATE-MARKER');
  });

  it.each([
    {}, { candidates: [] },
    { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: '{}' }] } }] },
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] },
  ])('rejects blocked, truncated or malformed envelopes %j', async (value) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(value)));
    await expect(geminiReply(context, new AbortController().signal, env)).rejects.toBeInstanceOf(ProviderError);
  });

  it('bounds upstream bytes even without Content-Length', async () => {
    let cancelled = false;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(4096)); }, cancel() { cancelled = true; },
    }))));
    await expect(geminiReply(context, new AbortController().signal, env)).rejects.toBeInstanceOf(ProviderError);
    expect(cancelled).toBe(true);
  });

  it('propagates cancellation and distinguishes the 20 second timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      if (init.signal?.aborted) reject(new Error('aborted'));
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })));
    const controller = new AbortController();
    const cancelled = expect(geminiReply(context, controller.signal, env)).rejects.toMatchObject({ code: 'cancelled' });
    controller.abort(); await cancelled;
    const timedOut = expect(geminiReply(context, new AbortController().signal, env)).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(20_001); await timedOut;
  });

  it('sanitizes network exceptions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('PRIVATE-MARKER'); }));
    const response = await createApp().request('/v1/guidance/next', post(), env);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('PRIVATE-MARKER');
  });
});

describe('protocol 2 result contract', () => {
  it.each(['answer', 'clarification', 'unsupported'])('strictly bounds text-only %s', (kind) => {
    expect(AssistantResultSchema.parse({ kind, message: '  Useful reply. ' })).toEqual({ kind, message: 'Useful reply.' });
    for (const value of [{ kind }, { kind, message: '' }, { kind, message: ' ' }, { kind, message: 'x'.repeat(601) },
      { kind, message: 'Reply', targetId: 'el_1' }, { kind, message: 'Reply', instruction: 'Click' }, { kind, message: 'Reply', steps: [] }]) {
      expect(AssistantResultSchema.safeParse(value).success).toBe(false);
    }
  });
  it('rejects old results, unexpected plans and blank or overlong guidance', () => {
    const guidance = { kind: 'guidance', targetId: 'el_1', message: 'Open settings here.', instruction: 'Click Settings.' };
    expect(AssistantResultSchema.safeParse(guidance).success).toBe(true);
    for (const value of [{ ...guidance, message: 'x'.repeat(601) }, { ...guidance, message: ' ' },
      { ...guidance, instruction: '' }, { ...guidance, instruction: 'x'.repeat(161) }, { ...guidance, expectedOutcome: {} },
      { ...guidance, steps: [] }, { ...guidance, kind: 'highlight' }, { kind: 'complete', message: 'Done' }, { kind: 'ask_clarification', question: 'Which?' }]) {
      expect(AssistantResultSchema.safeParse(value).success).toBe(false);
    }
    expect(GuidanceRequestSchema.safeParse({ ...fixture, protocolVersion: 1 }).success).toBe(false);
  });
});
