export const VOICE_SAMPLE_RATE = 16_000;
export const VOICE_MAX_SECONDS = 30;
export const WAV_HEADER_BYTES = 44;
export const VOICE_MAX_BYTES = WAV_HEADER_BYTES + VOICE_SAMPLE_RATE * VOICE_MAX_SECONDS * 2;
export const VOICE_MAX_TEXT = 2_000;

export function readTranscript(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') return null;
  const text = value.text.trim();
  return text.length <= VOICE_MAX_TEXT ? text : null;
}
