import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
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
