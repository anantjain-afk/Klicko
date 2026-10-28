import { ExpectedOutcomeSchema, type ExpectedOutcome } from '@clickpilot/shared/guidance';
export const MAX_ELEMENTS = 150;

export interface ObservedElement {
  id: string;
  role: string;
  name: string;
  context: string;
  disabled: boolean;
  expanded?: boolean;
  rect: { x: number; y: number; width: number; height: number };
}

export interface PageSnapshot {
  pageKey: string;
  snapshotId: string;
  elements: ObservedElement[];
  mockFixture?: boolean;
}

export interface GuidanceIdentity {
  sessionId: string;
  requestId: number;
}

export interface OverlayTarget {
  pageKey: string;
  snapshotId: string;
  targetId: string;
  instruction: string;
  guidance?: GuidanceIdentity & { observe?: boolean; expectedOutcome?: ExpectedOutcome };
}

export type PanelRequest =
  | { type: 'INSPECT_ACTIVE_TAB'; requestId: number; tabId?: number; settle?: boolean; inspectionToken?: string }
  | { type: 'CANCEL_INSPECTION'; inspectionToken: string }
  | { type: 'STOP_INSPECTION'; tabId: number; snapshotId?: string }
  | ({ type: 'HIGHLIGHT_ELEMENT'; tabId: number } & OverlayTarget);

export type ContentRequest =
  | { type: 'COLLECT_ELEMENTS' }
  | { type: 'WAIT_FOR_PAGE'; inspectionToken: string }
  | { type: 'CANCEL_PAGE_WAIT'; inspectionToken: string }
  | { type: 'GET_SNAPSHOT'; pageKey: string; snapshotId: string }
  | { type: 'CLEAR_ELEMENTS'; snapshotId?: string }
  | ({ type: 'SHOW_OVERLAY' } & OverlayTarget);

export type OverlayResponse = { type: 'OVERLAY_RESULT'; ok: boolean };

export type PageInvalidation = {
  pageKey: string;
  snapshotId: string;
} & ({ type: 'OVERLAY_INVALIDATED'; targetId: string } | { type: 'SNAPSHOT_INVALIDATED' } | { type: 'PAGE_NAVIGATED' });

export interface GuidanceClick extends GuidanceIdentity {
  type: 'GUIDANCE_CLICKED';
  navigationIntent?: boolean;
  pageKey: string;
  snapshotId: string;
  targetId: string;
}

export interface ActionObservation extends GuidanceIdentity {
  type: 'ACTION_OBSERVED';
  pageKey: string;
  snapshotId: string;
  targetId: string;
  changed: boolean;
  status: 'verified' | 'not_verified' | 'unverifiable';
}

export function isActionObservation(value: unknown): value is ActionObservation {
  if (!isRecord(value) || value.type !== 'ACTION_OBSERVED') return false;
  return isGuidanceClick({ ...value, type: 'GUIDANCE_CLICKED' }) && typeof value.changed === 'boolean'
    && typeof value.status === 'string' && ['verified', 'not_verified', 'unverifiable'].includes(value.status);
}

export type InspectionResponse =
  | { type: 'INSPECTION_RESULT'; requestId: number; tabId: number; snapshot: PageSnapshot }
  | { type: 'INSPECTION_ERROR'; requestId: number; reason: 'no-tab' | 'unsupported' | 'reactivate' | 'changed' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPageIdentity(value: Record<string, unknown>): boolean {
  return typeof value.pageKey === 'string' && value.pageKey.length > 0 && value.pageKey.length <= 80
    && typeof value.snapshotId === 'string' && value.snapshotId.length > 0 && value.snapshotId.length <= 80;
}

function isOverlayTarget(value: Record<string, unknown>): boolean {
  return isPageIdentity(value)
    && typeof value.targetId === 'string' && /^el_\d{1,3}$/.test(value.targetId)
    && typeof value.instruction === 'string' && value.instruction.trim().length > 0
    && value.instruction.length <= 240
    && (value.guidance === undefined || (isRecord(value.guidance)
      && typeof value.guidance.sessionId === 'string' && value.guidance.sessionId.length > 0
      && value.guidance.sessionId.length <= 80 && isId(value.guidance.requestId)
      && (value.guidance.observe === undefined || typeof value.guidance.observe === 'boolean')
      && (value.guidance.expectedOutcome === undefined || ExpectedOutcomeSchema.safeParse(value.guidance.expectedOutcome).success)));
}

function hasOptionalSnapshotId(value: Record<string, unknown>): boolean {
  return value.snapshotId === undefined
    || (typeof value.snapshotId === 'string' && value.snapshotId.length > 0 && value.snapshotId.length <= 80);
}

export function isPanelRequest(value: unknown): value is PanelRequest {
  if (!isRecord(value)) return false;
  if (value.type === 'CANCEL_INSPECTION') return typeof value.inspectionToken === 'string' && /^[\w-]{1,80}$/.test(value.inspectionToken);
  if (value.type === 'INSPECT_ACTIVE_TAB') {
    return isId(value.requestId) && (value.tabId === undefined || isId(value.tabId))
      && (value.settle === undefined || typeof value.settle === 'boolean')
      && (value.inspectionToken === undefined || (typeof value.inspectionToken === 'string'
        && /^[\w-]{1,80}$/.test(value.inspectionToken)))
      && (!value.settle || value.inspectionToken !== undefined);
  }
  if (value.type === 'STOP_INSPECTION') return isId(value.tabId) && hasOptionalSnapshotId(value);
  if (value.type === 'HIGHLIGHT_ELEMENT') return isId(value.tabId) && isOverlayTarget(value);
  return false;
}

export function isContentRequest(value: unknown): value is ContentRequest {
  return isRecord(value) && (value.type === 'COLLECT_ELEMENTS'
    || ((value.type === 'WAIT_FOR_PAGE' || value.type === 'CANCEL_PAGE_WAIT')
      && typeof value.inspectionToken === 'string' && /^[\w-]{1,80}$/.test(value.inspectionToken))
    || (value.type === 'GET_SNAPSHOT' && isPageIdentity(value))
    || (value.type === 'CLEAR_ELEMENTS' && hasOptionalSnapshotId(value))
    || (value.type === 'SHOW_OVERLAY' && isOverlayTarget(value)));
}

export function isGuidanceClick(value: unknown): value is GuidanceClick {
  return isRecord(value) && value.type === 'GUIDANCE_CLICKED' && isPageIdentity(value)
    && typeof value.targetId === 'string' && /^el_\d{1,3}$/.test(value.targetId)
    && typeof value.sessionId === 'string' && value.sessionId.length > 0 && value.sessionId.length <= 80
    && isId(value.requestId) && (value.navigationIntent === undefined || typeof value.navigationIntent === 'boolean');
}

export function isOverlayResponse(value: unknown): value is OverlayResponse {
  return isRecord(value) && value.type === 'OVERLAY_RESULT' && typeof value.ok === 'boolean';
}

export function isPageInvalidation(value: unknown): value is PageInvalidation {
  return isRecord(value) && isPageIdentity(value)
    && ((value.type === 'OVERLAY_INVALIDATED' && typeof value.targetId === 'string' && /^el_\d{1,3}$/.test(value.targetId))
      || value.type === 'SNAPSHOT_INVALIDATED' || value.type === 'PAGE_NAVIGATED');
}

export function isTrackPageRequest(value: unknown): value is { type: 'TRACK_PAGE'; tabId: number } {
  return isRecord(value) && value.type === 'TRACK_PAGE' && isId(value.tabId);
}

function isObservedElement(value: unknown): value is ObservedElement {
  if (!isRecord(value) || !isRecord(value.rect)) return false;
  const rect = value.rect;
  return typeof value.id === 'string' && /^el_\d+$/.test(value.id)
    && typeof value.role === 'string' && value.role.length <= 24
    && typeof value.name === 'string' && value.name.length <= 80
    && typeof value.context === 'string' && value.context.length <= 80
    && typeof value.disabled === 'boolean'
    && (value.expanded === undefined || typeof value.expanded === 'boolean')
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
    && (value.mockFixture === undefined || typeof value.mockFixture === 'boolean')
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
