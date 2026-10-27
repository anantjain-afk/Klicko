import { browser } from 'wxt/browser';
import { isSoundRequest } from '../../src/lib/sounds';

let audio: HTMLAudioElement | null = null;
browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (sender.id !== browser.runtime.id || !isSoundRequest(message, 'PLAY_AUDIO_CUE')) return;
  audio?.pause();
  audio = new Audio(browser.runtime.getURL(`/sounds/${message.sound}.wav`));
  audio.id = 'clickpilot-audio';
  audio.volume = 0.5;
  document.body.replaceChildren(audio);
  void audio.play().then(() => respond({ ok: true }), () => respond({ ok: false }));
  return true;
});
