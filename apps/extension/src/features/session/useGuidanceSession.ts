import { useEffect, useRef, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';
import { createAssistantSession, createMockSession, type GuidanceState, NAVIGATION_SETTLE_MS } from './session';
import type { AssistantRequest } from '../../lib/assistant';
import type { TextCommand } from '../../lib/text-assistant';
import { createTextSession, type TextState } from '../text-assistant/session';

function askThroughPanel(port: Browser.runtime.Port, request: AssistantRequest | TextCommand, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    function cleanup() { port.onMessage.removeListener(receive); signal.removeEventListener('abort', cancel); }
    function cancel() {
      cleanup();
      try { port.postMessage({ type: 'CANCEL_ASSISTANT', sessionId: request.sessionId, requestId: request.requestId }); } catch { /* The port may already be closed. */ }
      reject(new Error('The request was cancelled.'));
    }
    function receive(value: unknown) {
      if (!value || typeof value !== 'object' || !('type' in value) || value.type !== (request.type === 'ASK_TEXT' ? 'TEXT_RESULT' : 'ASSISTANT_RESULT')
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
  const [connectionId, setConnectionId] = useState(0);
  const [textState, setTextState] = useState<TextState>({ kind: 'idle', message: 'Select public text to ask about it.' });
  const [textConsent, setTextConsent] = useState(false);
  const textController = useRef<ReturnType<typeof createTextSession> | null>(null);
  const controller = useRef<ReturnType<typeof createMockSession> | null>(null);
  const connection = useRef<Browser.runtime.Port | null>(null);

  const [restartNotice, setRestartNotice] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    let disposed = false;
    let port: Browser.runtime.Port | null = null;
    let trackedTabId: number | undefined;
    let ownedOrigin: string | undefined;
    let lastUrl: string | undefined;
    let revision = 0;
    let pendingClear: { type: 'CHECKPOINT_CLEAR'; sessionId: string; revision: number } | undefined;
    let reconnectAttempts = 0;
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const checkpointWaiters = new Map<number, (ok: boolean) => void>();
    function checkpoint(sessionId: string, tabId: number): Promise<boolean> {
      setRestartNotice(false);
      pendingClear = undefined;
      const nextRevision = ++revision;
      return new Promise((resolve) => {
        const timer = setTimeout(() => finish(false), 2000);
        function finish(ok: boolean) {
          clearTimeout(timer); checkpointWaiters.delete(nextRevision);
          if (!disposed) setStorageAvailable(ok);
          resolve(ok);
        }
        checkpointWaiters.set(nextRevision, finish);
        try { port?.postMessage({ type: 'CHECKPOINT_SET', sessionId, tabId, revision: nextRevision }); }
        catch { finish(false); }
      });
    }
    const session = (live ? createAssistantSession : createMockSession)({
      ask: (tabId, snapshot, task, identity, signal, taskContext) => {
        if (!port) return Promise.reject(new Error('The assistant connection is paused.'));
        return askThroughPanel(port, { type: 'ASK_ASSISTANT', tabId, pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId, userGoal: task, taskContext, ...identity }, signal);
      },
      inspect: async (requestId, tabId, settle, signal) => {
        textController.current?.stop();
        const inspectionToken = crypto.randomUUID();
        const cancel = () => { void browser.runtime.sendMessage({ type: 'CANCEL_INSPECTION', inspectionToken }).catch(() => undefined); };
        signal?.addEventListener('abort', cancel, { once: true });
        try { return await browser.runtime.sendMessage({ type: 'INSPECT_ACTIVE_TAB', requestId, tabId, settle, inspectionToken }); }
        finally { signal?.removeEventListener('abort', cancel); }
      },
      track: (tabId) => {
        trackedTabId = tabId;
        port?.postMessage({ type: 'TRACK_PAGE', tabId });
        if (!ownedOrigin) void browser.tabs.get(tabId).then((tab) => {
          if (disposed || session.ownedTab() !== tabId || trackedTabId !== tabId || !tab.url) return;
          ownedOrigin = new URL(tab.url).origin; lastUrl = tab.url;
        }).catch(() => undefined);
      },
      ...(live ? { checkpoint, endCheckpoint: (sessionId: string) => {
        setRestartNotice(false);
        pendingClear = { type: 'CHECKPOINT_CLEAR', sessionId, revision: ++revision };
        try { port?.postMessage(pendingClear); } catch { /* Retry the clear after reconnection. */ }
        ownedOrigin = undefined; lastUrl = undefined;
      } } : {}),
      highlight: (tabId, snapshot, targetId, instruction, guidance) => browser.runtime.sendMessage({
        type: 'HIGHLIGHT_ELEMENT', tabId, pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId,
        targetId, instruction, guidance,
      }),
      clear: (tabId, snapshotId) => browser.runtime.sendMessage({ type: 'STOP_INSPECTION', tabId, snapshotId }),
    }, setState);
    controller.current = session;
    setTextConsent(false);
    const textSession = createTextSession({
      post: (message) => { if (port) port.postMessage(message); },
      ask: (command, signal) => port ? askThroughPanel(port, command, signal) : Promise.reject(new Error('The connection closed.')),
      interruptGuidance: () => session.stop(),
    }, setTextState);
    textController.current = textSession;

    function scheduleRecovery() {
      clearTimeout(recoveryTimer);
      recoveryTimer = setTimeout(() => { if (!disposed) void session.resumeNavigation(); }, NAVIGATION_SETTLE_MS);
    }
    function connect() {
      if (disposed) return;
      const next = browser.runtime.connect({ name: 'clickpilot-panel' });
      port = next; connection.current = next; setConnectionId((value) => value + 1);
      const receive = (value: unknown) => {
        textSession.onPortMessage(value);
        if (!value || typeof value !== 'object' || !('type' in value)) return;
        if (value.type === 'CHECKPOINT_RESULT' && 'revision' in value && typeof value.revision === 'number') {
          const ok = 'ok' in value && value.ok === true;
          checkpointWaiters.get(value.revision)?.(ok);
          if (!ok && value.revision === revision) setStorageAvailable(false);
          if (ok && pendingClear?.revision === value.revision) { pendingClear = undefined; setRestartNotice(false); }
        }
        if (value.type === 'CHECKPOINT_NOTICE' || value.type === 'CHECKPOINT_UNAVAILABLE') {
          setConnected(true); reconnectAttempts = 0;
          setStorageAvailable(value.type !== 'CHECKPOINT_UNAVAILABLE');
          if (!pendingClear && !session.isActive() && 'interrupted' in value && value.interrupted === true) setRestartNotice(true);
        }
      };
      next.onMessage.addListener(receive);
      if (pendingClear) next.postMessage(pendingClear);
      textSession.onConnected();
      next.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        next.onMessage.removeListener(receive);
        if (disposed || port !== next) return;
        port = null; connection.current = null; setConnected(false);
        textSession.connectionLost();
        clearTimeout(recoveryTimer);
        session.suspend('The worker connection closed. Reconnecting; your goal remains in this panel. Continue after reconnection and toolbar activation if required.', true);
        for (const finish of checkpointWaiters.values()) finish(false);
        if (++reconnectAttempts <= 3) reconnectTimer = setTimeout(connect, 500);
      });
    }
    connect();
    const onMessage = (message: unknown, sender: Browser.runtime.MessageSender) => {
      if (sender.id !== browser.runtime.id) return;
      if (message && typeof message === 'object' && 'type' in message && message.type === 'TEXT_ACTIVATED' && !sender.tab) {
        textSession.enable(); return;
      }
      if (sender.tab?.id === undefined || sender.frameId !== 0) return;
      textSession.onPageEvent(message, sender.tab.id);
      session.onPageEvent(message, sender.tab.id);
      if (message && typeof message === 'object' && 'type' in message && message.type === 'PAGE_NAVIGATED') scheduleRecovery();
    };
    const onTabActivated = () => {
      textSession.invalidate();
      if (session.isActive()) {
        clearTimeout(recoveryTimer);
        session.suspend('Tab changed. Return to the task tab, activate the ClickPilot toolbar if required, then Continue task on this page.');
      }
    };
    const onTabUpdated = (tabId: number, change: { url?: string; status?: string }) => {
      if (tabId === textSession.ownedTab() && (change.url || change.status === 'loading')) textSession.invalidate();
      if (tabId !== session.ownedTab()) return;
      if (change.url && change.url !== lastUrl) {
        lastUrl = change.url;
        let sameOrigin = false;
        try { sameOrigin = new URL(change.url).origin === ownedOrigin; } catch { /* Unsupported destination. */ }
        session.navigation(tabId, sameOrigin);
        scheduleRecovery();
      } else if (change.status === 'loading') {
        session.navigation(tabId); scheduleRecovery();
      } else if (change.status === 'complete') scheduleRecovery();
    };
    const onTabRemoved = (tabId: number) => {
      if (tabId === textSession.ownedTab()) textSession.invalidate('The selected-text tab closed. Activate another page to start again.');
      if (tabId === session.ownedTab()) { clearTimeout(recoveryTimer); session.pause('The task tab closed. Enter a new goal on another tab.'); }
    };
    const onPageHide = () => { textSession.dispose(); session.destroy(); port?.disconnect(); };
    browser.runtime.onMessage.addListener(onMessage);
    browser.tabs.onActivated.addListener(onTabActivated);
    browser.tabs.onUpdated.addListener(onTabUpdated);
    browser.tabs.onRemoved.addListener(onTabRemoved);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      disposed = true;
      clearTimeout(recoveryTimer); clearTimeout(reconnectTimer);
      textSession.dispose(); textController.current = null;
      session.dispose(); controller.current = null; connection.current = null;
      port?.disconnect(); port = null;
      for (const finish of checkpointWaiters.values()) finish(false);
      browser.runtime.onMessage.removeListener(onMessage);
      browser.tabs.onActivated.removeListener(onTabActivated);
      browser.tabs.onUpdated.removeListener(onTabUpdated);
      browser.tabs.onRemoved.removeListener(onTabRemoved);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [live]);

  return { state, connected, controller, connection, connectionId, restartNotice, storageAvailable, textState, textController, textConsent,
    setTextConsent: (value: boolean) => { setTextConsent(value); textController.current?.setConsent(value); } };
}
