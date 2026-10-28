import { createServer } from 'node:http';
import { test, expect, type Page } from '@playwright/test';
import { activateToolbar, launchExtension, openSharingSettings, stopExtensionWorker, selectMode, setConsent, textAction } from './extension';

test.describe.configure({ mode: 'default' });
let requests: Record<string, unknown>[] = [];
let mode = 'explanation';
let release: (() => void) | undefined;
let mockPort: number;
const quick = 'Plants turn sunlight into stored energy.';
const detail = 'During photosynthesis, plants convert light energy into chemical energy. This stored energy supports growth.';
const server = createServer(async (request, response) => {
  let raw = ''; for await (const chunk of request) raw += String(chunk);
  const body = JSON.parse(raw); requests.push(body);
  const chosen = mode;
  if (chosen === 'delayed') await new Promise<void>((resolve) => { release = resolve; });
  if (chosen === 'error') {
    response.writeHead(429, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ protocolVersion: 1, kind: 'error', error: { code: 'rate_limited', message: 'Gemini quota was reached. Wait before retrying.' } })); return;
  }
  const result = chosen === 'clarification' || chosen === 'unsupported' ? { kind: chosen, message: 'More passage context is needed.' }
    : { kind: 'explanation', quickExplanation: chosen === 'hostile' ? '<img src=x onerror="window.bad=true">' : quick,
      detailedExplanation: chosen === 'hostile' ? '<script>window.bad=true</script> **literal**' : detail };
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ protocolVersion: 1, sessionId: body.sessionId, requestId: chosen === 'stale' ? Number(body.requestId) + 1 : body.requestId,
    pageKey: body.pageKey, selectionId: body.selectionId, result: chosen === 'invalid' ? { ...result, selector: 'body' } : result }));
});
test.beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Mock did not bind.'); mockPort = address.port;
});
test.afterAll(async () => { release?.(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
test.beforeEach(() => { requests = []; mode = 'explanation'; release = undefined; });

async function setup(consent = true, activated = true) {
  const extension = await launchExtension();
  await extension.context.route('http://127.0.0.1:8787/**', (route) => route.continue({ url: route.request().url().replace('127.0.0.1:8787', `127.0.0.1:${mockPort}`) }));
  const page = await extension.context.newPage(); await page.goto('http://127.0.0.1:4173/text.html?PRIVATE-QUERY#PRIVATE-HASH');
  if (activated) await activateToolbar(page, extension.extensionId);
  const panel = await extension.context.newPage(); await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
  await panel.setViewportSize({ width: 360, height: 1000 });
  if (consent) await setConsent(panel, 'text', true);
  await page.bringToFront();
  if (activated) {
    await textAction(panel, 'text-enable');

  }
  return { ...extension, page, panel };
}
async function select(page: Page, selector = '#passage') {
  await page.locator(selector).click({ clickCount: 3 });
  await expect(page.getByRole('button', { name: 'Ask Klicko', exact: true })).toBeVisible();
}
async function compose(page: Page) {
  await select(page); await page.getByRole('button', { name: 'Ask Klicko', exact: true }).click();
  await page.getByLabel('Question about this passage').fill('Explain this passage.');
}
async function submit(page: Page) { await compose(page); await page.getByRole('button', { name: 'Ask', exact: true }).click(); }
const reply = (panel: Page) => panel.locator('.chat-workspace');

test('selection completes before one bubble appears; focus preserves passage; only explicit Ask uploads', async () => {
  const { context, page, panel } = await setup();
  try {
    const bounds = (await page.locator('#passage').boundingBox())!;
    await page.mouse.move(bounds.x + 2, bounds.y + 12); await page.mouse.down(); await page.mouse.move(bounds.x + 260, bounds.y + 12, { steps: 8 });
    await page.waitForTimeout(180); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    await page.mouse.up(); await expect(page.getByRole('button', { name: 'Ask Klicko', exact: true })).toBeVisible();
    await compose(page); expect(requests).toHaveLength(0);
    await expect(page.getByLabel('Question about this passage')).toBeFocused();
    await page.locator('#clickpilot-text form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.waitForTimeout(150); expect(requests).toHaveLength(0);
    await page.getByLabel('Question about this passage').press('Enter');
    await expect(reply(panel)).toContainText(detail);
    await expect(page.locator('#clickpilot-text')).toContainText(quick);
    await page.locator('#clickpilot-text .bubble').screenshot({ path: '/tmp/clickpilot-7a-bubble.png' });
    await panel.getByRole('log', { name: 'Conversation' }).screenshot({ path: '/tmp/clickpilot-7a-panel.png' });
    expect(requests).toHaveLength(1);
    expect(Object.keys(requests[0]).sort()).toEqual(['protocolVersion', 'operation', 'sessionId', 'requestId', 'pageKey', 'selectionId', 'selectedText', 'question'].sort());
    expect(requests[0].selectedText).toContain('Photosynthesis');
    expect(JSON.stringify(requests)).not.toMatch(/PRIVATE-|FAKE INPUT|FAKE PASSWORD|elements|history|rect|url|title/);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('#clickpilot-text')).toHaveCount(0); await expect(reply(panel)).toContainText(detail);
    await page.locator('#normal').click(); await expect(page.locator('#normal')).toHaveText('Clicked normally');
  } finally { await context.close(); }
});

test('toolbar activation and specific text consent are required; Cancel and Escape never upload', async () => {
  const { context, page, panel, extensionId } = await setup(false, false);
  try {
    await page.locator('#passage').click({ clickCount: 3 }); await page.waitForTimeout(250); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    await activateToolbar(page, extensionId); await panel.reload(); await page.bringToFront();
    await textAction(panel, 'text-enable'); await select(page);
    await page.getByRole('button', { name: 'Ask Klicko', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeDisabled();
    await page.getByLabel('Question about this passage').press('Escape'); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    await setConsent(panel, 'text', true); await page.bringToFront();
    await textAction(panel, 'text-enable');
    await compose(page); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(requests).toHaveLength(0);
  } finally { await context.close(); }
});

test('script-only changes do not show a bubble; keyboard selection supports focus and submission', async () => {
  const { context, page, panel } = await setup();
  try {
    await page.evaluate(() => { const range = document.createRange(); range.selectNodeContents(document.querySelector('#passage')!); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
    await page.waitForTimeout(250); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(page.getByRole('button', { name: 'Ask Klicko', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ask Klicko', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByLabel('Question about this passage')).toBeFocused();
    await page.keyboard.type('Explain'); await page.keyboard.press('Enter'); await expect(reply(panel)).toContainText(detail);
  } finally { await context.close(); }
});

test('worker restart retains an unsent text draft and a completed panel explanation without replay', async () => {
  const { context, page, panel, extensionId } = await setup();
  try {
    await compose(page);
    await page.getByLabel('Question about this passage').fill('Keep this unsent question.');
    await stopExtensionWorker(page, extensionId);
    await expect(page.getByLabel('Question about this passage')).toHaveValue('Keep this unsent question.');
    expect(requests).toHaveLength(0);
    await page.getByLabel('Question about this passage').press('Enter');
    await expect(reply(panel)).toContainText(detail);
    await stopExtensionWorker(page, extensionId);
    await expect(reply(panel)).toContainText(detail);
    await panel.reload();
    await expect(panel.getByRole('checkbox', { name: /^Selected-text assistance/ })).toBeChecked();
    await expect(reply(panel)).not.toContainText(detail);
    expect(requests).toHaveLength(1);
  } finally { await context.close(); }
});

test('viewport clamping, resize and scroll fallback keep the detailed panel answer', async () => {
  const { context, page, panel } = await setup();
  try {
    await submit(page); await expect(reply(panel)).toContainText(detail);
    await page.setViewportSize({ width: 430, height: 650 });
    await expect.poll(() => page.locator('#clickpilot-text .bubble').evaluate((box) => { const r = box.getBoundingClientRect(); return r.left >= 11 && r.right <= innerWidth - 11 && r.top >= 11 && r.bottom <= innerHeight - 11; })).toBe(true);
    await page.evaluate(() => scrollTo(0, 1200)); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    await expect(reply(panel)).toContainText(detail);
  } finally { await context.close(); }
});

test('pending explanation survives geometry loss and still reaches the panel', async () => {
  const { context, page, panel } = await setup();
  try {
    mode = 'delayed'; await submit(page); await expect.poll(() => requests.length).toBe(1);
    await page.evaluate(() => scrollTo(0, 1200)); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    release?.(); await expect(reply(panel)).toContainText(detail); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
  } finally { release?.(); await context.close(); }
});

test('sensitive, editable, mixed, hidden and oversized selections are rejected without requests', async () => {
  const { context, page } = await setup();
  try {
    for (const selector of ['#secret', '#editor', '#mixed', '#form-text']) {
      await page.locator(selector).click({ clickCount: 3 }); await page.waitForTimeout(180); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    }
    await page.locator('#passage').evaluate((p) => { p.textContent = 'a'.repeat(2001); });
    await page.locator('#passage').click({ clickCount: 3 }); await page.waitForTimeout(180); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    expect(requests).toHaveLength(0);
  } finally { await context.close(); }
});

for (const kind of ['hostile', 'clarification', 'unsupported', 'invalid', 'stale', 'error']) {
  test(`MOCK text result: ${kind}`, async () => {
    const { context, page, panel } = await setup();
    try {
      mode = kind; await submit(page);
      await expect(reply(panel)).toContainText(kind === 'hostile' ? '<script>window.bad=true</script> **literal**'
        : kind === 'clarification' || kind === 'unsupported' ? 'More passage context'
        : kind === 'error' ? 'AI usage limit was reached' : "couldn't use that reply safely");
      expect(await page.evaluate(() => 'bad' in window)).toBe(false);
      expect(await panel.evaluate(() => 'bad' in window)).toBe(false);
      await expect(page.locator('#clickpilot-text img, #clickpilot-text script')).toHaveCount(0);
      if (kind === 'error') { mode = 'explanation'; await panel.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(reply(panel)).toContainText(detail); }
    } finally { await context.close(); }
  });
}

for (const action of ['cancel', 'stop', 'withdraw', 'new-selection', 'navigate', 'spa', 'tab', 'detach']) {
  test(`pending text cancellation and cleanup: ${action}`, async () => {
    const { context, page, panel } = await setup();
    try {
      mode = 'delayed'; await submit(page); await expect.poll(() => requests.length).toBe(1);
      if (action === 'cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      if (action === 'stop') await textAction(panel, 'text-stop');
      if (action === 'withdraw') await setConsent(panel, 'text', false);
      if (action === 'new-selection') await select(page, '#second');
      if (action === 'navigate') await page.goto('http://127.0.0.1:4173/second.html');
      if (action === 'spa') await page.evaluate(() => history.pushState({}, '', '/text.html?route=new'));
      if (action === 'tab') { const other = await context.newPage(); await other.goto('http://127.0.0.1:4173/second.html'); }
      if (action === 'detach') await page.locator('#passage').evaluate((p) => p.remove());
      if (action !== 'new-selection') await expect(page.locator('#clickpilot-text')).toHaveCount(0);
      release?.(); await page.waitForTimeout(300);
      await expect(reply(panel)).not.toContainText(detail);
      expect(requests).toHaveLength(1);
    } finally { release?.(); await context.close(); }
  });
}

test('closing the sidebar leaves the explicit selected-text request and local reply available', async () => {
  const { context, page, panel } = await setup();
  try {
    mode = 'delayed'; await submit(page); await expect.poll(() => requests.length).toBe(1);
    await panel.close(); await page.bringToFront();
    release?.();
    await expect(page.locator('#clickpilot-text')).toContainText(quick);
    expect(requests).toHaveLength(1);
  } finally { release?.(); await context.close(); }
});

test('nested scroll and insufficient viewport space remove floating UI while the panel retains its answer', async () => {
  const { context, page, panel } = await setup();
  try {
    await select(page, '#nested'); await page.getByRole('button', { name: 'Ask Klicko', exact: true }).click();
    await page.getByLabel('Question about this passage').fill('Explain this sentence.'); await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(reply(panel)).toContainText(detail);
    await page.locator('#scrollbox').evaluate((element) => { element.scrollTop = 1000; });
    await expect(page.locator('#clickpilot-text')).toHaveCount(0); await expect(reply(panel)).toContainText(detail);
    await page.locator('#scrollbox').evaluate((element) => { element.scrollTop = 0; });
    await submit(page); await expect(reply(panel)).toContainText(detail);
    await page.setViewportSize({ width: 110, height: 70 }); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    await expect(reply(panel)).toContainText(detail);
  } finally { await context.close(); }
});

test('text composer replaces Manual decoration; starting Manual inspection ends text assistance', async () => {
  const { context, page, panel } = await setup();
  try {
    await selectMode(panel, 'Manual highlights');
    await panel.getByRole('button', { name: 'Inspect this page' }).click();
    await expect(panel.getByRole('heading', { name: /Visible controls/ })).toBeVisible();
    const row = panel.locator('.element-list li').filter({ has: panel.locator('.element-name', { hasText: 'Normal website action' }) });
    await row.getByRole('button', { name: /^Highlight/ }).click(); await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    await textAction(panel, 'text-enable');
    await compose(page); await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(page.getByLabel('Question about this passage')).toBeVisible();
    await panel.getByRole('button', { name: 'Inspect this page' }).click(); await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    expect(requests).toHaveLength(0);
  } finally { await context.close(); }
});


test('switching from a pending Mock task to Manual cancels old work on the shared connection', async () => {
  const { context, page, panel } = await setup();
  try {
    await page.goto('http://127.0.0.1:4173/guidance.html');
    await selectMode(panel, 'Mock guidance');
    await panel.getByLabel('What do you want to find?').fill('find primary target');
    await panel.getByRole('heading', { name: 'Find your next click.' }).click();
    await panel.getByText('Mock test scenarios', { exact: true }).click();
    await panel.getByLabel('Behavior for the next submitted task').selectOption('delayed');
    await panel.getByRole('button', { name: 'Start mock guidance' }).click();
    await expect(panel.getByRole('status')).toContainText('Choosing a target');
    await selectMode(panel, 'Manual highlights');
    await page.waitForTimeout(2200); await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Inspect this page' }).click();
    await expect(panel.getByRole('heading', { name: /Visible controls/ })).toBeVisible();
  } finally { await context.close(); }
});
