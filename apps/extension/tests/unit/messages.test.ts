import { describe, expect, it } from 'vitest';
import { isContentRequest, isInspectionResponse, isOverlayResponse, isPageInvalidation, isPanelRequest, isTrackPageRequest } from '../../src/lib/messages';

describe('message validation', () => {
  it('rejects malformed panel requests', () => {
    expect(isPanelRequest({ type: 'INSPECT_ACTIVE_TAB', requestId: 1 })).toBe(true);
    expect(isPanelRequest({ type: 'INSPECT_ACTIVE_TAB', requestId: '1' })).toBe(false);
    expect(isPanelRequest({ type: 'STOP_INSPECTION', tabId: -1 })).toBe(false);
    expect(isPanelRequest({ type: 'EXECUTE_SCRIPT' })).toBe(false);
  });

  it('rejects unexpected response shapes', () => {
    expect(isInspectionResponse({ type: 'INSPECTION_ERROR', requestId: 1, reason: 'reactivate' })).toBe(true);
    expect(isInspectionResponse({ type: 'INSPECTION_ERROR', requestId: 1, reason: 'granted' })).toBe(false);
    expect(isInspectionResponse({ type: 'INSPECTION_RESULT', requestId: 1, tabId: 3, snapshot: { elements: [] } })).toBe(false);
  });

  it('requires bounded instructions, element IDs and page identity for highlights', () => {
    const target = { pageKey: 'page', snapshotId: 'snapshot', targetId: 'el_1', instruction: 'Use this control.' };
    expect(isPanelRequest({ type: 'HIGHLIGHT_ELEMENT', tabId: 1, ...target })).toBe(true);
    expect(isContentRequest({ type: 'SHOW_OVERLAY', ...target })).toBe(true);
    for (const invalid of [{ pageKey: '' }, { snapshotId: '' }, { targetId: '#button' }, { instruction: '' }, { instruction: 'a'.repeat(241) }]) {
      expect(isPanelRequest({ type: 'HIGHLIGHT_ELEMENT', tabId: 1, ...target, ...invalid })).toBe(false);
      expect(isContentRequest({ type: 'SHOW_OVERLAY', ...target, ...invalid })).toBe(false);
    }
    expect(isOverlayResponse({ type: 'OVERLAY_RESULT', ok: 'yes' })).toBe(false);
    expect(isPageInvalidation({ type: 'SNAPSHOT_INVALIDATED', pageKey: 'page', snapshotId: 'snapshot' })).toBe(true);
    expect(isPageInvalidation({ type: 'SNAPSHOT_INVALIDATED' })).toBe(false);
    expect(isTrackPageRequest({ type: 'TRACK_PAGE', tabId: 1 })).toBe(true);
    expect(isTrackPageRequest({ type: 'TRACK_PAGE', tabId: '1' })).toBe(false);
  });
});
