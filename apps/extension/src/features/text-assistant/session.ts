import { TextIdentitySchema, validateTextResponse, type TextResult } from '@clickpilot/shared/text-assistant';
import { isTextEvent, type TextCommand } from '../../lib/text-assistant';

export interface TextState {
  kind: 'idle' | 'ready' | 'selected' | 'composing' | 'requesting' | 'answered' | 'error' | 'stopped';
  message: string;
  question?: string;
  result?: TextResult;
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
      if (!response) throw new Error('The explanation was invalid or stale. Select text and try again.');
      active = null;
      set({ kind: 'answered', message: 'Response about your selected passage.', question: command.question, result: response.result });
    } catch (error) {
      if (active !== run) return;
      active = null;
      set({ kind: 'error', question: command.question,
        message: error instanceof Error && error.message.length <= 240 ? error.message : 'Text assistance could not respond. Retry if needed.' });
    }
  }
  return {
    enable,
    onConnected() { if (enabled) enable(); },
    ownedTab: () => page?.tabId,
    setConsent(value: boolean) {
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
        if (state.kind === 'idle' || state.kind === 'stopped' || state.kind === 'error') set({ kind: 'ready', message: 'Select public webpage text, then choose Ask ClickPilot.' });
      }
      if (value.type === 'TEXT_ARM_ERROR' && enabled) set({ kind: 'error', message: 'Click the ClickPilot toolbar icon on a public page to enable text help.' });
    },
    onPageEvent(value: unknown, tabId: number) {
      if (!enabled || !isTextEvent(value) || value.sessionId !== sessionId || page?.tabId !== tabId || page.pageKey !== value.pageKey) return;
      if (value.type === 'TEXT_SELECTED') {
        clear('Selected passage ready. Choose Ask ClickPilot on the page.', 'selected'); selectionId = value.selectionId; return;
      }
      if (value.selectionId !== selectionId) return;
      if (value.type === 'TEXT_OPENED') { client.interruptGuidance(); set({ kind: 'composing', message: 'Type your question beside the selected passage.' }); }
      if (value.type === 'TEXT_SUBMITTED') void submit({ type: 'ASK_TEXT', protocolVersion: 1, operation: 'explain_text',
        sessionId, pageKey: value.pageKey, selectionId, tabId, requestId: 1, selectedText: value.selectedText, question: value.question });
      if (value.type === 'TEXT_INVALIDATED') clear('The page or passage changed. Select text again.');
      if (value.type === 'TEXT_CANCELLED') {
        cancelRequest(); retryCommand = null; selectionId = null;
        if (state.kind !== 'answered') set({ kind: 'ready', message: 'Question cancelled. Select text to ask again.' });
      }
    },
    invalidate(message = 'Page changed. Activate the toolbar and select text again.') {
      page = null; clear(message); post({ type: 'STOP_TEXT' });
    },
    stop() { enabled = false; clear('Text assistant stopped. Resume when you want to select a passage.', 'stopped'); post({ type: 'STOP_TEXT' }); },
    connectionLost() { page = null; clear('The connection closed. Activate the toolbar to resume text help.', 'stopped'); },
    retry() { if (state.kind === 'error' && retryCommand) void submit(retryCommand); },
    dispose() { enabled = false; cancelRequest(); retryCommand = null; page = null; post({ type: 'STOP_TEXT' }); },
  };
}
