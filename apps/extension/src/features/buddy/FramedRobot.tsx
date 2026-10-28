import { useEffect, useRef, useState } from 'react';
import { motion, useSpring } from 'motion/react';
import { browser } from 'wxt/browser';
import { Companion } from './CompanionAvatar';
import { watchRobotAttention } from './robot-attention';
import { useRobotActivity } from './robot-activity';
import { expressionNames, type RobotFrameState } from './robot-frame';
import type { RobotProps } from './robot-types';

// Extension-origin rendering avoids webpage CSP preventing WASM compilation.
// The native buddy keeps all controls and task coordination outside this decorative frame.
export function FramedRobot(props: RobotProps) {
  const { mood, typingTarget, visible = true, dragging, floating, clickSignal = 0, guideTarget } = props;
  const container = useRef<HTMLSpanElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const port = useRef<MessagePort | null>(null);
  const pendingFrame = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const lastClick = useRef(clickSignal);
  const [token] = useState(() => crypto.randomUUID());
  const [ready, setReady] = useState(false);
  const [expression, setExpression] = useState('Idle');
  const { active, still } = useRobotActivity(container, visible);
  const state = useRef<RobotFrameState>({ type: 'DRAW_ROBOT', expression: 0, lookX: 0, lookY: 0, still, active });
  const bounce = useSpring(0, { stiffness: 340, damping: 18 });
  function send() {
    cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => port.current?.postMessage(state.current));
  }
  function connect() {
    port.current?.close();
    const channel = new MessageChannel();
    port.current = channel.port1;
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return;
      const reply = event.data as Record<string, unknown>;
      if (reply.type === 'ROBOT_READY' && typeof reply.ready === 'boolean') setReady(reply.ready);
      if (reply.type === 'ROBOT_STATE' && typeof reply.name === 'string' && expressionNames.includes(reply.name)) setExpression(reply.name);
    };
    iframe.current?.contentWindow?.postMessage({ type: 'CONNECT_ROBOT', token },
      browser.runtime.getURL('/').replace(/\/$/, ''), [channel.port2]);
    send();
  }
  useEffect(() => () => { cancelAnimationFrame(pendingFrame.current); port.current?.close(); }, []);
  useEffect(() => {
    state.current.still = still; state.current.active = active;
    if (still || dragging) bounce.jump(0);
    if (still) { state.current.lookX = 0; state.current.lookY = 0; }
    send();
  }, [still, active, dragging, bounce]);
  useEffect(() => {
    const clicked = clickSignal !== lastClick.current; lastClick.current = clickSignal;
    if (still || !container.current) return;
    return watchRobotAttention(container.current, { mood, typingTarget, dragging, guideTarget }, {
      expression(value) { state.current.expression = value; send(); },
      gaze(x, y) { state.current.lookX = x; state.current.lookY = y; send(); },
    }, pointer, clicked, () => { bounce.jump(-6); bounce.set(0); });
  }, [mood, typingTarget, dragging, guideTarget, clickSignal, still, bounce]);
  const float = floating && !still && !dragging && mood !== 'paused';
  return <motion.span ref={container} className="robot-companion" aria-hidden="true"
    data-ready={ready} data-expression={expression} style={{ y: bounce }}
    animate={{ translateY: float ? [0, -3, 0] : 0 }}
    transition={float ? { duration: 5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}>
    {!ready && <Companion className="robot-fallback" />}
    <iframe ref={iframe} src={`${browser.runtime.getURL('/robot.html')}#${token}`} title="Klicko character"
      tabIndex={-1} aria-hidden="true" referrerPolicy="no-referrer" onLoad={connect}
      className="robot-canvas" style={{ border: 0, pointerEvents: 'none', visibility: ready ? 'visible' : 'hidden' }} />
  </motion.span>;
}
