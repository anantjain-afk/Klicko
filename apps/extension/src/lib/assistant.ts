import { GuidanceErrorSchema, GuidanceRequestSchema, MAX_REQUEST_BYTES, validateGuidanceResponse } from '@clickpilot/shared/guidance';
import { containsSensitiveText, prepareProviderContext } from '@clickpilot/shared/privacy';
import { readBoundedJson } from '@clickpilot/shared/http';
import type { GuidanceIdentity, PageSnapshot } from './messages';

export const API_URL = 'http://127.0.0.1:8787/v1/guidance/next';
export interface AssistantRequest extends GuidanceIdentity {
  type: 'ASK_ASSISTANT';
  tabId: number;
  pageKey: string;
  snapshotId: string;
  userGoal: string;
}

export function isAssistantRequest(value: unknown): value is AssistantRequest {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.type === 'ASK_ASSISTANT' && typeof item.tabId === 'number' && Number.isSafeInteger(item.tabId) && item.tabId >= 0
    && typeof item.sessionId === 'string' && /^[a-f\d-]{36}$/i.test(item.sessionId)
    && typeof item.requestId === 'number' && Number.isSafeInteger(item.requestId) && item.requestId > 0
    && typeof item.pageKey === 'string' && /^[\w-]{1,80}$/.test(item.pageKey)
    && typeof item.snapshotId === 'string' && /^[\w-]{1,80}$/.test(item.snapshotId)
    && typeof item.userGoal === 'string' && item.userGoal.trim().length > 0 && item.userGoal.length <= 240;
}

export function assistantError(message: string): never { throw new Error(message); }

// Called only after the background has checked the active tab and current snapshot.
export async function requestAssistant(command: AssistantRequest, snapshot: PageSnapshot, url: string, signal: AbortSignal): Promise<unknown> {
  const raw = GuidanceRequestSchema.safeParse({
    protocolVersion: 2, operation: 'next', sessionId: command.sessionId, requestId: command.requestId, userGoal: command.userGoal,
    page: { url, pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId },
    elements: snapshot.elements.map(({ id, role, name, context, disabled }) => ({ id, role, name, context, disabled })),
  });
  if (!raw.success) return assistantError('This page context cannot be sent. Try a smaller public page.');
  const clean = prepareProviderContext(raw.data);
  if (!clean) return assistantError('This page or question may contain sensitive information. Use a public, non-sensitive page and question.');
  const request = GuidanceRequestSchema.parse({ ...raw.data, userGoal: clean.userGoal,
    page: { ...raw.data.page, url: clean.page.origin }, elements: clean.elements.map((element) => ({ ...element, disabled: false })) });
  const body = JSON.stringify(request);
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) return assistantError('The page context is too large to send.');
  const response = await fetch(API_URL, { method: 'POST', signal, redirect: 'error', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body });
  const value = await readBoundedJson(response, 8192);
  if (!response.ok) {
    const error = GuidanceErrorSchema.safeParse(value);
    return assistantError(error.success ? error.data.error.message : 'The local AI service returned an invalid error.');
  }
  const parsed = validateGuidanceResponse(value, request, clean.elements.map((element) => element.id));
  if (!parsed || containsSensitiveText(parsed.result.message)
    || (parsed.result.kind === 'guidance' && containsSensitiveText(parsed.result.instruction))) {
    return assistantError('The AI reply was invalid or referenced an unobserved control. Nothing was displayed.');
  }
  return parsed;
}
