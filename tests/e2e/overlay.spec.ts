import { test, expect, type Page } from '@playwright/test';
import { activateToolbar, launchExtension, panelMessage } from './extension';
import type { PageSnapshot } from '../../apps/extension/src/lib/messages';

async function openFixture(fixture = 'overlay.html') {
  const extension = await launchExtension();
  const page = await extension.context.newPage();
  await page.goto(`http://127.0.0.1:4173/${fixture}`);
  await activateToolbar(page, extension.extensionId);
  const panel = await extension.context.newPage();
  await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);
  await panel.getByRole('button', { name: 'Manual highlights', exact: true }).click();
  await panel.setViewportSize({ width: 360, height: 800 });
  await page.bringToFront();
  await panel.getByRole('button', { name: 'Inspect this page' }).click();
  await expect(panel.getByRole('heading', { name: /Visible controls/ })).toBeVisible();
  return { ...extension, page, panel };
}

async function highlight(panel: Page, name = 'Primary target', context?: string) {
  let row = panel.locator('.element-list li').filter({ has: panel.locator('.element-name', { hasText: new RegExp(`^${name}$`) }) });
  if (context) row = row.filter({ hasText: context });
  await row.getByRole('button', { name: /^Highlight/ }).click();
  await expect(panel.getByRole('status')).toContainText('Waiting for you');
}

async function expectAligned(page: Page, selector = '#target') {
  await expect.poll(async () => page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector)?.getBoundingClientRect();
    const box = document.querySelector('#clickpilot-overlay')?.shadowRoot?.querySelector('.highlight')?.getBoundingClientRect();
    if (!target || !box) return false;
    return Math.abs(box.x - target.x + 4) < 1 && Math.abs(box.y - target.y + 4) < 1
      && Math.abs(box.width - target.width - 8) < 1 && Math.abs(box.height - target.height - 8) < 1;
  }, selector)).toBe(true);
}

test('01 — highlight, arrow and tooltip align without autonomous actions', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel);
    await expectAligned(page);
    await expect(page.locator('#clickpilot-overlay path')).toHaveAttribute('d', /^M/);
    await expect(page.locator('#clickpilot-overlay .tooltip')).toContainText('Selected: Primary target');
    await expect(page.locator('#click-count')).toHaveText('Clicks: 0');
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.screenshot({ path: '/tmp/clickpilot-overlay-desktop.png' });
    await panel.screenshot({ path: '/tmp/clickpilot-panel-360.png' });
    await panel.setViewportSize({ width: 260, height: 800 });
    await panel.screenshot({ path: '/tmp/clickpilot-panel-260.png' });
    expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

for (const [number, landmark, selector] of [['02', 'Main navigation', '#nav-settings'], ['03', 'Preferences', '#dialog-settings']]) {
  test(`${number} — duplicate Settings uses the ${landmark} target`, async () => {
    const { context, page, panel } = await openFixture();
    try {
      await highlight(panel, 'Settings', landmark);
      await expectAligned(page, selector);
    } finally { await context.close(); }
  });
}

test('04 — pointer-transparent decoration allows clicks and typing', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel);
    await page.locator('#target').click();
    await expect(page.locator('#click-count')).toHaveText('Clicks: 1');
    await highlight(panel, 'Project name');
    await page.locator('#project').fill('FAKE-TYPED-MARKER');
    await expect(page.locator('#project')).toHaveValue('FAKE-TYPED-MARKER');
    await expect(page.locator('#clickpilot-overlay .tooltip')).not.toContainText('FAKE-TYPED-MARKER');
    expect(await page.locator('#clickpilot-overlay').evaluate((host) => {
      const nodes = [host, ...Array.from(host.shadowRoot!.querySelectorAll('*'))];
      return nodes.every((node) => getComputedStyle(node).pointerEvents === 'none');
    })).toBe(true);
  } finally { await context.close(); }
});

test('05 — follows window scrolling then removes offscreen targets', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel);
    await page.evaluate(() => scrollBy(0, 65));
    await expectAligned(page);
    await page.evaluate(() => scrollTo(0, 700));
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(panel.getByRole('status')).toContainText('Highlight removed');
  } finally { await context.close(); }
});

test('06 — follows nested scrolling and removes clipped targets', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel, 'Nested target');
    await page.locator('#scroller').evaluate((element) => { element.scrollTop = 10; });
    await expectAligned(page, '#nested');
    await page.locator('#scroller').evaluate((element) => { element.scrollTop = 130; });
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('07 — follows viewport resizing', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel);
    await page.setViewportSize({ width: 700, height: 800 });
    await expectAligned(page);
  } finally { await context.close(); }
});

test('08 — follows real browser tab zoom', async () => {
  const { context, page, panel, worker } = await openFixture();
  try {
    await highlight(panel);
    await worker.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: { tabs: { query: (query: object) => Promise<{ id: number }[]>; setZoom: (id: number, zoom: number) => Promise<void>; getZoom: (id: number) => Promise<number> } } }).chrome;
      const [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true });
      await api.tabs.setZoom(tab.id, 1.25);
      if (await api.tabs.getZoom(tab.id) !== 1.25) throw new Error('Browser zoom did not apply');
    });
    await expectAligned(page);
  } finally { await context.close(); }
});

test('09 — follows target movement', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel);
    await page.locator('#move').click();
    await expectAligned(page);
  } finally { await context.close(); }
});

for (const [number, action, selector] of [['10', 'covered', '#cover-button'], ['11', 'hidden', '#hide'], ['12', 'removed', '#remove']]) {
  test(`${number} — clears a ${action} target`, async () => {
    const { context, page, panel } = await openFixture();
    try {
      await highlight(panel);
      await page.locator(selector).click();
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
      await expect(panel.getByRole('status')).toContainText('Highlight removed');
    } finally { await context.close(); }
  });
}

test('13 — rejects targets that become disabled', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await page.locator('#target').evaluate((element: HTMLButtonElement) => { element.disabled = true; });
    await panel.getByRole('button', { name: /Highlight .*Primary target/ }).click();
    await expect(panel.getByRole('status')).toContainText('unavailable');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('14 — rejects stale snapshot, document and missing target IDs', async () => {
  const { context, page, panel } = await openFixture();
  try {
    const result = await panelMessage(panel, { type: 'INSPECT_ACTIVE_TAB', requestId: 90 }) as { tabId: number; snapshot: PageSnapshot };
    const request = { type: 'HIGHLIGHT_ELEMENT', tabId: result.tabId, pageKey: result.snapshot.pageKey, snapshotId: result.snapshot.snapshotId, targetId: 'el_4', instruction: 'Use this control.' };
    for (const invalid of [{ snapshotId: 'old-snapshot' }, { pageKey: 'old-document' }, { targetId: 'el_150' }]) {
      expect(await panelMessage(panel, { ...request, ...invalid })).toEqual({ type: 'OVERLAY_RESULT', ok: false });
    }
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('15 — hostile tooltip instructions render as literal text', async () => {
  const { context, page, panel } = await openFixture();
  try {
    const result = await panelMessage(panel, { type: 'INSPECT_ACTIVE_TAB', requestId: 90 }) as { tabId: number; snapshot: PageSnapshot };
    const instruction = '<img src=x onerror="document.body.remove()"><script>alert(1)</script>';
    const targetId = result.snapshot.elements.find((element) => element.name === 'Primary target')!.id;
    expect(await panelMessage(panel, { type: 'HIGHLIGHT_ELEMENT', tabId: result.tabId, pageKey: result.snapshot.pageKey, snapshotId: result.snapshot.snapshotId, targetId, instruction })).toEqual({ type: 'OVERLAY_RESULT', ok: true });
    await expect(page.locator('#clickpilot-overlay .tooltip')).toHaveText(instruction);
    await expect(page.locator('#clickpilot-overlay img, #clickpilot-overlay script')).toHaveCount(0);
    await expect(page.locator('#target')).toBeVisible();
  } finally { await context.close(); }
});

test('16 — Stop removes decoration and stays stopped after layout changes', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel);
    await panel.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await page.locator('#move').click();
    await page.evaluate(() => scrollBy(0, 10));
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(panel.locator('.element-list')).toHaveCount(0);
  } finally { await context.close(); }
});

test('17 — repeated inspection and selection produce one overlay', async () => {
  const { context, page, panel } = await openFixture();
  try {
    for (let i = 0; i < 3; i++) {
      await highlight(panel);
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
      await panel.getByRole('button', { name: 'Inspect this page' }).click();
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    }
    await highlight(panel);
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
  } finally { await context.close(); }
});

test('18 — SPA and full navigation clear decoration and allow fresh inspection', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel);
    await page.locator('#spa').click();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(panel.locator('.element-list')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Inspect this page' }).click();
    await highlight(panel);
    await page.reload();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Inspect this page' }).click();
    await highlight(panel);
    // Proves the panel connection attaches to the new document after reload.
    await panel.close();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
  } finally { await context.close(); }
});

test('19 — tab switching clears decoration', async () => {
  const { context, page, panel } = await openFixture();
  try {
    await highlight(panel);
    const other = await context.newPage();
    await other.goto('http://127.0.0.1:4173/second.html');
    await other.bringToFront();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(panel.getByRole('alert')).toContainText('Tab changed');
  } finally { await context.close(); }
});

test('20 — panel disconnection removes decoration and registry', async () => {
  const { context, page, panel, extensionId } = await openFixture();
  try {
    await highlight(panel);
    const result = await panelMessage(panel, { type: 'INSPECT_ACTIVE_TAB', requestId: 90 }) as { tabId: number; snapshot: PageSnapshot };
    const request = { type: 'HIGHLIGHT_ELEMENT', tabId: result.tabId, pageKey: result.snapshot.pageKey, snapshotId: result.snapshot.snapshotId, targetId: result.snapshot.elements.find((element) => element.name === 'Primary target')!.id, instruction: 'Current target.' };
    expect(await panelMessage(panel, request)).toEqual({ type: 'OVERLAY_RESULT', ok: true });
    await panel.close();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    const reopened = await context.newPage();
    await reopened.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.bringToFront();
    expect(await panelMessage(reopened, request)).toEqual({ type: 'OVERLAY_RESULT', ok: false });
  } finally { await context.close(); }
});

for (const shape of ['rounded', 'asymmetric', 'one-corner', 'overlapping', 'pill', 'square']) {
  test(`rounded SVG regression: manual highlights ${shape} controls and remains pointer-transparent`, async () => {
    const { context, page, panel } = await openFixture('targets.html');
    try {
      await page.getByLabel('Shape').selectOption(shape);
      if (shape === 'rounded') {
        expect(await page.locator('#target').evaluate((target) => {
          const r = target.getBoundingClientRect();
          return target.contains(document.elementFromPoint(r.right - 2, r.bottom - 2));
        })).toBe(false);
      }
      await highlight(panel);
      await expectAligned(page);
      await expect(page.locator('#counter')).toHaveText('Clicks: 0');
      // Repeated draws must not hit our own host/shadow decorations.
      await page.waitForTimeout(150);
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(1);
      await page.locator('#target svg path').click();
      await expect(page.locator('#counter')).toHaveText('Clicks: 1');
    } finally { await context.close(); }
  });
}

for (const side of ['full', 'top', 'right', 'bottom', 'left', 'corner']) {
  test(`rounded SVG regression: rejects ${side} occlusion before drawing and during guidance`, async () => {
    const { context, page, panel } = await openFixture('targets.html');
    try {
      await page.locator(`#cover-${side}`).click();
      // Only the full cover hides the center; edge/corner patches must also fail.
      if (side !== 'full') {
        expect(await page.locator('#target').evaluate((target) => {
          const r = target.getBoundingClientRect();
          return target.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        })).toBe(true);
      }
      await panel.getByRole('button', { name: /Highlight .*Primary target/ }).click();
      await expect(panel.getByRole('status')).toContainText('unavailable');
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
      await page.locator('#uncover').click();
      await highlight(panel);
      await page.locator(`#cover-${side}`).click();
      await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
      await expect(panel.getByRole('status')).toContainText('Highlight removed');
    } finally { await context.close(); }
  });
}

test('rounded SVG regression: replacement never reuses detached references, and reinspection recovers', async () => {
  const { context, page, panel } = await openFixture('targets.html');
  try {
    await page.locator('#replace').click();
    await panel.getByRole('button', { name: /Highlight .*Primary target/ }).click();
    await expect(panel.getByRole('status')).toContainText('unavailable');
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Inspect this page' }).click();
    await highlight(panel);
    await page.locator('#replace').click();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(panel.getByRole('status')).toContainText('Highlight removed');
    await panel.getByRole('button', { name: 'Inspect this page' }).click();
    await highlight(panel);
    await expectAligned(page);
  } finally { await context.close(); }
});

test('rounded SVG regression: follows positive axis scaling and rejects a non-interactive target', async () => {
  const { context, page, panel } = await openFixture('targets.html');
  try {
    await page.getByLabel('Shape').selectOption('asymmetric');
    await page.locator('#toolbar').evaluate((toolbar) => { toolbar.style.transform = 'scale(1.25, 0.8)'; });
    await highlight(panel);
    await expectAligned(page);
    await page.locator('#target').evaluate((target) => { target.style.transform = 'rotate(35deg)'; });
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await page.locator('#target').evaluate((target) => { target.style.transform = ''; });
    await highlight(panel);
    await page.locator('#target').evaluate((target) => { target.style.pointerEvents = 'none'; });
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(panel.getByRole('status')).toContainText('Highlight removed');
  } finally { await context.close(); }
});

test('rounded SVG regression: nested shadow icons are accepted but an unrelated shadow cover is rejected', async () => {
  const { context, page, panel } = await openFixture('targets.html');
  try {
    await page.locator('#target').evaluate((target) => {
      const icon = document.createElement('span');
      const root = icon.attachShadow({ mode: 'open' });
      root.innerHTML = '<svg viewBox="0 0 20 20" style="width:20px;height:20px"><path d="M0 0H20V20H0Z" /></svg>';
      target.replaceChildren(icon);
    });
    await highlight(panel);
    await page.locator('#target path').click();
    await expect(page.locator('#counter')).toHaveText('Clicks: 1');
    await page.locator('#cover').evaluate((cover) => {
      cover.attachShadow({ mode: 'open' }).innerHTML = '<div style="width:100%;height:100%">Cover</div>';
    });
    await page.locator('#cover-full').click();
    await expect(page.locator('#clickpilot-overlay')).toHaveCount(0);
    await expect(panel.getByRole('status')).toContainText('Highlight removed');
  } finally { await context.close(); }
});
