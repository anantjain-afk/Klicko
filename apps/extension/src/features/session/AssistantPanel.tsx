import { useRef, useState, type FormEvent } from 'react';
import type { GuidanceState } from './session';
import type { useGuidanceSession } from './useGuidanceSession';

function replyText(state: GuidanceState): string {
  switch (state.kind) {
    case 'idle': return 'Ask a question about the controls on this page.';
    case 'observing': return state.attempt ? 'Refreshing once to check the target…' : 'Observing the activated page…';
    case 'selecting': return 'Waiting for Gemini…';
    case 'highlighting': return 'Checking the suggested target…';
    case 'waiting': return `Step ${state.stepNumber}: ${state.message} Waiting for you to act.${state.nextStep === 'none' ? ' This is the final suggestion; no automatic next step.' : ' I will observe the page before suggesting the next step.'}${state.previousStatus ? ` Previous step: ${state.previousStatus === 'verified' ? 'outcome verified' : state.previousStatus === 'user_confirmed' ? 'confirmed by you' : 'unverified'}.` : ''}`;
    default: return state.message;
  }
}

export function AssistantPanel({ session }: { session: ReturnType<typeof useGuidanceSession> }) {
  const { state, connected, controller, restartNotice, storageAvailable } = session;
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const submitted = useRef('');
  const busy = ['observing', 'selecting', 'highlighting', 'verifying', 'navigating'].includes(state.kind);
  const active = controller.current?.isActive() ?? false;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || !connected) return;
    submitted.current = question.trim();
    void controller.current?.start(submitted.current);
  }

  return <>
    <section className="welcome guidance-welcome" aria-labelledby="assistant-title">
      <h1 id="assistant-title">Ask about this page.</h1>
      <p>Get an answer or guided steps toward your goal. You make every click. A new question starts a new task.</p>
    </section>
    <details className="mock-examples" open>
      <summary>What is sent to Gemini?</summary>
      <p>Your original goal, site origin, fresh filtered control labels, step number and a short last-action status are sent through your local backend to Google. Continuing guidance can send another request after you act. Task context is temporary and clears on Stop. No screenshots, input values or conversation history are sent.</p>
      <p>Filtering is limited. Use public pages and avoid personal information. Google’s data handling depends on your API service tier; unpaid usage may be used to improve products.</p>
    </details>
    <form className="guidance-form" onSubmit={submit}>
      <label htmlFor="assistant-question">What would you like help with?</label>
      <textarea id="assistant-question" rows={3} required maxLength={240} value={question}
        placeholder="Where can I open my profile?" onChange={(event) => setQuestion(event.target.value)} />
      <label className="assistant-consent"><input type="checkbox" checked={consent} onChange={(event) => {
        setConsent(event.target.checked);
        if (!event.target.checked) { submitted.current = ''; controller.current?.stop(); }
      }} />Allow this panel to send the described context to Gemini.</label>
      <button type="submit" className="primary-button" disabled={!consent || !question.trim() || !connected}>
        {active ? 'Send new question' : 'Ask Gemini'}
      </button>
    </form>
    <section className="guidance-progress" aria-label="Assistant reply">
      {restartNotice && <p>Previous task interrupted — enter your goal to restart.</p>}
      {!storageAvailable && <p>Interruption metadata is unavailable. Your goal survives only while this panel stays open.</p>}
      {submitted.current && <p className="assistant-question">You asked: {submitted.current}</p>}
      <p className="guidance-state" role={state.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{replyText(state)}</p>
      <div className="guidance-actions">
        <button className="text-button" disabled={!active && !busy && !restartNotice} onClick={() => { session.textController.current?.stop(); submitted.current = ''; controller.current?.stop(); }}>Stop</button>
        <button className="text-button" disabled={!submitted.current || busy || !consent || !connected} onClick={() => {
          if (active && 'canContinue' in state && state.canContinue && state.kind !== 'recovery') void controller.current?.continueTask();
          else if (active) void controller.current?.retry();
          else void controller.current?.start(question.trim());
        }}>Retry</button>
        {active && 'canContinue' in state && state.canContinue && state.kind !== 'recovery' && <button className="text-button" disabled={!consent || !connected}
          onClick={() => { void controller.current?.continueTask(); }}>Continue task on this page</button>}
        {state.kind === 'recovery' && state.canContinue && <button className="text-button" disabled={!consent || !connected}
          onClick={() => { void controller.current?.continueManually(); }}>Continue manually</button>}
        {(state.kind === 'waiting' || state.kind === 'recovery' || state.kind === 'clicked') && <button className="text-button"
          onClick={() => { submitted.current = ''; controller.current?.confirmComplete(); }}>Confirm task complete</button>}
      </div>
    </section>
  </>;
}
