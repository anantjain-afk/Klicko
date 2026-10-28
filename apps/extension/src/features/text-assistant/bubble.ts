import { MAX_QUESTION_LENGTH, prepareText, type TextIdentity, type TextResult } from '@clickpilot/shared/text-assistant';
import { isSensitivePage } from '@clickpilot/shared/privacy';
import { createOverlaySurface } from '../overlay/surface';
import { bubblePosition, captureSelection, sameSelectedText, selectionAnchor } from './selection';
import type { TextEvent, TextPageCommand } from '../../lib/text-assistant';
import { uiTheme, uiDarkTheme, uiTokens } from '../../lib/ui-tokens';
import { playSound } from '../../lib/sounds';

export function createTextBubble(pageKey: () => string, valid: () => boolean, send: (event: TextEvent) => void,
  positionChanged: (rect: DOMRect | null) => void = () => undefined) {
  let enabled: { sessionId: string; consent: boolean } | null = null;
  let current: { identity: TextIdentity; range: Range; text: string } | null = null;
  let surface: ReturnType<typeof createOverlaySurface> | null = null;
  let box: HTMLDivElement | null = null;
  let mode: 'offer' | 'composing' | 'requesting' | 'reply' = 'offer';
  let completionTimer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  let pointerDown = false;
  let selectionChanged = false;
  let awaitingPointerSelection = false;
  let previousFocus: HTMLElement | null = null;
  let lastUrl = location.href;
  let lastBounds = '';

  function emit(type: 'TEXT_SELECTED' | 'TEXT_OPENED' | 'TEXT_CANCELLED' | 'TEXT_INVALIDATED') {
    if (current) send({ ...current.identity, type });
  }
  function removeSurface() {
    cancelAnimationFrame(frame); frame = 0;
    surface?.host.remove(); surface = null; box = null;
    lastBounds = ''; positionChanged(null);
  }
  function cancel(invalidated = false) {
    clearTimeout(completionTimer);
    emit(invalidated ? 'TEXT_INVALIDATED' : 'TEXT_CANCELLED');
    const hadFocus = !!surface?.shadow.activeElement;
    current = null; removeSurface();
    if (hadFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  function matches(identity: TextIdentity) {
    return enabled?.sessionId === identity.sessionId && current?.identity.selectionId === identity.selectionId
      && identity.pageKey === pageKey() && current.identity.pageKey === identity.pageKey && valid()
      && !document.hidden && !isSensitivePage(location.href) && sameSelectedText(current.range, current.text);
  }
  function place() {
    if (!current || !surface || !box) return;
    if (!matches(current.identity)) { cancel(true); return; }
    const anchor = selectionAnchor(current.range);
    const viewport = window.visualViewport;
    const position = anchor && bubblePosition(anchor, box.getBoundingClientRect(), {
      left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
      width: viewport?.width ?? innerWidth, height: viewport?.height ?? innerHeight,
    });
    if (!position) {
      // Losing geometry must not cancel an already submitted panel explanation.
      removeSurface();
      if (mode === 'offer' || mode === 'composing') cancel();
      return;
    }
    box.style.left = `${position.left}px`; box.style.top = `${position.top}px`;
    const bounds = box.getBoundingClientRect();
    const key = JSON.stringify([bounds.x, bounds.y, bounds.width, bounds.height]);
    if (key !== lastBounds) { lastBounds = key; positionChanged(bounds); }
    frame = requestAnimationFrame(place);
  }
  function button(label: string, action: () => void) {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = label; element.addEventListener('click', action);
    return element;
  }
  function base() {
    removeSurface();
    surface = createOverlaySurface('clickpilot-text', true);
    const style = document.createElement('style');
    style.textContent = `
      :host { ${uiTheme} pointer-events:none !important; } * { box-sizing:border-box; }
      @media (prefers-color-scheme:dark) { :host { ${uiDarkTheme} } }
      .bubble { position:absolute; pointer-events:auto; max-width:min(300px, calc(100vw - 24px));
        width:max-content; padding:14px; border-radius:12px; background:var(--raised); color:var(--ink);
        box-shadow:var(--shadow); font:400 14px/1.5 ${uiTokens.font}; overflow-wrap:anywhere; }
      button,input { font:inherit; } button { cursor:pointer; border:0; border-radius:8px; padding:7px 10px; background:var(--green); color:var(--button-ink); }
      button:hover:not(:disabled) { background:var(--green-hover); } button:disabled { opacity:.6; cursor:default; }
      button:focus-visible,input:focus-visible { outline:2px solid var(--green); outline-offset:2px; }
      label { display:block; font-weight:600; margin-bottom:7px; } input { width:100%; min-width:0; color:var(--ink); background:var(--surface);
        border:1px solid var(--line); border-radius:8px; padding:8px; caret-color:var(--green); }
      p { margin:0 0 8px; white-space:pre-wrap; } .actions { display:flex; gap:8px; margin-top:9px; }
      .cancel { color:var(--green); background:var(--soft); } .note { font-size:12px; color:var(--muted); margin-top:8px; }
      ::selection { background:var(--green); color:var(--button-ink); }
    `;
    box = document.createElement('div'); box.className = 'bubble';
    box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Ask Klicko about selected text');
    surface.shadow.append(style, box); document.documentElement.append(surface.host);
    return box;
  }
  function compose(draft = '') {
    if (!current || !matches(current.identity)) { cancel(true); return; }
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    emit('TEXT_OPENED'); mode = 'composing';
    const container = base();
    const form = document.createElement('form');
    const label = document.createElement('label'); label.textContent = 'Question about this passage'; label.htmlFor = 'clickpilot-text-question';
    const input = document.createElement('input'); input.id = label.htmlFor; input.maxLength = MAX_QUESTION_LENGTH; input.required = true;
    input.autocomplete = 'off'; input.placeholder = 'What does this mean?';
    input.value = draft;
    const note = document.createElement('p'); note.className = 'note';
    note.textContent = enabled?.consent ? 'Only this passage and your question are sent.' : 'Turn on Selected-text assistance in Settings to ask.';
    const ask = document.createElement('button'); ask.type = 'submit'; ask.textContent = 'Ask'; ask.disabled = !enabled?.consent;
    let userSubmitted = false;
    const approveSubmit = (event: Event) => {
      userSubmitted = event.isTrusted;
      setTimeout(() => { userSubmitted = false; }, 0);
    };
    ask.addEventListener('click', approveSubmit);
    const actions = document.createElement('div'); actions.className = 'actions';
    const dismiss = button('Cancel', () => cancel()); dismiss.className = 'cancel'; actions.append(ask, dismiss);
    form.append(label, input, note, actions); container.append(form);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (event.isComposing) { event.preventDefault(); return; }
      approveSubmit(event);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!userSubmitted) return;
      userSubmitted = false;
      if (!current || !enabled?.consent || mode !== 'composing') return;
      if (!matches(current.identity)) { cancel(true); return; }
      const clean = prepareText(current.text, input.value);
      if (!clean) { note.textContent = 'Use a short question without sensitive information.'; return; }
      playSound('clicky-text-selection');
      mode = 'requesting';
      send({ type: 'TEXT_SUBMITTED', ...current.identity, ...clean });
      showMessage('Explaining…', false);
    });
    place(); if (box) input.focus();
  }
  function showMessage(text: string, reply: boolean) {
    if (!surface) return;
    const container = base();
    const message = document.createElement('p'); message.textContent = text; message.setAttribute('role', 'status');
    container.append(message);
    const note = document.createElement('p'); note.className = 'note';
    note.textContent = reply ? 'Detailed response in the side panel.' : 'You can cancel while waiting.';
    container.append(note, button(reply ? 'Close' : 'Cancel', () => cancel()));
    place();
  }
  function finishSelection() {
    if (!enabled || pointerDown || surface?.shadow.activeElement) return;
    if (awaitingPointerSelection && !selectionChanged) { awaitingPointerSelection = false; return; }
    awaitingPointerSelection = false;
    const captured = captureSelection();
    if (!captured) { if (mode === 'offer') cancel(); return; }
    if (current && captured.text === current.text && captured.range.startContainer === current.range.startContainer
      && captured.range.startOffset === current.range.startOffset && captured.range.endContainer === current.range.endContainer
      && captured.range.endOffset === current.range.endOffset) return;
    cancel(); mode = 'offer';
    current = { ...captured, identity: { sessionId: enabled.sessionId, pageKey: pageKey(), selectionId: crypto.randomUUID() } };
    emit('TEXT_SELECTED');
    base().append(button('Ask Klicko', () => compose())); place();
  }
  function schedule() { clearTimeout(completionTimer); completionTimer = setTimeout(finishSelection, 120); }
  function inside(event: Event) { return !!surface && event.composedPath().includes(surface.host); }
  function onPointerDown(event: PointerEvent) {
    if (!event.isTrusted || inside(event)) return;
    pointerDown = true;
    selectionChanged = false;
    awaitingPointerSelection = true;
    cancel();
  }
  function onSelectionChange() { if (pointerDown || awaitingPointerSelection) selectionChanged = true; }
  function onPointerUp(event: PointerEvent) {
    if (!event.isTrusted || inside(event)) return;
    pointerDown = false;
    if (event.button === 0) schedule();
  }
  function onPointerCancel() { pointerDown = false; awaitingPointerSelection = false; }
  function onKeyUp(event: KeyboardEvent) {
    if (event.isTrusted && !inside(event) && (event.shiftKey || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a'))) {
      awaitingPointerSelection = false; schedule();
    }
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && current) { if (inside(event)) { event.preventDefault(); event.stopPropagation(); } cancel(); }
  }
  function onVisibility() { if (document.hidden) cancel(true); }
  let listening = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  function listen(value: boolean) {
    if (listening === value) return;
    listening = value;
    const events = { pointerdown: onPointerDown, pointerup: onPointerUp, pointercancel: onPointerCancel,
      selectionchange: onSelectionChange, keyup: onKeyUp, keydown: onKeyDown, visibilitychange: onVisibility };
    // The handlers keep their browser event types; registration is the same for both paths.
    for (const [name, handler] of Object.entries(events)) {
      if (value) document.addEventListener(name, handler as EventListener, true);
      else document.removeEventListener(name, handler as EventListener, true);
    }
    if (value) {
      window.addEventListener('pagehide', disable);
      poll = setInterval(() => {
        if (lastUrl !== location.href || !valid()) { lastUrl = location.href; disable(); }
        else if (current && !matches(current.identity)) cancel(true);
      }, 250);
    } else { clearInterval(poll); poll = undefined; window.removeEventListener('pagehide', disable); }
  }
  function disable() {
    cancel(true); enabled = null; pointerDown = false;
    awaitingPointerSelection = false; selectionChanged = false; listen(false);
  }

  return {
    handle(command: TextPageCommand) {
      if (command.type === 'CANCEL_TEXT') { if (enabled?.sessionId === command.sessionId) cancel(true); return { ok: true }; }
      if (command.type === 'DISABLE_TEXT') { if (enabled?.sessionId === command.sessionId) disable(); return { ok: true }; }
      if (command.type === 'ENABLE_TEXT') {
        if (enabled?.sessionId !== command.sessionId && mode === 'requesting') cancel(true);
        // A new worker may rebind a still-valid local offer or unsent draft.
        // Pending requests are cancelled above; passage text is never persisted.
        if (command.resumeDraft && current && current.identity.pageKey === pageKey() && sameSelectedText(current.range, current.text)) {
          current.identity.sessionId = command.sessionId;
          if (enabled) enabled.sessionId = command.sessionId;
        }
        if (enabled?.sessionId !== command.sessionId) cancel();
        enabled = command; lastUrl = location.href;
        listen(true);
        const ask = surface?.shadow.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (ask) ask.disabled = !command.consent;
        const note = surface?.shadow.querySelector('.note');
        if (note && mode === 'composing') note.textContent = command.consent
          ? 'Only this passage and your question are sent.' : 'Turn on Selected-text assistance in Settings to ask.';
        return { ok: true, pageKey: pageKey(), selectionId: current?.identity.selectionId };
      }
      if (!matches(command)) return { ok: false };
      if (command.type === 'CHECK_TEXT') return { ok: true, selectedText: current!.text };
      const result: TextResult | undefined = command.result;
      const text = result?.kind === 'explanation' ? result.quickExplanation : result?.message ?? command.error ?? 'The explanation is unavailable.';
      mode = 'reply'; showMessage(text, true);
      return { ok: true };
    },
    disable,
    dispose() {
      disable(); clearInterval(poll); clearTimeout(completionTimer);
    },
  };
}
