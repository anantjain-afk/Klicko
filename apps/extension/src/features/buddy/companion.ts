import type { GuidanceState } from '../session/session';
import type { TextState } from '../text-assistant/session';

export type CompanionMood = 'idle' | 'noticed' | 'composing' | 'thinking' | 'answering' | 'guiding' | 'paused' | 'error' | 'confused';

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
    case 'answer': case 'confirmed': return 'answering';
    case 'clarification': return 'confused';
    case 'paused': case 'recovery': case 'connection_paused': case 'stopped': return 'paused';
    case 'error': case 'unsupported': return 'error';
    default: return 'idle';
  }
}

// Static poster of the approved character: fast startup, message avatars and runtime fallback.
export function createCompanion() {
  const document = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" class="companion" viewBox="0 0 400 360" aria-hidden="true" focusable="false">
    <g fill="#364442"><rect x="153" y="315" width="37" height="14" rx="6"/><rect x="210" y="315" width="37" height="14" rx="6"/><rect x="188" y="231" width="24" height="28" rx="6"/></g>
    <rect x="147" y="242" width="106" height="76" rx="30" fill="#ddb055" stroke="#a67b35" stroke-width="2"/>
    <rect x="162" y="264" width="76" height="40" rx="14" fill="#f4ecd1"/>
    <path d="M176 281h27m-27 7h27" stroke="#b2aa8c" stroke-width="3" stroke-linecap="round"/>
    <circle cx="226" cy="284" r="3" fill="#8ca583"/>
    <g fill="#edc064" stroke="#ad853b" stroke-width="2"><rect x="129" y="255" width="30" height="25" rx="10"/><rect x="241" y="255" width="30" height="25" rx="10"/></g>
    <g transform="rotate(-2 200 216)">
      <g fill="#364442"><rect x="58" y="155" width="20" height="54" rx="9"/><rect x="322" y="155" width="20" height="54" rx="9"/></g>
      <rect x="73" y="101" width="254" height="162" rx="49" fill="#b78939"/>
      <rect x="74" y="96" width="252" height="156" rx="49" fill="#edc15e" stroke="#ab7b31" stroke-width="2"/>
      <path d="M121 107h110" stroke="#ffdf83" stroke-width="3" stroke-linecap="round"/>
      <rect x="269" y="111" width="32" height="12" rx="4" fill="#f6e5b6"/>
      <g fill="#394542" stroke="#202c2d" stroke-width="2"><rect x="103" y="120" width="88" height="104" rx="35"/><rect x="209" y="120" width="88" height="104" rx="35"/></g>
      <g fill="#101b20"><rect x="110" y="129" width="74" height="89" rx="31"/><rect x="216" y="129" width="74" height="89" rx="31"/></g>
      <g fill="#f6efd6"><rect x="118" y="139" width="58" height="70" rx="25"/><rect x="224" y="139" width="58" height="70" rx="25"/></g>
      <g fill="#b7c6b6"><rect x="128.5" y="150" width="37" height="48" rx="17"/><rect x="234.5" y="150" width="37" height="48" rx="17"/></g>
      <g fill="#233033"><rect x="133.5" y="154" width="27" height="38" rx="12"/><rect x="239.5" y="154" width="27" height="38" rx="12"/></g>
      <g fill="#fffae9"><ellipse cx="142" cy="165" rx="4.5" ry="5.5"/><ellipse cx="248" cy="165" rx="4.5" ry="5.5"/></g>
      <g fill="#73807a"><rect x="132" y="216" width="31" height="3" rx="1.5"/><rect x="238" y="216" width="31" height="3" rx="1.5"/></g>
      <g fill="#b48534"><circle cx="89" cy="177" r="3.5"/><circle cx="311" cy="177" r="3.5"/></g>
    </g>
  </svg>`, 'image/svg+xml');
  return document.documentElement;
}
