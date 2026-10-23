import { z } from 'zod';

export const MAX_REQUEST_BYTES = 64 * 1024;
export const MAX_ELEMENTS = 150;
export const MAX_STEPS = 20;
export const OBSERVATION_SETTLE_MS = 400;
export const OBSERVATION_MAX_MS = 5000;
export const OBSERVATION_TIMEOUT_GRACE_MS = 1500;
export const VerificationStatusSchema = z.enum(['pending', 'verified', 'not_verified', 'unverifiable', 'user_confirmed']);
export const TaskContextSchema = z.strictObject({
  stepNumber: z.number().int().min(1).max(MAX_STEPS),
  previousStep: z.strictObject({
    action: z.string().trim().min(1).max(160),
    event: z.enum(['none', 'trusted_click']),
    status: VerificationStatusSchema,
  }).nullable(),
});
export type TaskContext = z.infer<typeof TaskContextSchema>;
export const ExpectedOutcomeSchema = z.strictObject({
  type: z.enum(['target_hidden', 'target_expanded']),
});
export type ExpectedOutcome = z.infer<typeof ExpectedOutcomeSchema>;
const identityId = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const targetId = z.string().regex(/^el_\d{1,3}$/);
const shortText = z.string().trim().min(1).max(240);
const role = z.enum(['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'switch', 'combobox', 'textbox']);

export const GuidanceRequestSchema = z.strictObject({
  protocolVersion: z.literal(3),
  operation: z.literal('next'),
  sessionId: z.string().uuid(),
  requestId: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  userGoal: shortText,
  taskContext: TaskContextSchema,
  page: z.strictObject({
    url: z.string().min(1).max(2048).refine((value) => {
      try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
    }),
    pageKey: identityId,
    snapshotId: identityId,
  }),
  elements: z.array(z.strictObject({
    id: targetId,
    role,
    name: z.string().max(80),
    context: z.string().max(80),
    disabled: z.boolean(),
  })).max(MAX_ELEMENTS).refine((elements) => new Set(elements.map((element) => element.id)).size === elements.length),
});

export type GuidanceRequest = z.infer<typeof GuidanceRequestSchema>;

// Model results can describe one allowed result, never browser operations,
// executable code, HTML nodes, or selectors. Strings remain untrusted text.
export const AssistantResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('guidance'),
    nextStep: z.enum(['none', 'after_user_action']),
    expectedOutcome: ExpectedOutcomeSchema.optional(),
    message: z.string().trim().min(1).max(600),
    targetId,
    instruction: z.string().trim().min(1).max(160),
  }),
  z.strictObject({ kind: z.literal('answer'), message: z.string().trim().min(1).max(600) }),
  z.strictObject({ kind: z.literal('clarification'), message: z.string().trim().min(1).max(600) }),
  z.strictObject({ kind: z.literal('unsupported'), message: z.string().trim().min(1).max(600) }),
]);
export type AssistantResult = z.infer<typeof AssistantResultSchema>;

export const GuidanceResponseSchema = z.strictObject({
  protocolVersion: z.literal(3),
  sessionId: z.string().uuid(),
  requestId: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  pageKey: identityId,
  snapshotId: identityId,
  result: AssistantResultSchema,
});

export type GuidanceResponse = z.infer<typeof GuidanceResponseSchema>;

export const ErrorCodeSchema = z.enum([
  'invalid_request', 'invalid_json', 'payload_too_large', 'unsupported_media_type',
  'unsafe_context', 'provider_unavailable', 'provider_error', 'invalid_provider_response',
  'not_found', 'method_not_allowed', 'local_only', 'internal_error',
  'service_disabled', 'rate_limited', 'timeout', 'cancelled',
]);

export const GuidanceErrorSchema = z.strictObject({
  protocolVersion: z.literal(3), kind: z.literal('error'),
  error: z.strictObject({ code: ErrorCodeSchema, message: shortText }),
});

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

// Call after parsing, against the privacy-filtered inventory actually supplied
// to the provider, rather than the larger original DOM inventory.
export function validateGuidanceResponse(value: unknown, request: { sessionId: string; requestId: number; page: { pageKey: string; snapshotId: string } }, eligibleTargetIds: string[]): GuidanceResponse | null {
  const parsed = GuidanceResponseSchema.safeParse(value);
  if (!parsed.success) return null;
  const response = parsed.data;
  if (response.sessionId !== request.sessionId || response.requestId !== request.requestId
    || response.pageKey !== request.page.pageKey || response.snapshotId !== request.page.snapshotId) return null;
  if (response.result.kind === 'guidance' && !eligibleTargetIds.includes(response.result.targetId)) return null;
  return response;
}
