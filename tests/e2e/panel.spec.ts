import { test, expect } from '@playwright/test';
import { activateToolbar, launchExtension } from './extension';

test('built extension reports restricted pages without injecting into them', async () => {
  const { context, extensionId } = await launchExtension();
  try {
    const page = await context.newPage();
    await page.goto('chrome://extensions');

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
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
