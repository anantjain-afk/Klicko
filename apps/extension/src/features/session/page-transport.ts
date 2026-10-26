import { browser, type Browser } from 'wxt/browser';
import { isSensitivePage } from '@clickpilot/shared/privacy';
import { requestAssistant, type AssistantRequest } from '../../lib/assistant';
import { requestText, type TextCommand } from '../../lib/text-assistant';
import { TextIdentitySchema } from '@clickpilot/shared/text-assistant';
import { isPageSnapshot } from '../../lib/messages';
import { sharingPreferences, tabAccess } from '../../lib/page-access';

function requestDeadline(parent: AbortSignal) {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  const timer = setTimeout(cancel, 25_000);
  parent.addEventListener('abort', cancel, { once: true });
  if (parent.aborted) cancel();
  return { signal: abort.signal, dispose: () => { clearTimeout(timer); parent.removeEventListener('abort', cancel); } };
}

export function createPageTransport(tabId: number, textEvent: (value: unknown) => void) {
  let page: Browser.runtime.Port | undefined;
  let closed = false;
  let armNumber = 0;
  let armed: { sessionId: string; pageKey: string; consent: boolean } | undefined;
  let arming: string | undefined;

  async function activePage() {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.url && isSensitivePage(tab.url)) throw new Error('For your privacy, ClickPilot is unavailable on this page.');
    if (tab?.id !== tabId || !tab.url || !await tabAccess.allows(tabId, tab.url)) {
      throw new Error('Click the ClickPilot toolbar icon on this public page, then try again.');
    }
    return tab;
  }
  function track() {
    if (page || closed) return;
    page = browser.tabs.connect(tabId, { name: 'clickpilot-page', frameId: 0 });
    const connection = page;
    connection.onDisconnect.addListener(() => { void browser.runtime.lastError; if (page === connection) page = undefined; });
  }
  function stopText() {
    ++armNumber;
    const sessionId = armed?.sessionId ?? arming;
    armed = undefined; arming = undefined;
    if (sessionId) void browser.tabs.sendMessage(tabId, { type: 'DISABLE_TEXT', sessionId }, { frameId: 0 }).catch(() => undefined);
  }
  async function armText(sessionId: string, consent: boolean) {
    const attempt = ++armNumber;
    try {
      const tab = await activePage();
      if (closed || attempt !== armNumber) return;
      arming = sessionId;
      const command = { type: 'ENABLE_TEXT', sessionId, consent, resumeDraft: true };
      let result: unknown;
      try { result = await browser.tabs.sendMessage(tabId, command, { frameId: 0 }); }
      catch {
        if (closed || attempt !== armNumber) return;
        await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
        if (closed || attempt !== armNumber) return;
        result = await browser.tabs.sendMessage(tabId, command, { frameId: 0 });
      }
      const latest = await activePage();
      if (closed || attempt !== armNumber) return;
      if (latest.url !== tab.url || !result || typeof result !== 'object' || !('pageKey' in result) || typeof result.pageKey !== 'string') {
        stopText(); return;
      }
      track(); armed = { sessionId, pageKey: result.pageKey, consent }; arming = undefined;
      const selectionId = 'selectionId' in result && TextIdentitySchema.safeParse({ sessionId, pageKey: armed.pageKey, selectionId: result.selectionId }).success
        ? result.selectionId : undefined;
      textEvent({ type: 'TEXT_ARMED', ...armed, tabId, selectionId });
    } catch {
      if (!closed && attempt === armNumber) textEvent({ type: 'TEXT_ARM_ERROR' });
    }
  }
  return {
    track, activePage, stopText,
    textPost(value: unknown) {
      if (!value || typeof value !== 'object' || !('type' in value)) return;
      if (value.type === 'STOP_TEXT') stopText();
      if (value.type === 'ARM_TEXT' && 'sessionId' in value && typeof value.sessionId === 'string'
        && 'consent' in value && typeof value.consent === 'boolean') void armText(value.sessionId, value.consent);
    },
    async askGuidance(command: AssistantRequest, parent: AbortSignal) {
      const deadline = requestDeadline(parent);
      try {
        const tab = await activePage();
        if (!(await sharingPreferences()).guidance || deadline.signal.aborted) throw new Error('Webpage sharing is off. Check Settings.');
        const snapshot = () => browser.tabs.sendMessage(tabId, { type: 'GET_SNAPSHOT', pageKey: command.pageKey, snapshotId: command.snapshotId }, { frameId: 0 });
        const before: unknown = await snapshot();
        if (!isPageSnapshot(before) || before.pageKey !== command.pageKey || before.snapshotId !== command.snapshotId) throw new Error('This page changed. Try again.');
        if (!(await sharingPreferences()).guidance || deadline.signal.aborted) throw new Error('The request was stopped.');
        const result = await requestAssistant(command, before, tab.url!, deadline.signal);
        const latest = await activePage(); const after: unknown = await snapshot();
        if (closed || deadline.signal.aborted || latest.url !== tab.url || !isPageSnapshot(after)
          || after.pageKey !== command.pageKey || after.snapshotId !== command.snapshotId) throw new Error('This page changed. Try again.');
        return result;
      } finally { deadline.dispose(); }
    },
    async askText(command: TextCommand, parent: AbortSignal) {
      const deadline = requestDeadline(parent);
      try {
        const tab = await activePage();
        if (!(await sharingPreferences()).selectedText || !armed?.consent || armed.sessionId !== command.sessionId || armed.pageKey !== command.pageKey) {
          throw new Error('Selected-text sharing is off or the page changed. Check Settings and select the passage again.');
        }
        const check = () => browser.tabs.sendMessage(tabId, { type: 'CHECK_TEXT', sessionId: command.sessionId,
          pageKey: command.pageKey, selectionId: command.selectionId }, { frameId: 0 });
        const matches = (value: unknown) => !!value && typeof value === 'object' && 'selectedText' in value && value.selectedText === command.selectedText;
        if (!matches(await check()) || deadline.signal.aborted) throw new Error('The selection changed. Select the passage again.');
        if (!(await sharingPreferences()).selectedText || deadline.signal.aborted) throw new Error('Selected-text sharing is off. Check Settings.');
        const result = await requestText(command, deadline.signal);
        const latest = await activePage();
        if (closed || deadline.signal.aborted || latest.url !== tab.url || !matches(await check())) throw new Error('The selection changed. Select the passage again.');
        if (deadline.signal.aborted) throw new Error('The request was stopped.');
        await browser.tabs.sendMessage(tabId, { type: 'SHOW_TEXT', sessionId: command.sessionId, pageKey: command.pageKey,
          selectionId: command.selectionId, result: result.result }, { frameId: 0 });
        return result;
      } finally { deadline.dispose(); }
    },
    dispose() { closed = true; stopText(); page?.disconnect(); page = undefined; },
  };
}
