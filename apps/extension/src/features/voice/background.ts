import { browser, type Browser } from 'wxt/browser';
import { ensureAudioDocument } from '../sounds/background';
import { GLOBAL_ACTIVATION_KEY } from '../../lib/activation';
import {
  isVoiceMessage, VOICE_AUDIO_PORT, VOICE_CONSENT, VOICE_FIXTURE, VOICE_PAGE_PORT, VOICE_SETUP, VOICE_WORKER_HOST,
} from './preview';

export function startVoicePreview(allowed: (tabId: number) => Promise<boolean>) {
  async function activeFixture(sender?: Browser.runtime.MessageSender) {
    const tabId = sender?.tab?.id;
    if (sender?.id !== browser.runtime.id || sender.frameId !== 0 || sender.url !== VOICE_FIXTURE || tabId === undefined) return false;
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id === tabId && tab.url === VOICE_FIXTURE && await allowed(tabId);
  }
  async function enabled() {
    const consent = await browser.storage.session.get(VOICE_CONSENT);
    return consent[VOICE_CONSENT] === true && await browser.permissions.contains({ origins: [VOICE_WORKER_HOST] });
  }
  browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (message !== VOICE_SETUP) return;
    void (async () => {
      if (!await activeFixture(sender)) return false;
      await browser.tabs.create({ url: browser.runtime.getURL('/audio.html') + '?' + VOICE_SETUP });
      return true;
    })().then(respond, () => respond(false));
    return true;
  });

  browser.runtime.onConnect.addListener((page) => {
    if (page.name !== VOICE_PAGE_PORT) return;
    const tabId = page.sender?.tab?.id;
    let closed = false;
    let audio: Browser.runtime.Port | undefined;
    function stop() {
      if (closed) return;
      closed = true;
      audio?.disconnect();
      browser.storage.onChanged.removeListener(consentChanged);
      browser.permissions.onRemoved.removeListener(permissionChanged);
      browser.tabs.onActivated.removeListener(tabActivated);
    }
    function fail(reason: 'unavailable' | 'setup' | 'interrupted') {
      if (closed) return;
      try { page.postMessage({ type: 'error', reason }); } finally { stop(); }
    }
    function consentChanged(changes: Record<string, Browser.storage.StorageChange>, area: string) {
      if (area !== 'session') return;
      if (changes[VOICE_CONSENT]?.oldValue === true && changes[VOICE_CONSENT]?.newValue !== true) fail('setup');
      if (changes[GLOBAL_ACTIVATION_KEY]?.newValue === false) cancel();
    }
    function permissionChanged() {
      void enabled().then((permitted) => { if (!permitted) fail('setup'); }).catch(() => fail('setup'));
    }
    function cancel() {
      if (closed) return;
      try { page.postMessage({ type: 'cancelled' }); } finally { stop(); }
    }
    function tabActivated(tab: Browser.tabs.OnActivatedInfo) {
      if (tab.tabId !== tabId) cancel();
    }
    browser.storage.onChanged.addListener(consentChanged);
    browser.permissions.onRemoved.addListener(permissionChanged);
    browser.tabs.onActivated.addListener(tabActivated);
    page.onDisconnect.addListener(stop);
    page.onMessage.addListener((message: unknown) => {
      if (!closed && audio && message === 'finish') audio.postMessage('finish');
    });
    void (async () => {
      if (!await activeFixture(page.sender)) return fail('unavailable');
      if (!await enabled()) return fail('setup');
      if (closed) return;
      await ensureAudioDocument();
      if (closed) return;
      audio = browser.runtime.connect({ name: VOICE_AUDIO_PORT });
      audio.onDisconnect.addListener(() => { void browser.runtime.lastError; fail('interrupted'); });
      audio.onMessage.addListener((value: unknown) => {
        if (closed || !isVoiceMessage(value)) return;
        page.postMessage(value);
        if (value.type === 'transcript' || value.type === 'error' || value.type === 'cancelled') stop();
      });
    })().catch(() => fail('interrupted'));
  });
}
