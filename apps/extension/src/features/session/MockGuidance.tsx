import { useRef, useState, type FormEvent } from 'react';
import type { GuidanceState } from './session';
import { useGuidanceSession } from './useGuidanceSession';
import type { MockScenario } from './mock';

function statusText(state: GuidanceState): string {
  switch (state.kind) {
    case 'idle': return 'Ready for a fixture task. Nothing happens on the page until you act.';
    case 'observing': return state.attempt === 0 ? 'Observing the activated page…' : 'Refreshing once to check the target again…';
    case 'selecting': return 'Choosing a target with the local mock…';
    case 'highlighting': return 'Checking the target before highlighting…';
    case 'waiting': return `${state.instruction} Waiting for you to act.`;
    default: return state.message;
  }
}

export function MockGuidance() {
  const [question, setQuestion] = useState('');
  const [scenario, setScenario] = useState<MockScenario>('normal');
  const { state, connected, controller, connection } = useGuidanceSession(false);
  const previousTask = useRef<{ question: string; scenario: MockScenario } | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection.current) return;
    previousTask.current = { question: question.trim(), scenario };
    void controller.current?.start(question.trim(), scenario);
  }

  function retry() {
    const previous = previousTask.current;
    if (previous && connection.current) void controller.current?.start(previous.question, previous.scenario);
  }

  const busy = ['observing', 'selecting', 'highlighting'].includes(state.kind);
  const canStop = busy || state.kind === 'waiting';
  const canRetry = previousTask.current !== null && !busy && state.kind !== 'waiting';
  return (
    <>
      <section className="welcome guidance-welcome" aria-labelledby="guidance-title">
        <h1 id="guidance-title">Find your next click.</h1>
        <p>Mock mode uses a few fixed tasks on our local fixture. You make every click; no AI service is connected.</p>
      </section>
      <form className="guidance-form" onSubmit={submit}>
        <label htmlFor="guidance-question">What do you want to find?</label>
        <textarea id="guidance-question" rows={3} maxLength={240} required value={question}
          placeholder="Try: find primary target" onChange={(event) => setQuestion(event.target.value)} />
        <button className="primary-button" type="submit" disabled={!question.trim() || !connected}>
          {canStop ? 'Replace guidance' : 'Start mock guidance'}
        </button>
      </form>
      <section className="guidance-progress" aria-label="Guidance progress">
        <p className="guidance-state" role={state.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{statusText(state)}</p>
        <div className="guidance-actions">
          <button className="text-button" onClick={() => controller.current?.stop()} disabled={!canStop}>Stop</button>
          <button className="text-button" onClick={retry} disabled={!canRetry || !connected}>Retry</button>
        </div>
      </section>
      <details className="mock-examples" open>
        <summary>Fixture and supported tasks</summary>
        <p>Open <code>http://127.0.0.1:4173/guidance.html</code> and click the ClickPilot toolbar icon on that tab.</p>
        <p>Try “find primary target”, “find profile”, “open help”, “find navigation settings”, or “find dialog settings”. “Find settings” asks you to choose between the two controls.</p>
      </details>
      <details className="mock-scenarios">
        <summary>Mock test scenarios</summary>
        <label htmlFor="mock-scenario">Behavior for the next submitted task</label>
        <select id="mock-scenario" value={scenario} onChange={(event) => setScenario(event.target.value as MockScenario)}>
          <option value="normal">Normal</option>
          <option value="delayed">Delay selection by 2 seconds</option>
          <option value="stale-once">Stale target once, then recover</option>
          <option value="stale-always">Stale target on both attempts</option>
          <option value="invalid-output">Invalid mock output</option>
        </select>
        <p>These local scenarios test cancellation and failure handling. Retry repeats the last submitted task and scenario.</p>
      </details>
    </>
  );
}
