import { TaskContextSchema, type TaskContext, GuidanceRequestSchema, MAX_REQUEST_BYTES, validateGuidanceResponse } from '@clickpilot/shared/guidance';
import { containsSensitiveText, prepareProviderContext } from '@clickpilot/shared/privacy';
import type { GuidanceIdentity, PageSnapshot } from './messages';
import { aiServiceError } from './ai-errors';
import { providerReply } from './provider-api';
import type { ProviderSettings } from './provider-settings';

export interface AssistantRequest extends GuidanceIdentity {
  type: 'ASK_ASSISTANT';
  tabId: number;
  pageKey: string;
  snapshotId: string;
  userGoal: string;
  taskContext: TaskContext;
}

export function isAssistantRequest(value: unknown): value is AssistantRequest {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.type === 'ASK_ASSISTANT' && typeof item.tabId === 'number' && Number.isSafeInteger(item.tabId) && item.tabId >= 0
    && typeof item.sessionId === 'string' && /^[a-f\d-]{36}$/i.test(item.sessionId)
    && typeof item.requestId === 'number' && Number.isSafeInteger(item.requestId) && item.requestId > 0
    && typeof item.pageKey === 'string' && /^[\w-]{1,80}$/.test(item.pageKey)
    && typeof item.snapshotId === 'string' && /^[\w-]{1,80}$/.test(item.snapshotId)
    && TaskContextSchema.safeParse(item.taskContext).success
    && typeof item.userGoal === 'string' && item.userGoal.trim().length > 0 && item.userGoal.length <= 240;
}

export function assistantError(message: string): never { throw new Error(message); }

// Called only after the background has checked the active tab and current snapshot.
export async function requestAssistant(command: AssistantRequest, snapshot: PageSnapshot, url: string, signal: AbortSignal,
  provider: ProviderSettings): Promise<unknown> {
  const raw = GuidanceRequestSchema.safeParse({
    protocolVersion: 3, operation: 'next', sessionId: command.sessionId, requestId: command.requestId, userGoal: command.userGoal, taskContext: command.taskContext,
    page: { url, pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId },
    elements: snapshot.elements.map(({ id, role, name, context, disabled, expanded }) => ({ id, role, name, context, disabled,
      ...(typeof expanded === 'boolean' ? { expanded } : {}) })),
  });
  if (!raw.success) return assistantError('This page context cannot be sent. Try a smaller public page.');
  const clean = prepareProviderContext(raw.data);
  if (!clean) return assistantError('This page or question may contain sensitive information. Use a public, non-sensitive page and question.');
  const request = GuidanceRequestSchema.parse({ ...raw.data, userGoal: clean.userGoal, taskContext: clean.taskContext,
    page: { ...raw.data.page, url: clean.page.origin }, elements: clean.elements.map((element) => ({ ...element, disabled: false })) });
  const body = JSON.stringify(request);
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) return assistantError('The page context is too large to send.');
  const result = await providerReply(provider, 'guidance', clean, signal);
  const parsed = validateGuidanceResponse({ protocolVersion: 3, sessionId: request.sessionId,
    requestId: request.requestId, pageKey: request.page.pageKey, snapshotId: request.page.snapshotId,
    result }, request, clean.elements.map((element) => element.id));
  if (!parsed || containsSensitiveText(parsed.result.message)
    || (parsed.result.kind === 'guidance' && containsSensitiveText(parsed.result.instruction))) {
    throw aiServiceError('invalid_reply');
  }
  return parsed;
}
