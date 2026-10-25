import { z } from 'zod';
import { ErrorCodeSchema } from './guidance';
import { containsSensitiveText } from './privacy';

export const MAX_SELECTION_LENGTH = 2000;
export const MAX_QUESTION_LENGTH = 240;
export const MAX_TEXT_BYTES = 16 * 1024;
const id = z.string().min(1).max(80).regex(/^[\w-]+$/);
export const TextIdentitySchema = z.strictObject({
  sessionId: z.string().uuid(), pageKey: id, selectionId: id,
});
export const TextRequestSchema = TextIdentitySchema.extend({
  protocolVersion: z.literal(1), operation: z.literal('explain_text'),
  requestId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  selectedText: z.string().trim().min(2).max(MAX_SELECTION_LENGTH),
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
});
export const TextResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('explanation'),
    quickExplanation: z.string().trim().min(1).max(280),
    detailedExplanation: z.string().trim().min(1).max(2000) }),
  z.strictObject({ kind: z.literal('clarification'), message: z.string().trim().min(1).max(600) }),
  z.strictObject({ kind: z.literal('unsupported'), message: z.string().trim().min(1).max(600) }),
]);
export const TextResponseSchema = TextIdentitySchema.extend({
  protocolVersion: z.literal(1), requestId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  result: TextResultSchema,
});
export const TextErrorSchema = z.strictObject({ protocolVersion: z.literal(1), kind: z.literal('error'),
  error: z.strictObject({ code: ErrorCodeSchema, message: z.string().min(1).max(240) }) });
export type TextIdentity = z.infer<typeof TextIdentitySchema>;
export type TextRequest = z.infer<typeof TextRequestSchema>;
export type TextResult = z.infer<typeof TextResultSchema>;

export function normalizeText(text: string): string {
  // eslint-disable-next-line no-control-regex -- Normalize before checking and uploading text.
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function prepareText(selectedText: string, question: string): { selectedText: string; question: string } | null {
  if (selectedText.length > MAX_SELECTION_LENGTH || question.length > MAX_QUESTION_LENGTH) return null;
  const selected = normalizeText(selectedText);
  const ask = normalizeText(question);
  if (selected.replace(/\s/g, '').length < 2 || !/[\p{L}\p{N}]/u.test(selected) || !ask
    || containsSensitiveText(selected) || containsSensitiveText(ask)) return null;
  return { selectedText: selected, question: ask };
}

export function safeTextResult(value: unknown): TextResult | null {
  const parsed = TextResultSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  const text = result.kind === 'explanation' ? `${result.quickExplanation} ${result.detailedExplanation}` : result.message;
  return containsSensitiveText(text) ? null : result;
}

export function validateTextResponse(value: unknown, request: TextRequest) {
  const parsed = TextResponseSchema.safeParse(value);
  if (!parsed.success) return null;
  const reply = parsed.data;
  return reply.sessionId === request.sessionId && reply.requestId === request.requestId
    && reply.pageKey === request.pageKey && reply.selectionId === request.selectionId && safeTextResult(reply.result)
    ? reply : null;
}
