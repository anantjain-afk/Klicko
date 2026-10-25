import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bubblePosition, readSelectedRange } from '../../src/features/text-assistant/selection';
import { createTextSession, type TextState } from '../../src/features/text-assistant/session';
import { isSensitivePage } from '@clickpilot/shared/privacy';
import { prepareText, validateTextResponse } from '@clickpilot/shared/text-assistant';
import { isTextCommand, isTextEvent, isTextPageCommand, requestText, type TextCommand } from '../../src/lib/text-assistant';

const sessionId = '00000000-0000-4000-8000-000000000001';
const identity = { sessionId, pageKey: 'page', selectionId: 'selection' };
const request: TextCommand = { type: 'ASK_TEXT', protocolVersion: 1, operation: 'explain_text', ...identity, requestId: 1, tabId: 1,
  selectedText: 'Plants store energy.', question: 'Explain this.' };
const result = { kind: 'explanation' as const, quickExplanation: 'Plants store energy.', detailedExplanation: 'Sunlight becomes stored chemical energy.' };
function rangeFor(element: Element) { const range = document.createRange(); range.selectNodeContents(element); return range; }
beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('selection privacy and placement', () => {
  it('reads a bounded ordinary text range with partial text endpoints and nested formatting', () => {
    document.body.innerHTML = '<p>Some <strong>ordinary</strong> selected text.</p>';
    const p = document.querySelector('p')!;
    expect(readSelectedRange(rangeFor(p))).toBe('Some ordinary selected text.');
    const range = rangeFor(p); range.setStart(p.firstChild!, 2); range.setEnd(p.lastChild!, 9);
    expect(readSelectedRange(range)).toBe('me ordinary selected');
  });
  it.each(['<input value="FAKE SECRET">', '<textarea>FAKE SECRET</textarea>', '<span contenteditable>FAKE SECRET</span>', '<span role="textbox">FAKE SECRET</span>', '<span hidden>FAKE SECRET</span>', '<span inert>FAKE SECRET</span>', '<span style="display:none">FAKE SECRET</span>', '<span aria-label="Payment details">FAKE SECRET</span>'])('rejects excluded content even in the middle of a range: %s', (html) => {
    document.body.innerHTML = `<p>Public start ${html} public end.</p>`;
    expect(readSelectedRange(rangeFor(document.querySelector('p')!))).toBeNull();
  });
  it('rejects forms, disconnected ranges, sensitive markers, work limits and oversized text', () => {
    document.body.innerHTML = '<form><p>Ordinary words.</p></form>';
    expect(readSelectedRange(rangeFor(document.querySelector('p')!))).toBeNull();
    for (const content of ['person@example.com', 'a'.repeat(2001), '<span>word</span>'.repeat(300)]) {
      document.body.innerHTML = `<p>${content}</p>`;
      expect(readSelectedRange(rangeFor(document.querySelector('p')!))).toBeNull();
    }
    const p = document.createElement('p'); p.textContent = 'Detached words';
    expect(readSelectedRange(rangeFor(p))).toBeNull();
  });
  it('normalizes before privacy checks, accepts Unicode and rejects punctuation-only selections', () => {
    expect(prepareText('   Plants\nuse sunlight. ', ' Explain\tthis ')).toEqual({ selectedText: 'Plants use sunlight.', question: 'Explain this' });
    expect(prepareText('你好', 'Explain')).not.toBeNull();
    expect(prepareText('!!!', 'Explain')).toBeNull();
    expect(prepareText('ordinary text', 'person@example.com')).toBeNull();
    expect(isSensitivePage('https://example.com/checkout?x')).toBe(true);
    expect(isSensitivePage('https://example.com/public')).toBe(false);
  });
  it('places below by default, flips above, clamps edges and refuses insufficient room', () => {
    const viewport = { left: 0, top: 0, width: 400, height: 300 };
    expect(bubblePosition({ left: 0, right: 40, top: 20, bottom: 40 }, { width: 100, height: 50 }, viewport)).toEqual({ left: 12, top: 48 });
    expect(bubblePosition({ left: 380, right: 450, top: 270, bottom: 290 }, { width: 100, height: 50 }, viewport)).toEqual({ left: 288, top: 212 });
    expect(bubblePosition({ left: 40, right: 90, top: 100, bottom: 200 }, { width: 300, height: 200 }, viewport)).toBeNull();
    expect(bubblePosition({ left: 0, right: 100, top: 10, bottom: 20 }, { width: 500, height: 20 }, viewport)).toBeNull();
  });
});

describe('text client and transient session', () => {
  function setup() {
    const states: TextState[] = []; let resolve!: (value: unknown) => void;
    const client = { post: vi.fn(), interruptGuidance: vi.fn(), ask: vi.fn<(command: TextCommand, signal: AbortSignal) => Promise<unknown>>(() => new Promise<unknown>((done) => { resolve = done; })) };
    const session = createTextSession(client, (state) => states.push(state)); session.enable();
    const id = client.post.mock.calls[0]![0].sessionId;
    const event = (type: string, extra = {}) => ({ type, ...identity, sessionId: id, ...extra });
    session.onPortMessage({ type: 'TEXT_ARMED', sessionId: id, tabId: 1, pageKey: 'page' });
    return { session, client, states, event, resolve: (value: unknown) => resolve(value) };
  }
  it('does not request on selection, opening, consent or typing; requires explicit submission', () => {
    const { session, client, event } = setup();
    session.onPageEvent(event('TEXT_SELECTED'), 1); session.onPageEvent(event('TEXT_OPENED'), 1);
    session.onPageEvent(event('TEXT_SUBMITTED', { selectedText: request.selectedText, question: request.question }), 1);
    expect(client.ask).not.toHaveBeenCalled(); expect(client.interruptGuidance).toHaveBeenCalledOnce();
    session.setConsent(true); expect(client.ask).not.toHaveBeenCalled();
    session.onPageEvent(event('TEXT_SUBMITTED', { selectedText: request.selectedText, question: request.question }), 1);
    expect(client.ask).toHaveBeenCalledOnce(); session.dispose();
  });
  it.each(['stop', 'invalidate', 'connectionLost', 'dispose'] as const)('rejects late replies after %s', async (action) => {
    const { session, client, states, event, resolve } = setup(); session.setConsent(true);
    session.onPageEvent(event('TEXT_SELECTED'), 1); session.onPageEvent(event('TEXT_SUBMITTED', { selectedText: request.selectedText, question: request.question }), 1);
    const command = client.ask.mock.calls[0]![0]; session[action]();
    expect(client.ask.mock.calls[0]![1].aborted).toBe(true);
    resolve({ protocolVersion: 1, sessionId: command.sessionId, requestId: command.requestId, pageKey: command.pageKey, selectionId: command.selectionId, result });
    await Promise.resolve(); expect(states.at(-1)?.kind).not.toBe('answered');
  });
  it('retains a completed detailed reply when its floating surface closes', async () => {
    const { session, client, states, event, resolve } = setup(); session.setConsent(true);
    session.onPageEvent(event('TEXT_SELECTED'), 1); session.onPageEvent(event('TEXT_SUBMITTED', { selectedText: request.selectedText, question: request.question }), 1);
    const command = client.ask.mock.calls[0]![0];
    resolve({ protocolVersion: 1, sessionId: command.sessionId, requestId: command.requestId, pageKey: command.pageKey, selectionId: command.selectionId, result });
    await Promise.resolve(); session.onPageEvent(event('TEXT_CANCELLED'), 1);
    expect(states.at(-1)).toMatchObject({ kind: 'answered', result });
    session.connectionLost(); session.onConnected();
    expect(states.at(-1)).toMatchObject({ kind: 'answered', result });
    session.onPortMessage({ type: 'TEXT_ARMED', sessionId: command.sessionId, tabId: 1, pageKey: 'page' });
    session.onPageEvent(event('TEXT_SELECTED', { selectionId: 'new' }), 1);
    expect(states.at(-1)?.result).toBeUndefined(); session.dispose();
  });
  it('new selections and consent withdrawal abort pending work; wrong tab/identity is ignored', () => {
    const { session, client, event } = setup(); session.setConsent(true);
    session.onPageEvent(event('TEXT_SELECTED'), 2); session.onPageEvent(event('TEXT_SUBMITTED', { selectedText: request.selectedText, question: request.question }), 1);
    expect(client.ask).not.toHaveBeenCalled();
    session.onPageEvent(event('TEXT_SELECTED'), 1); session.onPageEvent(event('TEXT_SUBMITTED', { selectedText: request.selectedText, question: request.question }), 1);
    session.onPageEvent(event('TEXT_SELECTED', { selectionId: 'new' }), 1);
    expect(client.ask.mock.calls[0]![1].aborted).toBe(true); session.setConsent(false); session.dispose();
  });
  it('rejects invalid internal messages and stale/malformed response envelopes', () => {
    expect(isTextCommand(request)).toBe(true);
    expect(isTextCommand({ ...request, tabId: -1 })).toBe(false);
    expect(isTextEvent({ type: 'TEXT_OPENED', ...identity })).toBe(true);
    expect(isTextEvent({ type: 'TEXT_SUBMITTED', ...identity, selectedText: 'person@example.com', question: 'Explain' })).toBe(false);
    expect(isTextPageCommand({ type: 'SHOW_TEXT', ...identity, result: { kind: 'explanation', quickExplanation: 'short' } })).toBe(false);
    expect(validateTextResponse({ protocolVersion: 1, ...identity, requestId: 2, result }, request)).toBeNull();
  });
  it('Stop survives reconnection and late enable acknowledgements until explicit Resume', () => {
    const { session, client, states, event } = setup();
    session.stop(); session.connectionLost(); const calls = client.post.mock.calls.length;
    session.onConnected();
    expect(client.post.mock.calls).toHaveLength(calls);
    session.onPortMessage({ type: 'TEXT_ARMED', sessionId: event('TEXT_SELECTED').sessionId, tabId: 1, pageKey: 'page' });
    expect(states.at(-1)?.kind).toBe('stopped');
    session.enable(); expect(client.post.mock.calls.length).toBe(calls + 1); session.dispose();
  });
  it('bounds and validates a text response and sends no local tab metadata', async () => {
    const fetch = vi.fn(async () => Response.json({ protocolVersion: 1, ...identity, requestId: 1, result })); vi.stubGlobal('fetch', fetch);
    await requestText(request, new AbortController().signal);
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).not.toHaveProperty('tabId');
    expect(init.redirect).toBe('error'); expect(init.cache).toBe('no-store');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(16385))));
    await expect(requestText(request, new AbortController().signal)).rejects.toThrow('reply safely');
  });
});
