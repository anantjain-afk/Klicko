import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import hostedVoice from '../src/voice-hosted';
import { VOICE_MAX_BYTES } from '@clickpilot/shared/voice';

const url = 'http://127.0.0.1:8787/v1/voice/transcribe';
const headers = { 'Content-Type': 'audio/wav', 'X-Klicko-Voice': 'preview' };
// A canonical 16 kHz mono PCM clip with two samples.
const wav = Uint8Array.from([
  82, 73, 70, 70, 40, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
  16, 0, 0, 0, 1, 0, 1, 0, 128, 62, 0, 0, 0, 125, 0, 0, 2, 0, 16, 0,
  100, 97, 116, 97, 4, 0, 0, 0, 0, 23, 0, 232,
]);

function setup(reply: unknown = { text: '  Switch accounts.  ', segments: [] }) {
  const run = vi.fn(async () => reply);
  const env = { VOICE_PREVIEW: 'enabled', AI: { run } };
  const app = createApp();
  return {
    run,
    send: (body: BodyInit = wav, init: RequestInit = {}) =>
      app.request(url, { method: 'POST', headers, body, ...init }, env),
  };
}

describe('local voice transcription', () => {
  it('sends only the clip to Whisper and returns only trimmed transcript text', async () => {
    const { send, run } = setup();
    const result = await send();
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.json()).toEqual({ text: 'Switch accounts.' });
    expect(run).toHaveBeenCalledExactlyOnceWith('@cf/openai/whisper-large-v3-turbo', {
      audio: btoa(String.fromCharCode(...wav)), task: 'transcribe', vad_filter: true,
    });
  });

  it('rejects cross-origin form headers, corrupted audio, and oversized audio without calling Whisper', async () => {
    const { send, run } = setup();
    expect((await send(wav, { headers: { 'Content-Type': 'audio/wav' } })).status).toBe(403);
    expect((await send(wav, { headers: { ...headers, 'Content-Type': 'audio/webm' } })).status).toBe(415);
    expect((await send(new Uint8Array(44))).status).toBe(400);
    expect((await send(new Uint8Array(VOICE_MAX_BYTES + 1))).status).toBe(413);
    const wrongRate = wav.slice();
    wrongRate[24] = 0;
    expect((await send(wrongRate)).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it('requires the local preview environment and an AI binding', async () => {
    const app = createApp();
    const init = { method: 'POST', headers, body: wav };
    expect((await app.request(url, init)).status).toBe(404);
    expect((await app.request(url, init, { VOICE_PREVIEW: 'enabled' })).status).toBe(503);
    expect((await app.request(url.replace('127.0.0.1:8787', 'public.example'), init, { VOICE_PREVIEW: 'enabled' })).status).toBe(403);
  });

  it('accepts a no-speech result and handles invalid provider data safely', async () => {
    expect(await (await setup({ text: ' ' }).send()).json()).toEqual({ text: '' });
    expect((await setup({ text: 'x'.repeat(2001) }).send()).status).toBe(502);
    const { send, run } = setup();
    run.mockRejectedValueOnce(new Error('upstream details'));
    expect(await (await send()).json()).toEqual({ error: 'voice_provider_error' });
  });
});

describe('hosted voice transcription', () => {
  const origin = 'https://voice.example.test';
  const endpoint = origin + '/v1/voice/transcribe';
  const clientHeaders = { ...headers, 'CF-Connecting-IP': '203.0.113.24' };

  function hostedSetup() {
    const run = vi.fn(async () => ({ text: 'Find the settings.' }));
    const limit = vi.fn(async () => ({ success: true }));
    const env = {
      VOICE_HOSTED_ORIGIN: origin, VOICE_HOSTED_ENABLED: 'enabled',
      AI: { run }, VOICE_RATE_LIMIT: { limit },
    };
    const send = (url = endpoint, init: RequestInit = { method: 'POST', headers: clientHeaders, body: wav }) =>
      hostedVoice.fetch(new Request(url, init), env);
    return { env, send, run, limit };
  }

  it('only exposes the HTTPS transcription URL on the configured host', async () => {
    const { send, run, limit } = hostedSetup();
    for (const url of [endpoint.replace('https:', 'http:'), endpoint.replace('voice.', 'other.'),
      endpoint + '?debug=1', origin + '/v1/guidance/next', origin + '/v1/text/explain']) {
      expect((await send(url)).status).toBe(404);
    }
    const preflight = await send(endpoint, { method: 'OPTIONS' });
    expect(preflight.status).toBe(405);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
    expect(run).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it('stays disabled until configured and fails closed if the limiter is missing or unavailable', async () => {
    const { env, send, run, limit } = hostedSetup();
    expect((await hostedVoice.fetch(new Request(endpoint, { method: 'POST' }), {})).status).toBe(503);
    expect((await hostedVoice.fetch(new Request(endpoint, { method: 'POST' }), {
      ...env, VOICE_RATE_LIMIT: undefined,
    })).status).toBe(503);
    env.VOICE_HOSTED_ENABLED = 'disabled';
    expect((await send()).status).toBe(503);
    expect(limit).not.toHaveBeenCalled();
    env.VOICE_HOSTED_ENABLED = 'enabled';
    limit.mockRejectedValueOnce(new Error('limiter details'));
    expect((await send()).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  it('requires the upload format and edge client address and rejects requests over the IP threshold', async () => {
    const { send, run, limit } = hostedSetup();
    expect((await send(endpoint, { method: 'POST', headers, body: wav })).status).toBe(403);
    expect((await send(endpoint, { method: 'POST', headers: {
      ...clientHeaders, 'Content-Length': String(VOICE_MAX_BYTES + 1),
    }, body: wav })).status).toBe(413);
    expect((await send(endpoint, { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.24' } })).status).toBe(403);
    expect(limit).not.toHaveBeenCalled();
    limit.mockResolvedValueOnce({ success: false });
    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
    expect(limit).toHaveBeenCalledExactlyOnceWith({ key: '203.0.113.24' });
    expect(run).not.toHaveBeenCalled();
  });

  it('transcribes bounded audio and returns just the uncacheable transcript', async () => {
    const { send, run } = hostedSetup();
    expect((await send(endpoint, { method: 'POST', headers: clientHeaders, body: new Uint8Array(44) })).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
    const response = await send();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ text: 'Find the settings.' });
    expect(run).toHaveBeenCalledExactlyOnceWith('@cf/openai/whisper-large-v3-turbo', {
      audio: btoa(String.fromCharCode(...wav)), task: 'transcribe', vad_filter: true,
    });
  });
});
