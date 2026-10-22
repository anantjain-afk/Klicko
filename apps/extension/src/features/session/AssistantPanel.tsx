import { useRef, useState, type FormEvent } from 'react';
import type { GuidanceState } from './session';
import { useGuidanceSession } from './useGuidanceSession';

function replyText(state: GuidanceState): string {
  switch (state.kind) {
    case 'idle': return 'Ask a question about the controls on this page.';
    case 'observing': return state.attempt ? 'Refreshing once to check the target…' : 'Observing the activated page…';
    case 'selecting': return 'Waiting for Gemini…';
    case 'highlighting': return 'Checking the suggested target…';
    case 'waiting': return `${state.message} Waiting for you to act.`;
    default: return state.message;
  }
}

export function AssistantPanel() {
  const { state, connected, controller } = useGuidanceSession(true);
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const submitted = useRef('');
  const busy = ['observing', 'selecting', 'highlighting'].includes(state.kind);
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
      <p>Get an answer or one visual suggestion. You make every click. Each question starts fresh.</p>
    </section>
    <details className="mock-examples" open>
      <summary>What is sent to Gemini?</summary>
      <p>Your question, the site origin and filtered visible control labels are sent through your local backend to Google. No screenshots, input values or conversation history are sent.</p>
      <p>Filtering is limited. Use public pages and avoid personal information. Google’s data handling depends on your API service tier; unpaid usage may be used to improve products.</p>
    </details>
    <form className="guidance-form" onSubmit={submit}>
      <label htmlFor="assistant-question">What would you like help with?</label>
      <textarea id="assistant-question" rows={3} required maxLength={240} value={question}
        placeholder="Where can I open my profile?" onChange={(event) => setQuestion(event.target.value)} />
      <label className="assistant-consent"><input type="checkbox" checked={consent} onChange={(event) => {
        setConsent(event.target.checked);
        if (!event.target.checked) controller.current?.stop();
      }} />Allow this panel to send the described context to Gemini.</label>
      <button type="submit" className="primary-button" disabled={!consent || !question.trim() || !connected}>
        {active ? 'Send new question' : 'Ask Gemini'}
      </button>
    </form>
    <section className="guidance-progress" aria-label="Assistant reply">
      {submitted.current && <p className="assistant-question">You asked: {submitted.current}</p>}
      <p className="guidance-state" role={state.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{replyText(state)}</p>
      <div className="guidance-actions">
        <button className="text-button" disabled={!active && !busy} onClick={() => controller.current?.stop()}>Stop</button>
        <button className="text-button" disabled={!submitted.current || busy || !consent || !connected} onClick={() => {
          void controller.current?.start(submitted.current);
        }}>Retry</button>
      </div>
    </section>
  </>;
}
