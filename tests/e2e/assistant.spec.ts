import { createServer } from 'node:http';
import { test, expect, type Page } from '@playwright/test';
import { activateToolbar, launchExtension } from './extension';

// Test-only HTTP server. These browser tests NEVER contact Gemini.
test.describe.configure({ mode: 'serial' });
let outcome = 'guidance';
let requests: Record<string, unknown>[] = [];
let release: (() => void) | undefined;
const server = createServer(async (request, response) => {
  let text = '';
  for await (const chunk of request) text += String(chunk);
  const body = JSON.parse(text);
  requests.push(body);
  const target = body.elements.find((element: { name: string }) => element.name === 'Primary target');
  const kind = outcome.replace('delayed-', '');
  let result: unknown = kind === 'guidance'
    ? { kind, message: 'Use the primary control to try the fixture.', targetId: target?.id ?? 'el_999', instruction: 'Click Primary target.' }
    : { kind, message: kind === 'answer' ? 'A button offers an action when you click it.' : kind === 'clarification' ? 'Which Settings control do you mean?' : 'The available controls do not reveal that information.' };
  if (kind === 'hostile') result = { kind: 'answer', message: '<img src=x onerror="window.bad=true"> **literal** <script>alert(1)</script>' };
  if (kind === 'unknown') result = { kind: 'guidance', message: 'UNTRUSTED NARRATIVE', targetId: 'el_999', instruction: 'Bad target' };
  if (kind === 'invalid-answer') result = { kind: 'answer', message: 'UNTRUSTED NARRATIVE', targetId: target.id };
  if (outcome.startsWith('delayed-')) await new Promise<void>((resolve) => { release = resolve; });
  response.setHeader('Content-Type', 'application/json');
  if (kind === 'oversized') { response.end('x'.repeat(8193)); return; }
  if (kind === 'rate-limit') {
    response.statusCode = 429;
    response.end(JSON.stringify({ protocolVersion: 2, kind: 'error', error: { code: 'rate_limited', message: 'Gemini quota was reached. Wait before retrying.' } })); return;
  }
  response.end(JSON.stringify({ protocolVersion: 2, sessionId: body.sessionId,
    requestId: kind === 'stale' ? body.requestId + 1 : body.requestId,
    pageKey: body.page.pageKey, snapshotId: body.page.snapshotId, result }));
});
test.beforeAll(async () => { await new Promise<void>((resolve) => server.listen(8787, '127.0.0.1', resolve)); });
test.afterAll(async () => { release?.(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
test.beforeEach(() => { requests = []; outcome = 'guidance'; release = undefined; });

async function openAssistant() {
  const extension = await launchExtension();
  const page = await extension.context.newPage();
  await page.goto('http://127.0.0.1:4173/guidance.html?private=PRIVATE-QUERY#PRIVATE-FRAGMENT');
  await activateToolbar(page, extension.extensionId);
  const panel = await extension.context.newPage();
  await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
  await panel.setViewportSize({ width: 360, height: 1000 });
  await panel.getByRole('button', { name: 'AI assistant', exact: true }).click();
  await panel.getByLabel('Allow this panel').check();
  await page.bringToFront();
  return { ...extension, page, panel };
}
async function submit(panel: Page, question = 'Find primary target') {
  await panel.getByLabel('What would you like help with?').fill(question);
  await panel.getByRole('button', { name: /Ask Gemini|Send new question/ }).click();
}

test('MOCK API: panel explanation, exact tooltip, consent, safe payload and no automatic action', async () => {
  const { context, page, panel } = await openAssistant();
  try {
    await panel.getByLabel('Allow this panel').uncheck();
    await panel.getByLabel('What would you like help with?').fill('Find primary target');
    await expect(panel.getByRole('button', { name: 'Ask Gemini' })).toBeDisabled();
    expect(requests).toHaveLength(0);
    await panel.getByLabel('Allow this panel').check();
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Use the primary control');
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Primary target.');
    const outline = await page.locator('#clickpilot-overlay .highlight').boundingBox();
    const target = await page.locator('#primary').boundingBox();
    expect(outline!.x).toBeCloseTo(target!.x - 4);
    await expect(page.locator('#counter')).toHaveText('Clicks: 0');
    expect(requests).toHaveLength(1);
    const body = requests[0]!;
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE-|rect|viewport|GEMINI_API_KEY|history/);
    expect((body.page as { url: string }).url).toBe('http://127.0.0.1:4173');
    await panel.screenshot({ path: '/tmp/clickpilot-5b-360.png', fullPage: true });
    await panel.setViewportSize({ width: 260, height: 1000 });
    await panel.screenshot({ path: '/tmp/clickpilot-5b-260.png', fullPage: true });
    expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/clickpilot-5b-page.png' });
    await page.locator('#primary span').click();
    await expect(panel.getByRole('status')).toContainText('has not verified');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    expect(requests).toHaveLength(1);
  } finally { await context.close(); }
});

for (const kind of ['answer', 'clarification', 'unsupported', 'hostile']) {
  test(`MOCK API: ${kind} clears prior decoration and renders inert text`, async () => {
    const { context, page, panel } = await openAssistant();
    try {
      await submit(panel);
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
      outcome = kind;
      await submit(panel, `Independent ${kind} question`);
      await expect(panel.getByRole('status')).toContainText(kind === 'answer' ? 'A button offers' : kind === 'clarification' ? 'Which Settings' : kind === 'unsupported' ? 'do not reveal' : '<img src=x');
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
      await expect(panel.locator('.guidance-state img, .guidance-state script, .guidance-state strong')).toHaveCount(0);
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(requests[1])).not.toContain('Find primary target');
      await page.locator('#change-route').click();
      await expect(panel.getByRole('status')).toContainText('Page changed');
    } finally { await context.close(); }
  });
}

for (const kind of ['unknown', 'invalid-answer', 'stale', 'oversized', 'rate-limit']) {
  test(`MOCK API: ${kind} is an honest error with no narrative or overlay`, async () => {
    const { context, page, panel } = await openAssistant();
    try {
      outcome = kind;
      await submit(panel);
      await expect(panel.getByRole('alert')).not.toBeEmpty();
      await expect(panel.getByRole('alert')).not.toContainText('UNTRUSTED NARRATIVE');
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
      expect(requests).toHaveLength(1);
      await panel.getByRole('button', { name: 'Mock guidance', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Start mock guidance' })).toBeVisible();
    } finally { await context.close(); }
  });
}

for (const kind of ['answer', 'guidance']) {
  for (const action of ['stop', 'replace', 'navigate', 'tab', 'close']) {
    test(`MOCK API: late ${kind} is rejected after ${action}`, async () => {
      const { context, page, panel } = await openAssistant();
      try {
        outcome = `delayed-${kind}`;
        await submit(panel, 'Old question');
        await expect.poll(() => requests.length).toBe(1);
        const finish = release!;
        if (action === 'stop') await panel.getByRole('button', { name: 'Stop', exact: true }).click();
        if (action === 'replace') { outcome = 'answer'; await submit(panel, 'New question'); await expect(panel.getByRole('status')).toContainText('A button offers'); }
        if (action === 'navigate') await page.locator('#change-route').click();
        if (action === 'tab') { const other = await context.newPage(); await other.goto('http://127.0.0.1:4173/second.html'); }
        if (action === 'close') await panel.close();
        finish();
        await page.waitForTimeout(200);
        await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
        if (action !== 'close') {
          await expect(panel.getByRole('status')).toContainText(action === 'stop' ? 'Guidance stopped' : action === 'replace' ? 'A button offers' : action === 'tab' ? 'Tab changed' : 'Page changed');
        }
        expect(requests).toHaveLength(action === 'replace' ? 2 : 1);
      } finally { release?.(); await context.close(); }
    });
  }
}
