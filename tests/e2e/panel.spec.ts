import { test, expect } from '@playwright/test';
import { activateToolbar, launchExtension, openSharingSettings } from './extension';

test('built extension reports restricted pages without injecting into them', async () => {
  const { context, extensionId } = await launchExtension();
  try {
    const page = await context.newPage();
    await page.goto('chrome://extensions');

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.getByRole('button', { name: 'Manual highlights', exact: true }).click();
    await panel.getByRole('button', { name: 'Inspect this page' }).click();
    await expect(panel.getByRole('alert')).toContainText('cannot be inspected');

  } finally {
    await context.close();
  }
});

test('toolbar activation lets the panel inspect the local fixture', async () => {
  const { context, extensionId } = await launchExtension();
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173');

    await activateToolbar(page, extensionId);

    // Headless Chromium does not expose side panels as Playwright pages.
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.getByRole('button', { name: 'Manual highlights', exact: true }).click();
    await page.bringToFront();
    await panel.getByRole('button', { name: 'Inspect this page' }).click();

    await expect(panel.getByRole('heading', { name: 'Visible controls (7)' })).toBeVisible();
    const names = await panel.locator('.element-name').allTextContents();
    expect(names.filter((name) => name === 'Settings')).toHaveLength(2);
    expect(names).toContain('Profile');
    expect(names).toContain('Search projects');
    expect(names).not.toContain('Hidden control');
  } finally {
    await context.close();
  }
});

test('the loopback API host grant does not activate page inspection without the toolbar', async () => {
  const { context, extensionId } = await launchExtension();
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173');
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.getByRole('button', { name: 'Manual highlights', exact: true }).click();
    await page.bringToFront();
    await panel.getByRole('button', { name: 'Inspect this page' }).click();
    await expect(panel.getByRole('alert')).toContainText('toolbar icon');
    await expect(panel.getByRole('heading', { name: /Visible controls/ })).toHaveCount(0);
  } finally { await context.close(); }
});

test('first-use choices are optional, independent and remembered; Settings can revoke them', async () => {
  const { context, extensionId } = await launchExtension(true);
  let uploads = 0;
  await context.route('http://127.0.0.1:8787/**', async (route) => { uploads++; await route.abort(); });
  try {
    const page = await context.newPage(); await page.goto('http://127.0.0.1:4173/text.html');
    const panel = await context.newPage(); await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.setViewportSize({ width: 360, height: 900 });
    await expect(panel.getByRole('heading', { name: 'A little help. Your next move.' })).toBeVisible();
    const guidance = panel.getByRole('checkbox', { name: /^Webpage guidance/ });
    const selectedText = panel.getByRole('checkbox', { name: /^Selected-text assistance/ });
    await expect(guidance).not.toBeChecked(); await expect(selectedText).not.toBeChecked();
    await panel.screenshot({ path: '/tmp/clickpilot-ux1-onboarding-360.png', fullPage: true });
    await panel.setViewportSize({ width: 260, height: 900 });
    await panel.screenshot({ path: '/tmp/clickpilot-ux1-onboarding-260.png', fullPage: true });
    expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await selectedText.check(); await panel.getByRole('button', { name: 'Save choices and continue' }).click();
    await openSharingSettings(panel);
    await expect(guidance).not.toBeChecked(); await expect(selectedText).toBeChecked();
    await panel.reload(); await openSharingSettings(panel);
    await expect(guidance).not.toBeChecked(); await expect(selectedText).toBeChecked();
    await panel.getByRole('button', { name: 'AI assistant', exact: true }).click();
    await panel.getByLabel('What would you like help with?').fill('Find settings');
    await expect(panel.getByRole('button', { name: 'Ask Gemini' })).toBeDisabled();
    await page.bringToFront();
    await page.locator('#passage').click({ clickCount: 3 });
    await expect(page.locator('#clickpilot-text')).toHaveCount(0);
    await selectedText.uncheck(); await expect(selectedText).toBeEnabled();
    await panel.screenshot({ path: '/tmp/clickpilot-ux1-settings-260.png', fullPage: true });
    await panel.reload(); await openSharingSettings(panel);
    await expect(guidance).not.toBeChecked(); await expect(selectedText).not.toBeChecked();
    expect(uploads).toBe(0);
  } finally { await context.close(); }
});

test('worker refuses direct AI commands without the matching saved consent', async () => {
  const { context, extensionId } = await launchExtension();
  let uploads = 0;
  await context.route('http://127.0.0.1:8787/**', async (route) => { uploads++; await route.abort(); });
  try {
    const page = await context.newPage(); await page.goto('http://127.0.0.1:4173/text.html');
    await activateToolbar(page, extensionId);
    const panel = await context.newPage(); await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const errors = await panel.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: {
        runtime: { connect: (options: { name: string }) => { postMessage: (value: unknown) => void;
          onMessage: { addListener: (callback: (value: { type: string; error?: string }) => void) => void }; disconnect: () => void } };
        storage: { local: { set: (value: unknown) => Promise<void> } };
      } }).chrome;
      const port = api.runtime.connect({ name: 'clickpilot-panel' });
      const sessionId = crypto.randomUUID();
      const received: string[] = [];
      const first = new Promise<void>((resolve) => port.onMessage.addListener((value) => {
        if (value.type === 'ASSISTANT_RESULT' && value.error) { received.push(value.error); resolve(); }
      }));
      await api.storage.local.set({ 'clickpilot.ai-sharing': { version: 1, onboardingComplete: true, guidance: false, selectedText: true } });
      port.postMessage({ type: 'ASK_ASSISTANT', tabId: 1, sessionId, requestId: 1, pageKey: 'page', snapshotId: 'snapshot',
        userGoal: 'Find settings', taskContext: { stepNumber: 1, previousStep: null } });
      await first;
      const second = new Promise<void>((resolve) => port.onMessage.addListener((value) => {
        if (value.type === 'TEXT_RESULT' && value.error) { received.push(value.error); resolve(); }
      }));
      await api.storage.local.set({ 'clickpilot.ai-sharing': { version: 1, onboardingComplete: true, guidance: true, selectedText: false } });
      port.postMessage({ type: 'ASK_TEXT', protocolVersion: 1, operation: 'explain_text', tabId: 1, sessionId,
        requestId: 2, pageKey: 'page', selectionId: 'selection', selectedText: 'Plants use sunlight.', question: 'Explain this.' });
      await second; port.disconnect(); return received;
    });
    expect(errors).toEqual(['Webpage sharing is off. You can change it in Settings.', 'Selected-text sharing is off. You can change it in Settings.']);
    expect(uploads).toBe(0);
  } finally { await context.close(); }
});
