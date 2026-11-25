import { createServer } from 'node:http';
import { test, expect, type Page } from '@playwright/test';
import { activateToolbar, launchExtension } from './extension';

test.skip(process.env.CLICKPILOT_TEST_VOICE !== '1', 'Requires the local voice-preview build and port 8787.');

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

async function voiceStatus(page: Page) {
  const { node, cdp } = await buddyNode(page, 'id', 'clickpilot-voice-status');
  await cdp.detach();
  return node.children?.map((child) => child.nodeValue).join('') ?? '';
}

test('hold-to-talk previews one transcript and cancels interrupted clips', async () => {
  const uploads: Buffer[] = [];
  const server = createServer(async (request, response) => {
    if (request.url !== '/v1/voice/transcribe' || request.method !== 'POST'
      || request.headers['content-type'] !== 'audio/wav' || request.headers['x-klicko-voice'] !== 'preview') {
      response.writeHead(400).end(); return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk);
    uploads.push(Buffer.concat(chunks));
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ text: 'Switch accounts.' }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(8787, '127.0.0.1', resolve);
  });
  let context: Awaited<ReturnType<typeof launchExtension>>['context'] | undefined;
  try {
    const extension = await launchExtension(false, true, {
      path: 'apps/extension/.output/chrome-mv3-voice-preview',
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    context = extension.context;
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

    await page.keyboard.down('Meta');
    await page.keyboard.down('Alt');
    await expect.poll(() => voiceStatus(page)).toContain('Listening');
    // Chromium's fake mic produces periodic tones. Keep a full interval.
    await page.waitForTimeout(1150);
    await page.keyboard.up('Meta');
    await page.keyboard.up('Alt');
    await expect.poll(() => voiceStatus(page)).toBe('Transcript: Switch accounts.');
    expect(uploads).toHaveLength(1);
    expect(uploads[0]!.subarray(0, 4).toString()).toBe('RIFF');
    expect(uploads[0]!.readUInt16LE(22)).toBe(1);
    expect(uploads[0]!.readUInt32LE(24)).toBe(16_000);
    expect(uploads[0]!.readUInt16LE(34)).toBe(16);
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally {
    await context?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
