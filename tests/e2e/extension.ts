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
  if (await panel.locator('#sharing-settings').isVisible()) return;
  if (await panel.getByRole('button', { name: 'Back to chat' }).isVisible()) await panel.getByRole('button', { name: 'Back to chat' }).click();
  await panel.locator('.panel-menu summary').click();
  await panel.locator('.menu-options').getByRole('button', { name: 'Settings', exact: true }).click();
}

export async function setConsent(panel: Page, category: 'guidance' | 'text', value: boolean) {
  await openSharingSettings(panel);
  const checkbox = panel.getByRole('checkbox', { name: category === 'guidance' ? /^Webpage guidance/ : /^Selected-text assistance/ });
  await checkbox.setChecked(value); await expect(checkbox).toBeEnabled();
  await panel.getByRole('button', { name: 'Back to chat' }).click();
}

export async function selectMode(panel: Page, mode: 'AI assistant' | 'Manual highlights' | 'Mock guidance') {
  if (mode === 'AI assistant') {
    if (await panel.getByRole('button', { name: 'Back to chat' }).isVisible()) await panel.getByRole('button', { name: 'Back to chat' }).click();
    return;
  }
  if (!await panel.getByRole('heading', { name: 'Developer tools', exact: true }).isVisible()) {
    await selectMode(panel, 'AI assistant');
    await panel.locator('.panel-menu summary').click();
    await panel.locator('.menu-options').getByRole('button', { name: 'Developer tools', exact: true }).click();
  }
  await panel.getByRole('button', { name: mode, exact: true }).click();
}

export async function textAction(panel: Page, action: 'text-enable' | 'text-stop') {
  // Exercise the same shared command as the secondary text-selection controls.
  await panel.evaluate(async (action) => {
    const api = (globalThis as unknown as { chrome: { runtime: { connect: (options: { name: string }) => {
      postMessage: (value: unknown) => void; disconnect: () => void;
      onMessage: { addListener: (receive: (value: { type: string; epoch: string; taskId: string; textEnabled: boolean; textState: { kind: string } }) => void) => void };
    } } } }).chrome;
    const port = api.runtime.connect({ name: 'clickpilot-view' });
    await new Promise<void>((resolve, reject) => {
      let sent = false;
      const timer = setTimeout(() => { port.disconnect(); reject(new Error('Text command did not settle.')); }, 5000);
      port.onMessage.addListener((view) => {
        if (view.type !== 'TASK_VIEW') return;
        if (!sent) { sent = true; port.postMessage({ type: 'TASK_COMMAND', id: crypto.randomUUID(), epoch: view.epoch, taskId: view.taskId, action }); return; }
        if (action === 'text-stop' ? !view.textEnabled : view.textEnabled && ['ready', 'error'].includes(view.textState.kind)) {
          clearTimeout(timer); port.disconnect(); resolve();
        }
      });
      port.postMessage({ type: 'ATTACH' });
    });
  }, action);
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
