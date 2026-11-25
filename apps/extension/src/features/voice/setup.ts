import { browser } from 'wxt/browser';
import { VOICE_CONSENT, VOICE_WORKER_HOST } from './preview';

export function showVoiceSetup() {
  document.title = 'Klicko voice setup';
  const heading = document.createElement('h1');
  heading.textContent = 'Klicko voice preview';
  const description = document.createElement('p');
  description.textContent = 'On the local test page, hold Option + Command to record. Release either key to send the clip through the local Worker to Cloudflare Workers AI and show the transcript in Klicko. Escape discards the recording.';
  const enable = document.createElement('button');
  enable.textContent = 'Allow microphone and enable voice';
  const disable = document.createElement('button');
  disable.textContent = 'Disable voice preview';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  document.body.append(heading, description, enable, ' ', disable, status);

  function display(enabled: boolean) {
    enable.disabled = enabled;
    disable.disabled = !enabled;
    status.textContent = enabled ? 'Voice is enabled for this browser session. Return to the test tab.' : 'Voice is off.';
  }
  enable.disabled = disable.disabled = true;
  void browser.storage.session.get(VOICE_CONSENT).then((value) => {
    display(value[VOICE_CONSENT] === true);
  }).catch(() => { status.textContent = 'Could not read voice settings.'; });
  enable.addEventListener('click', async (event) => {
    if (!event.isTrusted) return;
    enable.disabled = true;
    try {
      if (!await browser.permissions.request({ origins: [VOICE_WORKER_HOST] })) {
        status.textContent = 'Allow access to the local Worker to enable voice.';
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await browser.storage.session.set({ [VOICE_CONSENT]: true });
      display(true);
      return;
    } catch {
      status.textContent = 'Could not enable voice. Check Chrome and macOS microphone permissions.';
    } finally {
      enable.disabled = !disable.disabled;
    }
  });
  disable.addEventListener('click', async (event) => {
    if (!event.isTrusted) return;
    try {
      await browser.storage.session.remove(VOICE_CONSENT);
      display(false);
    } catch { status.textContent = 'Could not disable voice. Try again.'; }
  });
}
