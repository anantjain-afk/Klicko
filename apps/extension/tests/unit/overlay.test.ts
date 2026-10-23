import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { targetHitPoints } from '../../src/features/overlay/hit-test-points';
import { showOverlay } from '../../src/features/overlay/renderer';

function styleFor(tl: string, tr = tl, bl = tl, br = tl): CSSStyleDeclaration {
  const style = document.createElement('button').style;
  Object.assign(style, { borderTopLeftRadius: tl, borderTopRightRadius: tr,
    borderBottomLeftRadius: bl, borderBottomRightRadius: br });
  return style;
}

describe('rounded target perimeter', () => {
  const rect = DOMRect.fromRect({ x: 40, y: 60, width: 100, height: 60 });

  it('samples inside rounded corners while retaining probes 2px from each straight edge', () => {
    const points = targetHitPoints(rect, styleFor('8px'), 100, 60)!;
    const corner = points.find(({ name }) => name === 'top_left')!;
    expect(Math.hypot(corner.x - 48, corner.y - 68)).toBeLessThan(8);
    expect(points).toEqual(expect.arrayContaining([
      { name: 'center', x: 90, y: 90 },
      { name: 'top_edge', x: 90, y: 62 },
      { name: 'right_edge', x: 138, y: 90 },
      { name: 'bottom_edge', x: 90, y: 118 },
      { name: 'left_edge', x: 42, y: 90 },
    ]));
  });

  it('resolves each asymmetric elliptical corner independently', () => {
    const points = targetHitPoints(rect, styleFor('40% 50%', '5px 10px', '0px', '20px 15px'), 100, 60)!;
    const tl = points.find(({ name }) => name === 'top_left')!;
    expect(tl.x - rect.left).toBeGreaterThan(tl.y - rect.top);
    const bl = points.find(({ name }) => name === 'bottom_left')!;
    expect(bl).toEqual({ name: 'bottom_left', x: 42, y: 118 });
    const tr = points.find(({ name }) => name === 'top_right')!;
    expect(rect.right - tr.x).toBeLessThan(tr.y - rect.top);
    expect(points.find(({ name }) => name === 'top_edge')!.x).toBe(107.5);
  });

  it('normalizes oversized radii like CSS, including pill controls', () => {
    expect(targetHitPoints(rect, styleFor('999px'), 100, 60))
      .toEqual(targetHitPoints(rect, styleFor('30px'), 100, 60));
    expect(targetHitPoints(rect, styleFor('80px', '80px', '0px', '0px'), 100, 60))
      .toEqual(targetHitPoints(rect, styleFor('50px', '50px', '0px', '0px'), 100, 60));
  });

  it('scales px and percentage radii into current viewport coordinates', () => {
    const scaled = DOMRect.fromRect({ x: 40, y: 60, width: 200, height: 30 });
    expect(targetHitPoints(scaled, styleFor('20% 50%', '10px', '0px', '5px'), 100, 60))
      .toEqual(targetHitPoints(scaled, styleFor('40px 15px', '20px 5px', '0px', '10px 2.5px'), 200, 30));
  });

  it('uses square corners when either ellipse radius is zero and rejects unresolved geometry', () => {
    expect(targetHitPoints(rect, styleFor('0px 30px'), 100, 60))
      .toEqual(targetHitPoints(rect, styleFor('0px'), 100, 60));
    expect(targetHitPoints(rect, styleFor('calc(10% + 2px)'), 100, 60)).toBeNull();
    expect(targetHitPoints(rect, styleFor('8px'), 0, 60)).toBeNull();
  });
});

describe('safe development highlight diagnostics', () => {
  let target: HTMLButtonElement;
  const hit = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = '<button aria-label="PRIVATE-LABEL">PRIVATE-TEXT<input value="PRIVATE-VALUE"></button>';
    target = document.querySelector('button')!;
    // Set individual properties explicitly: jsdom does not expand every CSS shorthand.
    for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'] as const) {
      target.style[corner] = '8px';
    }
    target.getBoundingClientRect = () => DOMRect.fromRect({ x: 40, y: 60, width: 36, height: 36 });
    Object.defineProperties(target, { offsetWidth: { value: 36 }, offsetHeight: { value: 36 } });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    Object.defineProperty(document, 'elementFromPoint', { value: hit, configurable: true });
    hit.mockReset().mockReturnValue(document.body);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('reports the failed hit-test probe without DOM objects or sensitive content', () => {
    const invalidated = vi.fn();
    expect(showOverlay(target, 'PRIVATE-INSTRUCTION', () => true, invalidated)).toBeNull();
    expect(console.debug).toHaveBeenCalledExactlyOnceWith('[ClickPilot highlight]', { reason: 'hit_test_failed', probe: 'center' });
    expect(invalidated).not.toHaveBeenCalled();
    expect(document.querySelector('#clickpilot-overlay')).toBeNull();
  });

  it('identifies detached references and identity failures before hit testing', () => {
    target.remove();
    expect(showOverlay(target, 'Use it', () => true, vi.fn())).toBeNull();
    expect(console.debug).toHaveBeenLastCalledWith('[ClickPilot highlight]', { reason: 'detached' });
    expect(showOverlay(target, 'Use it', () => false, vi.fn())).toBeNull();
    expect(console.debug).toHaveBeenLastCalledWith('[ClickPilot highlight]', { reason: 'identity_mismatch' });
    expect(hit).not.toHaveBeenCalled();
  });
});
