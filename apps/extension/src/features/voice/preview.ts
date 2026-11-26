import { VOICE_MAX_TEXT } from '@clickpilot/shared/voice';

export const VOICE_PREVIEW = import.meta.env.MODE === 'voice-preview';
export const VOICE_WORKER_HOST = 'http://127.0.0.1/*';
export const VOICE_WORKER_URL = 'http://127.0.0.1:8787/v1/voice/transcribe';
export const VOICE_CONSENT = 'clickpilot.voice-on-supported-sites';
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
  failed: 'Transcription failed. Check that the local voice Worker is running and signed in.',
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
