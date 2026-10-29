import { MAX_TEXT_BYTES, TextIdentitySchema, TextRequestSchema, prepareText, validateTextResponse,
  safeTextResult, type TextRequest, type TextIdentity, type TextResult } from '@clickpilot/shared/text-assistant';
import { providerReply } from './provider-api';
import type { ProviderSettings } from './provider-settings';

export type TextEvent = TextIdentity & (
  { type: 'TEXT_SELECTED' | 'TEXT_OPENED' | 'TEXT_CANCELLED' | 'TEXT_INVALIDATED' }
  | { type: 'TEXT_SUBMITTED'; selectedText: string; question: string }
);
export interface TextCommand extends TextRequest { type: 'ASK_TEXT'; tabId: number }
export type TextPageCommand =
  | { type: 'ENABLE_TEXT'; sessionId: string; consent: boolean; resumeDraft?: boolean }
  | { type: 'DISABLE_TEXT'; sessionId: string }
  | { type: 'CANCEL_TEXT'; sessionId: string }
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
  if (value.type === 'DISABLE_TEXT' || value.type === 'CANCEL_TEXT') return TextIdentitySchema.pick({ sessionId: true }).safeParse({ sessionId: value.sessionId }).success;
  if (value.type === 'ENABLE_TEXT') return typeof value.consent === 'boolean'
    && (value.resumeDraft === undefined || typeof value.resumeDraft === 'boolean')
    && TextIdentitySchema.pick({ sessionId: true }).safeParse({ sessionId: value.sessionId }).success;
  if (!identity(value)) return false;
  if (value.type === 'CHECK_TEXT') return true;
  if (value.type !== 'SHOW_TEXT') return false;
  if (typeof value.error === 'string' && value.error.length <= 240 && value.result === undefined) return true;
  return safeTextResult(value.result) !== null && value.error === undefined;
}

export async function requestText(command: TextCommand, signal: AbortSignal, provider: ProviderSettings) {
  const raw = { protocolVersion: command.protocolVersion, operation: command.operation, sessionId: command.sessionId,
    requestId: command.requestId, pageKey: command.pageKey, selectionId: command.selectionId, selectedText: command.selectedText, question: command.question };
  const clean = prepareText(raw.selectedText, raw.question);
  if (!clean) throw new Error('The passage or question may contain sensitive information. Select public text instead.');
  const request = TextRequestSchema.parse({ ...raw, ...clean });
  const body = JSON.stringify(request);
  if (new TextEncoder().encode(body).byteLength > MAX_TEXT_BYTES) throw new Error('The selected text request is too large. Select a shorter passage.');
  const result = await providerReply(provider, 'text', clean, signal);
  const parsed = validateTextResponse({ protocolVersion: 1, sessionId: request.sessionId,
    requestId: request.requestId, pageKey: request.pageKey, selectionId: request.selectionId,
    result }, request);
  if (!parsed) throw new Error('Klicko couldn’t use that reply safely. Try again.');
  return parsed;
}
