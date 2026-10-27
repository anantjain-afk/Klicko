import { useEffect, useRef, useState } from 'react';
import { RuntimeLoader, useRive } from '@rive-app/react-canvas';
import wasmUrl from '@rive-app/canvas/rive.wasm?url';
import { expressions, type Expression, type ExpressionPreview } from './expressions';

// Keep the prototype self-contained: no runtime downloads from a CDN.
RuntimeLoader.setWasmUrl(wasmUrl);
RuntimeLoader.setWasmFallbackUrl(null);

type RobotProps = {
  still: boolean;
  visible: boolean;
  typingTarget: HTMLTextAreaElement | null;
  preview: ExpressionPreview;
  clickSignal: number;
  context: string;
  onExpressionChange: (name: string) => void;
};

export function Robot({ still, visible, typingTarget, preview, clickSignal, context, onExpressionChange }: RobotProps) {
  const bounds = useRef<HTMLDivElement>(null);
  const lastClick = useRef(clickSignal);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const { rive, RiveComponent } = useRive({
    src: `${import.meta.env.BASE_URL}robot.riv`,
    stateMachine: 'Buddy',
    autoplay: true,
    autoBind: true,
    onLoadError: () => setFailed(true),
    onStateChange: (event) => {
      const states = event.data;
      const name = Array.isArray(states) ? states.at(-1) : undefined;
      if (typeof name === 'string') onExpressionChange(name);
    },
  });

  useEffect(() => {
    if (!rive) return;
    const reduced = rive.viewModelInstance?.boolean('reduceMotion');
    if (reduced) reduced.value = still;
    if (visible) rive.play();
    else rive.pause();
  }, [rive, still, visible]);

  useEffect(() => {
    const model = rive?.viewModelInstance;
    const lookX = model?.number('lookX');
    const lookY = model?.number('lookY');
    const expression = model?.number('expression');
    const clicked = clickSignal !== lastClick.current;
    lastClick.current = clickSignal;
    if (!lookX || !lookY || !expression) return;

    const resetGaze = () => { lookX.value = 0; lookY.value = 0; };
    if (still || !visible) { resetGaze(); return; }
    let frame = 0;
    let near = false;
    let reaction: Expression | null = null;
    let reactionTimer: ReturnType<typeof setTimeout> | undefined;
    const chooseExpression = () => {
      const next = preview !== 'Automatic' ? preview : reaction ?? (typingTarget ? 'Listening' : near ? 'Happy' : 'Idle');
      expression.value = expressions.indexOf(next);
      if (!['Idle', 'Happy', 'Listening'].includes(next)) resetGaze();
    };
    const lookAt = (x: number, y: number) => {
      const rect = bounds.current?.getBoundingClientRect();
      if (!rect) return;
      // Bounded by the lenses; Rive's data converter smooths the eye movement.
      lookX.value = Math.max(-8, Math.min(8, (x - rect.left - rect.width / 2) / 22));
      lookY.value = Math.max(-7, Math.min(7, (y - rect.top - rect.height * 0.48) / 24));
    };
    const lookAtComposer = () => {
      if (!typingTarget) return;
      const rect = typingTarget.getBoundingClientRect();
      // Follow the writing area, without reading or storing any entered text.
      lookAt(rect.left + rect.width * 0.5, rect.top + 24);
    };
    const samplePointer = (x: number, y: number) => {
      const rect = bounds.current?.getBoundingClientRect();
      if (!rect) return;
      const distance = Math.hypot(x - rect.left - rect.width / 2, y - rect.top - rect.height * 0.48);
      // Hysteresis prevents repeated happy entrances when hovering at the boundary.
      const threshold = near ? Math.max(145, rect.width * 0.67) : Math.max(95, rect.width * 0.48);
      const nextNear = distance < threshold;
      if (near !== nextNear) { near = nextNear; chooseExpression(); }
      if (!typingTarget && (preview === 'Automatic' || ['Idle', 'Happy', 'Listening'].includes(preview))) {
        lookAt(x, y);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointer.current = { x: event.clientX, y: event.clientY };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => samplePointer(event.clientX, event.clientY));
    };
    const resetAttention = () => {
      cancelAnimationFrame(frame);
      clearTimeout(reactionTimer);
      near = false;
      pointer.current = null;
      reaction = null;
      resetGaze();
      chooseExpression();
    };
    const onInput = () => {
      lookAtComposer();
      // A tiny gaze change acknowledges input; no text or caret value is read.
      lookY.value = Math.max(-7, Math.min(7, lookY.value + 0.6));
    };
    if (clicked && preview === 'Automatic') {
      reaction = 'Surprised';
      reactionTimer = setTimeout(() => {
        reaction = 'Happy';
        chooseExpression();
        reactionTimer = setTimeout(() => { reaction = null; chooseExpression(); }, 1300);
      }, 420);
    }
    chooseExpression();
    if (pointer.current) samplePointer(pointer.current.x, pointer.current.y);
    if (preview === 'Automatic' || preview === 'Listening') lookAtComposer();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('blur', resetAttention);
    document.documentElement.addEventListener('pointerleave', resetAttention);
    typingTarget?.addEventListener('input', onInput);
    typingTarget?.addEventListener('scroll', lookAtComposer);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(reactionTimer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', resetAttention);
      document.documentElement.removeEventListener('pointerleave', resetAttention);
      typingTarget?.removeEventListener('input', onInput);
      typingTarget?.removeEventListener('scroll', lookAtComposer);
    };
  }, [rive, still, visible, typingTarget, preview, clickSignal, context]);

  return (
    <div className="robot-art" ref={bounds} data-loaded={Boolean(rive)}>
      {failed ? <span role="alert" className="asset-error">Robot couldn’t load. Reload this page to retry.</span>
        : <RiveComponent aria-hidden="true" />}
    </div>
  );
}
