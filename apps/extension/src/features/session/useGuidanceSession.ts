import { useEffect, useRef, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';
import { createMockSession, type GuidanceState } from './session';
import type { MockScenario } from './mock';
import type { TextState } from '../text-assistant/session';
import { isTaskView, type TaskAction, type TaskView } from '../../lib/task-messages';

interface GuidanceControls {
  start: (goal: string, scenario?: MockScenario) => Promise<void>;
  stop: () => void;
  retry: () => Promise<void>;
  continueTask: () => Promise<void>;
  continueManually: () => Promise<void>;
  confirmComplete: () => void;
  isActive: () => boolean;
  newChat?: () => void;
}
interface TextControls { enable: () => void; stop: () => void; retry: () => void }

// This hook is a view/client. The only local controller is the existing offline Mock tool.
export function useGuidanceSession(live: boolean, guidanceConsent: boolean, textConsent: boolean) {
  const [state, setState] = useState<GuidanceState>({ kind: 'idle' });
  const [textState, setTextState] = useState<TextState>({ kind: 'idle', message: 'Select public text to ask about it.' });
  const [sharedView, setSharedView] = useState<TaskView | null>(null);
  const latest = useRef<TaskView | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionId, setConnectionId] = useState(0);
  const controller = useRef<GuidanceControls | null>(null);
  const textController = useRef<TextControls | null>(null);
  const connection = useRef<Browser.runtime.Port | null>(null);
  const reconnect = useRef<() => void>(() => undefined);

  useEffect(() => {
    let disposed = false;
    let port: Browser.runtime.Port | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const send = (action: TaskAction, goal?: string) => {
      const view = latest.current;
      if (!view || !port) return;
      try { port.postMessage({ type: 'TASK_COMMAND', id: crypto.randomUUID(), epoch: view.epoch,
        taskId: view.taskId, action, ...(goal === undefined ? {} : { goal }) }); } catch { setConnected(false); }
    };
    const local = live ? null : createMockSession({
      inspect: (requestId) => browser.runtime.sendMessage({ type: 'INSPECT_ACTIVE_TAB', requestId }),
      track: (tabId) => port?.postMessage({ type: 'TRACK_PAGE', tabId }),
      highlight: (tabId, snapshot, targetId, instruction, guidance) => browser.runtime.sendMessage({
        type: 'HIGHLIGHT_ELEMENT', tabId, pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId, targetId, instruction, guidance,
      }),
      clear: (tabId, snapshotId) => browser.runtime.sendMessage({ type: 'STOP_INSPECTION', tabId, snapshotId }),
    }, setState);
    controller.current = local ?? {
      start: async (goal) => send('start', goal), stop: () => send('stop'), retry: async () => send('retry'),
      continueTask: async () => send('continue'), continueManually: async () => send('continue-manually'),
      confirmComplete: () => send('done'), isActive: () => latest.current?.source === 'guidance' && latest.current?.active === true,
      newChat: () => send('new-chat'),
    };
    textController.current = { enable: () => send('text-enable'), stop: () => send('text-stop'), retry: () => send('retry') };
    function attach() { try { port?.postMessage({ type: 'ATTACH' }); } catch { /* Reconnect handles port loss. */ } }
    function connect() {
      if (disposed || port) return;
      clearTimeout(timer);
      try {
        const next = browser.runtime.connect({ name: 'clickpilot-view' });
        port = next; connection.current = next;
        setConnectionId((value) => value + 1);
        next.onMessage.addListener((value: unknown) => {
          if (port !== next) return;
          if (value && typeof value === 'object' && 'type' in value && value.type === 'VIEW_SETTINGS') {
            window.dispatchEvent(new Event('clickpilot-settings')); return;
          }
          if (!isTaskView(value)) return;
          if (latest.current?.tabId === value.tabId && latest.current.epoch === value.epoch && value.revision < latest.current.revision) return;
          latest.current = value; setSharedView(value); setTextState(value.textState);
          if (local && value.active) local.stop();
          if (live) setState(value.state);
          setConnected(true); attempts = 0;
        });
        next.onDisconnect.addListener(() => {
          void browser.runtime.lastError;
          if (disposed || port !== next) return;
          port = null; connection.current = null; setConnected(false);
          local?.suspend('The connection was interrupted. Start the local mock again.');
          if (++attempts <= 3) timer = setTimeout(connect, [250, 1000, 2500][attempts - 1]);
        });
        attach();
      } catch { setConnected(false); }
    }
    function reconnectNow() { attempts = 0; connect(); if (port) attach(); }
    reconnect.current = reconnectNow;
    const activated = () => { local?.pause('Tab changed. Start the local mock again.'); attach(); };
    const pageEvent = (value: unknown, sender: Browser.runtime.MessageSender) => {
      if (local && sender.id === browser.runtime.id && sender.tab?.id !== undefined && sender.frameId === 0) local.onPageEvent(value, sender.tab.id);
    };
    const pageHide = () => { local?.dispose(); port?.disconnect(); };
    browser.tabs.onActivated.addListener(activated);
    browser.runtime.onMessage.addListener(pageEvent);
    window.addEventListener('focus', reconnectNow);
    window.addEventListener('pagehide', pageHide);
    connect();
    return () => {
      disposed = true; clearTimeout(timer); local?.dispose(); port?.disconnect();
      connection.current = null; controller.current = null; textController.current = null;
      browser.tabs.onActivated.removeListener(activated); browser.runtime.onMessage.removeListener(pageEvent);
      window.removeEventListener('focus', reconnectNow); window.removeEventListener('pagehide', pageHide);
    };
  }, [live]);

  return { state, textState, connected, connectionId, connection, controller, textController, sharedView,
    retainedReply: null, restartNotice: sharedView?.recovered ?? false, storageAvailable: sharedView?.storageAvailable ?? true,
    guidanceConsent, textConsent, reconnect: () => reconnect.current() };
}
