import { useEffect, useRef, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';
import { createAssistantSession, createMockSession, type GuidanceState } from './session';
import type { AssistantRequest } from '../../lib/assistant';

function askThroughPanel(port: Browser.runtime.Port, request: AssistantRequest, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    function cleanup() { port.onMessage.removeListener(receive); signal.removeEventListener('abort', cancel); }
    function cancel() {
      cleanup();
      try { port.postMessage({ type: 'CANCEL_ASSISTANT', sessionId: request.sessionId, requestId: request.requestId }); } catch { /* The port may already be closed. */ }
      reject(new Error('The request was cancelled.'));
    }
    function receive(value: unknown) {
      if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'ASSISTANT_RESULT'
        || !('sessionId' in value) || value.sessionId !== request.sessionId || !('requestId' in value) || value.requestId !== request.requestId) return;
      cleanup();
      if ('error' in value && typeof value.error === 'string' && value.error.length <= 240) reject(new Error(value.error));
      else resolve('value' in value ? value.value : null);
    }
    port.onMessage.addListener(receive);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    try { port.postMessage(request); } catch { cleanup(); reject(new Error('The assistant connection closed. Reopen the panel.')); }
  });
}

export function useGuidanceSession(live: boolean) {
  const [state, setState] = useState<GuidanceState>({ kind: 'idle' });
  const [connected, setConnected] = useState(true);
  const controller = useRef<ReturnType<typeof createMockSession> | null>(null);
  const connection = useRef<Browser.runtime.Port | null>(null);

  useEffect(() => {
    const port = browser.runtime.connect({ name: 'clickpilot-panel' });
    let trackedTabId: number | undefined;
    connection.current = port;
    const session = (live ? createAssistantSession : createMockSession)({
      ask: (tabId, snapshot, task, identity, signal) => askThroughPanel(port, { type: 'ASK_ASSISTANT', tabId, pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId, userGoal: task, ...identity }, signal),
      inspect: (requestId) => browser.runtime.sendMessage({ type: 'INSPECT_ACTIVE_TAB', requestId }),
      track: (tabId) => { trackedTabId = tabId; port.postMessage({ type: 'TRACK_PAGE', tabId }); },
      highlight: (tabId, snapshot, targetId, instruction, guidance) => browser.runtime.sendMessage({
        type: 'HIGHLIGHT_ELEMENT', tabId, pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId,
        targetId, instruction, guidance,
      }),
      clear: (tabId, snapshotId) => browser.runtime.sendMessage({ type: 'STOP_INSPECTION', tabId, snapshotId }),
    }, setState);
    controller.current = session;

    const onDisconnect = () => {
      connection.current = null;
      setConnected(false);
      session.pause('The page connection closed. Reopen the panel to continue.');
    };
    const onMessage = (message: unknown, sender: Browser.runtime.MessageSender) => {
      if (sender.id !== browser.runtime.id || sender.tab?.id === undefined || sender.frameId !== 0) return;
      session.onPageEvent(message, sender.tab.id);
    };
    const onTabActivated = () => {
      if (session.isActive() || trackedTabId !== undefined) {
        trackedTabId = undefined;
        session.pause('Tab changed. Activate the fixture tab with the toolbar icon, then Retry.');
      }
    };
    const onTabUpdated = (tabId: number, change: { url?: string; status?: string }) => {
      if (tabId === trackedTabId && (change.url || change.status === 'loading')) {
        session.pause('Page changed. Return to the fixture and Retry.');
      }
    };
    const onPageHide = () => { session.dispose(); port.disconnect(); };
    port.onDisconnect.addListener(onDisconnect);
    browser.runtime.onMessage.addListener(onMessage);
    browser.tabs.onActivated.addListener(onTabActivated);
    browser.tabs.onUpdated.addListener(onTabUpdated);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      session.dispose();
      controller.current = null;
      connection.current = null;
      port.onDisconnect.removeListener(onDisconnect);
      port.disconnect();
      browser.runtime.onMessage.removeListener(onMessage);
      browser.tabs.onActivated.removeListener(onTabActivated);
      browser.tabs.onUpdated.removeListener(onTabUpdated);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [live]);

  return { state, connected, controller, connection };
}
