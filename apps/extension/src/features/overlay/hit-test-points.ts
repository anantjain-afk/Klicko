import type { HighlightProbe } from './diagnostics';

interface Radius { x: number; y: number }
interface HitPoint { name: HighlightProbe; x: number; y: number }

function radiusLength(value: string, size: number): number {
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|%)$/.test(value) && value !== '0') return NaN;
  return parseFloat(value) * (value.endsWith('%') ? size / 100 : 1);
}

function cornerRadius(value: string, width: number, height: number): Radius {
  const [x = '', y = x] = value.trim().split(/\s+/);
  const radius = { x: radiusLength(x, width), y: radiusLength(y, height) };
  // CSS treats an ellipse with either radius zero as a square corner.
  return radius.x === 0 || radius.y === 0 ? { x: 0, y: 0 } : radius;
}

// Resolve CSS radii in the layout border box, then scale to the live viewport box.
// This covers px, percentages, elliptical/asymmetric corners and positive axis scaling.
export function targetHitPoints(
  rect: DOMRect, style: CSSStyleDeclaration, layoutWidth: number, layoutHeight: number,
): HitPoint[] | null {
  if (layoutWidth <= 0 || layoutHeight <= 0) return null;
  const corners = [style.borderTopLeftRadius, style.borderTopRightRadius,
    style.borderBottomLeftRadius, style.borderBottomRightRadius]
    .map((value) => cornerRadius(value, layoutWidth, layoutHeight));
  if (corners.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return null;
  const [tl, tr, bl, br] = corners as [Radius, Radius, Radius, Radius];
  // CSS reduces all radii together when adjacent corner radii overlap.
  const factor = Math.min(1, layoutWidth / (tl.x + tr.x), layoutWidth / (bl.x + br.x),
    layoutHeight / (tl.y + bl.y), layoutHeight / (tr.y + br.y));
  for (const radius of corners) {
    radius.x *= factor * rect.width / layoutWidth;
    radius.y *= factor * rect.height / layoutHeight;
  }
  const insetX = Math.min(2, rect.width / 4);
  const insetY = Math.min(2, rect.height / 4);
  const edgeX = (x: number) => rect.left + Math.max(insetX, Math.min(rect.width - insetX, x));
  const edgeY = (y: number) => rect.top + Math.max(insetY, Math.min(rect.height - insetY, y));
  const arcInset = 1 - Math.SQRT1_2;
  function corner(name: HighlightProbe, radius: Radius, right: boolean, bottom: boolean): HitPoint {
    // Probe just inside the 45-degree point on each ellipse, not its empty bounding-box corner.
    const x = Math.max(insetX, radius.x * arcInset + insetX / 2);
    const y = Math.max(insetY, radius.y * arcInset + insetY / 2);
    return { name, x: right ? rect.right - x : rect.left + x, y: bottom ? rect.bottom - y : rect.top + y };
  }
  return [
    { name: 'center', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    corner('top_left', tl, false, false), corner('top_right', tr, true, false),
    corner('bottom_left', bl, false, true), corner('bottom_right', br, true, true),
    // Keep perimeter coverage, even when large/asymmetric radii move the arc probes inward.
    { name: 'top_edge', x: edgeX((tl.x + rect.width - tr.x) / 2), y: rect.top + insetY },
    { name: 'right_edge', x: rect.right - insetX, y: edgeY((tr.y + rect.height - br.y) / 2) },
    { name: 'bottom_edge', x: edgeX((bl.x + rect.width - br.x) / 2), y: rect.bottom - insetY },
    { name: 'left_edge', x: rect.left + insetX, y: edgeY((tl.y + rect.height - bl.y) / 2) },
  ];
}
