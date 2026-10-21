export const MAX_ELEMENTS = 150;

export interface ObservedElement {
  id: string;
  role: string;
  name: string;
  context: string;
  disabled: boolean;
  rect: { x: number; y: number; width: number; height: number };
}

export interface PageSnapshot {
  pageKey: string;
  snapshotId: string;
  elements: ObservedElement[];
}

export type PanelRequest =
  | { type: 'INSPECT_ACTIVE_TAB'; requestId: number }
  | { type: 'STOP_INSPECTION'; tabId: number };

export type ContentRequest =
  | { type: 'COLLECT_ELEMENTS' }
  | { type: 'CLEAR_ELEMENTS' };

export type InspectionResponse =
  | { type: 'INSPECTION_RESULT'; requestId: number; tabId: number; snapshot: PageSnapshot }
  | { type: 'INSPECTION_ERROR'; requestId: number; reason: 'no-tab' | 'unsupported' | 'reactivate' | 'changed' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isPanelRequest(value: unknown): value is PanelRequest {
  if (!isRecord(value)) return false;
  if (value.type === 'INSPECT_ACTIVE_TAB') return isId(value.requestId);
  if (value.type === 'STOP_INSPECTION') return isId(value.tabId);
  return false;
}

export function isContentRequest(value: unknown): value is ContentRequest {
  return isRecord(value) && (value.type === 'COLLECT_ELEMENTS' || value.type === 'CLEAR_ELEMENTS');
}

function isObservedElement(value: unknown): value is ObservedElement {
  if (!isRecord(value) || !isRecord(value.rect)) return false;
  const rect = value.rect;
  return typeof value.id === 'string' && /^el_\d+$/.test(value.id)
    && typeof value.role === 'string' && value.role.length <= 24
    && typeof value.name === 'string' && value.name.length <= 80
    && typeof value.context === 'string' && value.context.length <= 80
    && typeof value.disabled === 'boolean'
    && ['x', 'y', 'width', 'height'].every((key) =>
      typeof rect[key] === 'number' && Number.isFinite(rect[key]))
    && typeof rect.width === 'number' && rect.width > 0
    && typeof rect.height === 'number' && rect.height > 0;
}

export function isPageSnapshot(value: unknown): value is PageSnapshot {
  return isRecord(value)
    && typeof value.pageKey === 'string' && value.pageKey.length > 0 && value.pageKey.length <= 80
    && typeof value.snapshotId === 'string' && value.snapshotId.length > 0 && value.snapshotId.length <= 80
    && Array.isArray(value.elements) && value.elements.length <= MAX_ELEMENTS
    && value.elements.every(isObservedElement)
    && new Set(value.elements.map((element: ObservedElement) => element.id)).size === value.elements.length;
}

export function isInspectionResponse(value: unknown): value is InspectionResponse {
  if (!isRecord(value) || !isId(value.requestId)) return false;
  if (value.type === 'INSPECTION_RESULT') {
    return isId(value.tabId) && isPageSnapshot(value.snapshot);
  }
  if (value.type === 'INSPECTION_ERROR') {
    return typeof value.reason === 'string'
      && ['no-tab', 'unsupported', 'reactivate', 'changed'].includes(value.reason);
  }
  return false;
}
