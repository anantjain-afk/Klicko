import { browser, type Browser } from 'wxt/browser';
import { createOverlaySurface } from '../overlay/surface';
import { isTaskView, type TaskAction, type TaskView } from '../../lib/task-messages';
import { uiTokens, uiTheme, uiDarkTheme } from '../../lib/ui-tokens';
import { createCompanion, companionMood } from './companion';
import { mountRobot } from './mount-robot';
import { animate } from 'motion';
import { playSound } from '../../lib/sounds';
import companionCss from './companion.css?inline';
import buddyCss from './buddy.css?inline';
import { BUDDY_SIZE, clampBuddy, defaultBuddyPosition, popupPosition, type Position, type Viewport } from './position';

export function createBuddy(pageKey: () => string, valid: () => boolean, targetRect: () => DOMRect | null) {
  const surface = createOverlaySurface('clickpilot-buddy', true, 'closed');
  const style = document.createElement('style');
  style.textContent = `
    :host { ${uiTheme} --font:${uiTokens.font}; --buddy-size:${BUDDY_SIZE}px; }
    @media (prefers-color-scheme:dark) { :host { ${uiDarkTheme} } }
    ${companionCss}
    ${buddyCss}
  `;
  let port: Browser.runtime.Port | null = null;
  let view: TaskView | null = null;
  let connected = false;
  let visible = false;
  let launchSoundArmed = true;
  let expanded = false;
  let disposed = false;
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let draft = '';
  let submitting: string | null = null;
  let localError = '';
  let position: Position | null = null;
  let selectionRect: DOMRect | null = null;
  let pointer: { id: number; x: number; y: number; start: Position; lastX: number; lastY: number; time: number; vx: number; vy: number } | null = null;
  let dragged = false;
  let clickSignal = 0;
  let docked = false;
  let robot: ReturnType<typeof mountRobot> | undefined;
  let placed: Position | null = null;
  let popupShown = false;
  let popupRevision = 0;
  let placementAnimation: ReturnType<typeof animate> | undefined;
  let popupAnimation: ReturnType<typeof animate> | undefined;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const launcher = document.createElement('button'); launcher.className = 'launcher'; launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Ask ClickPilot'); launcher.title = 'Ask ClickPilot · Drag to move · Alt+arrow keys to reposition · Home to reset';
  const avatar = document.createElement('span'); avatar.className = 'companion-avatar';
  avatar.id = 'clickpilot-companion';
  avatar.setAttribute('aria-hidden', 'true'); avatar.append(createCompanion()); launcher.append(avatar);
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
  const close = button('Close ask card', () => { playSound('clicky-text-close'); expanded = false; render(); launcher.focus({ preventScroll: true }); }, 'icon');
  close.replaceChildren(icon('m6 6 12 12M18 6 6 18'));
  const hide = button('Hide ClickPilot', () => { playSound('agent-close'); command('hide'); visible = false; launchSoundArmed = true; render(); }, 'settings');
  tools.append(openSidebar, close); heading.append(name, tools);
  const greeting = document.createElement('h2'); greeting.className = 'greeting'; greeting.textContent = 'What would you like help with?';
  const reply = document.createElement('p'); reply.className = 'reply';
  const replyLink = button('Read more in sidebar', () => openPanel(false), 'reply-link');
  const status = document.createElement('p'); status.className = 'status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const form = document.createElement('form');
  const label = document.createElement('label'); label.className = 'sr'; label.htmlFor = 'clickpilot-ask'; label.textContent = 'Your question';
  const input = document.createElement('textarea'); input.id = label.htmlFor; input.placeholder = 'Ask ClickPilot…'; input.maxLength = 240; input.rows = 2; input.autocomplete = 'off';
  input.addEventListener('input', () => { draft = input.value; render(); });
  input.addEventListener('focus', () => render());
  input.addEventListener('blur', () => render());
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
  const footer = document.createElement('div'); footer.className = 'actions'; footer.append(hide);
  popup.append(heading, greeting, reply, replyLink, status, form, actions, note, settings, footer);
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
    const candidates = [defaultBuddyPosition(v), { x: v.left + 20, y: v.top + v.height - BUDDY_SIZE - 20 },
      { x: v.left + v.width - BUDDY_SIZE - 20, y: v.top + 20 }, { x: v.left + 20, y: v.top + 20 }];
    return candidates.find((candidate) => {
      if (blocked && overlaps({ ...candidate, width: BUDDY_SIZE, height: BUDDY_SIZE }, blocked)) return false;
      if (selectionRect && overlaps({ ...candidate, width: BUDDY_SIZE, height: BUDDY_SIZE }, selectionRect)) return false;
      return [[4, 4], [BUDDY_SIZE / 2, BUDDY_SIZE / 2], [BUDDY_SIZE - 4, BUDDY_SIZE - 4]].every(([x, y]) => !document.elementsFromPoint(candidate.x + x!, candidate.y + y!).some((element) => {
        if (element === surface.host) return false;
        return element.id.startsWith('clickpilot-') || !!element.closest('button,a,input,textarea,select,[role="button"],[role="link"]');
      }));
    }) ?? defaultBuddyPosition(v);
  }
  function place() {
    if (!visible || disposed) return;
    const v = viewport();
    if (v.width < BUDDY_SIZE + 24 || v.height < BUDDY_SIZE + 24) {
      expanded = false; showPopup(false); launcher.hidden = true; popup.hidden = true;
      launcher.setAttribute('aria-expanded', 'false'); return;
    }
    launcher.hidden = false;
    position = clampBuddy(docked ? { x: v.left + v.width - BUDDY_SIZE - 12, y: v.top + 80 } : position ?? choosePosition(targetRect()), v);
    const blocked = targetRect();
    if (!pointer && [blocked, selectionRect].some(rect => rect && overlaps({ ...position!, width: BUDDY_SIZE, height: BUDDY_SIZE }, rect))) position = choosePosition(blocked);
    if (!placed || placed.x !== position.x || placed.y !== position.y) {
      placementAnimation?.stop();
      launcher.style.left = '0px'; launcher.style.top = '0px';
      placementAnimation = animate(launcher, { x: position.x, y: position.y },
        !placed || pointer || reducedMotion.matches ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 29 });
      placed = { ...position };
    }
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
  function openPanel(settings: boolean) {
    if (!connected || !port) return;
    port.postMessage({ type: 'OPEN_SIDEBAR', settings });
    docked = true; expanded = false; render();
  }
  function submit() {
    if (!draft.trim() || submitting || !connected || !view?.guidanceConsent) return;
    playSound('clicky-text-send');
    submitting = draft.trim(); localError = ''; command('start', submitting); render();
  }
  function showPopup(show: boolean) {
    if (show === popupShown) return;
    popupShown = show;
    const revision = ++popupRevision;
    popupAnimation?.stop();
    popup.inert = !show;
    if (!visible || reducedMotion.matches) { popup.hidden = !show; popup.style.opacity = '1'; popup.style.transform = 'none'; return; }
    if (show) {
      popup.hidden = false;
      popupAnimation = animate(popup, { opacity: [0, 1], y: [8, 0] }, { duration: 0.22, ease: [0.16, 1, 0.3, 1] });
    } else {
      popupAnimation = animate(popup, { opacity: 0, y: 5 }, { duration: 0.12 });
      void popupAnimation.then(() => { if (revision === popupRevision && !popupShown) popup.hidden = true; });
    }
  }
  function render() {
    launcher.hidden = !visible;
    showPopup(visible && expanded);
    launcher.setAttribute('aria-expanded', String(expanded));
    const text = view?.source === 'text'; const state = view?.state;
    const busy = text ? view?.textState.kind === 'requesting' : !!state && ['observing', 'selecting', 'highlighting', 'verifying', 'navigating'].includes(state.kind);
    const mood = view ? companionMood(view.state, view.textState, view.source, connected) : 'idle';
    const typingTarget = expanded && surface.shadow.activeElement === input ? input : null;
    const currentMood = localError ? 'error' : (draft.trim() || typingTarget) && expanded && ['idle', 'noticed', 'answering', 'composing'].includes(mood) ? 'composing' : mood;
    avatar.dataset.mood = currentMood;
    robot?.update({ mood: currentMood, visible, typingTarget, clickSignal, floating: !docked, dragging: !!pointer && dragged, guideTarget: targetRect });
    launcher.dataset.busy = String(busy); launcher.setAttribute('aria-busy', String(busy));
    let latestReply = '';
    for (const message of [...(view?.messages ?? [])].reverse()) {
      if (message.role === 'user') break;
      if (message.role === 'assistant') { latestReply = message.text; break; }
    }
    if (state?.kind === 'waiting' && !text) latestReply = state.instruction;
    greeting.hidden = !!latestReply || busy || !!view?.active;
    replyLink.hidden = latestReply.length <= 280;
    replyLink.disabled = !connected;
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
    if (connected && !message) message = view?.activationNotice ?? '';
    status.textContent = message; status.hidden = !message;
    status.className = `status${localError || state?.kind === 'error' || (text && view?.textState.kind === 'error') ? ' error' : ''}`;
    send.disabled = !connected || !!submitting || !view?.guidanceConsent || !draft.trim(); openSidebar.disabled = !connected;
    stop.hidden = !view?.active && !busy;
    retry.hidden = text ? !(view?.textState.kind === 'error' && view.textState.canRetry) : state?.kind !== 'error' && state?.kind !== 'recovery';
    next.hidden = text || !state || !('canContinue' in state) || !state.canContinue;
    next.textContent = state?.kind === 'recovery' ? 'Continue manually' : 'Continue';
    next.setAttribute('aria-label', next.textContent);
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
          if (!visible) launchSoundArmed = true;
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
    expanded = false; draft = ''; input.value = ''; submitting = null; position = null; docked = false;
    if (port) port.postMessage({ type: 'ATTACH', pageKey: pageKey() }); render();
  }
  launcher.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    if (dragged) { dragged = false; return; }
    playSound(expanded ? 'clicky-text-close' : 'clicky-text-open');
    clickSignal++; docked = false; expanded = !expanded; attempts = 0; connect(); render();
    if (expanded) input.focus({ preventScroll: true });
  });
  launcher.addEventListener('pointerdown', (event) => {
    if (!event.isTrusted || event.button !== 0) return;
    placementAnimation?.stop(); docked = false;
    // Start from the visible position if a spring was interrupted by a grab.
    const bounds = launcher.getBoundingClientRect(); position = clampBuddy({ x: bounds.x, y: bounds.y }, viewport());
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, start: position,
      lastX: event.clientX, lastY: event.clientY, time: event.timeStamp, vx: 0, vy: 0 };
    dragged = false; launcher.setPointerCapture(event.pointerId);
  });
  launcher.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const elapsed = Math.max(1, event.timeStamp - pointer.time);
    pointer.vx = (event.clientX - pointer.lastX) / elapsed; pointer.vy = (event.clientY - pointer.lastY) / elapsed;
    pointer.lastX = event.clientX; pointer.lastY = event.clientY; pointer.time = event.timeStamp;
    const x = event.clientX - pointer.x; const y = event.clientY - pointer.y;
    if (Math.hypot(x, y) > 5 && !dragged) { dragged = true; render(); }
    if (dragged) { position = clampBuddy({ x: pointer.start.x + x, y: pointer.start.y + y }, viewport()); place(); }
  });
  const release = (event: PointerEvent) => {
    if (pointer && dragged && position && event.type !== 'pointercancel' && !reducedMotion.matches) {
      const freshness = Math.max(0, 1 - (event.timeStamp - pointer.time) / 100);
      const limit = (speed: number) => Math.max(-48, Math.min(48, speed * 70 * freshness));
      position = clampBuddy({ x: position.x + limit(pointer.vx), y: position.y + limit(pointer.vy) }, viewport());
    }
    pointer = null; render();
  };
  launcher.addEventListener('pointerup', release); launcher.addEventListener('pointercancel', release);
  launcher.addEventListener('keydown', (event) => {
    if (!event.isTrusted) return;
    if (event.key === 'Home') { event.preventDefault(); docked = false; position = defaultBuddyPosition(viewport()); place(); }
    if (event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); docked = false; const p = position ?? defaultBuddyPosition(viewport());
      position = clampBuddy({ x: p.x + (event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0),
        y: p.y + (event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0) }, viewport()); place();
    }
  });
  surface.shadow.addEventListener('keydown', (event) => {
    if (event instanceof KeyboardEvent && event.key === 'Escape') {
      event.preventDefault(); if (expanded) playSound('clicky-text-close');
      expanded = false; render(); launcher.focus({ preventScroll: true });
    }
    event.stopPropagation();
  });
  for (const type of ['click', 'pointerdown', 'pointerup', 'pointermove', 'keyup']) surface.shadow.addEventListener(type, (event) => event.stopPropagation());
  const focus = () => { if (visible && !connected) { attempts = 0; connect(); } };
  const visibility = () => {
    if (document.hidden || !visible) return;
    focus();
    if (port && connected) port.postMessage({ type: 'ATTACH', pageKey: pageKey() });
  };
  const motionChanged = () => {
    placementAnimation?.stop(); popupAnimation?.stop(); placed = null; ++popupRevision;
    popupShown = visible && expanded; popup.hidden = !popupShown; popup.inert = !popupShown;
    popup.style.opacity = '1'; popup.style.transform = 'none'; render();
  };
  reducedMotion.addEventListener('change', motionChanged);
  window.addEventListener('resize', place); window.addEventListener('scroll', place, true); window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', visibility);
  window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
  return {
    show() {
      if (launchSoundArmed) { playSound('agent-launch'); launchSoundArmed = false; }
      if (!surface.host.isConnected) document.documentElement.append(surface.host);
      robot ??= mountRobot(avatar);
      visible = true; attempts = 0;
      if (port) port.postMessage({ type: 'ATTACH', pageKey: pageKey() }); else connect();
      render();
    },
    pageChanged,
    avoidTarget: place,
    avoidSelection(rect: DOMRect | null) {
      if (disposed) return;
      selectionRect = rect;
      if (rect) expanded = false;
      render();
    },
    hide() {
      visible = false; expanded = false; draft = ''; input.value = ''; view = null;
      clearTimeout(reconnectTimer); port?.disconnect(); port = null; connected = false;
      launchSoundArmed = true; render(); surface.host.remove();
    },
    dispose() {
      disposed = true; clearTimeout(reconnectTimer); port?.disconnect(); placementAnimation?.stop(); popupAnimation?.stop();
      robot?.dispose(); surface.host.remove(); reducedMotion.removeEventListener('change', motionChanged);
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
      window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place);
    },
  };
}
