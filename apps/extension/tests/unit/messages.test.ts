import { describe, expect, it } from 'vitest';
import { isInspectionResponse, isPanelRequest } from '../../src/lib/messages';

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
});
