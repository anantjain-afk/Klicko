import assert from 'node:assert/strict';
import { validateGuidanceResponse } from '@clickpilot/shared/guidance';
import fixture from '../tests/fixtures/valid-request.json' with { type: 'json' };

// Explicit opt-in command: four real API calls using synthetic data only.
// Never print response text, credentials or raw provider errors.
const cases = [
  ['guidance', 'Show me which control opens Settings.'],
  ['answer', 'Explain what a navigation menu is in general. No highlight is needed.'],
  ['clarification', 'Find Settings.'],
  ['unsupported', 'Tell me my current account balance from this page.'],
];
let requestId = 0;
for (const [kind, userGoal] of cases) {
  const request = globalThis.structuredClone(fixture);
  request.requestId = ++requestId;
  request.userGoal = userGoal;
  if (kind === 'clarification') request.elements.push({ ...request.elements[0], id: 'el_2', context: 'Dialog' });
  const response = await globalThis.fetch('http://127.0.0.1:8787/v1/guidance/next', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: globalThis.AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `Gemini ${kind} smoke failed: HTTP ${response.status}, code ${body.error?.code ?? 'unknown'}`);
  const result = validateGuidanceResponse(body, request, request.elements.map((element) => element.id));
  assert.ok(result, `Gemini ${kind} smoke returned invalid or ungrounded output`);
  assert.equal(result.result.kind, kind, `Gemini ${kind} smoke chose a different outcome`);
  globalThis.console.log(`REAL GEMINI PASS: ${kind}, protocol 2, bounded validated result${kind === 'guidance' ? ', observed target' : ''}`);
}
