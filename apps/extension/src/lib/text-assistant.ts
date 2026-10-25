import { MAX_TEXT_BYTES, TextErrorSchema, TextIdentitySchema, TextRequestSchema, prepareText, validateTextResponse,
  safeTextResult, type TextRequest, type TextIdentity, type TextResult } from '@clickpilot/shared/text-assistant';
import { readBoundedJson } from '@clickpilot/shared/http';
import { aiServiceError } from './ai-errors';

export type TextEvent = TextIdentity & (
  { type: 'TEXT_SELECTED' | 'TEXT_OPENED' | 'TEXT_CANCELLED' | 'TEXT_INVALIDATED' }
  | { type: 'TEXT_SUBMITTED'; selectedText: string; question: string }
);
export interface TextCommand extends TextRequest { type: 'ASK_TEXT'; tabId: number }
export type TextPageCommand =
  | { type: 'ENABLE_TEXT'; sessionId: string; consent: boolean }
  | { type: 'DISABLE_TEXT'; sessionId: string }
  | (TextIdentity & { type: 'CHECK_TEXT' })
  | (TextIdentity & { type: 'SHOW_TEXT'; result?: TextResult; error?: string });

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function identity(value: Record<string, unknown>): boolean {
  return TextIdentitySchema.safeParse({ sessionId: value.sessionId, pageKey: value.pageKey, selectionId: value.selectionId }).success;
}
export function isTextEvent(value: unknown): value is TextEvent {
  if (!record(value) || !identity(value)) return false;
  if (value.type === 'TEXT_SUBMITTED') return typeof value.selectedText === 'string' && typeof value.question === 'string'
    && prepareText(value.selectedText, value.question) !== null;
  return ['TEXT_SELECTED', 'TEXT_OPENED', 'TEXT_CANCELLED', 'TEXT_INVALIDATED'].includes(String(value.type));
}
export function isTextCommand(value: unknown): value is TextCommand {
  if (!record(value) || value.type !== 'ASK_TEXT' || !Number.isSafeInteger(value.tabId) || Number(value.tabId) < 0) return false;
  const request = { ...value }; delete request.type; delete request.tabId;
  return TextRequestSchema.safeParse(request).success;
}
export function isTextPageCommand(value: unknown): value is TextPageCommand {
  if (!record(value)) return false;
  if (value.type === 'DISABLE_TEXT') return TextIdentitySchema.pick({ sessionId: true }).safeParse({ sessionId: value.sessionId }).success;
  if (value.type === 'ENABLE_TEXT') return typeof value.consent === 'boolean'
    && TextIdentitySchema.pick({ sessionId: true }).safeParse({ sessionId: value.sessionId }).success;
  if (!identity(value)) return false;
  if (value.type === 'CHECK_TEXT') return true;
  if (value.type !== 'SHOW_TEXT') return false;
  if (typeof value.error === 'string' && value.error.length <= 240 && value.result === undefined) return true;
  return safeTextResult(value.result) !== null && value.error === undefined;
}

export async function requestText(command: TextCommand, signal: AbortSignal) {
  const raw = { protocolVersion: command.protocolVersion, operation: command.operation, sessionId: command.sessionId,
    requestId: command.requestId, pageKey: command.pageKey, selectionId: command.selectionId, selectedText: command.selectedText, question: command.question };
  const clean = prepareText(raw.selectedText, raw.question);
  if (!clean) throw new Error('The passage or question may contain sensitive information. Select public text instead.');
  const request = TextRequestSchema.parse({ ...raw, ...clean });
  const body = JSON.stringify(request);
  if (new TextEncoder().encode(body).byteLength > MAX_TEXT_BYTES) throw new Error('The selected text request is too large. Select a shorter passage.');
  const response = await fetch('http://127.0.0.1:8787/v1/text/explain', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    signal, redirect: 'error', cache: 'no-store',
  }).catch(() => { throw aiServiceError('connection'); });
  const value = await readBoundedJson(response, MAX_TEXT_BYTES).catch(() => { throw aiServiceError('invalid_reply'); });
  if (!response.ok) {
    const error = TextErrorSchema.safeParse(value);
    throw aiServiceError(error.success ? error.data.error.code : 'invalid_reply');
  }
  const parsed = validateTextResponse(value, request);
  if (!parsed) throw aiServiceError('invalid_reply');
  return parsed;
}
