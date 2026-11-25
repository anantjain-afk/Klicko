import {
  readTranscript, VOICE_MAX_BYTES, VOICE_SAMPLE_RATE, WAV_HEADER_BYTES,
} from '@clickpilot/shared/voice';

const VOICE_MODEL = '@cf/openai/whisper-large-v3-turbo';

export interface VoiceEnv {
  VOICE_PREVIEW?: string;
  AI?: { run: (model: typeof VOICE_MODEL, input: { audio: string; task: 'transcribe'; vad_filter: true }) => Promise<unknown> };
}

function error(code: string, status: number) {
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

async function readClip(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > VOICE_MAX_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const clip = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    clip.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return clip;
}

function isVoiceWav(clip: Uint8Array) {
  const dataBytes = clip.byteLength - WAV_HEADER_BYTES;
  if (dataBytes <= 0 || dataBytes % 2 !== 0) return false;
  const wav = new DataView(clip.buffer, clip.byteOffset, clip.byteLength);
  // Validate the exact PCM format produced by the extension. This also bounds duration.
  return wav.getUint32(0) === 0x52494646 && wav.getUint32(4, true) === clip.byteLength - 8
    && wav.getUint32(8) === 0x57415645 && wav.getUint32(12) === 0x666d7420 && wav.getUint32(16, true) === 16
    && wav.getUint16(20, true) === 1 && wav.getUint16(22, true) === 1 && wav.getUint32(24, true) === VOICE_SAMPLE_RATE
    && wav.getUint32(28, true) === VOICE_SAMPLE_RATE * 2 && wav.getUint16(32, true) === 2 && wav.getUint16(34, true) === 16
    && wav.getUint32(36) === 0x64617461 && wav.getUint32(40, true) === dataBytes;
}

function base64(clip: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < clip.length; offset += 8192) {
    binary += String.fromCharCode(...clip.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export async function transcribeVoice(request: Request, env: VoiceEnv) {
  if (env.VOICE_PREVIEW !== 'enabled') return error('voice_preview_disabled', 404);
  // A cross-origin web form cannot set this header, and the Worker grants no CORS.
  if (request.headers.get('X-Klicko-Voice') !== 'preview') return error('invalid_voice_request', 403);
  const type = request.headers.get('Content-Type')?.trim().toLowerCase();
  const encoding = request.headers.get('Content-Encoding')?.toLowerCase();
  if (type !== 'audio/wav' || (encoding && encoding !== 'identity')) return error('unsupported_audio', 415);
  if (Number(request.headers.get('Content-Length')) > VOICE_MAX_BYTES) return error('audio_too_large', 413);
  const clip = await readClip(request).catch(() => undefined);
  if (clip === null) return error('audio_too_large', 413);
  if (!clip || !isVoiceWav(clip)) return error('invalid_wav', 400);
  if (!env.AI) return error('voice_provider_unavailable', 503);
  if (request.signal.aborted) return error('cancelled', 499);
  try {
    const result = await env.AI.run(VOICE_MODEL, { audio: base64(clip), task: 'transcribe', vad_filter: true });
    if (request.signal.aborted) return error('cancelled', 499);
    const text = readTranscript(result);
    return text === null ? error('invalid_transcript', 502) : Response.json({ text }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch { return error('voice_provider_error', 502); }
}
