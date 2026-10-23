export type HighlightProbe = 'center' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right'
  | 'top_edge' | 'right_edge' | 'bottom_edge' | 'left_edge';

type HighlightFailure = 'registry_missing' | 'identity_mismatch' | 'unsupported_target' | 'document_hidden'
  | 'detached' | 'not_visible_or_no_geometry' | 'disabled' | 'outside_viewport'
  | 'unsupported_radius' | 'hit_test_failed' | 'overlay_removed' | 'position_drift' | 'tooltip_no_space';

// Only fixed codes reach the console. Never pass DOM nodes, page text or identity values.
export function reportHighlightFailure(reason: HighlightFailure, probe?: HighlightProbe): null {
  if (import.meta.env.DEV) {
    console.debug('[ClickPilot highlight]', { reason, ...(probe ? { probe } : {}) });
  }
  return null;
}
