import { chromium, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export async function launchExtension() {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: { width: 1100, height: 800 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  return { context, extensionId, worker };
}

export async function activateToolbar(page: Page, extensionId: string) {
  const browser = page.context().browser();
  if (!browser) throw new Error('Browser-level debugging is unavailable.');
  const cdp = await browser.newBrowserCDPSession();
  const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
  const tab = targetInfos.find((target) => target.url === page.url());
  if (!tab) throw new Error('The fixture tab target was not found.');
  await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: tab.targetId });
  await cdp.detach();
}

export async function panelMessage(panel: Page, message: unknown): Promise<unknown> {
  return panel.evaluate((request) => {
    const api = (globalThis as unknown as {
      chrome: { runtime: { sendMessage: (value: unknown) => Promise<unknown> } };
    }).chrome;
    return api.runtime.sendMessage(request);
  }, message);
}
