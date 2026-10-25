import { chromium, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export async function launchExtension(firstUse = false) {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: { width: 1100, height: 800 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  // A worker target exists before its bundle finishes registering action handlers.
  await expect.poll(() => worker.evaluate(() => (globalThis as unknown as {
    chrome: { action: { onClicked: { hasListeners: () => boolean } } };
  }).chrome.action.onClicked.hasListeners())).toBe(true);
  if (!firstUse) await worker.evaluate(async () => {
    const api = (globalThis as unknown as { chrome: { storage: { local: { set: (value: unknown) => Promise<void> } } } }).chrome;
    await api.storage.local.set({ 'clickpilot.ai-sharing': { version: 1, onboardingComplete: true, guidance: false, selectedText: false } });
  });
  const extensionId = new URL(worker.url()).host;
  return { context, extensionId, worker };
}

export async function openSharingSettings(panel: Page) {
  const settings = panel.locator('#sharing-settings');
  if (await settings.getAttribute('open') === null) await settings.locator('summary').click();
}

export async function stopExtensionWorker(page: Page, extensionId: string) {
  const cdp = await page.context().browser()!.newBrowserCDPSession();
  const { targetInfos } = await cdp.send('Target.getTargets');
  const worker = targetInfos.find((target) => target.type === 'service_worker' && target.url.includes(extensionId));
  if (!worker) throw new Error('Extension worker was not found.');
  await cdp.send('Target.closeTarget', { targetId: worker.targetId });
  await cdp.detach();
}

export async function activateToolbar(page: Page, extensionId: string) {
  const browser = page.context().browser();
  if (!browser) throw new Error('Browser-level debugging is unavailable.');
  const worker = page.context().serviceWorkers().find((value) => value.url().includes(extensionId));
  if (!worker) throw new Error('Extension worker was not found.');
  // Tests use a panel HTML tab. A second, real headless panel would compete
  // for task ownership and rearm text assistance when saved consent changes.
  // Keep the genuine toolbar gesture/activeTab grant, suppress only panel opening.
  await worker.evaluate(() => {
    const api = (globalThis as unknown as { chrome: { sidePanel: { open: (options: unknown) => Promise<void> } } }).chrome;
    api.sidePanel.open = async () => undefined;
  });
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
