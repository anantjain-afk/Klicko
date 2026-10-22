import assert from 'node:assert/strict';
import fixture from '../tests/fixtures/valid-request.json' with { type: 'json' };

// Negative contract checks never invoke Gemini, even when credentials are present.
const endpoint = 'http://127.0.0.1:8787/v1/guidance/next';
const json = { 'Content-Type': 'application/json' };
const cases = [
  ['malformed JSON', '{', 400, 'invalid_json'],
  ['oversized body', JSON.stringify({ value: 'x'.repeat(70_000) }), 413, 'payload_too_large'],
  ['forbidden field', JSON.stringify({ ...fixture, screenshot: 'FORBIDDEN-FAKE-MARKER' }), 400, 'invalid_request'],
  ['excessive label', JSON.stringify({ ...fixture, elements: [{ ...fixture.elements[0], name: 'x'.repeat(81) }] }), 400, 'invalid_request'],
  ['sensitive goal', JSON.stringify({ ...fixture, userGoal: 'Use sk-private-marker' }), 422, 'unsafe_context'],
];

for (const [name, body, status, code] of cases) {
  const response = await globalThis.fetch(endpoint, { method: 'POST', headers: json, body });
  assert.equal(response.status, status, `${name}: unexpected status`);
  const result = await response.json();
  assert.equal(result.kind, 'error');
  assert.equal(result.error.code, code, `${name}: unexpected error code`);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  globalThis.console.log(`PASS: ${name} → ${status} ${code}`);
}
