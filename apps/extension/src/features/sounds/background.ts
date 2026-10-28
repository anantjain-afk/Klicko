import { browser } from 'wxt/browser';
import { isSoundRequest, type SoundName } from '../../lib/sounds';

let creating: Promise<void> | undefined;
async function ensureAudioDocument() {
  if (creating) return creating;
  const contexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [browser.runtime.getURL('/audio.html')],
  });
  if (contexts.length) return;
  if (!creating) {
    creating = browser.offscreen.createDocument({
      url: '/audio.html', reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play bundled Klicko interaction sounds, including startup and close cues.',
    }).finally(() => { creating = undefined; });
  }
  return creating;
}

export async function playUiSound(sound: SoundName) {
  await ensureAudioDocument();
  const result: unknown = await browser.runtime.sendMessage({ type: 'PLAY_AUDIO_CUE', sound });
  if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
    throw new Error('Audio playback is unavailable.');
  }
}

export function startBackgroundSounds() {
  browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (sender.id !== browser.runtime.id || !isSoundRequest(message, 'PLAY_UI_SOUND')) return;
    void playUiSound(message.sound).then(() => respond({ ok: true }), () => respond({ ok: false }));
    return true;
  });
  browser.sidePanel.onOpened?.addListener((info) => {
    if (info.path.replace(/^\//, '') === 'sidepanel.html') void playUiSound('sidebar').catch(() => undefined);
  });
  // The panel document is already closing; play through the surviving audio document.
  browser.sidePanel.onClosed?.addListener((info) => {
    if (info.path.replace(/^\//, '') === 'sidepanel.html') void playUiSound('agent-close').catch(() => undefined);
  });
}
