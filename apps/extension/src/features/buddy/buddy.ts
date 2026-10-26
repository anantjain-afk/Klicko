import { browser, type Browser } from 'wxt/browser';
import { createOverlaySurface } from '../overlay/surface';
import { isTaskView, type TaskAction, type TaskView } from '../../lib/task-messages';
import { uiTokens } from '../../lib/ui-tokens';
import { clampBuddy, defaultBuddyPosition, popupPosition, type Position, type Viewport } from './position';

export function createBuddy(pageKey: () => string, valid: () => boolean, targetRect: () => DOMRect | null) {
  const surface = createOverlaySurface('clickpilot-buddy', true, 'closed');
  const style = document.createElement('style');
  style.textContent = `
    :host { pointer-events:none !important; } * { box-sizing:border-box; }
    [hidden] { display:none !important; }
    button,textarea { font:inherit; } button { cursor:pointer; } button:disabled { cursor:default; opacity:.5; }
    button:focus-visible,textarea:focus-visible { outline:2px solid ${uiTokens.green}; outline-offset:3px; }
    .launcher { position:fixed; display:grid; place-items:center; width:44px; height:44px; padding:0;
      border:2px solid #fafbf8; border-radius:16px; color:#fff; background:${uiTokens.green};
      box-shadow:0 3px 14px rgb(15 35 22 / 22%); pointer-events:auto; touch-action:none; user-select:none; }
    .launcher:hover { background:#234b34; }
    .face { display:flex; align-items:center; justify-content:center; gap:7px; width:28px; height:26px; border:1.5px solid #c5d9bf; border-radius:9px; transform:rotate(-6deg); }
    .eye { width:3px; height:7px; border-radius:3px; background:#fafbf8; }
    .launcher[data-busy=true] .face { animation:thinking 1.4s ease-in-out infinite; }
    .popup { position:fixed; width:min(280px,calc(100vw - 24px)); max-height:min(360px,calc(100dvh - 88px)); overflow:auto;
      padding:14px; border-radius:16px; color:${uiTokens.ink}; background:${uiTokens.surface};
      box-shadow:0 6px 28px rgb(15 35 22 / 24%); pointer-events:auto; font:400 14px/1.6 ${uiTokens.font};
      color-scheme:light; scrollbar-width:thin; }
    .heading,.actions { display:flex; align-items:center; gap:12px; }
    .heading { justify-content:space-between; margin-bottom:10px; }
    .name { font-size:13px; font-weight:650; } .tools { display:flex; gap:6px; }
    button { border:0; border-radius:7px; background:transparent; color:${uiTokens.green}; }
    .icon { display:grid; place-items:center; width:28px; height:28px; padding:0; }
    .icon:hover { background:#e9efe5; }
    .reply { margin:0 0 12px; white-space:pre-wrap; overflow-wrap:anywhere; }
    .status,.note { margin:8px 0; color:${uiTokens.muted}; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
    .status.error { color:#8b3d28; }
    form { position:relative; margin-top:10px; border:1px solid #cdd8c9; border-radius:12px; background:#fff; }
    textarea { display:block; width:100%; min-height:72px; max-height:110px; padding:10px 46px 10px 10px; resize:none; border:0; border-radius:inherit; color:${uiTokens.ink}; background:transparent; font-size:14px; line-height:1.5; caret-color:${uiTokens.green}; }
    textarea::placeholder { color:#657260; opacity:1; }
    .send { position:absolute; right:8px; bottom:8px; display:grid; place-items:center; width:30px; height:30px; padding:0; color:#fff; background:${uiTokens.green}; border-radius:9px; }
    .actions { flex-wrap:wrap; margin-top:8px; } .actions button,.settings { padding:3px 0; font-size:12px; font-weight:600; }
    .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
    ::selection { background:#cde1d2; color:${uiTokens.ink}; }
    @keyframes thinking { 50% { transform:rotate(3deg) translateY(-1px); } }
    @media(prefers-reduced-motion:reduce) { .launcher[data-busy=true] .face { animation:none; } }
  `;
  let port: Browser.runtime.Port | null = null;
  let view: TaskView | null = null;
  let connected = false;
  let visible = false;
  let expanded = false;
  let disposed = false;
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let draft = '';
  let submitting: string | null = null;
  let localError = '';
  let position: Position | null = null;
  let pointer: { id: number; x: number; y: number; start: Position } | null = null;
  let dragged = false;
  const launcher = document.createElement('button'); launcher.className = 'launcher'; launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Ask ClickPilot'); launcher.title = 'Ask ClickPilot · Drag to move · Alt+arrow keys to reposition · Home to reset';
  const face = document.createElement('span'); face.className = 'face'; face.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 2; i++) { const eye = document.createElement('span'); eye.className = 'eye'; face.append(eye); }
  launcher.append(face);
  const popup = document.createElement('section'); popup.className = 'popup'; popup.hidden = true;
  popup.id = 'clickpilot-quick-ask'; popup.setAttribute('role', 'region'); popup.setAttribute('aria-label', 'ClickPilot quick ask');
  launcher.setAttribute('aria-controls', popup.id); launcher.setAttribute('aria-expanded', 'false');
  function icon(path: string) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(svg.namespaceURI, 'path'); shape.setAttribute('d', path); svg.append(shape); return svg;
  }
  function button(label: string, action: () => void, className = '') {
    const element = document.createElement('button'); element.type = 'button'; element.className = className;
    element.textContent = label; element.setAttribute('aria-label', label);
    element.addEventListener('click', (event) => { if (event.isTrusted) action(); }); return element;
  }
  const heading = document.createElement('div'); heading.className = 'heading';
  const name = document.createElement('span'); name.textContent = 'ClickPilot'; name.className = 'name';
  const tools = document.createElement('div'); tools.className = 'tools';
  const openSidebar = button('Open sidebar', () => openPanel(false), 'icon'); openSidebar.replaceChildren(icon('M14 4h6v6m0-6L10 14M10 4H4v16h16v-6'));
  const hide = button('Hide ClickPilot', () => { command('hide'); visible = false; render(); }, 'icon'); hide.replaceChildren(icon('m6 6 12 12M18 6 6 18'));
  tools.append(openSidebar, hide); heading.append(name, tools);
  const reply = document.createElement('p'); reply.className = 'reply';
  const status = document.createElement('p'); status.className = 'status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const form = document.createElement('form');
  const label = document.createElement('label'); label.className = 'sr'; label.htmlFor = 'clickpilot-ask'; label.textContent = 'Your question';
  const input = document.createElement('textarea'); input.id = label.htmlFor; input.placeholder = 'Ask me'; input.maxLength = 240; input.rows = 2; input.autocomplete = 'off';
  input.addEventListener('input', () => { draft = input.value; render(); });
  const send = button('Send question', submit, 'send'); send.replaceChildren(icon('M12 19V5m-6 6 6-6 6 6'));
  form.append(label, input, send); form.addEventListener('submit', (event) => event.preventDefault());
  input.addEventListener('keydown', (event) => {
    if (event.isTrusted && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(); }
  });
  const actions = document.createElement('div'); actions.className = 'actions';
  const stop = button('Stop', () => command('stop'));
  const retry = button('Retry', () => command('retry'));
  const next = button('Continue', () => command(view?.state.kind === 'recovery' ? 'continue-manually' : 'continue'));
  const done = button('Done', () => command('done')); actions.append(stop, retry, next, done);
  const note = document.createElement('p'); note.className = 'note';
  const settings = button('Open Settings', () => openPanel(true), 'settings');
  popup.append(heading, reply, status, form, actions, note, settings);
  surface.shadow.append(style, launcher, popup);

  function viewport(): Viewport {
    const v = window.visualViewport;
    return { left: v?.offsetLeft ?? 0, top: v?.offsetTop ?? 0, width: v?.width ?? innerWidth, height: v?.height ?? innerHeight };
  }
  function overlaps(a: { x: number; y: number; width: number; height: number }, b: DOMRect) {
    return a.x < b.right + 8 && a.x + a.width > b.left - 8 && a.y < b.bottom + 8 && a.y + a.height > b.top - 8;
  }
  function choosePosition(blocked?: DOMRect | null) {
    const v = viewport();
    const candidates = [defaultBuddyPosition(v), { x: v.left + 20, y: v.top + v.height - 64 },
      { x: v.left + v.width - 64, y: v.top + 20 }, { x: v.left + 20, y: v.top + 20 }];
    return candidates.find((candidate) => {
      if (blocked && overlaps({ ...candidate, width: 44, height: 44 }, blocked)) return false;
      return [[4, 4], [22, 22], [40, 40]].every(([x, y]) => !document.elementsFromPoint(candidate.x + x!, candidate.y + y!).some((element) => {
        if (element === surface.host) return false;
        return element.id.startsWith('clickpilot-') || !!element.closest('button,a,input,textarea,select,[role="button"],[role="link"]');
      }));
    }) ?? defaultBuddyPosition(v);
  }
  function place() {
    if (!visible || disposed) return;
    const v = viewport();
    if (v.width < 68 || v.height < 68) { expanded = false; launcher.hidden = true; popup.hidden = true; return; }
    launcher.hidden = false;
    position = clampBuddy(position ?? choosePosition(targetRect()), v);
    const blocked = targetRect();
    if (!pointer && blocked && overlaps({ ...position, width: 44, height: 44 }, blocked)) position = choosePosition(blocked);
    launcher.style.left = `${position.x}px`; launcher.style.top = `${position.y}px`;
    if (!expanded) return;
    if (v.width < 180 || v.height < 180) { expanded = false; render(); return; }
    const bounds = popup.getBoundingClientRect();
    const location = popupPosition(position, bounds, v);
    popup.style.left = `${location.x}px`; popup.style.top = `${location.y}px`;
  }
  function command(action: TaskAction, goal?: string) {
    if (!connected || !port || !view) { connect(); return; }
    try { port.postMessage({ type: 'TASK_COMMAND', action, id: crypto.randomUUID(), epoch: view.epoch, taskId: view.taskId,
      ...(goal === undefined ? {} : { goal }) }); } catch { connected = false; render(); }
  }
  function openPanel(settings: boolean) { if (connected && port) port.postMessage({ type: 'OPEN_SIDEBAR', settings }); }
  function submit() {
    if (!draft.trim() || submitting || !connected || !view?.guidanceConsent) return;
    submitting = draft.trim(); localError = ''; command('start', submitting); render();
  }
  function render() {
    launcher.hidden = !visible; popup.hidden = !visible || !expanded;
    launcher.setAttribute('aria-expanded', String(expanded));
    const text = view?.source === 'text'; const state = view?.state;
    const busy = text ? view?.textState.kind === 'requesting' : !!state && ['observing', 'selecting', 'highlighting', 'verifying', 'navigating'].includes(state.kind);
    launcher.dataset.busy = String(busy); launcher.setAttribute('aria-busy', String(busy));
    let latestReply = '';
    for (const message of [...(view?.messages ?? [])].reverse()) {
      if (message.role === 'user') break;
      if (message.role === 'assistant') { latestReply = message.text; break; }
    }
    if (state?.kind === 'waiting' && !text) latestReply = state.instruction;
    reply.textContent = latestReply.length > 280 ? `${latestReply.slice(0, 277)}…` : latestReply; reply.hidden = !latestReply;
    let message = !connected ? 'Reconnecting…' : '';
    if (connected && view) {
      if (text && !['answered', 'ready', 'idle', 'stopped'].includes(view.textState.kind)) message = view.textState.message;
      else if (!text && state) {
        if (['observing', 'selecting', 'highlighting'].includes(state.kind)) message = 'Thinking…';
        else if (state.kind === 'waiting') message = `Step ${state.stepNumber ?? 1} · Waiting for you`;
        else if ('message' in state && !['answer', 'clarification', 'unsupported'].includes(state.kind)) message = state.message ?? '';
      }
      if (!view.storageAvailable) message = 'Task recovery is unavailable. Stop and try again.';
    }
    if (localError) message = localError;
    status.textContent = message; status.hidden = !message;
    status.className = `status${state?.kind === 'error' || (text && view?.textState.kind === 'error') ? ' error' : ''}`;
    send.disabled = !connected || !!submitting || !view?.guidanceConsent || !draft.trim(); openSidebar.disabled = !connected;
    stop.hidden = !view?.active && !busy;
    retry.hidden = text ? !(view?.textState.kind === 'error' && view.textState.canRetry) : state?.kind !== 'error' && state?.kind !== 'recovery';
    next.hidden = text || !state || !('canContinue' in state) || !state.canContinue;
    done.hidden = text || !state || !['waiting', 'recovery', 'clicked'].includes(state.kind);
    for (const action of [stop, retry, next, done]) action.disabled = !connected;
    note.textContent = view?.guidanceConsent ? 'You make every click.' : 'Webpage sharing is off. Enable it in Settings to ask.';
    settings.hidden = !!view?.guidanceConsent;
    place();
  }
  function connect() {
    if (port || disposed || !visible || !valid()) return;
    clearTimeout(reconnectTimer);
    try {
      const nextPort = browser.runtime.connect({ name: 'clickpilot-view' }); port = nextPort;
      nextPort.onMessage.addListener((value: unknown) => {
        if (disposed || port !== nextPort) return;
        if (isTaskView(value)) {
          if (view?.epoch === value.epoch && value.revision < view.revision) return;
          view = value; connected = true; attempts = 0; visible = value.buddyVisible; localError = '';
          if (submitting && value.goal === submitting) { draft = ''; input.value = ''; submitting = null; }
          else if (value.state.kind === 'error') submitting = null;
          if (value.source === 'text' && ['composing', 'requesting'].includes(value.textState.kind)) expanded = false;
          render();
        } else if (value && typeof value === 'object' && 'type' in value) {
          if (value.type === 'PAGE_CHANGED') pageChanged();
          if (value.type === 'VIEW_ERROR' && 'message' in value && typeof value.message === 'string' && value.message.length <= 240) {
            localError = value.message; submitting = null; render();
          }
        }
      });
      nextPort.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        if (disposed || port !== nextPort) return;
        port = null; connected = false; submitting = null; render();
        if (visible && ++attempts <= 3) reconnectTimer = setTimeout(connect, [250, 1000, 2500][attempts - 1]);
      });
      nextPort.postMessage({ type: 'ATTACH', pageKey: pageKey() });
    } catch { connected = false; render(); }
  }
  function pageChanged() {
    expanded = false; draft = ''; input.value = ''; submitting = null; position = null;
    if (port) port.postMessage({ type: 'ATTACH', pageKey: pageKey() }); render();
  }
  launcher.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    if (dragged) { dragged = false; return; }
    expanded = !expanded; attempts = 0; connect(); render();
    if (expanded) input.focus({ preventScroll: true });
  });
  launcher.addEventListener('pointerdown', (event) => {
    if (!event.isTrusted || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, start: position ?? defaultBuddyPosition(viewport()) };
    dragged = false; launcher.setPointerCapture(event.pointerId);
  });
  launcher.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const x = event.clientX - pointer.x; const y = event.clientY - pointer.y;
    if (Math.hypot(x, y) > 5) dragged = true;
    if (dragged) { position = clampBuddy({ x: pointer.start.x + x, y: pointer.start.y + y }, viewport()); place(); }
  });
  const release = () => { pointer = null; place(); };
  launcher.addEventListener('pointerup', release); launcher.addEventListener('pointercancel', release);
  launcher.addEventListener('keydown', (event) => {
    if (!event.isTrusted) return;
    if (event.key === 'Home') { event.preventDefault(); position = defaultBuddyPosition(viewport()); place(); }
    if (event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); const p = position ?? defaultBuddyPosition(viewport());
      position = clampBuddy({ x: p.x + (event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0),
        y: p.y + (event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0) }, viewport()); place();
    }
  });
  surface.shadow.addEventListener('keydown', (event) => {
    if (event instanceof KeyboardEvent && event.key === 'Escape') { event.preventDefault(); expanded = false; render(); launcher.focus({ preventScroll: true }); }
    event.stopPropagation();
  });
  for (const type of ['click', 'pointerdown', 'pointerup', 'pointermove', 'keyup']) surface.shadow.addEventListener(type, (event) => event.stopPropagation());
  const focus = () => { if (visible && !connected) { attempts = 0; connect(); } };
  const visibility = () => {
    if (document.hidden || !visible) return;
    focus();
    if (port && connected) port.postMessage({ type: 'ATTACH', pageKey: pageKey() });
  };
  window.addEventListener('resize', place); window.addEventListener('scroll', place, true); window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', visibility);
  window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
  return {
    show() {
      if (!surface.host.isConnected) document.documentElement.append(surface.host);
      visible = true; attempts = 0;
      if (port) port.postMessage({ type: 'ATTACH', pageKey: pageKey() }); else connect();
      render();
    },
    pageChanged,
    avoidTarget: place,
    dispose() {
      disposed = true; clearTimeout(reconnectTimer); port?.disconnect(); surface.host.remove();
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
      window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place);
    },
  };
}
