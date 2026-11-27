import { VOICE_MAX_TEXT } from '@clickpilot/shared/voice';

export const VOICE_HOSTED = import.meta.env.MODE === 'voice-hosted';
export const VOICE_PREVIEW = import.meta.env.MODE === 'voice-preview' || VOICE_HOSTED;
const hostedOrigin = import.meta.env.WXT_VOICE_ORIGIN;
export const VOICE_WORKER_HOST = VOICE_HOSTED ? `${hostedOrigin}/*` : 'http://127.0.0.1/*';
export const VOICE_WORKER_URL = VOICE_HOSTED ? import.meta.env.WXT_VOICE_ENDPOINT : 'http://127.0.0.1:8787/v1/voice/transcribe';
export const VOICE_CONSENT = VOICE_HOSTED ? `clickpilot.voice-hosted:${hostedOrigin}` : 'clickpilot.voice-on-supported-sites';
export const VOICE_PAGE_PORT = 'clickpilot-voice-preview';
export const VOICE_AUDIO_PORT = 'clickpilot-voice-audio';
export const VOICE_SETUP = 'clickpilot-voice-setup';

export const voiceMessages = {
  setup: 'Open Voice setup to enable microphone access and Cloudflare transcription.',
  unavailable: 'Voice preview is unavailable. Focus a supported tab where Klicko is on.',
  permission: 'Microphone access failed. Check Chrome permissions in Voice setup.',
  busy: 'Another voice recording is already in progress.',
  expired: 'Recording reached the 30-second limit. Hold the keys again to retry.',
  empty: 'No speech was transcribed. Try speaking again after Listening appears.',
  failed: VOICE_HOSTED ? 'Transcription failed. Try again or type your question.'
    : 'Transcription failed. Check that the local voice Worker is running and signed in.',
  rateLimited: 'Voice is getting too many requests. Wait a minute or type your question.',
  serviceUnavailable: 'Voice transcription is temporarily unavailable. You can still type your question.',
  interrupted: 'Voice preview was interrupted. Hold the keys again to retry.',
};

export type VoiceMessage =
  | { type: 'listening' | 'transcribing' | 'cancelled' }
  | { type: 'transcript'; text: string }
  | { type: 'error'; reason: keyof typeof voiceMessages };

export function isVoiceMessage(value: unknown): value is VoiceMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  if (value.type === 'listening' || value.type === 'transcribing' || value.type === 'cancelled') return true;
  if (value.type === 'transcript') return 'text' in value && typeof value.text === 'string'
    && value.text.length > 0 && value.text.length <= VOICE_MAX_TEXT;
  return value.type === 'error' && 'reason' in value && typeof value.reason === 'string'
    && Object.hasOwn(voiceMessages, value.reason);
}
