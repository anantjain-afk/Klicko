import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

async function launchExtension() {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  return { context, extensionId };
}

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

    const browser = context.browser();
    if (!browser) throw new Error('Browser-level debugging is unavailable.');
    const cdp = await browser.newBrowserCDPSession();
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
    const tab = targetInfos.find((target) => target.url === page.url());
    if (!tab) throw new Error('The fixture tab target was not found.');
    await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: tab.targetId });

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
