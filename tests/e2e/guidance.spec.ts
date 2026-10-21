import { test, expect, type Page } from '@playwright/test';
import { activateToolbar, launchExtension } from './extension';

async function openFixture(path = '/guidance.html') {
  const extension = await launchExtension();
  const page = await extension.context.newPage();
  await page.goto(`http://127.0.0.1:4173${path}`);
  await activateToolbar(page, extension.extensionId);
  const panel = await extension.context.newPage();
  await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
  await panel.setViewportSize({ width: 360, height: 900 });
  await page.bringToFront();
  return { ...extension, page, panel };
}

async function scenario(panel: Page, value: string) {
  const details = panel.locator('.mock-scenarios');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await panel.getByLabel('Behavior for the next submitted task').selectOption(value);
}

async function submit(panel: Page, question = 'find primary target') {
  await panel.getByLabel('What do you want to find?').fill(question);
  await panel.getByRole('button', { name: /Start mock guidance|Replace guidance/ }).click();
}

test('question to highlight to a user click, with honest acknowledgement and no backend traffic', async () => {
  const { context, page, panel } = await openFixture();
  const outgoing: string[] = [];
  context.on('request', (request) => outgoing.push(request.url()));
  try {
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Waiting for you');
    await expect(page.locator('#clickpilot-overlay .tooltip')).toContainText('Click Primary target yourself');
    await expect(page.locator('#counter')).toHaveText('Clicks: 0');
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await panel.screenshot({ path: '/tmp/clickpilot-m4-waiting-360.png', fullPage: true });
    await panel.setViewportSize({ width: 260, height: 900 });
    await panel.screenshot({ path: '/tmp/clickpilot-m4-waiting-260.png', fullPage: true });
    expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/clickpilot-m4-page.png' });
    await page.locator('#primary span').click();
    await expect(page.locator('#counter')).toHaveText('Clicks: 1');
    await expect(panel.getByRole('status')).toContainText('Click observed');
    await expect(panel.getByRole('status')).toContainText('has not verified');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    expect(outgoing.every((url) => url.startsWith('chrome-extension://') || url.startsWith('http://127.0.0.1:4173/'))).toBe(true);
  } finally { await context.close(); }
});

test('ambiguous and unsupported tasks never select a guessed control', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await submit(panel, 'find settings');
    await expect(panel.getByRole('status')).toContainText('More than one control');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await submit(panel, 'delete my account');
    await expect(panel.getByRole('status')).toContainText('does not understand');
    await submit(panel, 'find navigation settings');
    await expect(panel.getByRole('status')).toContainText('Waiting for you');
    const outline = await page.locator('#clickpilot-overlay .highlight').boundingBox();
    const target = await page.locator('#nav-settings').boundingBox();
    expect(outline!.x).toBeCloseTo(target!.x - 4);
    await expect(page.locator('#output')).toHaveText('No action taken');
  } finally { await context.close(); }
});

test('mock guidance refuses other pages, even when the requested label exists', async () => {
  const { context, page, panel } = await openFixture('/overlay.html');
  try {
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('only works on the local guidance fixture');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('missing targets show an honest limitation', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await page.locator('#remove-primary').click();
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('No visible, enabled Primary target');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('Stop cancels delayed selection; Retry starts a fresh run', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await scenario(panel, 'delayed');
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Choosing a target');
    await panel.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('Guidance stopped');
    await panel.waitForTimeout(2200);
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('Waiting for you');
    await expect(page.locator('#counter')).toHaveText('Clicks: 0');
  } finally { await context.close(); }
});

test('a newer task supersedes delayed guidance and keeps its own target', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await scenario(panel, 'delayed');
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Choosing a target');
    await scenario(panel, 'normal');
    await submit(panel, 'find profile');
    await expect(panel.getByRole('status')).toContainText('Click Profile yourself');
    await panel.waitForTimeout(2200);
    await expect(page.locator('#clickpilot-overlay .tooltip')).toContainText('Click Profile yourself');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
  } finally { await context.close(); }
});

test('stale target scenarios recover once or stop after the bounded retry', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await scenario(panel, 'stale-once');
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Waiting for you');
    await scenario(panel, 'stale-always');
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('after one refresh');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await scenario(panel, 'invalid-output');
    await submit(panel);
    await expect(panel.getByRole('alert')).toContainText('invalid output');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('target removed during delayed selection is reobserved without painting a stale element', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await scenario(panel, 'delayed');
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Choosing a target');
    await page.locator('#remove-primary').click();
    await expect(panel.getByRole('status')).toContainText('No visible, enabled Primary target', { timeout: 7000 });
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('SPA navigation cancels selection and prevents a delayed highlight', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await scenario(panel, 'delayed');
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Choosing a target');
    await page.locator('#change-route').click();
    await expect(panel.getByRole('status')).toContainText('Page changed');
    await panel.waitForTimeout(2200);
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('tab switching and full navigation cancel active guidance', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await scenario(panel, 'delayed');
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Choosing a target');
    const other = await context.newPage();
    await other.goto('http://127.0.0.1:4173/second.html');
    await expect(panel.getByRole('status')).toContainText('Tab changed');
    await page.bringToFront();
    await scenario(panel, 'normal');
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Waiting for you');
    await page.getByRole('link', { name: 'Next page' }).click();
    await expect(panel.getByRole('status')).toContainText('Page changed');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('scripted clicks and clicks on unrelated controls do not acknowledge guidance', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Waiting for you');
    await page.locator('#primary').evaluate((element: HTMLButtonElement) => element.click());
    await page.locator('#profile').click();
    await expect(panel.getByRole('status')).toContainText('Waiting for you');
    await page.locator('#primary').click();
    await expect(panel.getByRole('status')).toContainText('Click observed');
  } finally { await context.close(); }
});

test('covered targets and mode changes clear guidance; closing the panel cancels pending selection', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await submit(panel);
    await expect(panel.getByRole('status')).toContainText('Waiting for you');
    await page.locator('#cover-primary').click();
    await expect(panel.getByRole('status')).toContainText('no longer visible');
    await panel.getByRole('button', { name: 'Manual highlights', exact: true }).click();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Mock guidance', exact: true }).click();
    await scenario(panel, 'delayed');
    await submit(panel, 'find profile');
    await expect(panel.getByRole('status')).toContainText('Choosing a target');
    await panel.close();
    await page.waitForTimeout(2200);
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(page.locator('#output')).toHaveText('No action taken');
  } finally { await context.close(); }
});
