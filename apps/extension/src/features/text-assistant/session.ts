import { TextIdentitySchema, validateTextResponse, type TextResult } from '@clickpilot/shared/text-assistant';
import { isTextEvent, type TextCommand } from '../../lib/text-assistant';

export interface TextState {
  kind: 'idle' | 'ready' | 'selected' | 'composing' | 'requesting' | 'answered' | 'error' | 'stopped';
  message: string;
  question?: string;
  result?: TextResult;
  canRetry?: boolean;
}
interface TextClient {
  post: (message: unknown) => void;
  ask: (command: TextCommand, signal: AbortSignal) => Promise<unknown>;
  interruptGuidance: () => void;
}

export function createTextSession(client: TextClient, change: (state: TextState) => void) {
  const sessionId = crypto.randomUUID();
  let requestNumber = 0;
  let consent = false;
  let enabled = true;
  let page: { tabId: number; pageKey: string } | null = null;
  let selectionId: string | null = null;
  let active: { command: TextCommand; abort: AbortController } | null = null;
  let retryCommand: TextCommand | null = null;
  let state: TextState = { kind: 'idle', message: 'Select public webpage text to ask about it.' };

  function set(next: TextState) { state = next; change(next); }
  function cancelRequest() { const previous = active; active = null; previous?.abort.abort(); }
  function post(value: unknown) { try { client.post(value); } catch { /* The connection handler provides recovery UI. */ } }
  function clear(message: string, kind: TextState['kind'] = 'idle') {
    cancelRequest(); selectionId = null; retryCommand = null;
    set({ kind, message });
  }
  function enable() {
    enabled = true;
    post({ type: 'ARM_TEXT', sessionId, consent });
  }
  async function submit(command: TextCommand) {
    if (!enabled || !consent || page?.tabId !== command.tabId || page.pageKey !== command.pageKey || selectionId !== command.selectionId) return;
    cancelRequest();
    const run = { command: { ...command, requestId: ++requestNumber }, abort: new AbortController() };
    active = run; retryCommand = run.command;
    set({ kind: 'requesting', message: 'Explaining the selected passage…', question: command.question });
    try {
      const value = await client.ask(run.command, run.abort.signal);
      if (active !== run) return;
      const response = validateTextResponse(value, run.command);
      if (!response) throw new Error('Klicko couldn’t use that reply safely. Select the passage and try again.');
      active = null;
      set({ kind: 'answered', message: 'Response about your selected passage.', question: command.question, result: response.result });
    } catch (error) {
      if (active !== run) return;
      active = null;
      set({ kind: 'error', question: command.question, canRetry: true,
        message: error instanceof Error && error.message.length <= 240 ? error.message : 'Text assistance could not respond. Retry if needed.' });
    }
  }
  return {
    enable,
    onConnected() { if (enabled) enable(); },
    ownedTab: () => page?.tabId,
    setConsent(value: boolean) {
      if (consent === value) return;
      consent = value;
      if (!value) { clear('Selected-text sharing is off. Nothing will be uploaded.'); post({ type: 'STOP_TEXT' }); }
      if (enabled) enable();
    },
    onPortMessage(value: unknown) {
      if (!value || typeof value !== 'object' || !('type' in value)) return;
      if (enabled && value.type === 'TEXT_ARMED' && 'sessionId' in value && value.sessionId === sessionId && 'tabId' in value
        && typeof value.tabId === 'number' && Number.isSafeInteger(value.tabId) && value.tabId >= 0 && 'pageKey' in value
        && TextIdentitySchema.safeParse({ sessionId, pageKey: value.pageKey, selectionId: 'pending' }).success) {
        page = { tabId: value.tabId, pageKey: String(value.pageKey) };
        if ('selectionId' in value && TextIdentitySchema.safeParse({ sessionId, pageKey: value.pageKey, selectionId: value.selectionId }).success) {
          selectionId = String(value.selectionId);
        }
        if (state.kind === 'idle' || state.kind === 'stopped' || (state.kind === 'error' && !state.question)) set({ kind: 'ready', message: 'Select public webpage text, then choose Ask Klicko.' });
      }
      if (value.type === 'TEXT_ARM_ERROR' && enabled) set({ kind: 'error', message: 'reason' in value && value.reason === 'privacy'
        ? 'For your privacy, text help is unavailable on this page. Try a public page.'
        : 'Click the Klicko toolbar icon on a public page to enable text help.' });
    },
    onPageEvent(value: unknown, tabId: number) {
      if (!enabled || !isTextEvent(value) || value.sessionId !== sessionId || page?.tabId !== tabId || page.pageKey !== value.pageKey) return;
      if (value.type === 'TEXT_SELECTED') {
        clear('Selected passage ready. Choose Ask Klicko on the page.', 'selected'); selectionId = value.selectionId; return;
      }
      if (value.selectionId !== selectionId) return;
      if (value.type === 'TEXT_OPENED') { client.interruptGuidance(); set({ kind: 'composing', message: 'Type your question beside the selected passage.' }); }
      if (value.type === 'TEXT_SUBMITTED') {
        if (consent && state.kind !== 'composing') client.interruptGuidance();
        void submit({ type: 'ASK_TEXT', protocolVersion: 1, operation: 'explain_text',
          sessionId, pageKey: value.pageKey, selectionId, tabId, requestId: 1, selectedText: value.selectedText, question: value.question });
      }
      if (value.type === 'TEXT_INVALIDATED') clear('The page or passage changed. Select text again.');
      if (value.type === 'TEXT_CANCELLED') {
        cancelRequest(); retryCommand = null; selectionId = null;
        if (state.kind !== 'answered') set({ kind: 'ready', message: 'Question cancelled. Select text to ask again.' });
      }
    },
    invalidate(message = 'Page changed. Activate the toolbar and select text again.') {
      page = null; clear(message); post({ type: 'STOP_TEXT' });
    },
    pauseSelection() {
      clear('Return to this tab and select text to ask again.');
      post({ type: 'CANCEL_TEXT', sessionId });
    },
    stop() { enabled = false; clear('Text assistant stopped. Resume when you want to select a passage.', 'stopped'); post({ type: 'STOP_TEXT' }); },
    connectionLost() {
      page = null; selectionId = null; retryCommand = null; cancelRequest();
      if (!enabled) return;
      if (state.kind === 'answered') return;
      set({ ...state, kind: state.question ? 'error' : 'idle', canRetry: false, message: state.question
        ? 'The connection was interrupted. Select the passage again to retry your question.'
        : 'Klicko is reconnecting. Your sharing choices are unchanged.' });
    },
    retry() { if (state.kind === 'error' && retryCommand) void submit(retryCommand); },
    dispose() { enabled = false; cancelRequest(); retryCommand = null; page = null; post({ type: 'STOP_TEXT' }); },
  };
}
