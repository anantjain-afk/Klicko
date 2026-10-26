import { useEffect, useRef, useState } from 'react';
import type { useGuidanceSession } from './useGuidanceSession';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  source: 'guidance' | 'text';
}

// Display history belongs to this panel document. It is never stored or sent to AI.
export function useConversation(session: ReturnType<typeof useGuidanceSession>, live: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [source, setSource] = useState<'guidance' | 'text'>('guidance');
  const nextId = useRef(0);
  const textQuestion = useRef<string | null>(null);
  const remote = useRef<{ tabId: number; epoch: string; lastId: number } | null>(null);

  useEffect(() => {
    const view = session.sharedView;
    if (!view) return;
    const previous = remote.current;
    const lastId = view.messages.at(-1)?.id ?? 0;
    if (!previous || previous.tabId !== view.tabId) setMessages(view.messages);
    else if (view.messages.length === 0) setMessages([]);
    else if (previous.epoch !== view.epoch) setMessages((current) => current.length ? current : view.messages);
    else {
      const added = view.messages.filter((message) => message.id > previous.lastId);
      if (added.length) setMessages((current) => [...current, ...added]);
    }
    remote.current = { tabId: view.tabId, epoch: view.epoch, lastId };
    setSource(view.source);
  }, [session.sharedView]);

  function append(role: ChatMessage['role'], text: string, source: ChatMessage['source']) {
    const message = { id: ++nextId.current, role, text, source };
    setMessages((previous) => [...previous, message]);
  }

  useEffect(() => {
    if (!live || session.sharedView) return;
    const state = session.state;
    if (state.kind === 'waiting') {
      setSource('guidance');
      const text = state.message && state.message !== state.instruction
        ? `${state.message}\n\n${state.instruction}` : state.instruction;
      append('assistant', text, 'guidance');
    } else if (state.kind === 'answer' || state.kind === 'clarification' || state.kind === 'unsupported') {
      setSource('guidance');
      append('assistant', state.message, 'guidance');
    }
  }, [session.state, session.sharedView, live]);

  useEffect(() => {
    const state = session.textState;
    if (session.sharedView) return;
    if (state.kind === 'composing') setSource('text');
    if (!state.question) textQuestion.current = null;
    if ((state.kind === 'requesting' || state.kind === 'answered') && state.question) {
      setSource('text');
      if (textQuestion.current !== state.question) append('user', state.question, 'text');
      textQuestion.current = state.question;
    }
    if (state.kind === 'answered' && state.result) {
      append('assistant', state.result.kind === 'explanation' ? state.result.detailedExplanation : state.result.message, 'text');
    }
  }, [session.textState, session.sharedView]);

  return { messages, source, addQuestion: (question: string) => {
    if (!session.sharedView) { setSource('guidance'); append('user', question, 'guidance'); }
  } };
}
