import type { GuidanceState } from '../session/session';
import type { TextState } from '../text-assistant/session';

export type CompanionMood = 'idle' | 'noticed' | 'composing' | 'thinking' | 'answering' | 'guiding' | 'paused' | 'error';

export function companionMood(state: GuidanceState, textState: TextState, source: 'guidance' | 'text', connected: boolean): CompanionMood {
  if (!connected) return 'paused';
  if (source === 'text') {
    switch (textState.kind) {
      case 'selected': return 'noticed';
      case 'composing': return 'composing';
      case 'requesting': return 'thinking';
      case 'answered': return 'answering';
      case 'error': return 'error';
      default: return 'idle';
    }
  }
  switch (state.kind) {
    case 'observing': case 'selecting': case 'highlighting': case 'verifying': case 'navigating': return 'thinking';
    case 'waiting': case 'clicked': return 'guiding';
    case 'answer': case 'clarification': case 'confirmed': return 'answering';
    case 'paused': case 'recovery': case 'connection_paused': case 'stopped': return 'paused';
    case 'error': case 'unsupported': return 'error';
    default: return 'idle';
  }
}

// Entirely authored artwork. Page text and model output never enter this markup.
export function createCompanion() {
  const document = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" class="companion" viewBox="0 0 80 84" aria-hidden="true" focusable="false">
    <ellipse cx="40" cy="78" rx="22" ry="3" fill="#243128" opacity=".14"/>
    <path d="M25 68h11v9H23q-3 0-2-3zM44 68h11l4 6q1 3-2 3H44z" fill="#34443b" stroke="#20362b" stroke-width="1.5"/>
    <path d="M25 52q15-7 30 0l4 17q-18 8-38 0z" fill="#41674c" stroke="#244531" stroke-width="1.6"/>
    <path d="M29 55q11-4 22 0l3 12q-14 5-28 0z" fill="#eee9d9" stroke="#c4c3ad" stroke-width="1"/>
    <path d="M33 61h8" stroke="#a6ac97" stroke-width="2" stroke-linecap="round"/>
    <circle cx="48" cy="63" r="2" fill="#b49b68"/>
    <path d="M35 44h10v10H35z" fill="#a89060" stroke="#766542" stroke-width="1.5"/>
    <circle cx="40" cy="49" r="2.5" fill="#d4c292"/>
    <g class="companion-head">
      <path d="M11 15q0-7 8-8l41 1q9 1 9 9l-2 23q-1 7-9 8l-38-1q-8-1-9-8z" fill="#315c43" stroke="#244531" stroke-width="1.8"/>
      <path d="M18 11q17-3 31 0" fill="none" stroke="#789373" stroke-width="1.5" stroke-linecap="round"/>
      <path d="m54 8 7 1q7 1 7 8l-1 7-11-2z" fill="#e6e1cb" stroke="#c7c4ac" stroke-width="1"/>
      <path d="m59 13 4 1" stroke="#9f9e86" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M17 22q0-5 6-5h34q6 0 6 6l-1 13q0 6-6 6H24q-6 0-6-6z" fill="#172c24" stroke="#102119" stroke-width="1.5"/>
      <path d="M23 20h23" stroke="#446052" stroke-width="1.2" stroke-linecap="round"/>
      <g class="companion-eyes">
        <g class="companion-eye companion-eye-left"><rect x="24" y="23" width="12" height="14" rx="5.5" fill="#f7f0da"/><rect class="companion-pupil" x="28" y="27" width="5" height="8" rx="2.5" fill="#244735"/><circle cx="31" cy="28" r="1" fill="#fffefa"/></g>
        <g class="companion-eye companion-eye-right"><rect x="45" y="22" width="12" height="15" rx="5.5" fill="#f7f0da"/><rect class="companion-pupil" x="48" y="26" width="5" height="8" rx="2.5" fill="#244735"/><circle cx="51" cy="27" r="1" fill="#fffefa"/></g>
      </g>
      <circle cx="19" cy="43" r="1.4" fill="#b49b68"/>
    </g>
  </svg>`, 'image/svg+xml');
  return document.documentElement;
}
