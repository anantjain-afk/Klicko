import type { z } from 'zod';

type Stage = 'provider_envelope' | 'provider_text_length' | 'provider_json'
  | 'assistant_schema' | 'sensitive_output' | 'target_membership' | 'response_envelope';

const allowedPaths = new Set(['candidates', 'finishReason', 'content', 'parts', 'text', 'thought',
  'kind', 'nextStep', 'expectedOutcome', 'type', 'message', 'targetId', 'instruction']);

// Only fixed stage names, issue codes, and known schema paths reach the console.
export function reportValidationFailure(
  env: { GUIDANCE_DIAGNOSTICS?: string }, stage: Stage, issues: z.core.$ZodIssue[] = [],
): void {
  if (env.GUIDANCE_DIAGNOSTICS !== 'true') return;
  const paths = issues.map((issue) => issue.path.map((part) => {
    if (typeof part === 'number') return '[index]';
    return allowedPaths.has(String(part)) ? part : '<field>';
  }).join('.'));
  console.warn('[ClickPilot guidance validation]', { stage, paths, codes: issues.map((issue) => issue.code) });
}
