import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('navigation and installation links are honest', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Meet Klicko/ })).toBeVisible();
  await expect(page.locator('a.button-primary', { hasText: 'Get Klicko' }).first()).toHaveAttribute('href', '#install');
  await page.locator('.hero-actions').getByRole('link', { name: /Get Klicko/ }).click();
  await expect(page).toHaveURL(/#install$/);
  await expect(page.getByRole('heading', { name: /Get Klicko/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Download Extension/ })).toBeDisabled();
  await expect(page.getByText('Download pending production checks.')).toBeVisible();
  await expect(page.locator('code').filter({ hasText: 'chrome://extensions' })).toBeVisible();
  await expect(page.locator('code').filter({ hasText: 'brave://extensions' })).toBeVisible();
  await expect(page.locator('code').filter({ hasText: 'manifest.json' })).toBeVisible();
  await expect(page.locator('#privacy')).toBeVisible();
  const firstQuestion = page.locator('#faq details').first();
  await firstQuestion.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(firstQuestion).toHaveAttribute('open', '');
});

test('interactive demo advances only through visitor clicks', async ({ page }) => {
  await page.goto('/#try-it');
  await expect(page.getByText('Choose the example task to see how guidance works.')).toBeVisible();
  await page.getByRole('button', { name: /Start example task/ }).click();
  await expect(page.getByText('Start with Settings. You make the click.')).toBeVisible();
  await page.getByRole('navigation', { name: 'Demo dashboard navigation' }).getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByText('Follow the highlight: choose Settings.')).toBeVisible();
  const settings = page.getByRole('navigation', { name: 'Demo dashboard navigation' }).getByRole('button', { name: 'Settings' });
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Nice. Now open Domains.')).toBeVisible();
  await page.getByRole('navigation', { name: 'Demo dashboard navigation' }).getByRole('button', { name: 'Domains' }).click();
  await expect(page.getByText('You found domain settings. Every click was yours.')).toBeVisible();
  await page.getByRole('button', { name: /Try again/ }).click();
  await expect(page.getByText('Choose the example task to see how guidance works.')).toBeVisible();
});

test('video plays by visitor action and can pause', async ({ page }) => {
  await page.goto('/#demo-video');
  const video = page.locator('video');
  await expect(video).toHaveAttribute('poster', '/assets/klicko-demo-poster.jpg');
  await page.getByRole('button', { name: 'Play Klicko demo video' }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.25);
  await video.evaluate((element: HTMLVideoElement) => element.pause());
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await expect(page.getByRole('button', { name: 'Play Klicko demo video' })).toBeVisible();
});

test('mobile menu and page fit their viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Features' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Try it' }).click();
  await expect(page).toHaveURL(/#try-it$/);
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('capture desktop, tablet, and mobile layouts', async ({ page }) => {
  await mkdir('review', { recursive: true });
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    for (const [section, selector] of [['top', '#top'], ['try', '#try-it'], ['privacy', '#privacy'], ['install', '#install'], ['footer', '.site-footer']] as const) {
      await page.locator(selector).evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 78));
      await page.screenshot({ path: `review/${name}-${section}.png`, animations: 'disabled' });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${name} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
