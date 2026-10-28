import { containsSensitiveText } from '@clickpilot/shared/privacy';
import { createAssistantSession, type SessionClient } from './session';
import { createTextSession } from '../text-assistant/session';
import { TASK_TTL_MS, type TaskRecovery } from './task-recovery';
import type { AiPreferences } from '../../lib/preferences';
import type { TaskCommand, TaskView, SharedMessage } from '../../lib/task-messages';
import type { TextCommand } from '../../lib/text-assistant';

export interface TabFlags { buddyVisible: boolean; textEnabled: boolean }
interface CoordinatorClient {
  guidance: SessionClient;
  textPost: (message: unknown) => void;
  askText: (command: TextCommand, signal: AbortSignal) => Promise<unknown>;
  save: (value: TaskRecovery | null) => Promise<void>;
  saveFlags: (flags: TabFlags) => Promise<void>;
}

export function createTaskCoordinator(tabId: number, client: CoordinatorClient, preferences: AiPreferences,
  flags: TabFlags, saved: TaskRecovery | null = null) {
  const listeners = new Set<(view: TaskView) => void>();
  const seenCommands = new Set<string>();
  let disposed = false;
  let initializing = true;
  let expiresAt = saved?.expiresAt ?? Date.now() + TASK_TTL_MS;
  let lastReply = saved?.summary ?? '';
  let messageId = 0;
  let textQuestion: string | undefined;
  const view: TaskView = {
    type: 'TASK_VIEW', version: 1, tabId, epoch: crypto.randomUUID(), taskId: crypto.randomUUID(), revision: 0,
    goal: '', state: { kind: 'idle' }, textState: { kind: 'idle', message: 'Select public text to ask about it.' }, messages: [],
    source: 'guidance', active: false, ...flags, storageAvailable: true,
    guidanceConsent: preferences.guidance, textConsent: preferences.selectedText, recovered: Boolean(saved),
  };
  function publish() {
    if (disposed) return;
    view.revision++;
    for (const receive of listeners) receive(structuredClone(view));
  }
  function append(role: SharedMessage['role'], text: string, source: SharedMessage['source']) {
    view.messages = [...view.messages.slice(-79), { id: ++messageId, role, text, source }];
  }
  function summary() {
    const value = lastReply.replace(/\p{Cc}|[<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
    return value && !containsSensitiveText(value) ? value : undefined;
  }
  async function persist() {
    if (initializing || disposed) return true;
    const recovery = guidance.recovery();
    try {
      await client.save(recovery ? { version: 1, tabId, ...recovery, expiresAt, ...(summary() ? { summary: summary() } : {}) } : null);
      if (!view.storageAvailable) { view.storageAvailable = true; publish(); }
      return true;
    } catch {
      view.storageAvailable = false; publish(); return false;
    }
  }
  function saveFlags() {
    void client.saveFlags({ buddyVisible: view.buddyVisible, textEnabled: view.textEnabled }).catch(() => {
      view.storageAvailable = false; publish();
    });
  }
  const guidance = createAssistantSession({
    ...client.guidance,
    checkpoint: async () => {
      if (!await persist()) throw new Error('Klicko couldn’t save this task safely. Stop and try a public question again.');
      return true;
    },
    endCheckpoint: () => { if (!initializing) void client.save(null).catch(() => { view.storageAvailable = false; publish(); }); },
  }, (state) => {
    view.state = state; view.active = guidance.isActive();
    if (state.kind === 'waiting' || state.kind === 'answer' || state.kind === 'clarification' || state.kind === 'unsupported') {
      view.source = 'guidance';
      const text = state.kind === 'waiting' ? (state.message && state.message !== state.instruction
        ? `${state.message}\n\n${state.instruction}` : state.instruction) : state.message;
      lastReply = text; append('assistant', text, 'guidance');
    }
    if (!initializing) { publish(); void persist(); }
  });
  const text = createTextSession({
    post: client.textPost, ask: client.askText,
    interruptGuidance: () => {
      view.taskId = crypto.randomUUID(); view.source = 'text'; view.goal = ''; lastReply = '';
      guidance.stop();
    },
  }, (state) => {
    view.textState = state;
    if (!state.question) textQuestion = undefined;
    if (state.kind === 'composing' || state.kind === 'requesting' || state.kind === 'answered') view.source = 'text';
    if ((state.kind === 'requesting' || state.kind === 'answered') && state.question && state.question !== textQuestion) {
      view.goal = state.question; append('user', state.question, 'text'); textQuestion = state.question;
    }
    if (state.kind === 'answered' && state.result) append('assistant', state.result.kind === 'explanation'
      ? state.result.detailedExplanation : state.result.message, 'text');
    view.active = view.source === 'text' ? ['selected', 'composing', 'requesting'].includes(state.kind) : guidance.isActive();
    if (!initializing) publish();
  });
  // Arm only after a page view attaches, so toolbar injection has one owner.
  text.stop();
  text.setConsent(preferences.selectedText);
  if (saved && preferences.guidance) {
    view.goal = saved.goal; append('user', saved.goal, 'guidance');
    if (saved.summary) append('assistant', `Earlier reply (summary): ${saved.summary}`, 'guidance');
    guidance.restore(saved, tabId);
  }
  initializing = false;

  function stop(clearMessages = false) {
    view.taskId = crypto.randomUUID(); view.recovered = false; view.goal = ''; lastReply = '';
    guidance.stop(); text.stop();
    if (view.textEnabled) text.enable();
    if (clearMessages) view.messages = [];
    saveFlags(); publish();
  }
  function expired() {
    if (!guidance.isActive() || Date.now() < expiresAt) return false;
    stop(); view.state = { kind: 'paused', message: 'This task expired. Enter your goal to start again.' }; publish(); return true;
  }
  return {
    snapshot: () => structuredClone(view),
    error(message: string) { view.state = { kind: 'error', message }; publish(); },
    subscribe(receive: (state: TaskView) => void) { listeners.add(receive); receive(structuredClone(view)); return () => { listeners.delete(receive); }; },
    async command(command: TaskCommand) {
      if (disposed || command.epoch !== view.epoch || command.taskId !== view.taskId || seenCommands.has(command.id)) { publish(); return; }
      seenCommands.add(command.id);
      if (seenCommands.size > 64) seenCommands.delete(seenCommands.values().next().value!);
      if (expired() && command.action !== 'start') return;
      switch (command.action) {
        case 'start':
          if (!preferences.guidance || !command.goal || containsSensitiveText(command.goal)) {
            view.state = { kind: 'error', message: preferences.guidance ? 'Use a public question without sensitive information.' : 'Webpage sharing is off. Open Settings to enable it.' }; publish(); return;
          }
          view.taskId = crypto.randomUUID(); view.source = 'guidance'; view.goal = command.goal.trim();
          view.recovered = false; expiresAt = Date.now() + TASK_TTL_MS; lastReply = '';
          text.stop(); if (view.textEnabled) text.enable();
          append('user', view.goal, 'guidance');
          void guidance.start(view.goal); break;
        case 'stop': case 'new-chat': stop(command.action === 'new-chat'); break;
        case 'done':
          view.taskId = crypto.randomUUID(); guidance.confirmComplete(); text.stop();
          view.goal = ''; lastReply = ''; if (view.textEnabled) text.enable(); saveFlags(); publish(); break;
        case 'retry':
          view.recovered = false;
          if (view.source === 'text') text.retry();
          else if (preferences.guidance && guidance.isActive()) void guidance.retry();
          else if (preferences.guidance && view.goal) { view.taskId = crypto.randomUUID(); expiresAt = Date.now() + TASK_TTL_MS; void guidance.start(view.goal); }
          break;
        case 'continue': view.recovered = false; if (preferences.guidance) void guidance.continueTask(); break;
        case 'continue-manually': view.recovered = false; if (preferences.guidance) void guidance.continueManually(); break;
        case 'text-enable': view.textEnabled = true; text.enable(); saveFlags(); publish(); break;
        case 'text-stop': view.textEnabled = false; text.stop(); saveFlags(); publish(); break;
        case 'hide':
          view.buddyVisible = false; view.textEnabled = false; text.stop();
          if (guidance.isActive()) guidance.suspend('Buddy hidden. Continue from the sidebar or reactivate Klicko when ready.');
          saveFlags(); publish(); break;
      }
    },
    activate(notice?: string) {
      view.buddyVisible = true; view.textEnabled = true;
      view.activationNotice = notice;
      saveFlags(); publish();
    },
    deactivate() {
      view.buddyVisible = false; view.textEnabled = false;
      stop();
    },
    accessLost() {
      view.buddyVisible = false; view.textEnabled = false; text.invalidate();
      if (guidance.isActive()) guidance.suspend('Website access was lost. Activate Klicko on a supported page, then Continue.');
      saveFlags(); publish();
    },
    reconnectText() { if (view.textEnabled) text.enable(); },
    textPortMessage: (value: unknown) => { if (!disposed) text.onPortMessage(value); },
    pageEvent(value: unknown, senderTab: number) {
      if (disposed || senderTab !== tabId || expired()) return;
      text.onPageEvent(value, senderTab); guidance.onPageEvent(value, senderTab);
    },
    navigation(sameOrigin: boolean) {
      if (disposed || expired()) return;
      text.invalidate(); guidance.navigation(tabId, sameOrigin);
    },
    resumeNavigation: () => { if (!disposed && !expired()) void guidance.resumeNavigation(); },
    pauseForTabChange() {
      text.pauseSelection();
      if (guidance.isActive()) guidance.suspend('Tab changed. Return to this task’s tab, then Continue.');
    },
    preferences(next: AiPreferences) {
      const revokedGuidance = preferences.guidance && !next.guidance;
      const revokedText = preferences.selectedText && !next.selectedText;
      preferences = next; view.guidanceConsent = next.guidance; view.textConsent = next.selectedText;
      if (revokedGuidance) { view.taskId = crypto.randomUUID(); guidance.stop(); view.goal = ''; lastReply = ''; }
      if (revokedText) text.stop();
      text.setConsent(next.selectedText); publish();
      if (view.textEnabled && revokedText) text.enable();
    },
    dispose() { stop(); disposed = true; text.dispose(); guidance.dispose(); listeners.clear(); },
  };
}
export type TaskCoordinator = ReturnType<typeof createTaskCoordinator>;
