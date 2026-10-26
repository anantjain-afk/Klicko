import { visibleRect } from '../observer/collect-elements';
import { reportHighlightFailure } from './diagnostics';
import { targetHitPoints } from './hit-test-points';
import { createOverlaySurface } from './surface';
import { uiTheme, uiDarkTheme, uiTokens } from '../../lib/ui-tokens';

// All positions are current viewport CSS pixels; no snapshot coordinates are reused.
function targetRect(target: Element): DOMRect | null {
  if (!(target instanceof HTMLElement)) return reportHighlightFailure('unsupported_target');
  if (document.hidden) return reportHighlightFailure('document_hidden');
  if (!target.isConnected) return reportHighlightFailure('detached');
  const rect = visibleRect(target, window);
  if (!rect) return reportHighlightFailure('not_visible_or_no_geometry');
  if (target.matches(':disabled, [aria-disabled="true"]')) return reportHighlightFailure('disabled');
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const right = left + (viewport?.width ?? innerWidth);
  const bottom = top + (viewport?.height ?? innerHeight);
  // Partial/clipped controls are removed rather than decorated misleadingly.
  if (rect.left < left + 4 || rect.top < top + 4 || rect.right > right - 4 || rect.bottom > bottom - 4) return reportHighlightFailure('outside_viewport');
  const points = targetHitPoints(rect, getComputedStyle(target), target.offsetWidth, target.offsetHeight);
  if (!points) return reportHighlightFailure('unsupported_radius');
  for (const { name, x, y } of points) {
    const hit = document.elementFromPoint(x, y);
    if (!hit || (hit !== target && !target.contains(hit))) return reportHighlightFailure('hit_test_failed', name);
  }
  return rect;
}

export function showOverlay(
  target: Element,
  instruction: string,
  isCurrent: () => boolean,
  onInvalidated: () => void,
): (() => void) | null {
  if (!isCurrent()) return reportHighlightFailure('identity_mismatch');
  if (!targetRect(target)) return null;

  const { host, shadow } = createOverlaySurface('clickpilot-overlay');
  const style = document.createElement('style');
  style.textContent = `
    :host { ${uiTheme} pointer-events: none !important; }
    @media (prefers-color-scheme:dark) { :host { ${uiDarkTheme} } }
    *, *::before, *::after { box-sizing: border-box; pointer-events: none !important; }
    .highlight { position: absolute; border: 3px solid var(--green); border-radius: 6px; }
    .tooltip { position: absolute; width: max-content; max-width: 280px; margin: 0;
      padding: 12px 14px; border-radius: 12px; background: var(--raised); color: var(--ink);
      font: 500 14px/1.5 ${uiTokens.font}; overflow-wrap: anywhere; white-space: pre-wrap;
      box-shadow: var(--shadow); }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    path { fill: none; stroke: var(--green); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  `;
  const highlight = document.createElement('div');
  highlight.className = 'highlight';
  const tooltip = document.createElement('p');
  tooltip.className = 'tooltip';
  tooltip.textContent = instruction;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const arrow = document.createElementNS(svg.namespaceURI, 'path');
  svg.append(arrow);
  shadow.append(style, highlight, svg, tooltip);
  document.documentElement.append(host);
  let frame = 0;
  let stopped = false;

  function stop() {
    stopped = true;
    cancelAnimationFrame(frame);
    host.remove();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', invalidate);
  }

  function invalidate() {
    if (stopped) return;
    stop();
    onInvalidated();
  }

  function onVisibilityChange() {
    if (document.hidden) invalidate();
  }

  function draw() {
    if (stopped) return;
    const rect = !isCurrent() ? reportHighlightFailure('identity_mismatch')
      : !host.isConnected ? reportHighlightFailure('overlay_removed') : targetRect(target);
    if (!rect) { invalidate(); return; }
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? innerWidth;
    const height = viewport?.height ?? innerHeight;
    highlight.style.cssText = `left:${rect.x - 4}px;top:${rect.y - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px`;
    const drawn = highlight.getBoundingClientRect();
    if (Math.abs(drawn.x - (rect.x - 4)) > 1 || Math.abs(drawn.y - (rect.y - 4)) > 1) {
      reportHighlightFailure('position_drift');
      invalidate(); return;
    }
    tooltip.style.maxWidth = `${Math.min(280, width - 24)}px`;
    const box = tooltip.getBoundingClientRect();
    const x = Math.max(left + 12, Math.min(rect.x + rect.width / 2 - box.width / 2, left + width - box.width - 12));
    const below = rect.bottom + 32 + box.height <= top + height - 12;
    const y = below ? rect.bottom + 32 : rect.top - box.height - 32;
    if (y < top + 12) { reportHighlightFailure('tooltip_no_space'); invalidate(); return; }
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    const tipX = rect.x + rect.width / 2;
    const tipY = below ? rect.bottom + 9 : rect.top - 9;
    const startX = Math.max(x + 8, Math.min(tipX, x + box.width - 8));
    const startY = below ? y - 3 : y + box.height + 3;
    const direction = below ? 1 : -1;
    arrow.setAttribute('d', `M${startX},${startY} L${tipX},${tipY} m-5,${direction * 6} l5,${-direction * 6} l5,${direction * 6}`);
    frame = requestAnimationFrame(draw);
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', invalidate);
  draw();
  return stopped ? null : stop;
}
