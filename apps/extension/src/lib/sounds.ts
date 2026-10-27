import { browser } from 'wxt/browser';

export const soundNames = ['agent-launch', 'agent-close', 'clicky-text-open', 'clicky-text-close',
  'clicky-text-send', 'clicky-text-selection', 'sidebar', 'boing-1', 'boing-2'] as const;
export type SoundName = typeof soundNames[number];

export function isSoundName(value: unknown): value is SoundName {
  return typeof value === 'string' && soundNames.some((name) => name === value);
}

export function isSoundRequest(value: unknown, type: 'PLAY_UI_SOUND' | 'PLAY_AUDIO_CUE'): value is { type: string; sound: SoundName } {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return Object.keys(message).sort().join() === 'sound,type' && message.type === type && isSoundName(message.sound);
}

export function playSound(sound: SoundName) {
  // Playback lives outside temporary UI documents, including during launch/close.
  void browser.runtime.sendMessage({ type: 'PLAY_UI_SOUND', sound }).catch(() => undefined);
}
