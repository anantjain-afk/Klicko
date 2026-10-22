import { validateGuidanceResponse } from '@clickpilot/shared/guidance';
import { eligibleElements } from '@clickpilot/shared/privacy';
import { isGuidanceClick, isInspectionResponse, isOverlayResponse, isPageInvalidation,
  type GuidanceIdentity, type PageSnapshot } from '../../lib/messages';
import { isMockSelection, mockSelection, type MockScenario } from './mock';

export type GuidanceState =
  | { kind: 'idle' }
  | { kind: 'observing' | 'selecting' | 'highlighting'; attempt: number }
  | { kind: 'waiting'; instruction: string; message?: string }
  | { kind: 'answer' | 'clicked' | 'clarification' | 'unsupported' | 'paused' | 'error' | 'stopped'; message: string };

export interface SessionClient {
  ask?: (tabId: number, snapshot: PageSnapshot, task: string, identity: GuidanceIdentity, signal: AbortSignal) => Promise<unknown>;
  inspect: (requestId: number) => Promise<unknown>;
  track: (tabId: number) => void;
  highlight: (tabId: number, snapshot: PageSnapshot, targetId: string, instruction: string, identity: GuidanceIdentity) => Promise<unknown>;
  clear: (tabId: number, snapshotId: string) => Promise<unknown>;
}

interface ActiveRun extends GuidanceIdentity {
  abort: AbortController;
  tabId?: number;
  snapshot?: PageSnapshot;
  targetId?: string;
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
    const run: ActiveRun = { sessionId: crypto.randomUUID(), requestId: ++requestNumber, abort: new AbortController() };
    active = run;
    if (!task.trim() || task.length > 240) { pause('Enter a fixture task using at most 240 characters.'); return; }
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
        run.tabId = response.tabId;
        run.snapshot = response.snapshot;
        client.track(response.tabId);
        transition({ kind: 'selecting', attempt });
        let selection: { kind: 'highlight'; targetId: string; instruction: string; message?: string };
        if (live) {
          if (!client.ask) throw new Error('The assistant connection is unavailable.');
          const identity = { sessionId: run.sessionId, requestId: run.requestId };
          const value = await client.ask(response.tabId, response.snapshot, task, identity, run.abort.signal);
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
            { sessionId: run.sessionId, requestId: run.requestId });
          if (active !== run) return;
          if (!isOverlayResponse(result)) { pause('The highlight response was invalid. Retry the request.'); return; }
          if (result.ok) { transition({ kind: 'waiting', instruction: selection.instruction, ...(selection.message ? { message: selection.message } : {}) }); return; }
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
    if (!isPageInvalidation(message) && !isGuidanceClick(message)) return;
    if (message.pageKey !== run.snapshot.pageKey || message.snapshotId !== run.snapshot.snapshotId) return;
    if (message.type === 'SNAPSHOT_INVALIDATED') { pause('The page changed or the snapshot expired. Return to the fixture and Retry.'); return; }
    if (message.targetId !== run.targetId) return;
    if (message.type === 'OVERLAY_INVALIDATED') {
      if (state.kind === 'waiting') pause('The target is no longer visible or available. Restore it and Retry.');
      return;
    }
    if (message.sessionId !== run.sessionId || message.requestId !== run.requestId) return;
    if (state.kind !== 'waiting' && state.kind !== 'highlighting') return;
    cancel();
    transition({ kind: 'clicked', message: 'Click observed. ClickPilot has not verified that the task is complete.' });
  }

  return {
    start, onPageEvent, pause,
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
