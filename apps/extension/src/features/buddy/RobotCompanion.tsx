import { useEffect, useRef, useState } from 'react';
import { RuntimeLoader, useRive } from '@rive-app/react-canvas';
import { motion, useSpring } from 'motion/react';
import { browser } from 'wxt/browser';
import { Companion } from './CompanionAvatar';
import { watchRobotAttention } from './robot-attention';
import { useRobotActivity } from './robot-activity';
import type { RobotProps } from './robot-types';

RuntimeLoader.setWasmUrl(browser.runtime.getURL('/buddy/rive.wasm'));
RuntimeLoader.setWasmFallbackUrl(null);

export function RobotCompanion(props: RobotProps) {
  const { mood, visible = true, typingTarget, clickSignal = 0, floating = false, dragging, guideTarget, className = '' } = props;
  const container = useRef<HTMLSpanElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const lastClick = useRef(clickSignal);
  const [failed, setFailed] = useState(false);
  const [expressionName, setExpressionName] = useState('Idle');
  const { active, still } = useRobotActivity(container, visible);
  const bounce = useSpring(0, { stiffness: 340, damping: 18 });
  const { rive, RiveComponent } = useRive({
    src: browser.runtime.getURL('/buddy/robot.riv'), stateMachine: 'Buddy', autoplay: true, autoBind: true,
    shouldDisableRiveListeners: true,
    onLoadError: () => setFailed(true),
    onStateChange: (event) => {
      const name = Array.isArray(event.data) ? event.data.at(-1) : undefined;
      if (typeof name === 'string') setExpressionName(name);
    },
  });
  useEffect(() => {
    const value = rive?.viewModelInstance?.boolean('reduceMotion');
    if (value) value.value = still;
    if (active) rive?.play(); else rive?.pause();
    if (still || dragging) bounce.jump(0);
  }, [rive, still, active, dragging, bounce]);
  useEffect(() => {
    const model = rive?.viewModelInstance;
    const x = model?.number('lookX'); const y = model?.number('lookY'); const expression = model?.number('expression');
    const clicked = clickSignal !== lastClick.current; lastClick.current = clickSignal;
    if (!x || !y || !expression || !container.current) return;
    if (still) { x.value = 0; y.value = 0; return; }
    return watchRobotAttention(container.current, { mood, typingTarget, dragging, guideTarget }, {
      expression(value) { expression.value = value; }, gaze(dx, dy) { x.value = dx; y.value = dy; },
    }, pointer, clicked, () => { bounce.jump(-6); bounce.set(0); });
  }, [rive, mood, still, typingTarget, clickSignal, dragging, guideTarget, bounce]);
  const float = floating && !still && !dragging && mood !== 'paused';
  return <motion.span ref={container} className={`robot-companion ${className}`} aria-hidden="true"
    data-expression={expressionName} data-ready={!!rive && !failed} style={{ y: bounce }}
    animate={{ translateY: float ? [0, -3, 0] : 0 }}
    transition={float ? { duration: 5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}>
    {(!rive || failed) && <Companion className="robot-fallback" />}
    {!failed && <RiveComponent className="robot-canvas" style={{ visibility: rive ? 'visible' : 'hidden' }} />}
  </motion.span>;
}
