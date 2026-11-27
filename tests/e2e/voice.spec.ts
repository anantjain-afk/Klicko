import { createServer } from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { activateToolbar, launchExtension } from './extension';

const hosted = process.env.CLICKPILOT_TEST_VOICE === 'hosted';
test.skip(process.env.CLICKPILOT_TEST_VOICE !== '1' && !hosted, 'Requires a voice build.');

// Playwright selectors cannot pierce the buddy's closed shadow root.
async function buddyNode(page: Page, key: string, value: string) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const nodes = [root];
  while (nodes.length) {
    const node = nodes.pop()!;
    const index = node.attributes?.indexOf(key) ?? -1;
    if (index >= 0 && node.attributes?.[index + 1] === value) return { node, cdp };
    nodes.push(...node.children ?? [], ...node.shadowRoots ?? []);
  }
  await cdp.detach();
  throw new Error(`Buddy element missing: ${value}`);
}

async function clickBuddy(page: Page, key: string, value: string) {
  const { node, cdp } = await buddyNode(page, key, value);
  try {
    const { model } = await cdp.send('DOM.getBoxModel', { nodeId: node.nodeId });
    const [left, top, , , right, bottom] = model.border;
    await page.mouse.click((left! + right!) / 2, (top! + bottom!) / 2);
  } finally { await cdp.detach(); }
}

async function buddyText(page: Page, key: string, value: string) {
  const { node, cdp } = await buddyNode(page, key, value);
  await cdp.detach();
  return node.children?.map((child) => child.nodeValue).join('') ?? '';
}
const voiceStatus = (page: Page) => buddyText(page, 'id', 'clickpilot-voice-status');

test('voice follows activation and stays bound to the page that starts recording', async () => {
  const uploads: Buffer[] = [];
  const questions: string[] = [];
  const origins: string[] = [];
  let transcript = 'What is the capital of Japan?';
  let transcriptionStatus = 200;
  let deferTranscript = false;
  let finishTranscript: (() => void) | undefined;
  function completeDeferredTranscript() {
    const finish = finishTranscript;
    finishTranscript = undefined;
    finish?.();
  }
  const server = createServer(async (request, response) => {
    if (request.url !== '/v1/voice/transcribe' || request.method !== 'POST'
      || request.headers['content-type'] !== 'audio/wav' || request.headers['x-klicko-voice'] !== 'preview') {
      response.writeHead(400).end(); return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk);
    uploads.push(Buffer.concat(chunks));
    if (deferTranscript) await new Promise<void>((resolve) => { finishTranscript = resolve; });
    response.writeHead(transcriptionStatus, { 'Content-Type': 'application/json' }).end(JSON.stringify({ text: transcript }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Transcript stub did not bind.');
  let context: Awaited<ReturnType<typeof launchExtension>>['context'] | undefined;
  try {
    const extension = await launchExtension(false, true, {
      path: `apps/extension/.output/chrome-mv3-voice-${hosted ? 'hosted' : 'preview'}`,
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
      async prepareCopy(path) {
        // Leave the developer's live Worker and the original unpacked build alone.
        const chunks = join(path, 'chunks');
        const audio = (await readdir(chunks)).find((name) => /^audio-.*\.js$/.test(name));
        if (!audio) throw new Error('Voice-preview audio bundle is missing.');
        const file = join(chunks, audio);
        const code = await readFile(file, 'utf8');
        const origin = hosted ? 'https://voice.example.test' : 'http://127.0.0.1:8787';
        const endpoint = origin + '/v1/voice/transcribe';
        if (!code.includes(endpoint)) throw new Error('Voice endpoint is missing.');
        await writeFile(file, code.replace(endpoint, `http://127.0.0.1:${address.port}/v1/voice/transcribe`));
      },
    });
    context = extension.context;
    await context.route('http://127.0.0.1:4173/login', (route) => route.fulfill({
      contentType: 'text/html', body: '<title>Restricted fixture</title><h1>Restricted fixture</h1>',
    }));
    await context.route('https://api.groq.com/openai/v1/chat/completions', async (route) => {
      const input = JSON.parse(route.request().postDataJSON().messages[1].content);
      questions.push(input.userGoal);
      origins.push(input.page.origin);
      const target = input.elements.find((item: { name: string }) => item.name === 'Primary target');
      const result = input.userGoal === 'Find the primary target'
        ? { kind: 'guidance', targetId: target.id, nextStep: 'none', instruction: 'Click Primary target.', message: 'Use the primary control.' }
        : { kind: 'answer', message: 'Tokyo is the capital of Japan.' };
      await route.fulfill({ json: { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(result) } }] } });
    });
    const page = await context.newPage();
    await page.goto('http://localhost:4173/guidance.html');
    await page.bringToFront();
    await activateToolbar(page, extension.extensionId);
    await expect(page.locator('#clickpilot-buddy')).toHaveCount(1);
    await expect.poll(async () => {
      const { node, cdp } = await buddyNode(page, 'aria-label', 'Open sidebar');
      await cdp.detach();
      return node.attributes?.includes('disabled');
    }).toBe(false);

    await page.keyboard.down('Alt');
    await page.keyboard.down('Meta');
    await expect.poll(() => voiceStatus(page)).toContain('Open Voice setup');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Meta');
    expect(uploads).toHaveLength(0);

    const opened = context.waitForEvent('page');
    await clickBuddy(page, 'id', 'clickpilot-voice-setup');
    const setup = await opened;
    await setup.getByRole('button', { name: 'Allow microphone and enable voice' }).click();
    await expect(setup.getByRole('status')).toContainText('Voice is enabled');
    await setup.close();
    await page.bringToFront();

    await page.keyboard.down('Meta');
    await page.keyboard.down('Alt');
    await expect.poll(() => voiceStatus(page)).toContain('Listening');
    await page.keyboard.press('Escape');
    await page.keyboard.up('Meta');
    await page.keyboard.up('Alt');
    await expect.poll(() => voiceStatus(page)).toBe('');
    expect(uploads).toHaveLength(0);

    await page.keyboard.down('Alt');
    await page.keyboard.down('Meta');
    await expect.poll(() => voiceStatus(page)).toContain('Listening');
    const other = await context.newPage();
    await other.bringToFront();
    await expect.poll(() => voiceStatus(page)).toBe('');
    await other.close();
    await page.bringToFront();
    await page.keyboard.up('Alt');
    await page.keyboard.up('Meta');
    expect(uploads).toHaveLength(0);

    async function speak(tab = page) {
      await tab.keyboard.down('Meta');
      await tab.keyboard.down('Alt');
      await expect.poll(() => voiceStatus(tab)).toContain('Listening');
      // Chromium's fake mic produces periodic tones. Keep a full interval.
      await tab.waitForTimeout(1150);
      await tab.keyboard.up('Meta');
      await tab.keyboard.up('Alt');
    }
    await speak();
    await expect.poll(() => voiceStatus(page)).toContain('Enable Webpage guidance');
    expect(uploads).toHaveLength(1);
    expect(questions).toHaveLength(0);
    expect(uploads[0]!.subarray(0, 4).toString()).toBe('RIFF');
    expect(uploads[0]!.readUInt16LE(22)).toBe(1);
    expect(uploads[0]!.readUInt32LE(24)).toBe(16_000);
    expect(uploads[0]!.readUInt16LE(34)).toBe(16);
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);

    await extension.worker.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: { storage: { local: { set: (value: unknown) => Promise<void> } } } }).chrome;
      await api.storage.local.set({
        'clickpilot.ai-sharing': { version: 1, onboardingComplete: true, guidance: true, selectedText: false },
        'clickpilot.active-provider': 'groq',
        'clickpilot.provider.groq': { version: 1, provider: 'groq', model: 'openai/gpt-oss-120b', apiKey: 'fixture-groq-key' },
      });
    });
    await expect.poll(async () => {
      const { node, cdp } = await buddyNode(page, 'aria-label', 'Open Settings');
      await cdp.detach();
      return node.attributes?.includes('hidden');
    }).toBe(true);

    deferTranscript = true;
    await speak();
    await expect.poll(() => voiceStatus(page)).toContain('Transcribing');
    await expect.poll(() => !!finishTranscript).toBe(true);
    const secondTab = await context.newPage();
    await secondTab.bringToFront();
    await expect.poll(() => voiceStatus(page)).toBe('');
    completeDeferredTranscript();
    deferTranscript = false;
    await secondTab.close();
    await page.bringToFront();
    expect(questions).toHaveLength(0);

    const { node, cdp } = await buddyNode(page, 'id', 'clickpilot-ask');
    await cdp.send('DOM.focus', { nodeId: node.nodeId });
    await cdp.detach();
    await page.keyboard.type('Keep my typed draft');
    await speak();
    await expect.poll(() => buddyText(page, 'class', 'reply')).toBe('Tokyo is the capital of Japan.');
    expect(questions).toEqual(['What is the capital of Japan?']);
    const draft = await buddyNode(page, 'id', 'clickpilot-ask');
    try {
      const { object } = await draft.cdp.send('DOM.resolveNode', { nodeId: draft.node.nodeId });
      const { result } = await draft.cdp.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: 'function () { return this.value; }',
        returnByValue: true,
      });
      expect(result.value).toBe('Keep my typed draft');
    } finally { await draft.cdp.detach(); }

    transcript = 'Find the primary target';
    await speak();
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Primary target.');
    expect(questions).toEqual(['What is the capital of Japan?', 'Find the primary target']);
    await expect(page.locator('#counter')).toHaveText('Clicks: 0');

    const typed = await buddyNode(page, 'id', 'clickpilot-ask');
    await typed.cdp.send('DOM.focus', { nodeId: typed.node.nodeId });
    await typed.cdp.detach();
    await page.keyboard.press('Enter');
    await expect.poll(() => questions.at(-1)).toBe('Keep my typed draft');
    await expect.poll(async () => {
      const { node, cdp } = await buddyNode(page, 'aria-label', 'Send question');
      await cdp.detach();
      return node.attributes?.includes('disabled');
    }).toBe(true);

    const crossOrigin = await context.newPage();
    await crossOrigin.goto('http://127.0.0.1:4173/guidance.html?voice=second-origin');
    await crossOrigin.bringToFront();
    await expect(crossOrigin.locator('#clickpilot-buddy')).toHaveCount(1);
    await expect.poll(async () => {
      const { node, cdp } = await buddyNode(crossOrigin, 'aria-label', 'Open sidebar');
      await cdp.detach();
      return node.attributes?.includes('disabled');
    }).toBe(false);

    deferTranscript = true;
    await speak(crossOrigin);
    await expect.poll(() => !!finishTranscript).toBe(true);
    await crossOrigin.evaluate(() => history.pushState({}, '', '#destination'));
    await expect.poll(() => voiceStatus(crossOrigin)).toBe('');
    completeDeferredTranscript();
    deferTranscript = false;
    expect(questions).toHaveLength(3);
    await speak(crossOrigin);
    await expect(crossOrigin.locator('#clickpilot-overlay .tooltip')).toHaveText('Click Primary target.');
    expect(questions).toHaveLength(4);
    expect(origins.at(-1)).toBe('http://127.0.0.1:4173');
    await expect(crossOrigin.locator('#counter')).toHaveText('Clicks: 0');

    if (hosted) {
      transcriptionStatus = 429;
      await speak(crossOrigin);
      await expect.poll(() => voiceStatus(crossOrigin)).toContain('too many requests');
      transcriptionStatus = 503;
      await speak(crossOrigin);
      await expect.poll(() => voiceStatus(crossOrigin)).toContain('temporarily unavailable');
      expect(questions).toHaveLength(4);
    }

    const completedUploads = uploads.length;
    await crossOrigin.goto('http://127.0.0.1:4173/login');
    await expect(crossOrigin.getByText('Restricted fixture')).toBeVisible();
    await crossOrigin.keyboard.down('Alt');
    await crossOrigin.keyboard.down('Meta');
    await crossOrigin.waitForTimeout(350);
    await crossOrigin.keyboard.up('Alt');
    await crossOrigin.keyboard.up('Meta');
    await expect(crossOrigin.locator('#clickpilot-buddy')).toHaveCount(0);
    expect(uploads).toHaveLength(completedUploads);
  } finally {
    completeDeferredTranscript();
    await context?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
