import { createServer } from 'node:http';
import { test, expect, type Page } from '@playwright/test';
import { activateToolbar, launchExtension } from './extension';

// Test-only HTTP server. These browser tests NEVER contact Gemini.
test.describe.configure({ mode: 'serial' });
let outcome = 'guidance';
let requests: Record<string, unknown>[] = [];
let release: (() => void) | undefined;
let mockPort: number;
const server = createServer(async (request, response) => {
  let text = '';
  for await (const chunk of request) text += String(chunk);
  const body = JSON.parse(text);
  requests.push(body);
  const target = body.elements.find((element: { name: string }) => element.name === 'Primary target');
  const kind = outcome.replace('delayed-', '');
  let result: unknown = kind === 'guidance'
    ? { kind, nextStep: 'none', message: 'Use the primary control to try the fixture.', targetId: target?.id ?? 'el_999', instruction: 'Click Primary target.' }
    : { kind, message: kind === 'answer' ? 'A button offers an action when you click it.' : kind === 'clarification' ? 'Which Settings control do you mean?' : 'The available controls do not reveal that information.' };
  if (['workflow', 'workflow-check', 'no-change', 'failed-check', 'final-changing', 'hidden-check'].includes(kind)) {
    const name = kind === 'no-change' || kind === 'failed-check' ? 'Do nothing'
      : kind === 'final-changing' ? 'Settings'
      : body.elements.some((element: { name: string }) => element.name === 'Edit domain') ? 'Edit domain'
      : body.elements.some((element: { name: string }) => element.name === 'Domains') ? 'Domains' : 'Settings';
    const control = body.elements.find((element: { name: string }) => element.name === name);
    result = { kind: 'guidance', targetId: control?.id ?? 'el_999', message: `Use ${name} toward your original goal.`,
      instruction: `Click ${name}.`, nextStep: name === 'Edit domain' || kind === 'final-changing' ? 'none' : 'after_user_action',
      ...((kind === 'workflow-check' && name === 'Settings') || kind === 'failed-check' || kind === 'final-changing' || kind === 'hidden-check'
        ? { expectedOutcome: { type: kind === 'hidden-check' ? 'target_hidden' : 'target_expanded' } } : {}) };
  }
  if (kind === 'popup') {
    const name = body.elements.some((element: { name: string }) => element.name === 'Switch account') ? 'Switch account' : 'Account';
    const control = body.elements.find((element: { name: string }) => element.name === name);
    result = { kind: 'guidance', targetId: control?.id ?? 'el_999', message: `Use ${name}.`, instruction: `Click ${name}.`,
      nextStep: name === 'Account' ? 'after_user_action' : 'none' };
  }
  if (kind === 'missing-signal') result = { kind: 'guidance', targetId: target.id, message: 'Invalid signal', instruction: 'Click' };
  if (kind === 'hostile') result = { kind: 'answer', message: '<img src=x onerror="window.bad=true"> **literal** <script>alert(1)</script>' };
  if (kind === 'unknown') result = { kind: 'guidance', nextStep: 'none', message: 'UNTRUSTED NARRATIVE', targetId: 'el_999', instruction: 'Bad target' };
  if (kind === 'invalid-answer') result = { kind: 'answer', message: 'UNTRUSTED NARRATIVE', targetId: target.id };
  if (outcome.startsWith('delayed-')) await new Promise<void>((resolve) => { release = resolve; });
  response.setHeader('Content-Type', 'application/json');
  if (kind === 'oversized') { response.end('x'.repeat(8193)); return; }
  if (kind === 'rate-limit') {
    response.statusCode = 429;
    response.end(JSON.stringify({ protocolVersion: 3, kind: 'error', error: { code: 'rate_limited', message: 'Gemini quota was reached. Wait before retrying.' } })); return;
  }
  response.end(JSON.stringify({ protocolVersion: 3, sessionId: body.sessionId,
    requestId: kind === 'stale' ? body.requestId + 1 : body.requestId,
    pageKey: body.page.pageKey, snapshotId: body.page.snapshotId, result }));
});
test.beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Mock API did not bind a TCP port.');
  mockPort = address.port;
});
test.afterAll(async () => { release?.(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
test.beforeEach(() => { requests = []; outcome = 'guidance'; release = undefined; });

async function openAssistant(fixture = 'guidance.html') {
  const extension = await launchExtension();
  // Route extension-worker fetches to an isolated mock, even if a real local Worker is running.
  await extension.context.route('http://127.0.0.1:8787/**', (route) => route.continue({
    url: route.request().url().replace('127.0.0.1:8787', `127.0.0.1:${mockPort}`),
  }));
  const page = await extension.context.newPage();
  await page.goto(`http://127.0.0.1:4173/${fixture}${fixture.includes('?') ? '&' : '?'}private=PRIVATE-QUERY#PRIVATE-FRAGMENT`);
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

for (const kind of ['unknown', 'invalid-answer', 'stale', 'oversized', 'rate-limit', 'missing-signal']) {
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


for (const mode of ['workflow', 'workflow-check']) {
  test(`MOCK API: ${mode} reasons through three steps with bounded original-goal context`, async () => {
    const { context, page, panel } = await openAssistant('multistep.html');
    try {
      outcome = mode;
      await submit(panel, 'Change a Vercel domain');
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Settings.');
      expect(requests).toHaveLength(1);
      expect(requests[0]!.taskContext).toEqual({ stepNumber: 1, previousStep: null });
      await page.locator('#unrelated').click();
      await page.evaluate(() => document.getElementById('settings')!.click());
      await page.waitForTimeout(2200);
      expect(requests).toHaveLength(1);
      await page.reload();
      await activateToolbar(page, new URL(panel.url()).host);
      await submit(panel, 'Change a Vercel domain');
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Settings.');
      requests = [];
      await page.locator('#settings').click();
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Domains.');
      expect(requests[0]!.userGoal).toBe('Change a Vercel domain');
      expect(requests[0]!.taskContext).toEqual({ stepNumber: 2, previousStep: {
        action: 'Click Settings.', event: 'trusted_click', status: mode === 'workflow-check' ? 'verified' : 'unverifiable',
      } });
      await page.locator('#domains').click();
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Edit domain.');
      expect(requests[1]!.taskContext).toEqual({ stepNumber: 3, previousStep: {
        action: 'Click Domains.', event: 'trusted_click', status: 'unverifiable',
      } });
      expect(JSON.stringify(requests[1]!.taskContext)).not.toContain('Settings');
      expect(requests[1]!.userGoal).toBe('Change a Vercel domain');
      expect((requests[0]!.page as { snapshotId: string }).snapshotId).not.toBe((requests[1]!.page as { snapshotId: string }).snapshotId);
      await expect(panel.getByRole('status')).toContainText('final suggestion');
      await panel.screenshot({ path: '/tmp/clickpilot-6a-360.png', fullPage: true });
      await panel.setViewportSize({ width: 260, height: 1000 });
      await panel.screenshot({ path: '/tmp/clickpilot-6a-260.png', fullPage: true });
      expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#edit').click();
      await page.waitForTimeout(2300);
      expect(requests).toHaveLength(2);
      await expect(panel.getByRole('status')).toContainText('has not verified');
      await panel.getByRole('button', { name: 'Confirm task complete' }).click();
      await expect(panel.getByRole('status')).toHaveText('Task completion confirmed by you.');
    } finally { await context.close(); }
  });
}

test('MOCK API: final guidance with a verified page change still makes no next request', async () => {
  const { context, page, panel } = await openAssistant('multistep.html');
  try {
    outcome = 'final-changing'; await submit(panel, 'Show Settings');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    await page.locator('#settings').click();
    await expect(panel.getByRole('status')).toContainText('step outcome was verified');
    await expect(panel.getByRole('status')).toContainText('Overall task completion is not verified');
    expect(requests).toHaveLength(1);
  } finally { await context.close(); }
});

for (const mode of ['no-change', 'failed-check']) {
  test(`MOCK API: ${mode} waits, retries same step, and permits explicit manual continuation`, async () => {
    const { context, page, panel } = await openAssistant('multistep.html');
    try {
      outcome = mode; await submit(panel, 'Change a Vercel domain');
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Do nothing.');
      await page.locator('#no-change').click();
      await expect(panel.getByRole('status')).toContainText('No verified progress', { timeout: 8000 });
      expect(requests).toHaveLength(1);
      await panel.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Do nothing.');
      expect((requests[1]!.taskContext as { stepNumber: number }).stepNumber).toBe(1);
      await page.locator('#no-change').click();
      await expect(panel.getByRole('status')).toContainText('No verified progress', { timeout: 8000 });
      outcome = 'workflow';
      await panel.getByRole('button', { name: 'Continue manually' }).click();
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Settings.');
      expect(requests[2]!.taskContext).toMatchObject({ stepNumber: 2, previousStep: { status: 'user_confirmed' } });
      await expect(panel.getByRole('status')).toContainText('confirmed by you');
    } finally { await context.close(); }
  });
}

for (const action of ['stop', 'replace', 'consent', 'close', 'tab', 'navigate']) {
  test(`MOCK API: observation cleanup prevents a follow-up after ${action}`, async () => {
    const { context, page, panel } = await openAssistant('multistep.html');
    try {
      outcome = 'workflow'; await submit(panel, 'Old task');
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
      await page.locator('#settings').click();
      await expect(panel.getByRole('status')).toContainText('Checking the updated page');
      if (action === 'stop') await panel.getByRole('button', { name: 'Stop', exact: true }).click();
      if (action === 'replace') { outcome = 'answer'; await submit(panel, 'New goal'); }
      if (action === 'consent') await panel.getByLabel('Allow this panel').uncheck();
      if (action === 'close') await panel.close();
      if (action === 'tab') { const other = await context.newPage(); await other.goto('http://127.0.0.1:4173/second.html'); }
      if (action === 'navigate') await page.goto('http://127.0.0.1:4173/second.html');
      await page.waitForTimeout(2300);
      expect(requests).toHaveLength(action === 'replace' ? 2 : 1);
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
      if (action === 'replace') expect(requests[1]!.taskContext).toEqual({ stepNumber: 1, previousStep: null });
    } finally { await context.close(); }
  });
}


test('MOCK API: disappearing target check verifies only the step and observes fresh controls', async () => {
  const { context, page, panel } = await openAssistant('multistep.html');
  try {
    outcome = 'hidden-check'; await submit(panel, 'Change a Vercel domain');
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Settings.');
    await page.evaluate(() => document.getElementById('settings')!.addEventListener('click', (event) => {
      (event.currentTarget as HTMLElement).hidden = true;
    }));
    outcome = 'workflow';
    await page.locator('#settings').click();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Domains.');
    expect(requests[1]!.taskContext).toMatchObject({ previousStep: { status: 'verified' } });
    await expect(panel.getByRole('status')).toContainText('Previous step: outcome verified');
  } finally { await context.close(); }
});

test('MOCK API: an already-expanded target is not verified again just because it was clicked', async () => {
  const { context, page, panel } = await openAssistant('multistep.html');
  try {
    outcome = 'final-changing'; await submit(panel, 'Show Settings');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    await page.evaluate(() => document.getElementById('settings')!.setAttribute('aria-expanded', 'true'));
    await page.locator('#settings').click();
    await page.waitForTimeout(2300);
    await expect(panel.getByRole('status')).toContainText('has not verified');
    expect(requests).toHaveLength(1);
  } finally { await context.close(); }
});

test('MOCK API: rounded nested SVG highlights and observes the real user click', async () => {
  const { context, page, panel } = await openAssistant('targets.html');
  try {
    await submit(panel);
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Primary target.');
    await expect(page.locator('#counter')).toHaveText('Clicks: 0');
    await page.locator('#target svg path').click();
    await expect(page.locator('#counter')).toHaveText('Clicks: 1');
    await expect(panel.getByRole('status')).toContainText('Click observed');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    expect(requests).toHaveLength(1);
  } finally { await context.close(); }
});

test('MOCK API: detached selection refreshes once and uses the re-rendered SVG button', async () => {
  const { context, page, panel } = await openAssistant('targets.html');
  try {
    outcome = 'delayed-guidance';
    await submit(panel);
    await expect.poll(() => requests.length).toBe(1);
    const finish = release!;
    await page.locator('#replace').click();
    outcome = 'guidance';
    finish();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Primary target.');
    expect(requests).toHaveLength(2);
    expect((requests[0]!.page as { snapshotId: string }).snapshotId)
      .not.toBe((requests[1]!.page as { snapshotId: string }).snapshotId);
    await expect(page.locator('#counter')).toHaveText('Clicks: 0');
    await panel.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { release?.(); await context.close(); }
});

for (const side of ['full', 'top', 'corner']) {
  test(`MOCK API: ${side} coverage survives one refresh and pauses with website recovery wording`, async () => {
    const { context, page, panel } = await openAssistant('targets.html');
    try {
      await page.locator(`#cover-${side}`).click();
      await submit(panel);
      await expect(panel.getByRole('status')).toContainText('after one refresh');
      await expect(panel.getByRole('status')).toContainText('visible and unobstructed');
      await expect(panel.getByRole('status')).not.toContainText('fixture');
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
      expect(requests).toHaveLength(2);
      await page.locator('#uncover').click();
      await panel.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
      expect(requests).toHaveLength(3);
    } finally { await context.close(); }
  });
}

for (const mode of ['', '?preexisting', '?delayed', '?animation', '?crowded', '?pointerdown']) {
  test(`MOCK API: popup continuation ${mode} preserves goal and highlights a fresh option`, async () => {
    const { context, page, panel } = await openAssistant(`popup.html${mode}`);
    try {
      outcome = 'popup'; await submit(panel, 'How can I switch accounts?');
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Account.');
      await page.locator('#account').click();
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Switch account.', { timeout: 8000 });
      expect(requests).toHaveLength(2);
      expect(requests[1]!.userGoal).toBe('How can I switch accounts?');
      expect(requests[1]!.taskContext).toMatchObject({ stepNumber: 2, previousStep: { status: 'unverifiable' } });
      expect((requests[0]!.page as { snapshotId: string }).snapshotId).not.toBe((requests[1]!.page as { snapshotId: string }).snapshotId);
      expect(JSON.stringify(requests[1]!.elements)).not.toMatch(/Hidden|Disabled/);
      await expect(page.locator('#counter')).toHaveText('Actions: 0');
      await page.getByRole('option', { name: 'Switch account' }).click();
      await expect(page.locator('#counter')).toHaveText('Actions: 1');
    } finally { await context.close(); }
  });
}

async function checkpointValue(panel: Page): Promise<Record<string, unknown> | undefined> {
  return panel.evaluate(async () => {
    const api = (globalThis as unknown as { chrome: { storage: { session: { get: (key: string) => Promise<Record<string, Record<string, unknown>>> } } } }).chrome;
    return (await api.storage.session.get('clickpilot.interruption'))['clickpilot.interruption'];
  });
}

for (const mode of ['', '?full']) {
  test(`MOCK API: 6B navigation ${mode || 'SPA'} retains goal and advances once per trusted action`, async () => {
    const { context, page, panel, worker } = await openAssistant(`navigation.html${mode}`);
    try {
      outcome = 'workflow-check'; await submit(panel, 'Change a Vercel domain');
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Settings.');
      await page.locator('#settings').click();
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Domains.', { timeout: 10000 });
      expect(requests).toHaveLength(2);
      expect(requests[1]!.taskContext).toMatchObject({ stepNumber: 2, previousStep: { status: 'unverifiable' } });
      await page.locator('#domains').click();
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Edit domain.', { timeout: 10000 });
      expect(requests).toHaveLength(3);
      expect(requests.map((r) => r.userGoal)).toEqual(Array(3).fill('Change a Vercel domain'));
      expect(requests.map((r) => (r.taskContext as { stepNumber: number }).stepNumber)).toEqual([1, 2, 3]);
      expect(new Set(requests.map((r) => (r.page as { pageKey: string }).pageKey)).size).toBe(3);
      expect(new Set(requests.map((r) => (r.page as { snapshotId: string }).snapshotId)).size).toBe(3);
      await expect(page.locator('#result')).toHaveText('No action taken');
      const record = await checkpointValue(panel);
      expect(Object.keys(record!).sort()).toEqual(['version', 'ownerId', 'sessionId', 'tabId', 'status', 'revision', 'expiresAt'].sort());
      expect(JSON.stringify(record)).not.toMatch(/Vercel|Settings|Domains|http|snapshot|target|PRIVATE/);
      const access = await worker.evaluate(async (tabId) => {
        const api = (globalThis as unknown as { chrome: { scripting: { executeScript: (options: { target: { tabId: number }; func: () => Promise<string> }) => Promise<{ result: string }[]> } } }).chrome;
        return api.scripting.executeScript({ target: { tabId }, func: async () => {
          try {
            const storage = (globalThis as unknown as { chrome: { storage: { session?: { get: (key: string) => Promise<unknown> } } } }).chrome.storage;
            if (!storage.session) return 'blocked';
            await storage.session.get('clickpilot.interruption'); return 'exposed';
          } catch { return 'blocked'; }
        } });
      }, record!.tabId as number);
      expect(access[0]!.result).toBe('blocked');
      await panel.getByRole('button', { name: 'Stop', exact: true }).click();
      await expect.poll(() => checkpointValue(panel)).toBeUndefined();
    } finally { await context.close(); }
  });
}

test('MOCK API: 6B manual push/replace/back/forward require Continue and reject a pending reply', async () => {
  const { context, page, panel } = await openAssistant('navigation.html');
  try {
    outcome = 'delayed-workflow'; await submit(panel, 'Original navigation goal');
    await expect.poll(() => requests.length).toBe(1);
    await page.locator('#manual').click();
    await expect(panel.getByRole('status')).toContainText('Page changed');
    release!(); outcome = 'workflow';
    await expect(panel.getByRole('button', { name: 'Continue task on this page' })).toBeVisible();
    await panel.getByRole('button', { name: 'Continue task on this page' }).click();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Domains.');
    expect((requests[1]!.taskContext as { stepNumber: number }).stepNumber).toBe(1);
    for (const navigate of [() => page.locator('#replace').click(), () => page.goBack(), () => page.goForward()]) {
      const count = requests.length;
      await navigate();
      await expect(panel.getByRole('button', { name: 'Continue task on this page' })).toBeVisible();
      await page.waitForTimeout(900);
      expect(requests).toHaveLength(count);
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
      await panel.getByRole('button', { name: 'Continue task on this page' }).click();
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
      expect(requests.at(-1)!.userGoal).toBe('Original navigation goal');
    }
  } finally { release?.(); await context.close(); }
});

test('MOCK API: 6B panel destruction leaves restart-only metadata and a fresh re-entered task', async () => {
  const { context, page, panel, extensionId } = await openAssistant('navigation.html');
  try {
    outcome = 'workflow'; await submit(panel, 'PRIVATE original goal');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    const original = requests[0]!.sessionId;
    await panel.close();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    const reopened = await context.newPage();
    await reopened.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await reopened.getByRole('button', { name: 'AI assistant', exact: true }).click();
    await expect(reopened.getByText('Previous task interrupted — enter your goal to restart.')).toBeVisible();
    await expect(reopened.getByLabel('What would you like help with?')).toBeEmpty();
    await expect(reopened.getByLabel('Allow this panel')).not.toBeChecked();
    await page.waitForTimeout(800); expect(requests).toHaveLength(1);
    await reopened.getByLabel('Allow this panel').check(); await page.bringToFront();
    await submit(reopened, 'Re-entered new goal');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    expect(requests[1]!.sessionId).not.toBe(original);
    expect(requests[1]!.taskContext).toEqual({ stepNumber: 1, previousStep: null });
    expect(JSON.stringify(await checkpointValue(reopened))).not.toMatch(/PRIVATE|goal|http|target/);
    await reopened.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect.poll(() => checkpointValue(reopened)).toBeUndefined();
  } finally { await context.close(); }
});

test('MOCK API: 6B cross-origin requires toolbar activation and explicit Continue; tab ownership is retained', async () => {
  const { context, page, panel, extensionId } = await openAssistant('navigation.html');
  try {
    outcome = 'workflow'; await submit(panel, 'Same original goal');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    await page.locator('#cross').click();
    await expect(panel.getByRole('button', { name: 'Continue task on this page' })).toBeVisible();
    await panel.getByRole('button', { name: 'Continue task on this page' }).click();
    await expect(panel.getByRole('status')).toContainText('toolbar');
    expect(requests).toHaveLength(1);
    await activateToolbar(page, extensionId);
    await panel.getByRole('button', { name: 'Continue task on this page' }).click();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Domains.');
    expect(requests[1]!.userGoal).toBe('Same original goal');
    const other = await context.newPage(); await other.goto('http://127.0.0.1:4173/navigation.html');
    await activateToolbar(other, extensionId);
    await panel.getByRole('button', { name: 'Continue task on this page' }).click();
    await expect(panel.getByRole('status')).toContainText('page changed');
    expect(requests).toHaveLength(2);
    await page.bringToFront();
    await panel.getByRole('button', { name: 'Continue task on this page' }).click();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    expect(requests[2]!.userGoal).toBe('Same original goal');
    await page.close();
    await expect(panel.getByRole('status')).toContainText('task tab closed');
    await expect.poll(() => checkpointValue(panel)).toBeUndefined();
  } finally { await context.close(); }
});

test('MOCK API: 6B forced worker loss preserves live-panel goal without replaying the request', async () => {
  const { context, page, panel, extensionId } = await openAssistant('navigation.html');
  try {
    outcome = 'delayed-workflow'; await submit(panel, 'Exact surviving worker goal');
    await expect.poll(() => requests.length).toBe(1);
    const finish = release!;
    const cdp = await context.browser()!.newBrowserCDPSession();
    const { targetInfos } = await cdp.send('Target.getTargets');
    const workerTarget = targetInfos.find((target) => target.type === 'service_worker' && target.url.includes(extensionId));
    expect(workerTarget).toBeDefined();
    await cdp.send('Target.closeTarget', { targetId: workerTarget!.targetId });
    await cdp.detach();
    await expect(panel.getByRole('status')).toContainText('worker connection closed');
    finish(); outcome = 'workflow';
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await page.waitForTimeout(1000); expect(requests).toHaveLength(1);
    await activateToolbar(page, extensionId);
    await expect(panel.getByRole('button', { name: 'Continue task on this page' })).toBeEnabled();
    await panel.getByRole('button', { name: 'Continue task on this page' }).click();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Settings.');
    expect(requests[1]!.userGoal).toBe('Exact surviving worker goal');
    expect(requests[1]!.sessionId).toBe(requests[0]!.sessionId);
    expect(requests[1]!.taskContext).toEqual({ stepNumber: 1, previousStep: null });
  } finally { release?.(); await context.close(); }
});

test('MOCK API: 6B bounded destination settling pauses on animation and Stop cancels inspection', async () => {
  const { context, page, panel } = await openAssistant('navigation.html');
  try {
    outcome = 'workflow'; await submit(panel, 'Original settling goal');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    await page.locator('#manual').click();
    await expect(panel.getByRole('button', { name: 'Continue task on this page' })).toBeVisible();
    await page.evaluate(() => document.getElementById('domains')!.animate([{ opacity: 1 }, { opacity: 0.9 }], { duration: 1000, iterations: Infinity }));
    await panel.getByRole('button', { name: 'Continue task on this page' }).click();
    await expect(panel.getByRole('status')).toContainText('page changed', { timeout: 8000 });
    expect(requests).toHaveLength(1);
    await panel.getByRole('button', { name: 'Continue task on this page' }).click();
    await expect(panel.getByRole('status')).toContainText('Observing');
    await panel.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation.cancel()));
    await page.waitForTimeout(800);
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    expect(requests).toHaveLength(1);
    await expect.poll(() => checkpointValue(panel)).toBeUndefined();
  } finally { await context.close(); }
});

test('MOCK API: 6B same-origin redirect chain obtains a fresh document once', async () => {
  const { context, page, panel } = await openAssistant('navigation.html?full');
  try {
    await page.route('**/navigation.html?full&step=domains*', async (route) => {
      const url = new URL(route.request().url());
      const hop = Number(url.searchParams.get('hop') ?? 0);
      if (hop < 3) await route.fulfill({ status: 302, headers: { location: `/navigation.html?full&step=domains&hop=${hop + 1}` } });
      else await route.continue();
    });
    outcome = 'workflow'; await submit(panel, 'Original redirect goal');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
    await page.locator('#settings').click();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Domains.', { timeout: 10000 });
    expect(requests).toHaveLength(2);
    expect(requests[1]!.userGoal).toBe('Original redirect goal');
    expect(requests[1]!.taskContext).toMatchObject({ stepNumber: 2, previousStep: { status: 'unverifiable' } });
    expect((requests[1]!.page as { pageKey: string }).pageKey).not.toBe((requests[0]!.page as { pageKey: string }).pageKey);
  } finally { await context.close(); }
});
