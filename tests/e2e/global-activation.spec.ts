import { test, expect } from '@playwright/test';
import { activateToolbar, launchExtension } from './extension';

test('a stalled tab cannot block new tabs or global OFF, and a late show cannot revive it', async () => {
  const { context, worker, extensionId } = await launchExtension(false, true);
  let uploads = 0;
  context.on('request', request => { if (request.url().includes('127.0.0.1:8787')) uploads++; });
  try {
    const stalled = await context.newPage(); await stalled.goto('http://localhost:4173/second.html');
    const first = await context.newPage(); await first.goto('http://localhost:4173/guidance.html');
    await worker.evaluate(async () => {
      const api = chrome;
      const tab = (await api.tabs.query({})).find(item => item.url?.includes('/second.html'));
      if (tab?.id === undefined) throw new Error('Stalled fixture tab missing.');
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
      const send = api.tabs.sendMessage.bind(api.tabs);
      const scope = globalThis as typeof globalThis & { releaseStalledShow?: () => void };
      api.tabs.sendMessage = ((tabId: number, message: { type?: string }, options?: chrome.tabs.MessageSendOptions) => {
        if (tabId === tab.id && message.type === 'SHOW_BUDDY') {
          return new Promise((resolve, reject) => {
            scope.releaseStalledShow = () => { void send(tabId, message, options).then(resolve, reject); };
          });
        }
        return send(tabId, message, options);
      }) as typeof api.tabs.sendMessage;
    });
    await first.bringToFront(); await activateToolbar(first, extensionId);
    await expect(first.locator('#clickpilot-buddy')).toHaveCount(1);
    await expect.poll(() => worker.evaluate(() => typeof (globalThis as typeof globalThis & { releaseStalledShow?: () => void }).releaseStalledShow)).toBe('function');
    const next = await context.newPage(); await next.goto('http://localhost:4173/text.html');
    await expect.soft(next.locator('#clickpilot-buddy')).toHaveCount(1, { timeout: 5000 });
    await activateToolbar(next, extensionId);
    await expect.soft(first.locator('#clickpilot-buddy')).toHaveCount(0, { timeout: 5000 });
    await expect.soft(next.locator('#clickpilot-buddy')).toHaveCount(0);
    await worker.evaluate(() => (globalThis as typeof globalThis & { releaseStalledShow?: () => void }).releaseStalledShow?.());
    await expect(stalled.locator('#clickpilot-buddy')).toHaveCount(0);
    await stalled.waitForTimeout(500);
    await expect(stalled.locator('#clickpilot-buddy, #clickpilot-text, #clickpilot-overlay')).toHaveCount(0);
    await activateToolbar(first, extensionId);
    await expect(first.locator('#clickpilot-buddy')).toHaveCount(1);
    await expect(next.locator('#clickpilot-buddy')).toHaveCount(1);
    await worker.evaluate(async () => {
      const api = chrome;
      const tab = (await api.tabs.query({})).find(item => item.url?.includes('/guidance.html'));
      if (tab?.id === undefined) throw new Error('Fixture tab missing.');
      const send = api.tabs.sendMessage.bind(api.tabs);
      const scope = globalThis as typeof globalThis & { releaseStalledDisable?: () => void };
      api.tabs.sendMessage = ((tabId: number, message: { type?: string }, options?: chrome.tabs.MessageSendOptions) => {
        if (tabId === tab.id && message.type === 'DEACTIVATE_PAGE') {
          return new Promise((resolve, reject) => {
            scope.releaseStalledDisable = () => { void send(tabId, message, options).then(resolve, reject); };
          });
        }
        return send(tabId, message, options);
      }) as typeof api.tabs.sendMessage;
    });
    await activateToolbar(next, extensionId);
    await expect(next.locator('#clickpilot-buddy')).toHaveCount(0);
    await expect.poll(() => worker.evaluate(() => typeof (globalThis as typeof globalThis & { releaseStalledDisable?: () => void }).releaseStalledDisable)).toBe('function');
    await activateToolbar(next, extensionId);
    await expect(next.locator('#clickpilot-buddy')).toHaveCount(1);
    await expect(first.locator('#clickpilot-buddy')).toHaveCount(1);
    await worker.evaluate(() => (globalThis as typeof globalThis & { releaseStalledDisable?: () => void }).releaseStalledDisable?.());
    await first.waitForTimeout(500);
    await expect(first.locator('#clickpilot-buddy')).toHaveCount(1);
    expect(uploads).toBe(0);
  } finally { await context.close(); }
});

test('a current-tab fallback does not survive enabling and then disabling global mode', async () => {
  const { context, worker, extensionId } = await launchExtension(false, true);
  try {
    const first = await context.newPage(); await first.goto('http://localhost:4173/guidance.html');
    const second = await context.newPage(); await second.goto('http://localhost:4173/text.html');
    await worker.evaluate(() => {
      const scope = globalThis as typeof globalThis & { restorePermissions?: () => void };
      const { contains, request } = chrome.permissions;
      chrome.permissions.contains = async () => false;
      chrome.permissions.request = async () => false;
      scope.restorePermissions = () => { chrome.permissions.contains = contains; chrome.permissions.request = request; };
    });
    await first.bringToFront(); await activateToolbar(first, extensionId);
    await expect(first.locator('#clickpilot-buddy')).toHaveCount(1);
    await expect(second.locator('#clickpilot-buddy')).toHaveCount(0);
    await worker.evaluate(() => (globalThis as typeof globalThis & { restorePermissions?: () => void }).restorePermissions?.());
    await activateToolbar(first, extensionId);
    await expect(second.locator('#clickpilot-buddy')).toHaveCount(1);
    await activateToolbar(first, extensionId);
    await expect(first.locator('#clickpilot-buddy')).toHaveCount(0);
    await expect(second.locator('#clickpilot-buddy')).toHaveCount(0);
    await expect.poll(() => worker.evaluate(async () => Object.keys(await chrome.storage.session.get(null))
      .filter(key => key.startsWith('clickpilot.activation.')).length)).toBe(0);
  } finally { await context.close(); }
});
