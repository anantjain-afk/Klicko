import { browser, type Browser } from 'wxt/browser';
import { ensureAudioDocument } from '../sounds/background';
import { GLOBAL_ACTIVATION_KEY, supportedPage } from '../../lib/activation';
import { isRecord } from '../../lib/task-messages';
import {
  isVoiceMessage, VOICE_AUDIO_PORT, VOICE_CONSENT, VOICE_PAGE_PORT, VOICE_SETUP, VOICE_WORKER_HOST, type VoiceMessage,
} from './preview';

export function startVoicePreview(allowed: (tabId: number) => Promise<boolean>) {
  async function activePage(sender?: Browser.runtime.MessageSender) {
    const tabId = sender?.tab?.id;
    if (sender?.id !== browser.runtime.id || sender.frameId !== 0 || tabId === undefined
      || !sender.documentId) return;
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id !== tabId || !supportedPage(tab.url) || !await allowed(tabId)) return;
    // Use the live tab URL for in-document navigation and the document ID for reloads.
    const reply: unknown = await browser.tabs.sendMessage(tabId, { type: 'PAGE_IDENTITY' }, { documentId: sender.documentId })
      .catch(() => null);
    if (isRecord(reply) && reply.ok === true) return tab.url;
  }
  async function enabled() {
    const consent = await browser.storage.session.get(VOICE_CONSENT);
    return consent[VOICE_CONSENT] === true && await browser.permissions.contains({ origins: [VOICE_WORKER_HOST] });
  }
  browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (message !== VOICE_SETUP) return;
    void (async () => {
      if (!await activePage(sender)) return false;
      await browser.tabs.create({ url: browser.runtime.getURL('/audio.html') + '?' + VOICE_SETUP });
      return true;
    })().then(respond, () => respond(false));
    return true;
  });

  browser.runtime.onConnect.addListener((page) => {
    if (page.name !== VOICE_PAGE_PORT) return;
    const tabId = page.sender?.tab?.id;
    let closed = false;
    let finishing = false;
    let recordingUrl: string | undefined;
    let audio: Browser.runtime.Port | undefined;
    function stop() {
      if (closed) return;
      closed = true;
      audio?.disconnect();
      browser.storage.onChanged.removeListener(consentChanged);
      browser.permissions.onRemoved.removeListener(permissionChanged);
      browser.tabs.onActivated.removeListener(tabActivated);
      browser.tabs.onUpdated.removeListener(tabUpdated);
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
      void canContinue().catch(() => cancel());
    }
    function cancel() {
      if (closed) return;
      try { page.postMessage({ type: 'cancelled' }); } finally { stop(); }
    }
    function tabActivated(tab: Browser.tabs.OnActivatedInfo) {
      if (tab.tabId !== tabId) cancel();
    }
    function tabUpdated(id: number, change: Browser.tabs.OnUpdatedInfo) {
      if (id === tabId && (change.status === 'loading' || change.url !== undefined)) cancel();
    }
    async function canContinue() {
      if (closed) return false;
      if (!recordingUrl || await activePage(page.sender) !== recordingUrl) { cancel(); return false; }
      if (!await enabled()) { fail('setup'); return false; }
      return !closed;
    }
    async function sendTranscript(message: VoiceMessage) {
      if (!finishing || !await canContinue()) return;
      try { page.postMessage(message); } finally { stop(); }
    }
    browser.storage.onChanged.addListener(consentChanged);
    browser.permissions.onRemoved.addListener(permissionChanged);
    browser.tabs.onActivated.addListener(tabActivated);
    browser.tabs.onUpdated.addListener(tabUpdated);
    page.onDisconnect.addListener(stop);
    page.onMessage.addListener((message: unknown) => {
      if (closed || !audio || finishing || message !== 'finish') return;
      finishing = true;
      void canContinue().then((permitted) => {
        if (permitted && !closed) audio?.postMessage('finish');
      }).catch(() => fail('interrupted'));
    });
    void (async () => {
      recordingUrl = await activePage(page.sender);
      if (!recordingUrl) return fail('unavailable');
      if (!await enabled()) return fail('setup');
      if (closed) return;
      await ensureAudioDocument();
      if (closed) return;
      audio = browser.runtime.connect({ name: VOICE_AUDIO_PORT });
      audio.onDisconnect.addListener(() => { void browser.runtime.lastError; fail('interrupted'); });
      audio.onMessage.addListener((value: unknown) => {
        if (closed || !isVoiceMessage(value)) return;
        if (value.type === 'transcript') {
          void sendTranscript(value).catch(() => fail('interrupted'));
          return;
        }
        page.postMessage(value);
        if (value.type === 'error' || value.type === 'cancelled') stop();
      });
    })().catch(() => fail('interrupted'));
  });
}
