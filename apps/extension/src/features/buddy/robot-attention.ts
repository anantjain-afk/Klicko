import type { RobotProps } from './robot-types';

export const expressionIds = { Idle: 0, Listening: 1, Thinking: 2, Happy: 3, Confused: 4, Surprised: 5, Sleepy: 6, Error: 7 };
const moodExpressions = {
  idle: 'Idle', noticed: 'Happy', composing: 'Listening', thinking: 'Thinking', answering: 'Happy',
  guiding: 'Listening', paused: 'Sleepy', error: 'Error', confused: 'Confused',
} as const;

export interface RobotControls {
  expression: (value: number) => void;
  gaze: (x: number, y: number) => void;
}

// Shared attention policy for the sidebar canvas and the isolated floating renderer.
// It only reads geometry and input events, never input values or page text.
export function watchRobotAttention(element: HTMLElement, props: RobotProps, controls: RobotControls,
  pointer: { current: { x: number; y: number } | null }, clicked: boolean, kick: () => void) {
  const { mood, typingTarget, dragging, guideTarget } = props;
  let frame = 0;
  let near = false;
  let reaction: 'Surprised' | 'Happy' | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attentive = ['idle', 'noticed', 'answering', 'composing'].includes(mood);
  const choose = () => {
    const composing = typingTarget && !['thinking', 'guiding', 'error'].includes(mood);
    const next = reaction ?? (composing ? 'Listening' : attentive && near ? 'Happy' : moodExpressions[mood]);
    controls.expression(expressionIds[next]);
    if (['Thinking', 'Confused', 'Sleepy', 'Error', 'Surprised'].includes(next)) controls.gaze(0, 0);
  };
  const lookAt = (x: number, y: number) => {
    const rect = element.getBoundingClientRect();
    controls.gaze(Math.max(-8, Math.min(8, (x - rect.left - rect.width / 2) / 22)),
      Math.max(-7, Math.min(7, (y - rect.top - rect.height * 0.48) / 24)));
  };
  const lookAtTarget = () => {
    const rect = mood === 'guiding' ? guideTarget?.() : typingTarget?.getBoundingClientRect();
    if (rect) lookAt(rect.left + rect.width / 2, rect.top + (typingTarget && mood !== 'guiding' ? 24 : rect.height / 2));
  };
  const samplePointer = (x: number, y: number) => {
    if (!attentive || typingTarget || dragging) return;
    const rect = element.getBoundingClientRect();
    const distance = Math.hypot(x - rect.left - rect.width / 2, y - rect.top - rect.height * 0.48);
    const threshold = near ? Math.max(145, rect.width * 0.67) : Math.max(95, rect.width * 0.48);
    const nextNear = distance < threshold;
    if (near !== nextNear) { near = nextNear; choose(); }
    if (!reaction) lookAt(x, y);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    pointer.current = { x: event.clientX, y: event.clientY };
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => samplePointer(event.clientX, event.clientY));
  };
  const reset = () => {
    cancelAnimationFrame(frame); clearTimeout(timer); reaction = null; near = false; pointer.current = null;
    controls.gaze(0, 0); choose(); lookAtTarget();
  };
  const input = () => { clearTimeout(timer); reaction = null; choose(); lookAtTarget(); };
  if (clicked && attentive && !dragging) {
    kick(); reaction = 'Surprised';
    timer = setTimeout(() => {
      reaction = 'Happy'; choose();
      timer = setTimeout(() => { reaction = null; choose(); lookAtTarget(); }, 1300);
    }, 420);
  }
  choose();
  if (pointer.current) samplePointer(pointer.current.x, pointer.current.y);
  lookAtTarget();
  window.addEventListener('pointermove', move, { passive: true, capture: true });
  window.addEventListener('blur', reset);
  window.addEventListener('resize', lookAtTarget);
  window.addEventListener('scroll', lookAtTarget, true);
  document.documentElement.addEventListener('pointerleave', reset);
  typingTarget?.addEventListener('input', input);
  return () => {
    cancelAnimationFrame(frame); clearTimeout(timer);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('blur', reset);
    window.removeEventListener('resize', lookAtTarget);
    window.removeEventListener('scroll', lookAtTarget, true);
    document.documentElement.removeEventListener('pointerleave', reset);
    typingTarget?.removeEventListener('input', input);
  };
}
