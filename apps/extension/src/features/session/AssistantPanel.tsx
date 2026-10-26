import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { useGuidanceSession } from './useGuidanceSession';
import { useConversation } from './useConversation';

type Session = ReturnType<typeof useGuidanceSession>;

function guidanceStatus({ state, connected }: Session): string {
  switch (state.kind) {
    case 'idle': case 'answer': case 'clarification': case 'unsupported': return '';
    case 'observing': return 'Checking this page…';
    case 'selecting': return 'Thinking…';
    case 'highlighting': return 'Finding the right control…';
    case 'verifying': return 'Checking your step…';
    case 'waiting': return `Step ${state.stepNumber ?? 1} · Waiting for you`;
    case 'connection_paused': return connected ? 'Connected again. Continue when you’re ready.' : 'Reconnecting… Your goal is still here.';
    case 'stopped': return 'Stopped.';
    default: return state.message;
  }
}

export function AssistantPanel({ session, live, visible, onSettings }: {
  session: Session; live: boolean; visible: boolean; onSettings: () => void;
}) {
  const [question, setQuestion] = useState('');
  const { messages, source, addQuestion } = useConversation(session, live);
  const scrollArea = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const lastQuestion = useRef('');
  const { state, textState, controller, textController, connected, guidanceConsent } = session;
  const isText = source === 'text';
  const textActive = isText && ['selected', 'composing', 'requesting', 'answered', 'error'].includes(textState.kind);
  const busy = ['observing', 'selecting', 'highlighting', 'verifying', 'navigating'].includes(state.kind);
  const continuing = 'canContinue' in state && state.canContinue && controller.current?.isActive();
  const canStop = isText ? ['selected', 'composing', 'requesting', 'error'].includes(textState.kind)
    : busy || ['waiting', 'recovery', 'paused', 'connection_paused', 'clicked'].includes(state.kind);
  const canRetry = isText ? textState.kind === 'error' && textState.canRetry
    : state.kind === 'error' || state.kind === 'recovery';
  const canComplete = !isText && ['waiting', 'recovery', 'clicked'].includes(state.kind);
  const status = isText ? (textState.kind === 'answered' ? '' : textState.message) : guidanceStatus(session);
  const isError = isText ? textState.kind === 'error' : state.kind === 'error';
  const showStatus = !!status && (messages.length > 0 || textActive || isError || state.kind === 'connection_paused');

  useEffect(() => {
    if (visible && followLatest.current && scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [messages, status, visible]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = question.trim();
    if (!value || !guidanceConsent || !connected || !live) return;
    followLatest.current = true;
    lastQuestion.current = value;
    addQuestion(value); setQuestion('');
    void controller.current?.start(value);
  }

  return <section className="chat-workspace" aria-label="Ask ClickPilot">
    <div className="conversation" ref={scrollArea} onScroll={() => {
      const element = scrollArea.current;
      if (element) followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 60;
    }}>
      {messages.length === 0 && !textActive && <div className="chat-empty">
        <h1>What can I help<br />you with?</h1>
        <p>Ask about this page.<br />I’ll help you find your way.</p>
      </div>}
      <div className="chat-messages" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
        {messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}>
          <span className="visually-hidden">{message.role === 'user' ? 'You' : 'ClickPilot'}: </span>
          {message.source === 'text' && message.role === 'user' && <span className="message-context">Selected text</span>}
          <p>{message.text}</p>
        </div>)}
      </div>
      {session.restartNotice && <p className="chat-notice">Task restored. Continue when you’re ready.</p>}
      {!session.storageAvailable && <p className="chat-notice">Keep this panel open. ClickPilot couldn’t save a restart reminder.</p>}
    </div>

    <div className="chat-bottom">
      {showStatus && <p className={`chat-status${isError ? ' error' : ''}`} role={isError ? 'alert' : 'status'}>{status}</p>}
      {!connected && <p className="chat-status" aria-live="polite">Reconnecting… <button className="text-button" onClick={session.reconnect}>Reconnect</button></p>}
      {(canStop || canRetry || continuing || canComplete) && <div className="chat-actions">
        {canStop && <button className="text-button" onClick={() => { textController.current?.stop(); controller.current?.stop(); }}>Stop</button>}
        {canRetry && <button className="text-button" disabled={!connected || !(isText ? session.textConsent : guidanceConsent)} onClick={() => {
          if (isText) textController.current?.retry();
          else if (controller.current?.isActive()) void controller.current.retry();
          else if (lastQuestion.current) void controller.current?.start(lastQuestion.current);
        }}>Retry</button>}
        {!isText && continuing && <button className="text-button" disabled={!guidanceConsent || !connected} onClick={() => {
          if (state.kind === 'recovery') void controller.current?.continueManually(); else void controller.current?.continueTask();
        }}>Continue</button>}
        {canComplete && <button className="text-button" onClick={() => controller.current?.confirmComplete()}>Done</button>}
      </div>}
      <form className="chat-composer" onSubmit={submit}>
        <label htmlFor="assistant-question" className="visually-hidden">What would you like help with?</label>
        <textarea id="assistant-question" rows={2} required maxLength={240} value={question}
          placeholder="Ask ClickPilot…" onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault(); event.currentTarget.form?.requestSubmit();
            }
          }} />
        <button type="submit" className="send-button" aria-label="Send message" disabled={!question.trim() || !guidanceConsent || !connected || !live}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
        </button>
      </form>
      {!guidanceConsent ? <p className="composer-note">Webpage sharing is off. <button className="text-button" onClick={onSettings}>Settings</button></p>
        : <p className="composer-note">You make every click.</p>}
    </div>
  </section>;
}
