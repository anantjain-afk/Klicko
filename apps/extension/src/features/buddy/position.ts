export interface Viewport { left: number; top: number; width: number; height: number }
export interface Position { x: number; y: number }
export const BUDDY_SIZE = 44;
export function clampBuddy(position: Position, viewport: Viewport): Position {
  return { x: Math.max(viewport.left + 12, Math.min(position.x, viewport.left + viewport.width - BUDDY_SIZE - 12)),
    y: Math.max(viewport.top + 12, Math.min(position.y, viewport.top + viewport.height - BUDDY_SIZE - 12)) };
}
export function defaultBuddyPosition(viewport: Viewport): Position {
  return clampBuddy({ x: viewport.left + viewport.width - 64, y: viewport.top + viewport.height - 64 }, viewport);
}
export function popupPosition(position: Position, size: { width: number; height: number }, viewport: Viewport): Position {
  const x = Math.max(viewport.left + 12, Math.min(position.x + BUDDY_SIZE - size.width, viewport.left + viewport.width - size.width - 12));
  const above = position.y - size.height - 12;
  const y = above >= viewport.top + 12 ? above : Math.min(position.y + BUDDY_SIZE + 12, viewport.top + viewport.height - size.height - 12);
  return { x, y: Math.max(viewport.top + 12, y) };
}
