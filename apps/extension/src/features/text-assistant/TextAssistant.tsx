import type { TextState, createTextSession } from './session';

export function TextAssistant({ state, controller, consent }: {
  state: TextState;
  controller: ReturnType<typeof createTextSession> | null;
  consent: boolean;
}) {
  const result = state.result;
  return <section className="text-assistant" aria-label="Selected text assistant">
    <h2>Ask about selected text</h2>
    <p className="text-disclosure">Select public webpage text and ask a question beside it. Only that passage (up to 2,000 characters) and your question go through the local backend to Gemini. Filtering is limited; avoid personal information. Unpaid API usage may be used to improve Google’s products. No history is kept.</p>
    {!consent && <p className="sharing-note">Selected-text sharing is off. You can turn it on in Settings.</p>}
    <div className="text-reply" aria-live={state.kind === 'error' ? 'assertive' : 'polite'} role="region" aria-label="Text explanation">
      {state.question && <p className="assistant-question">You asked: {state.question}</p>}
      <p>{result?.kind === 'explanation' ? result.detailedExplanation : result?.message ?? state.message}</p>
    </div>
    <div className="guidance-actions">
      <button className="text-button" onClick={() => controller?.stop()} disabled={state.kind === 'stopped'}>Stop text assistant</button>
      <button className="text-button" onClick={() => controller?.enable()}>Resume text assistant</button>
      {state.kind === 'error' && state.canRetry && <button className="text-button" disabled={!consent} onClick={() => controller?.retry()}>Retry explanation</button>}
    </div>
  </section>;
}
