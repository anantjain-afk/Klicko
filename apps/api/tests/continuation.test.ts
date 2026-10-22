import { describe, expect, it, vi } from 'vitest';
import { AssistantResultSchema, GuidanceRequestSchema, MAX_STEPS } from '@clickpilot/shared/guidance';
import { prepareProviderContext } from '@clickpilot/shared/privacy';
import { createApp } from '../src/app';
import fixture from './fixtures/valid-request.json';

const guidance = { kind: 'guidance', nextStep: 'after_user_action', message: 'Open Settings.', instruction: 'Click Settings.', targetId: 'el_1' };
const context = { stepNumber: 2, previousStep: { action: 'Click Settings.', event: 'trusted_click', status: 'unverifiable' } };
const post = (value: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

describe('protocol 3 bounded continuation', () => {
  it.each(['none', 'after_user_action'])('accepts %s with or without an optional outcome', (nextStep) => {
    expect(AssistantResultSchema.safeParse({ ...guidance, nextStep }).success).toBe(true);
    for (const type of ['target_hidden', 'target_expanded']) {
      expect(AssistantResultSchema.safeParse({ ...guidance, nextStep, expectedOutcome: { type } }).success).toBe(true);
    }
  });
  it('rejects absent/invalid signals, scripted checks and continuation on text-only output', () => {
    const { nextStep: omitted, ...without } = guidance; expect(omitted).toBeDefined();
    const invalid = [without, { ...guidance, nextStep: 'always' }, { ...guidance, nextStep: null },
      { ...guidance, expectedOutcome: { type: 'target_expanded', selector: '#settings' } },
      { ...guidance, expectedOutcome: { type: 'url_change' } },
      { ...guidance, expectedOutcome: { type: 'execute', code: 'click()' } }];
    for (const kind of ['answer', 'clarification', 'unsupported']) {
      invalid.push({ ...guidance, kind });
      expect(AssistantResultSchema.safeParse({ kind, message: 'Reply', nextStep: 'none' }).success).toBe(false);
    }
    for (const value of invalid) expect(AssistantResultSchema.safeParse(value).success).toBe(false);
  });
  it('strictly bounds task context and rejects history, fields and old protocol', () => {
    const values = [undefined, { stepNumber: 0, previousStep: null }, { stepNumber: MAX_STEPS + 1, previousStep: null },
      { ...context, history: [] }, { ...context, previousStep: { ...context.previousStep, action: 'x'.repeat(161) } },
      { ...context, previousStep: { ...context.previousStep, action: '' } },
      { ...context, previousStep: { ...context.previousStep, status: 'complete' } },
      { ...context, previousStep: { ...context.previousStep, event: 'typed_private_value' } },
      { ...context, previousStep: { ...context.previousStep, value: 'PRIVATE-MARKER' } }];
    for (const taskContext of values) expect(GuidanceRequestSchema.safeParse({ ...fixture, taskContext }).success).toBe(false);
    expect(GuidanceRequestSchema.safeParse({ ...fixture, protocolVersion: 2 }).success).toBe(false);
  });
  it('sends only bounded previous-step context to the provider and preserves the original goal', async () => {
    const provider = vi.fn(async () => guidance);
    const request = { ...fixture, userGoal: 'Change a Vercel domain', taskContext: context };
    const reply = await createApp(provider).request('/v1/guidance/next', post(request));
    expect(reply.status).toBe(200);
    const sent = provider.mock.calls[0] as unknown as [ReturnType<typeof prepareProviderContext>];
    expect(sent[0]).toMatchObject({ userGoal: 'Change a Vercel domain', taskContext: context });
    expect(JSON.stringify(sent)).not.toMatch(/sessionId|requestId|pageKey|snapshotId|history|rect/);
    expect(await reply.json()).toMatchObject({ protocolVersion: 3, result: guidance });
  });
  it('blocks sensitive previous-action text at the backend and privacy helper', async () => {
    const provider = vi.fn();
    for (const action of ['Use sk-private-marker', 'Contact person@example.com', 'Use password PRIVATE-MARKER']) {
      const request = { ...fixture, taskContext: { ...context, previousStep: { ...context.previousStep, action } } };
      expect(prepareProviderContext(GuidanceRequestSchema.parse(request))).toBeNull();
      const reply = await createApp(provider).request('/v1/guidance/next', post(request));
      expect(reply.status).toBe(422);
      expect(await reply.text()).not.toContain('PRIVATE-MARKER');
    }
    expect(provider).not.toHaveBeenCalled();
  });
});
