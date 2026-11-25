import { browser, type Browser } from 'wxt/browser';
import { isVoiceMessage, VOICE_PAGE_PORT, VOICE_SETUP, voiceMessages } from './preview';

export function createVoiceControls(canRecord: () => boolean, reveal: () => void, sendTranscript: (text: string) => string) {
  const element = document.createElement('div');
  const setup = document.createElement('button');
  setup.id = 'clickpilot-voice-setup';
  setup.type = 'button';
  setup.className = 'settings';
  setup.textContent = 'Voice setup';
  const status = document.createElement('p');
  status.className = 'status';
  status.id = 'clickpilot-voice-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  element.append(setup, status);

  let hold: ReturnType<typeof setTimeout> | undefined;
  let port: Browser.runtime.Port | undefined;
  let phase: 'starting' | 'listening' | 'finishing' = 'starting';

  function show(message: string) {
    status.textContent = message;
    status.hidden = !message;
    if (message) reveal();
  }
  function stop() {
    clearTimeout(hold);
    hold = undefined;
    const current = port;
    port = undefined;
    current?.disconnect();
  }
  function clear() {
    stop();
    show('');
  }
  function start() {
    hold = undefined;
    if (!canRecord() || document.hidden || !document.hasFocus()) return;
    try {
      const current = browser.runtime.connect({ name: VOICE_PAGE_PORT });
      port = current;
      phase = 'starting';
      show('Starting microphone…');
      current.onMessage.addListener((message: unknown) => {
        if (port !== current || !isVoiceMessage(message)) return;
        if (message.type === 'listening') {
          phase = 'listening';
          show('Listening… Release either key to ask Klicko.');
        } else if (message.type === 'transcribing') {
          show('Transcribing…');
        } else if (message.type === 'transcript') {
          if (phase !== 'finishing' || !canRecord() || document.hidden || !document.hasFocus()) return clear();
          stop();
          const text = message.text.trim();
          if (!text) return show(voiceMessages.empty);
          const notice = sendTranscript(text);
          show(`Transcript: ${text}${notice ? ` · ${notice}` : ''}`);
        } else if (message.type === 'cancelled') {
          clear();
        } else if (message.type === 'error') {
          stop();
          show(voiceMessages[message.reason]);
        }
      });
      current.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        if (port !== current) return;
        stop();
        show(voiceMessages.interrupted);
      });
    } catch {
      stop();
      show(voiceMessages.interrupted);
    }
  }
  function cancelActive() {
    if (hold !== undefined || port) clear();
  }
  function keyDown(event: KeyboardEvent) {
    if (!event.isTrusted) return;
    if (event.key === 'Escape' || (event.key !== 'Alt' && event.key !== 'Meta' && event.altKey && event.metaKey)) {
      cancelActive();
      return;
    }
    if ((event.key === 'Alt' || event.key === 'Meta') && event.altKey && event.metaKey
      && !event.shiftKey && !event.ctrlKey && !event.repeat && !port && hold === undefined && canRecord()) {
      hold = setTimeout(start, 200);
    }
  }
  function keyUp(event: KeyboardEvent) {
    if (!event.isTrusted || (event.key !== 'Alt' && event.key !== 'Meta')) return;
    if (event.altKey && event.metaKey) return;
    clearTimeout(hold);
    hold = undefined;
    if (!port) return;
    if (phase === 'starting' || !canRecord() || document.hidden || !document.hasFocus()) return clear();
    if (phase === 'finishing') return;
    phase = 'finishing';
    try { port.postMessage('finish'); } catch { clear(); }
  }
  function visibilityChanged() { if (document.hidden) cancelActive(); }
  setup.addEventListener('click', (event) => {
    if (!event.isTrusted || !canRecord()) return;
    void browser.runtime.sendMessage(VOICE_SETUP).then((opened: unknown) => {
      if (opened !== true) show(voiceMessages.unavailable);
    }).catch(() => show(voiceMessages.unavailable));
  });
  window.addEventListener('keydown', keyDown, true);
  window.addEventListener('keyup', keyUp, true);
  window.addEventListener('blur', cancelActive);
  document.addEventListener('visibilitychange', visibilityChanged);
  return {
    element,
    clear,
    cancelActive,
    dispose() {
      clear();
      window.removeEventListener('keydown', keyDown, true);
      window.removeEventListener('keyup', keyUp, true);
      window.removeEventListener('blur', cancelActive);
      document.removeEventListener('visibilitychange', visibilityChanged);
    },
  };
}
