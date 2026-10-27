import { createServer } from 'node:http';
import { test, expect, type Page } from '@playwright/test';
import { activateToolbar, launchExtension, stopExtensionWorker } from './extension';

test.describe.configure({ mode: 'serial' });
let mode = 'answer';
let requests: Record<string, unknown>[] = [];
let release: (() => void) | undefined;
let mockPort: number;
const server = createServer(async (request, response) => {
  let raw = ''; for await (const chunk of request) raw += String(chunk);
  const body = JSON.parse(raw); requests.push(body);
  if (mode === 'delayed') await new Promise<void>((resolve) => { release = resolve; });
  let result: unknown = { kind: 'answer', message: 'Settings controls your preferences.' };
  if (mode === 'workflow') {
    const elements = body.elements as { id: string; name: string }[];
    const name = elements.some((element) => element.name === 'Edit domain') ? 'Edit domain'
      : elements.some((element) => element.name === 'Domains') ? 'Domains' : 'Settings';
    result = { kind: 'guidance', targetId: elements.find((element) => element.name === name)?.id,
      nextStep: name === 'Edit domain' ? 'none' : 'after_user_action', message: `Use ${name}.`, instruction: `Click ${name}.` };
  }
  if (body.protocolVersion === 1) result = { kind: 'explanation', quickExplanation: 'Plants use sunlight.', detailedExplanation: 'Plants store sunlight as chemical energy.' };
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body.protocolVersion === 1
    ? { protocolVersion: 1, sessionId: body.sessionId, requestId: body.requestId, pageKey: body.pageKey, selectionId: body.selectionId, result }
    : { protocolVersion: 3, sessionId: body.sessionId, requestId: body.requestId,
      pageKey: body.page.pageKey, snapshotId: body.page.snapshotId, result }));
});
test.beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Mock API did not bind.'); mockPort = address.port;
});
test.afterAll(async () => { release?.(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
test.beforeEach(() => { mode = 'answer'; requests = []; release = undefined; });

interface DomNode { nodeId: number; nodeName: string; nodeValue: string; attributes?: string[]; children?: DomNode[]; shadowRoots?: DomNode[] }
function walk(node: DomNode): DomNode[] { return [node, ...(node.children ?? []).flatMap(walk), ...(node.shadowRoots ?? []).flatMap(walk)]; }
function attribute(node: DomNode, key: string) { const index = node.attributes?.indexOf(key) ?? -1; return index < 0 ? undefined : node.attributes?.[index + 1]; }
// CDP can inspect a closed shadow tree for tests; the extension grants no debugger/DOM permission.
async function buddyNode(page: Page, name: string) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const host = walk(root as DomNode).find((node) => attribute(node, 'id') === 'clickpilot-buddy');
  const node = host && walk(host).find((node) => attribute(node, 'aria-label') === name || attribute(node, 'id') === name);
  if (!node) { await cdp.detach(); throw new Error(`Buddy control missing: ${name}`); }
  return { cdp, node };
}
async function clickBuddy(page: Page, name: string) {
  const { cdp, node } = await buddyNode(page, name);
  const { model } = await cdp.send('DOM.getBoxModel', { nodeId: node.nodeId });
  const q = model.border; await cdp.detach();
  await page.mouse.click((q[0]! + q[4]!) / 2, (q[1]! + q[5]!) / 2);
}
async function buddyText(page: Page) {
  const { cdp, node } = await buddyNode(page, 'ClickPilot quick ask');
  await cdp.detach(); return walk(node).filter((child) => child.nodeName === '#text').map((child) => child.nodeValue).join(' ');
}
async function askBuddy(page: Page, question: string) {
  await clickBuddy(page, 'Ask ClickPilot');
  const { cdp, node } = await buddyNode(page, 'clickpilot-ask');
  await cdp.send('DOM.focus', { nodeId: node.nodeId }); await cdp.detach();
  await page.keyboard.type(question); await page.keyboard.press('Enter');
}
async function setup(fixture = 'guidance.html', consent = true, options: { strictCsp?: boolean; failCharacter?: boolean } = {}) {
  const extension = await launchExtension();
  let blockedCharacterRequests = 0;
  await extension.context.route('http://127.0.0.1:8787/**', (route) => route.continue({ url: route.request().url().replace('127.0.0.1:8787', `127.0.0.1:${mockPort}`) }));
  await extension.worker.evaluate(async (enabled) => {
    const api = (globalThis as unknown as { chrome: { storage: { local: { set: (v: unknown) => Promise<void> } } } }).chrome;
    await api.storage.local.set({ 'clickpilot.ai-sharing': { version: 1, onboardingComplete: true, guidance: enabled, selectedText: enabled } });
  }, consent);
  if (options.strictCsp) await extension.context.route('**/guidance.html', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'" } });
  });
  if (options.failCharacter) await extension.context.route('**/buddy/robot.riv', (route) => { blockedCharacterRequests++; return route.abort(); });
  const page = await extension.context.newPage(); await page.goto(`http://localhost:4173/${fixture}`);
  await activateToolbar(page, extension.extensionId);
  await expect(page.locator('#clickpilot-buddy')).toHaveCount(1);
  // Wait for the view handshake without sending a task.
  await expect.poll(async () => {
    const { cdp, node } = await buddyNode(page, 'Open sidebar'); await cdp.detach(); return attribute(node, 'disabled');
  }).toBeUndefined();
  return { ...extension, page, blockedCharacterRequests: () => blockedCharacterRequests };
}
async function openPanel(page: Page, extensionId: string) {
  const context = page.context();
  const cdp = await context.browser()!.newBrowserCDPSession();
  const opened = context.waitForEvent('page');
  await cdp.send('Target.createTarget', { url: `chrome-extension://${extensionId}/sidepanel.html`, background: true });
  const panel = await opened; await cdp.detach();
  await panel.waitForLoadState(); await page.bringToFront(); return panel;
}
async function recoveryRecords(page: Page) {
  return page.evaluate(async () => {
    const api = (globalThis as unknown as { chrome: { storage: { session: { get: (key: null) => Promise<Record<string, unknown>> } } } }).chrome;
    const values = await api.storage.session.get(null);
    return Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('clickpilot.task.')));
  });
}

test('buddy opens locally, shares one answer with the sidebar, and survives sidebar closure', async () => {
  const { context, page, extensionId } = await setup();
  try {
    expect(await page.locator('#clickpilot-buddy').evaluate((host) => host.shadowRoot)).toBeNull();
    await clickBuddy(page, 'Ask ClickPilot'); expect(requests).toHaveLength(0);
    await page.keyboard.press('Escape'); expect(requests).toHaveLength(0);
    await askBuddy(page, 'What does Settings do?');
    await expect.poll(() => buddyText(page)).toContain('Settings controls your preferences.');
    const panel = await openPanel(page, extensionId);
    await expect(panel.getByRole('log', { name: 'Conversation' })).toContainText('What does Settings do?');
    await expect(panel.getByRole('log', { name: 'Conversation' })).toContainText('Settings controls your preferences.');
    expect(requests).toHaveLength(1);
    await panel.close(); await page.bringToFront();
    await clickBuddy(page, 'Ask ClickPilot'); // collapse
    await askBuddy(page, 'Where are the preferences?');
    await expect.poll(() => requests.length).toBe(2);
    await page.screenshot({ path: '/tmp/clickpilot-ux3-buddy-answer.png' });
  } finally { await context.close(); }
});

test('Stop and consent withdrawal clear recovery and reject a late provider reply', async () => {
  const { context, page, extensionId } = await setup();
  try {
    mode = 'delayed'; await askBuddy(page, 'Where are settings?'); await expect.poll(() => requests.length).toBe(1);
    const panel = await openPanel(page, extensionId);
    await clickBuddy(page, 'Stop');
    await expect.poll(async () => Object.keys(await recoveryRecords(panel)).length).toBe(0);
    release?.(); await expect.poll(() => buddyText(page)).toContain('Guidance stopped');
    await expect(panel.getByRole('log', { name: 'Conversation' })).not.toContainText('Settings controls your preferences.');
    mode = 'answer'; await clickBuddy(page, 'Ask ClickPilot'); await askBuddy(page, 'Open settings');
    await expect.poll(() => requests.length).toBe(2);
    await panel.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: { storage: { local: { set: (v: unknown) => Promise<void> } } } }).chrome;
      await api.storage.local.set({ 'clickpilot.ai-sharing': { version: 1, onboardingComplete: true, guidance: false, selectedText: false } });
    });
    await expect.poll(async () => Object.keys(await recoveryRecords(panel)).length).toBe(0);
  } finally { release?.(); await context.close(); }
});

test('worker termination restores the goal paused with no request replay or stale highlight', async () => {
  const { context, page, extensionId } = await setup();
  try {
    await askBuddy(page, 'Keep this original goal'); await expect.poll(() => buddyText(page)).toContain('Settings controls');
    const panel = await openPanel(page, extensionId);
    const records = await recoveryRecords(panel);
    expect(JSON.stringify(records)).not.toMatch(/snapshot|targetId|rect|elements|selectedText|history/);
    await stopExtensionWorker(page, extensionId);
    await expect.poll(() => buddyText(page)).toContain('ready to resume');
    expect(requests).toHaveLength(1); await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await clickBuddy(page, 'Continue'); await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]!.userGoal).toBe('Keep this original goal');
    expect(requests[1]!.sessionId).toBe(requests[0]!.sessionId);
    await expect(panel.getByRole('log', { name: 'Conversation' })).toContainText('Keep this original goal');
  } finally { await context.close(); }
});

test('full navigation keeps one original-goal task; cross-origin and other tabs cannot inherit access', async () => {
  const { context, page, extensionId } = await setup('navigation.html?full');
  try {
    mode = 'workflow'; await askBuddy(page, 'Guide me to Edit domain');
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Settings.');
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Listening');
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Domains.');
    await page.getByRole('link', { name: 'Domains', exact: true }).click();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Edit domain.');
    expect(requests.map((r) => r.userGoal)).toEqual(['Guide me to Edit domain', 'Guide me to Edit domain', 'Guide me to Edit domain']);
    const other = await context.newPage(); await other.goto('http://127.0.0.1:4173/guidance.html');
    await expect(other.locator('#clickpilot-buddy, #clickpilot-overlay')).toHaveCount(0);
    await other.close(); await page.bringToFront();
    const panel = await openPanel(page, extensionId);
    await page.goto('http://127.0.0.1:4173/navigation.html');
    await expect(page.locator('#clickpilot-buddy')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('toolbar');
    expect(requests).toHaveLength(3);
  } finally { await context.close(); }
});

test('no sharing without consent; drag, hide and popup interactions leave website controls usable', async () => {
  const { context, page } = await setup('guidance.html', false);
  try {
    await clickBuddy(page, 'Ask ClickPilot');
    await expect.poll(() => buddyText(page)).toContain('Webpage sharing is off');
    await page.keyboard.press('Escape');
    const { cdp, node } = await buddyNode(page, 'Ask ClickPilot');
    const { model } = await cdp.send('DOM.getBoxModel', { nodeId: node.nodeId }); await cdp.detach();
    await page.mouse.move(model.border[0]! + 20, model.border[1]! + 20); await page.mouse.down();
    await page.mouse.move(24, 80, { steps: 8 }); await page.mouse.up();
    await clickBuddy(page, 'Ask ClickPilot'); await clickBuddy(page, 'Hide ClickPilot');
    await page.locator('#primary').click(); await expect(page.locator('#counter')).toHaveText('Clicks: 1');
    expect(requests).toHaveLength(0);
  } finally { await context.close(); }
});

test('selected-text assistance still explains through the shared sidebar without a second request', async () => {
  const { context, page, extensionId } = await setup('text.html');
  try {
    await page.locator('#passage').click({ clickCount: 3 });
    await page.getByRole('button', { name: 'Ask ClickPilot', exact: true }).click();
    await page.getByLabel('Question about this passage').fill('Explain this passage.');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    const panel = await openPanel(page, extensionId);
    await expect(panel.getByRole('log', { name: 'Conversation' })).toContainText('Plants store sunlight as chemical energy.');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ protocolVersion: 1, operation: 'explain_text' });
    expect(await recoveryRecords(panel)).toEqual({});
  } finally { await context.close(); }
});

async function buddyCharacter(page: Page) {
  const { cdp, node } = await buddyNode(page, 'clickpilot-companion');
  await cdp.detach();
  const robot = walk(node).find((child) => attribute(child, 'data-expression') !== undefined);
  return { ready: robot && attribute(robot, 'data-ready'), expression: robot && attribute(robot, 'data-expression'),
    poster: walk(node).some((child) => child.nodeName.toLowerCase() === 'svg') };
}

test('packaged Rive works on a strict-CSP page with attention, task expressions and reduced motion', async () => {
  const { context, page, extensionId } = await setup('guidance.html', true, { strictCsp: true });
  try {
    await expect.poll(async () => (await buddyCharacter(page)).ready).toBe('true');
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Idle');
    const { cdp, node } = await buddyNode(page, 'Ask ClickPilot');
    const { model } = await cdp.send('DOM.getBoxModel', { nodeId: node.nodeId }); await cdp.detach();
    await page.mouse.move((model.border[0]! + model.border[4]!) / 2, (model.border[1]! + model.border[5]!) / 2);
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Happy');
    await page.mouse.move(10, 10);
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Idle');
    await clickBuddy(page, 'Ask ClickPilot');
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Surprised');
    await page.keyboard.type('Where are preferences?');
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Listening');
    expect(requests).toHaveLength(0);
    await page.screenshot({ path: '/tmp/clickpilot-integrated-ask.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Still');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Listening');
    mode = 'delayed'; await page.keyboard.press('Enter');
    await expect.poll(() => requests.length).toBe(1);
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Thinking');
    await clickBuddy(page, 'Stop');
    await expect.poll(async () => (await buddyCharacter(page)).expression).toBe('Sleepy');
    release?.();
    const panel = await openPanel(page, extensionId); await panel.bringToFront();
    await expect(panel.locator('.sidebar-perch .robot-companion')).toHaveAttribute('data-ready', 'true');
    await panel.getByLabel('What would you like help with?').fill('A new question');
    await expect(panel.locator('.sidebar-perch .robot-companion')).toHaveAttribute('data-expression', 'Listening');
    await panel.setViewportSize({ width: 360, height: 800 });
    await panel.screenshot({ path: '/tmp/clickpilot-integrated-sidebar-light.png' });
    await panel.emulateMedia({ colorScheme: 'dark' });
    await panel.setViewportSize({ width: 260, height: 800 });
    await panel.screenshot({ path: '/tmp/clickpilot-integrated-sidebar-dark.png' });
    expect(await panel.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await panel.emulateMedia({ reducedMotion: 'reduce' });
    await expect(panel.locator('.sidebar-perch .robot-companion')).toHaveAttribute('data-expression', 'Still');
  } finally { release?.(); await context.close(); }
});

test('a failed character asset leaves the poster and existing ask controls usable', async () => {
  const { context, page, blockedCharacterRequests } = await setup('guidance.html', true, { failCharacter: true });
  try {
    await expect.poll(blockedCharacterRequests).toBeGreaterThan(0);
    await expect.poll(async () => (await buddyCharacter(page)).poster).toBe(true);
    await askBuddy(page, 'What does Settings do?');
    await expect.poll(() => buddyText(page)).toContain('Settings controls your preferences.');
    expect((await buddyCharacter(page)).ready).toBe('false');
    expect(requests).toHaveLength(1);
  } finally { await context.close(); }
});
