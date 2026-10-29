import { test, expect } from '@playwright/test';
import { activateToolbar, launchExtension, openSharingSettings, textAction } from './extension';

const providers = [
  { name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/**', model: 'Gemini 3.8 Flash' },
  { name: 'OpenAI', url: 'https://api.openai.com/v1/responses', model: 'GPT-6.1 Sol' },
  { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'GPT-OSS 120B' },
] as const;

for (const provider of providers) {
  test(`saved ${provider.name} model handles guidance without a local API`, async () => {
    const extension = await launchExtension(false, true);
    const sent: unknown[] = [];
    await extension.context.route(provider.url, async (route) => {
      const body = route.request().postDataJSON();
      const context = provider.name === 'Google Gemini' ? JSON.parse(body.contents[0].parts[0].text)
        : provider.name === 'OpenAI' ? JSON.parse(body.input) : JSON.parse(body.messages[1].content);
      sent.push(context);
      const target = context.elements.find((element: { name: string }) => element.name === 'Primary target');
      const result = { kind: 'guidance', nextStep: 'none', targetId: target.id, message: 'Use the primary control.', instruction: 'Click Primary target.' };
      const text = JSON.stringify(result);
      const response = provider.name === 'Google Gemini'
        ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] }
        : provider.name === 'OpenAI'
          ? { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] }
          : { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: text } }] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    try {
      const page = await extension.context.newPage(); await page.goto('http://127.0.0.1:4173/guidance.html');
      await activateToolbar(page, extension.extensionId);
      const panel = await extension.context.newPage(); await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
      await openSharingSettings(panel);
      await panel.getByLabel('Provider', { exact: true }).selectOption({ label: provider.name });
      await panel.getByLabel('Model', { exact: true }).selectOption({ label: provider.model });
      await panel.getByLabel('API key').fill('fixture-private-key');
      await panel.getByRole('button', { name: 'Save provider' }).click();
      await expect(panel.locator('.provider-settings [role="status"]')).toContainText('saved on this device');
      await panel.getByRole('checkbox', { name: /^Webpage guidance/ }).check();
      await panel.reload(); await openSharingSettings(panel);
      await expect(panel.getByLabel('Provider', { exact: true })).toHaveValue(provider.name === 'Google Gemini' ? 'gemini' : provider.name.toLowerCase());
      await expect(panel.getByLabel('Model', { exact: true })).toHaveValue(provider.name === 'Google Gemini' ? 'gemini-3.8-flash'
        : provider.name === 'OpenAI' ? 'gpt-6.1-sol' : 'openai/gpt-oss-120b');
      await expect(panel.getByLabel('API key')).toBeEmpty();
      await panel.getByRole('button', { name: 'Back to chat' }).click();
      await page.bringToFront();
      await panel.getByLabel('What would you like help with?').fill('Find primary target');
      await panel.getByRole('button', { name: 'Send message' }).click();
      await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Primary target.');
      expect(sent).toHaveLength(1);
      expect(JSON.stringify(sent[0])).not.toMatch(/fixture-private-key|127\.0\.0\.1:8787|rect|viewport/);
      await expect(page.locator('#counter')).toHaveText('Clicks: 0');
    } finally { await extension.context.close(); }
  });
}

test('switching Groq to Gemini and back retains each model and key', async () => {
  const extension = await launchExtension(false, true);
  const sent: string[] = [];
  await extension.context.route('https://api.groq.com/openai/v1/chat/completions', async (route) => {
    sent.push(route.request().headers().authorization ?? '');
    expect(route.request().postDataJSON().model).toBe('openai/gpt-oss-120b');
    const context = JSON.parse(route.request().postDataJSON().messages[1].content);
    const target = context.elements.find((element: { name: string }) => element.name === 'Primary target');
    const result = { kind: 'guidance', nextStep: 'none', targetId: target.id, message: 'Use the primary control.', instruction: 'Click Primary target.' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [
      { finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(result) } },
    ] }) });
  });
  try {
    const page = await extension.context.newPage(); await page.goto('http://127.0.0.1:4173/guidance.html');
    await activateToolbar(page, extension.extensionId);
    const panel = await extension.context.newPage(); await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
    await openSharingSettings(panel);
    await panel.getByLabel('Provider', { exact: true }).selectOption('groq');
    await panel.getByLabel('Model', { exact: true }).selectOption('openai/gpt-oss-120b');
    await panel.getByLabel('API key').fill('fixture-groq-key');
    await panel.getByRole('button', { name: 'Save provider' }).click();
    await expect(panel.locator('.provider-settings [role="status"]')).toContainText('saved on this device');
    await panel.getByLabel('Provider', { exact: true }).selectOption('gemini');
    await panel.getByLabel('Model', { exact: true }).selectOption('gemini-3.8-flash');
    await panel.getByLabel('API key').fill('fixture-gemini-key');
    await panel.getByRole('button', { name: 'Save provider' }).click();
    await expect(panel.locator('.provider-settings [role="status"]')).toContainText('saved on this device');
    await panel.getByLabel('Provider', { exact: true }).selectOption('groq');
    await expect(panel.getByLabel('Model', { exact: true })).toHaveValue('openai/gpt-oss-120b');
    await expect(panel.getByLabel('API key')).toBeEmpty();
    await expect(panel.locator('.provider-settings')).toContainText('A key is saved for this provider');
    await panel.getByRole('button', { name: 'Save provider' }).click();
    await expect(panel.locator('.provider-settings [role="status"]')).toContainText('saved on this device');
    const storage = await extension.worker.evaluate(async () => {
      const local = (globalThis as unknown as { chrome: { storage: { local: { get: (keys: string[]) => Promise<Record<string, unknown>> } } } }).chrome.storage.local;
      return local.get(['clickpilot.provider.groq', 'clickpilot.provider.gemini', 'clickpilot.active-provider']);
    });
    expect(storage['clickpilot.active-provider']).toBe('groq');
    expect(storage['clickpilot.provider.groq']).toMatchObject({ model: 'openai/gpt-oss-120b', apiKey: 'fixture-groq-key' });
    expect(storage['clickpilot.provider.gemini']).toMatchObject({ model: 'gemini-3.8-flash', apiKey: 'fixture-gemini-key' });
    await panel.getByRole('checkbox', { name: /^Webpage guidance/ }).check();
    await panel.getByRole('button', { name: 'Back to chat' }).click();
    await page.bringToFront();
    await panel.getByLabel('What would you like help with?').fill('Find primary target');
    await panel.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Primary target.');
    expect(sent).toEqual(['Bearer fixture-groq-key']);
    await openSharingSettings(panel);
    await panel.getByRole('button', { name: 'Remove saved key' }).click();
    await expect(panel.locator('.provider-settings [role="status"]')).toContainText('removed');
    await panel.getByLabel('Provider', { exact: true }).selectOption('gemini');
    await expect(panel.getByLabel('Model', { exact: true })).toHaveValue('gemini-3.8-flash');
    await expect(panel.locator('.provider-settings')).toContainText('A key is saved for this provider');
  } finally { await extension.context.close(); }
});

test('saving another provider migrates the earlier single-provider key', async () => {
  const extension = await launchExtension(false, true);
  try {
    await extension.worker.evaluate(async () => {
      const local = (globalThis as unknown as { chrome: { storage: { local: { set: (value: unknown) => Promise<void> } } } }).chrome.storage.local;
      await local.set({ 'clickpilot.provider-settings': { version: 1, provider: 'groq', model: 'openai/gpt-oss-120b', apiKey: 'fixture-groq-key' } });
    });
    const panel = await extension.context.newPage(); await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
    await openSharingSettings(panel);
    await expect(panel.getByLabel('Provider', { exact: true })).toHaveValue('groq');
    await panel.getByLabel('Provider', { exact: true }).selectOption('gemini');
    await panel.getByLabel('API key').fill('fixture-gemini-key');
    await panel.getByRole('button', { name: 'Save provider' }).click();
    await expect(panel.locator('.provider-settings [role="status"]')).toContainText('saved on this device');
    const storage = await extension.worker.evaluate(async () => {
      const local = (globalThis as unknown as { chrome: { storage: { local: { get: (keys: string[]) => Promise<Record<string, unknown>> } } } }).chrome.storage.local;
      return local.get(['clickpilot.provider-settings', 'clickpilot.provider.groq', 'clickpilot.provider.gemini']);
    });
    expect(storage['clickpilot.provider-settings']).toBeUndefined();
    expect(storage['clickpilot.provider.groq']).toMatchObject({ model: 'openai/gpt-oss-120b', apiKey: 'fixture-groq-key' });
    expect(storage['clickpilot.provider.gemini']).toMatchObject({ apiKey: 'fixture-gemini-key' });
  } finally { await extension.context.close(); }
});

test('selected text uses the saved provider and removing the key stops further requests', async () => {
  const extension = await launchExtension(false, true);
  let calls = 0;
  await extension.context.route('https://api.groq.com/openai/v1/chat/completions', async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    const context = JSON.parse(body.messages[1].content);
    expect(context.selectedText).toContain('Photosynthesis');
    expect(context).not.toHaveProperty('tabId');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop',
      message: { role: 'assistant', content: JSON.stringify({ kind: 'explanation', quickExplanation: 'Plants use light.', detailedExplanation: 'Plants store light as chemical energy.' }) } }] }) });
  });
  try {
    const page = await extension.context.newPage(); await page.goto('http://127.0.0.1:4173/text.html');
    await activateToolbar(page, extension.extensionId);
    const panel = await extension.context.newPage(); await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
    await openSharingSettings(panel);
    await panel.getByLabel('Provider', { exact: true }).selectOption('groq');
    await panel.getByLabel('API key').fill('fixture-private-key');
    await panel.getByRole('button', { name: 'Save provider' }).click();
    await expect(panel.locator('.provider-settings [role="status"]')).toContainText('saved on this device');
    await panel.getByRole('checkbox', { name: /^Selected-text assistance/ }).check();
    await panel.getByRole('button', { name: 'Back to chat' }).click();
    await page.bringToFront();
    await textAction(panel, 'text-enable');
    await page.locator('#passage').click({ clickCount: 3 });
    await page.getByRole('button', { name: 'Ask Klicko', exact: true }).click();
    await page.getByLabel('Question about this passage').fill('Explain this passage.');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(panel.locator('.chat-workspace')).toContainText('Plants store light as chemical energy.');
    expect(calls).toBe(1);
    await openSharingSettings(panel);
    await panel.getByRole('button', { name: 'Remove saved key' }).click();
    await expect(panel.locator('.provider-settings [role="status"]')).toContainText('removed');
    await panel.getByRole('button', { name: 'Back to chat' }).click();
    await page.locator('#passage').click({ clickCount: 3 });
    await page.getByRole('button', { name: 'Ask Klicko', exact: true }).click();
    await page.getByLabel('Question about this passage').fill('Explain again.');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(panel.locator('.chat-workspace')).toContainText('Choose a provider, model, and API key');
    expect(calls).toBe(1);
  } finally { await extension.context.close(); }
});

test('denied provider access leaves the key unsaved', async () => {
  const extension = await launchExtension();
  try {
    const panel = await extension.context.newPage(); await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
    await openSharingSettings(panel);
    await panel.evaluate(() => {
      const permissions = (globalThis as unknown as { chrome: { permissions: { request: (value: unknown) => Promise<boolean> } } }).chrome.permissions;
      permissions.request = async () => false;
    });
    await panel.getByLabel('Provider', { exact: true }).selectOption('openai');
    await panel.getByLabel('API key').fill('fixture-private-key');
    await panel.getByRole('button', { name: 'Save provider' }).click();
    await expect(panel.locator('.provider-settings [role="status"]')).toContainText('not granted');
    const saved = await extension.worker.evaluate(async () => {
      const storage = (globalThis as unknown as { chrome: { storage: { local: { get: (key: string) => Promise<Record<string, unknown>> } } } }).chrome.storage.local;
      return (await storage.get('clickpilot.provider.openai'))['clickpilot.provider.openai'];
    });
    expect(saved).toBeUndefined();
  } finally { await extension.context.close(); }
});
