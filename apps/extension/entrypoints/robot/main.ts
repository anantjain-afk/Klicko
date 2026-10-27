import { Rive, RuntimeLoader } from '@rive-app/canvas';
import { isRobotFrameState, expressionNames, type RobotFrameState } from '../../src/features/buddy/robot-frame';
import './style.css';

RuntimeLoader.setWasmUrl(new URL('./buddy/rive.wasm', location.href).href);
RuntimeLoader.setWasmFallbackUrl(null);
const canvas = document.querySelector('canvas');
if (!canvas) throw new Error('Character canvas is missing.');
let port: MessagePort | null = null;
let loaded = false;
let failed = false;
let latest: RobotFrameState = { type: 'DRAW_ROBOT', expression: 0, lookX: 0, lookY: 0, still: true, active: false };

function apply() {
  const model = rive.viewModelInstance;
  if (!loaded || !model) return;
  const expression = model.number('expression'); const x = model.number('lookX'); const y = model.number('lookY');
  const reduced = model.boolean('reduceMotion');
  if (!expression || !x || !y || !reduced) return;
  expression.value = latest.expression; x.value = latest.lookX; y.value = latest.lookY; reduced.value = latest.still;
  if (latest.active) rive.play(); else rive.pause();
}

const rive = new Rive({
  canvas, src: new URL('./buddy/robot.riv', location.href).href,
  stateMachine: 'Buddy', autoplay: false, autoBind: true, shouldDisableRiveListeners: true,
  onLoad() { loaded = true; rive.resizeDrawingSurfaceToCanvas(); apply(); port?.postMessage({ type: 'ROBOT_READY', ready: true }); },
  onLoadError() { failed = true; port?.postMessage({ type: 'ROBOT_READY', ready: false }); },
  onStateChange(event) {
    const name = Array.isArray(event.data) ? event.data.at(-1) : undefined;
    if (typeof name === 'string' && expressionNames.includes(name)) port?.postMessage({ type: 'ROBOT_STATE', name });
  },
});

const connect = (event: MessageEvent<unknown>) => {
  if (port || event.source !== parent || !event.data || typeof event.data !== 'object') return;
  const message = event.data as Record<string, unknown>;
  if (message.type !== 'CONNECT_ROBOT' || message.token !== location.hash.slice(1) || event.ports.length !== 1) return;
  const channel = event.ports[0]; if (!channel) return;
  port = channel;
  port.onmessage = (incoming: MessageEvent<unknown>) => {
    if (!isRobotFrameState(incoming.data)) return;
    latest = incoming.data; apply();
  };
  port.postMessage({ type: 'ROBOT_READY', ready: loaded && !failed });
};
window.addEventListener('message', connect);
const observer = new ResizeObserver(() => { if (loaded) rive.resizeDrawingSurfaceToCanvas(); });
observer.observe(canvas);
const resume = () => apply();
const hide = (event: PageTransitionEvent) => {
  if (event.persisted) { rive.pause(); return; }
  observer.disconnect(); port?.close(); rive.cleanup(); window.removeEventListener('message', connect);
  window.removeEventListener('pageshow', resume); window.removeEventListener('pagehide', hide);
};
window.addEventListener('pageshow', resume);
window.addEventListener('pagehide', hide);
