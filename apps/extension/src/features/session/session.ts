import { MAX_STEPS, OBSERVATION_MS, type TaskContext, type ExpectedOutcome, type AssistantResult, validateGuidanceResponse } from '@clickpilot/shared/guidance';
import { eligibleElements } from '@clickpilot/shared/privacy';
import { isActionObservation, isGuidanceClick, isInspectionResponse, isOverlayResponse, isPageInvalidation,
  type GuidanceIdentity, type PageSnapshot } from '../../lib/messages';
import { isMockSelection, mockSelection, type MockScenario } from './mock';

export type GuidanceState =
  | { kind: 'idle' }
  | { kind: 'observing' | 'selecting' | 'highlighting'; attempt: number }
  | { kind: 'waiting'; instruction: string; message?: string; stepNumber?: number; nextStep?: 'none' | 'after_user_action'; previousStatus?: string }
  | { kind: 'verifying' | 'recovery' | 'confirmed' | 'answer' | 'clicked' | 'clarification' | 'unsupported' | 'paused' | 'error' | 'stopped'; message: string; canContinue?: boolean };

export interface SessionClient {
  ask?: (tabId: number, snapshot: PageSnapshot, task: string, identity: GuidanceIdentity, signal: AbortSignal, context: TaskContext) => Promise<unknown>;
  inspect: (requestId: number) => Promise<unknown>;
  track: (tabId: number) => void;
  highlight: (tabId: number, snapshot: PageSnapshot, targetId: string, instruction: string, identity: GuidanceIdentity & { observe?: boolean; expectedOutcome?: ExpectedOutcome }) => Promise<unknown>;
  clear: (tabId: number, snapshotId: string) => Promise<unknown>;
}

interface ActiveRun extends GuidanceIdentity {
  abort: AbortController;
  tabId?: number;
  snapshot?: PageSnapshot;
  targetId?: string;
  task: string;
  context: TaskContext;
  selection?: Extract<AssistantResult, { kind: 'guidance' }>;
  lastFingerprint?: string;
  scenario: MockScenario;
  observationTimeout?: ReturnType<typeof setTimeout>;
}

const INSPECTION_ERRORS = {
  'no-tab': 'No active tab was found. Open the fixture and try again.',
  unsupported: 'This page cannot be inspected. Open the local guidance fixture.',
  reactivate: 'Click the ClickPilot toolbar icon on this tab to grant access, then Retry.',
  changed: 'The page changed during inspection. Return to the fixture and Retry.',
};

// The panel owns one active run. Async replies can change state only while
// their run is current; clearing an old snapshot cannot erase a newer one.
function createSession(client: SessionClient, onChange: (state: GuidanceState) => void, live: boolean) {
  let state: GuidanceState = { kind: 'idle' };
  let active: ActiveRun | null = null;
  let requestNumber = 0;

  function transition(next: GuidanceState) { state = next; onChange(next); }
  function release(run: ActiveRun) {
    run.abort.abort();
    clearTimeout(run.observationTimeout);
    if (run.tabId !== undefined && run.snapshot) void client.clear(run.tabId, run.snapshot.snapshotId).catch(() => undefined);
  }
  function cancel() {
    const previous = active;
    active = null;
    if (previous) release(previous);
  }
  function pause(message: string) { cancel(); transition({ kind: 'paused', message }); }

  async function start(task: string, scenario: MockScenario = 'normal') {
    cancel();
    if (!task.trim() || task.length > 240) { pause('Enter a task using at most 240 characters.'); return; }
    const run: ActiveRun = { sessionId: crypto.randomUUID(), requestId: ++requestNumber,
      abort: new AbortController(), task: task.trim(), scenario, context: { stepNumber: 1, previousStep: null } };
    active = run;
    await requestStep(run);
  }

  async function requestStep(run: ActiveRun) {
    const { task, scenario } = run;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        run.requestId = ++requestNumber;
        run.targetId = undefined;
        transition({ kind: 'observing', attempt });
        const response: unknown = await client.inspect(run.requestId);
        if (active !== run) {
          if (isInspectionResponse(response) && response.type === 'INSPECTION_RESULT') {
            void client.clear(response.tabId, response.snapshot.snapshotId).catch(() => undefined);
          }
          return;
        }
        if (!isInspectionResponse(response) || response.requestId !== run.requestId) {
          pause('The inspection response was invalid. Retry the request.'); return;
        }
        if (response.type === 'INSPECTION_ERROR') { pause(INSPECTION_ERRORS[response.reason]); return; }
        if (run.tabId !== undefined && (run.tabId !== response.tabId || run.snapshot?.pageKey !== response.snapshot.pageKey)) {
          void client.clear(response.tabId, response.snapshot.snapshotId).catch(() => undefined);
          pause('Page changed. Start a new task on the current page.'); return;
        }
        run.tabId = response.tabId;
        run.snapshot = response.snapshot;
        client.track(response.tabId);
        transition({ kind: 'selecting', attempt });
        let selection: { kind: 'highlight'; targetId: string; instruction: string; message?: string };
        if (live) {
          if (!client.ask) throw new Error('The assistant connection is unavailable.');
          const identity = { sessionId: run.sessionId, requestId: run.requestId };
          const value = await client.ask(response.tabId, response.snapshot, task, identity, run.abort.signal, structuredClone(run.context));
          if (active !== run) return;
          const reply = validateGuidanceResponse(value, { ...identity, page: response.snapshot },
            eligibleElements(response.snapshot.elements).map((element) => element.id));
          if (!reply) {
            cancel(); transition({ kind: 'error', message: 'The AI reply was invalid or stale. Nothing was displayed.' }); return;
          }
          if (reply.result.kind !== 'guidance') {
            // Retain snapshot tracking so navigation also invalidates text-only replies.
            transition({ kind: reply.result.kind, message: reply.result.message }); return;
          }
          const chosen = response.snapshot.elements.find((element) => reply.result.kind === 'guidance' && element.id === reply.result.targetId);
          const fingerprint = JSON.stringify([chosen?.role, chosen?.name, chosen?.context, reply.result.instruction,
            eligibleElements(response.snapshot.elements).map(({ role, name, context }) => ({ role, name, context }))]);
          if (run.lastFingerprint === fingerprint && attempt === 0) {
            transition({ kind: 'recovery', message: 'The same guidance repeated without new page evidence. Retry or start a new task.' }); return;
          }
          run.lastFingerprint = fingerprint;
          run.selection = reply.result;
          selection = { ...reply.result, kind: 'highlight' };
        } else {
          const mock: unknown = await mockSelection(response.snapshot, task, scenario, attempt, run.abort.signal);
          if (active !== run) return;
          if (!isMockSelection(mock)) {
            cancel(); transition({ kind: 'error', message: 'The mock returned invalid output. Nothing was highlighted. Retry with the Normal scenario.' }); return;
          }
          if (mock.kind !== 'highlight') {
            cancel(); transition({ kind: mock.kind === 'missing' ? 'paused' : mock.kind, message: mock.message }); return;
          }
          selection = mock;
        }
        const member = response.snapshot.elements.some((element) => element.id === selection.targetId && !element.disabled);
        if (member) {
          run.targetId = selection.targetId;
          transition({ kind: 'highlighting', attempt });
          const result: unknown = await client.highlight(response.tabId, response.snapshot, selection.targetId, selection.instruction,
            { sessionId: run.sessionId, requestId: run.requestId, ...(live ? { observe: true, expectedOutcome: run.selection?.expectedOutcome } : {}) });
          if (active !== run) return;
          if (!isOverlayResponse(result)) { pause('The highlight response was invalid. Retry the request.'); return; }
          if (result.ok) { transition({ kind: 'waiting', instruction: selection.instruction, ...(selection.message ? { message: selection.message } : {}), ...(live ? { stepNumber: run.context.stepNumber, nextStep: run.selection?.nextStep, previousStatus: run.context.previousStep?.status } : {}) }); return; }
        }
        await client.clear(response.tabId, response.snapshot.snapshotId);
        if (active !== run) return;
      }
      pause('The target stayed unavailable after one refresh. Restore the fixture and Retry.');
    } catch (error) {
      if (active === run) {
        cancel(); transition({ kind: 'error', message: live && error instanceof Error && error.message.length <= 240
          ? error.message : 'Could not continue guidance. Check the page connection and Retry.' });
      }
    }
  }

  function onPageEvent(message: unknown, tabId: number) {
    const run = active;
    if (!run?.snapshot || run.tabId !== tabId) return;
    if (!isPageInvalidation(message) && !isGuidanceClick(message) && !isActionObservation(message)) return;
    if (message.pageKey !== run.snapshot.pageKey || message.snapshotId !== run.snapshot.snapshotId) return;
    if (message.type === 'SNAPSHOT_INVALIDATED') { pause('The page changed or the snapshot expired. Return to the fixture and Retry.'); return; }
    if (message.targetId !== run.targetId) return;
    if (message.type === 'OVERLAY_INVALIDATED') {
      if (state.kind === 'waiting') pause('The target is no longer visible or available. Restore it and Retry.');
      return;
    }
    if (message.sessionId !== run.sessionId || message.requestId !== run.requestId) return;
    if (live) {
      if (message.type === 'GUIDANCE_CLICKED') {
        if (state.kind !== 'waiting' && state.kind !== 'highlighting') return;
        run.context.previousStep = { action: run.selection!.instruction, event: 'trusted_click', status: 'pending' };
        transition({ kind: run.selection?.nextStep === 'none' ? 'clicked' : 'verifying',
          message: run.selection?.nextStep === 'none'
            ? 'Click observed. ClickPilot has not verified that the task is complete. No automatic next step.'
            : 'Click observed. Checking the updated page…' });
        run.observationTimeout = setTimeout(() => {
          if (active !== run || (state.kind !== 'verifying' && state.kind !== 'clicked')) return;
          run.context.previousStep!.status = 'unverifiable';
          transition({ kind: 'recovery', canContinue: run.selection?.nextStep === 'after_user_action', message: 'The observation timed out. Retry or continue manually; completion is unverified.' });
        }, OBSERVATION_MS + 1500);
        return;
      }
      if (message.type !== 'ACTION_OBSERVED' || !run.context.previousStep
        || (state.kind !== 'verifying' && state.kind !== 'clicked')) return;
      if (message.status === 'verified' && !run.selection?.expectedOutcome) return;
      clearTimeout(run.observationTimeout);
      run.context.previousStep.status = message.status;
      if (run.selection?.nextStep === 'none') {
        cancel();
        transition({ kind: 'clicked', message: message.status === 'verified'
          ? 'The step outcome was verified. Overall task completion is not verified. No automatic next step.'
          : 'Click observed. ClickPilot has not verified that the task is complete. No automatic next step.' });
        return;
      }
      if (message.status === 'not_verified' || !message.changed) {
        transition({ kind: 'recovery', canContinue: true, message: 'No verified progress was established. Retry or continue manually; task completion is unverified.' }); return;
      }
      void advance(run);
      return;
    }
    if (state.kind !== 'waiting' && state.kind !== 'highlighting') return;
    cancel();
    transition({ kind: 'clicked', message: 'Click observed. ClickPilot has not verified that the task is complete.' });
  }

  async function advance(run: ActiveRun) {
    if (active !== run) return;
    if (run.context.stepNumber >= MAX_STEPS) {
      pause('The 20-step limit was reached. Start a new task to continue. Completion is unverified.'); return;
    }
    const next: ActiveRun = { ...run, abort: new AbortController(),
      context: { stepNumber: run.context.stepNumber + 1, previousStep: run.context.previousStep ? { ...run.context.previousStep } : null },
      targetId: undefined, selection: undefined };
    active = next;
    release(run);
    await requestStep(next);
  }

  return {
    start, onPageEvent, pause,
    async retry() {
      const run = active;
      if (!run || ['observing', 'selecting', 'highlighting', 'verifying'].includes(state.kind)) return;
      const next: ActiveRun = { ...run, abort: new AbortController(), targetId: undefined, selection: undefined, lastFingerprint: undefined,
        context: structuredClone(run.context) };
      active = next;
      release(run);
      await requestStep(next);
    },
    async continueManually() {
      if (!active || state.kind !== 'recovery' || !active.context.previousStep || active.selection?.nextStep !== 'after_user_action') return;
      active.context.previousStep.status = 'user_confirmed';
      await advance(active);
    },
    confirmComplete() {
      if (!active && state.kind !== 'clicked') return;
      cancel(); transition({ kind: 'confirmed', message: 'Task completion confirmed by you.' });
    },
    stop() { cancel(); transition({ kind: 'stopped', message: 'Guidance stopped. Submit a task to start again.' }); },
    dispose: cancel,
    isActive: () => active !== null,
  };
}

export function createMockSession(client: SessionClient, onChange: (state: GuidanceState) => void) {
  return createSession(client, onChange, false);
}

export function createAssistantSession(client: SessionClient, onChange: (state: GuidanceState) => void) {
  return createSession(client, onChange, true);
}
