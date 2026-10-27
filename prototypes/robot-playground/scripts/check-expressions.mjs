import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
/* global document, innerWidth */

// Uses the repository's existing Playwright install and a running local playground.
const origin = 'http://127.0.0.1:5176';
const captures = process.env.CLICKPILOT_CAPTURE_DIR || join(tmpdir(), 'clickpilot-expression-review');
await mkdir(captures, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const externalRequests = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:')) return route.continue();
    externalRequests.push(url);
    return route.abort();
  });
  await page.goto(origin);
  await page.locator('.robot-art[data-loaded="true"]').waitFor();
  const current = page.getByRole('status', { name: 'Current expression' });
  const choose = (name) => page.getByRole('button', { name, exact: true }).click();
  const assertExpression = (name) => expect(current).toHaveText(new RegExp(`^${name} ·`));
  const capture = (name) => page.screenshot({ path: join(captures, name), fullPage: true });

  for (const name of ['Idle', 'Listening', 'Thinking', 'Happy', 'Confused', 'Surprised', 'Sleepy', 'Error']) {
    await choose(name);
    await assertExpression(name);
    await page.waitForTimeout(name === 'Surprised' || name === 'Error' ? 160 : 850);
    await capture(`web-${name.toLowerCase()}.png`);
  }

  await choose('Automatic');
  await page.mouse.move(10, 10);
  await assertExpression('Idle');
  const robot = page.locator('.robot-art');
  let box = await robot.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.48, { steps: 12 });
  await assertExpression('Happy');
  await page.mouse.move(10, 10);
  await assertExpression('Idle');

  await choose('Floating buddy');
  await page.waitForTimeout(800);
  const buddy = page.getByRole('button', { name: 'ClickPilot buddy: open or close ask card' });
  await buddy.click({ force: true });
  await assertExpression('Surprised');
  await assertExpression('Happy');
  await page.getByRole('textbox', { name: 'What are you working on?' }).fill('Hello, little co-pilot.');
  await assertExpression('Listening');
  await capture('web-typing.png');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await page.getByRole('textbox', { name: 'Give it something to look at' }).fill('I am writing over here.');
  await assertExpression('Listening');
  await page.waitForTimeout(500);
  await capture('web-sidebar.png');

  // Interrupt a one-shot before its recovery timer and check that it stays cancelled.
  await choose('Floating buddy');
  await page.waitForTimeout(600);
  await buddy.click({ force: true });
  await assertExpression('Surprised');
  await choose('Thinking');
  await assertExpression('Thinking');
  await page.waitForTimeout(1800);
  await assertExpression('Thinking');

  // Reduced motion wins over every expression, including changes made while paused.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await assertExpression('Still');
  await choose('Happy');
  await assertExpression('Still');
  await page.waitForTimeout(600);
  const canvas = page.locator('canvas');
  const a = join(captures, 'reduced-a.png');
  const b = join(captures, 'reduced-b.png');
  await page.screenshot({ path: a, clip: await canvas.boundingBox() });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: b, clip: await canvas.boundingBox() });
  assert.deepEqual(await readFile(a), await readFile(b), 'Reduced-motion canvas changed');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await assertExpression('Happy');
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await assertExpression('Still');
  await page.getByRole('button', { name: 'Resume animation' }).click();
  await assertExpression('Happy');

  await choose('Sidebar perch');
  await choose('Automatic');
  await page.getByRole('textbox', { name: 'Give it something to look at' }).fill('The composer still fits.');
  await page.getByRole('button', { name: 'Dark stage' }).click();
  await page.setViewportSize({ width: 390, height: 1150 });
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Narrow page overflow');
  await capture('web-mobile.png');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await choose('Character study');
  await page.getByRole('checkbox').check();
  const hit = page.getByRole('button', { name: 'Nudge ClickPilot robot' });
  await page.waitForTimeout(500);
  box = await hit.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 + 30, { steps: 12 });
  await page.mouse.up();
  const moved = await hit.boundingBox();
  assert.ok(moved.x < box.x - 40, 'Dragging did not move the robot');
  await hit.focus();
  await hit.press('Home');
  await expect.poll(async () => Math.abs((await hit.boundingBox()).x - box.x)).toBeLessThan(2);
  assert.equal(await page.locator('canvas').count(), 1, 'Duplicate character');
  assert.deepEqual(errors, [], 'Browser errors');
  assert.deepEqual(externalRequests, [], 'Unexpected external request');
  console.log(JSON.stringify({ expressions: 8, proximity: true, clickReaction: true, typing: true, interruption: true, reducedMotion: true, dragAndReset: true, errors, externalRequests, captures }, null, 2));
} finally {
  await browser.close();
}
