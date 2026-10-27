import { browser, type Browser } from 'wxt/browser';
import { playUiSound } from '../sounds/background';
import { AI_PREFERENCES_KEY, DEFAULT_AI_PREFERENCES } from '../../lib/preferences';
import { handlePanelRequest, inspectActiveTab, sharingPreferences, tabAccess } from '../../lib/page-access';
import { isPanelRequest, isTrackPageRequest } from '../../lib/messages';
import { isRecord, isTaskCommand } from '../../lib/task-messages';
import { createTaskRecoveryStore, taskKey } from './task-recovery';
import { createTaskCoordinator, type TabFlags, type TaskCoordinator } from './coordinator';
import { createPageTransport } from './page-transport';
import { NAVIGATION_SETTLE_MS } from './session';

interface Entry {
  task: TaskCoordinator;
  transport: ReturnType<typeof createPageTransport>;
  lastUrl?: string;
  recoveryTimer?: ReturnType<typeof setTimeout>;
}
const flagsKey = (tabId: number) => `clickpilot.ui.${tabId}`;

export function startBackgroundTasks() {
  const ready = browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  void ready.catch(() => undefined);
  void browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => undefined);
  const tasks = new Map<number, Promise<Entry>>();
  const closedTabs = new Set<number>();
  const settingsIntents = new Set<number>();
  // Developer inspections belong to their view; shared tasks do not.
  const debugSnapshots = new Map<string, Map<number, string>>();
  let flagsQueue: Promise<unknown> = Promise.resolve();
  const recovery = createTaskRecoveryStore({
    read: async (key) => { await ready; return (await browser.storage.session.get(key))[key]; },
    write: async (key, value) => { await ready; await browser.storage.session.set({ [key]: value }); },
    remove: async (key) => { await ready; await browser.storage.session.remove(key); },
  });
  function saveFlags(tabId: number, flags: TabFlags) {
    const result = flagsQueue.then(async () => {
      if (closedTabs.has(tabId)) return;
      await ready; await browser.storage.session.set({ [flagsKey(tabId)]: flags });
    });
    flagsQueue = result.catch(() => undefined); return result;
  }
  function entryFor(tabId: number): Promise<Entry> {
    const existing = tasks.get(tabId);
    if (existing) return existing;
    const creating = (async () => {
      const preferences = await sharingPreferences().catch(() => ({ ...DEFAULT_AI_PREFERENCES }));
      const data = await browser.storage.session.get(flagsKey(tabId)).catch(() => ({} as Record<string, unknown>));
      const stored = data[flagsKey(tabId)];
      const flags: TabFlags = isRecord(stored) && typeof stored.buddyVisible === 'boolean' && typeof stored.textEnabled === 'boolean'
        ? { buddyVisible: stored.buddyVisible, textEnabled: stored.textEnabled } : { buddyVisible: false, textEnabled: false };
      const saved = await recovery.read(tabId).catch(() => null);
      if (saved && !preferences.guidance) await recovery.save(tabId, null);
      const transport = createPageTransport(tabId, (event) => task?.textPortMessage(event));
      const task = createTaskCoordinator(tabId, {
        guidance: {
          inspect: async (requestId, _ownedTab, settle, signal) => {
            const inspectionToken = crypto.randomUUID();
            const cancel = () => { void handlePanelRequest({ type: 'CANCEL_INSPECTION', inspectionToken }).catch(() => undefined); };
            signal?.addEventListener('abort', cancel, { once: true });
            if (signal?.aborted) cancel();
            try { return await inspectActiveTab(requestId, tabId, settle, inspectionToken); }
            finally { signal?.removeEventListener('abort', cancel); }
          },
          track: transport.track,
          ask: (id, snapshot, goal, identity, signal, taskContext) => transport.askGuidance({ type: 'ASK_ASSISTANT', tabId: id,
            pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId, userGoal: goal, taskContext, ...identity }, signal),
          highlight: (id, snapshot, targetId, instruction, guidance) => handlePanelRequest({ type: 'HIGHLIGHT_ELEMENT', tabId: id,
            pageKey: snapshot.pageKey, snapshotId: snapshot.snapshotId, targetId, instruction, guidance }),
          clear: (id, snapshotId) => handlePanelRequest({ type: 'STOP_INSPECTION', tabId: id, snapshotId }),
        },
        textPost: transport.textPost, askText: transport.askText,
        save: (value) => recovery.save(tabId, value), saveFlags: (value) => saveFlags(tabId, value),
      }, preferences, flags, preferences.guidance ? saved : null);
      const tab = await browser.tabs.get(tabId);
      if (closedTabs.has(tabId)) { task.dispose(); transport.dispose(); throw new Error('Tab closed.'); }
      // One observer per task owner prevents duplicate cues across buddy/sidebar views.
      let lastMessageId = task.snapshot().messages.at(-1)?.id ?? 0;
      task.subscribe((view) => {
        const reply = view.messages.filter((message) => message.id > lastMessageId && message.role === 'assistant').at(-1);
        lastMessageId = Math.max(lastMessageId, view.messages.at(-1)?.id ?? 0);
        if (reply) void playUiSound(reply.source === 'text' ? 'boing-2' : 'boing-1').catch(() => undefined);
      });
      return { task, transport, lastUrl: tab.url };
    })();
    tasks.set(tabId, creating);
    void creating.catch(() => { if (tasks.get(tabId) === creating) tasks.delete(tabId); });
    return creating;
  }
  async function showBuddy(tabId: number) {
    const entry = await entryFor(tabId);
    await entry.transport.activePage();
    if (!entry.task.snapshot().buddyVisible) return;
    try { await browser.tabs.sendMessage(tabId, { type: 'SHOW_BUDDY' }, { frameId: 0 }); }
    catch {
      await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
      await browser.tabs.sendMessage(tabId, { type: 'SHOW_BUDDY' }, { frameId: 0 });
    }
  }
  function scheduleRecovery(entry: Entry) {
    clearTimeout(entry.recoveryTimer);
    entry.recoveryTimer = setTimeout(() => entry.task.resumeNavigation(), NAVIGATION_SETTLE_MS);
  }
  function isPanel(sender: Browser.runtime.MessageSender) {
    return sender.id === browser.runtime.id && sender.url === browser.runtime.getURL('/sidepanel.html') && !sender.tab;
  }
  // A panel HTML tab is also a trusted extension view (used by local tooling).
  function isPanelDocument(sender: Browser.runtime.MessageSender) {
    return isPanel(sender) || (sender.id === browser.runtime.id && sender.url === browser.runtime.getURL('/sidepanel.html'));
  }
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'clickpilot-view' || port.sender?.id !== browser.runtime.id) return;
    const panel = isPanelDocument(port.sender);
    if (!panel && (port.sender.frameId !== 0 || port.sender.tab?.id === undefined || !port.sender.documentId)) return;
    let unsubscribe: (() => void) | undefined;
    let attached: Entry | undefined;
    let boundTab: number | undefined;
    let pageKey: string | undefined;
    let closed = false;
    let attachNumber = 0;
    const post = (value: unknown) => { if (!closed) { try { port.postMessage(value); } catch { /* The view can disappear. */ } } };
    async function currentPage() {
      if (panel) return true;
      const current: unknown = await browser.tabs.sendMessage(boundTab!, { type: 'PAGE_IDENTITY' }, { frameId: 0 }).catch(() => null);
      return isRecord(current) && typeof current.pageKey === 'string' && current.pageKey === pageKey;
    }
    async function attach(value: Record<string, unknown>) {
      const attempt = ++attachNumber;
      const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      const tabId = panel ? active?.id : port.sender!.tab!.id;
      if (tabId === undefined || (!panel && active?.id !== tabId)) return;
      pageKey = !panel && typeof value.pageKey === 'string' && /^[\w-]{1,80}$/.test(value.pageKey) ? value.pageKey : undefined;
      boundTab = tabId;
      if (!await currentPage()) { post({ type: 'PAGE_CHANGED' }); return; }
      const entry = await entryFor(tabId);
      if (closed || attempt !== attachNumber) return;
      unsubscribe?.(); attached = entry;
      unsubscribe = entry.task.subscribe(post);
      if (panel && active?.windowId !== undefined && settingsIntents.delete(active.windowId)) post({ type: 'VIEW_SETTINGS' });
      if (!panel) entry.task.reconnectText();
    }
    port.onMessage.addListener((value: unknown) => {
      if (!isRecord(value)) return;
      if (value.type === 'ATTACH' && Object.keys(value).every((key) => ['type', 'pageKey'].includes(key))) {
        void attach(value).catch(() => post({ type: 'VIEW_ERROR', message: 'ClickPilot couldn’t connect. Try again.' })); return;
      }
      // Invoke Chrome's gesture-gated API before any await, storage read or probe.
      if (value.type === 'OPEN_SIDEBAR' && Object.keys(value).every((key) => ['type', 'settings'].includes(key))
        && (value.settings === undefined || typeof value.settings === 'boolean') && !panel && attached && boundTab !== undefined) {
        if (value.settings === true && port.sender!.tab!.windowId !== undefined) settingsIntents.add(port.sender!.tab!.windowId!);
        void browser.sidePanel.open({ windowId: port.sender!.tab!.windowId }).catch(() => post({ type: 'VIEW_ERROR', message: 'Use the ClickPilot entry in Chrome’s side panel to open the conversation.' }));
        return;
      }
      if (isTaskCommand(value) && attached && boundTab !== undefined) {
        const entry = attached; const tabId = boundTab;
        void (async () => {
          const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
          if (closed || attached !== entry || active?.id !== tabId || !await currentPage()) return;
          entry.task.preferences(await sharingPreferences());
          if (value.action === 'start' || value.action === 'text-enable') await entry.transport.activePage();
          if (!closed && attached === entry) await entry.task.command(value);
        })().catch((error: unknown) => {
          const current = entry.task.snapshot();
          if (current.epoch === value.epoch && current.taskId === value.taskId) entry.task.error(error instanceof Error
            && error.message === 'For your privacy, ClickPilot is unavailable on this page.' ? error.message
            : 'Click the ClickPilot toolbar icon on this public page, then try again.');
        });
      }
      if (panel && isTrackPageRequest(value)) {
        void entryFor(value.tabId).then((entry) => entry.transport.track()).catch(() => undefined);
      }
    });
    port.onDisconnect.addListener(() => {
      closed = true; ++attachNumber; unsubscribe?.();
      const documentId = panel ? port.sender?.documentId : undefined;
      const snapshots = documentId ? debugSnapshots.get(documentId) : undefined;
      if (documentId) debugSnapshots.delete(documentId);
      for (const [tabId, snapshotId] of snapshots ?? []) {
        // The snapshot identity prevents clearing a newer shared highlight.
        void handlePanelRequest({ type: 'STOP_INSPECTION', tabId, snapshotId }).catch(() => undefined);
      }
    });
  });
  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined || !tab.url || !/^https?:\/\//.test(tab.url)) {
      void browser.action.setTitle({ tabId: tab.id, title: 'ClickPilot is unavailable on this page' }); return;
    }
    const id = tab.id; const url = tab.url;
    void (async () => {
      await tabAccess.activate(id, url);
      const entry = await entryFor(id); entry.task.activate(); await showBuddy(id);
    })().catch(() => { void browser.action.setTitle({ tabId: id, title: 'ClickPilot: open a public webpage and activate again' }); });
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    for (const [id, pending] of tasks) if (id !== tabId) void pending.then((entry) => {
      clearTimeout(entry.recoveryTimer); entry.task.pauseForTabChange();
    }).catch(() => undefined);
  });
  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (!change.url && change.status !== 'loading' && change.status !== 'complete') return;
    const url = change.url ?? tab.url;
    void (url ? tabAccess.navigation(tabId, url) : tabAccess.remove(tabId)).catch(() => undefined);
    // Do not create tasks for unrelated tabs. Restore only known activated/recoverable tabs.
    void (async () => {
      const pending = tasks.get(tabId);
      if (pending) return pending;
      const data = await browser.storage.session.get([flagsKey(tabId), taskKey(tabId)]);
      if (data[flagsKey(tabId)] === undefined && data[taskKey(tabId)] === undefined) return null;
      return entryFor(tabId);
    })().then((entry) => {
      if (!entry) return;
      if (change.url && change.url !== entry.lastUrl) {
        let sameOrigin = false;
        try { sameOrigin = new URL(change.url).origin === new URL(entry.lastUrl ?? '').origin; } catch { /* Access can be lost. */ }
        entry.lastUrl = change.url; entry.task.navigation(sameOrigin); scheduleRecovery(entry);
      } else if (change.status === 'loading') { entry.task.navigation(true); scheduleRecovery(entry); }
      else if (change.status === 'complete') scheduleRecovery(entry);
      if (change.status === 'complete') void showBuddy(tabId).catch(() => undefined);
    }).catch(() => undefined);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    closedTabs.add(tabId);
    const pending = tasks.get(tabId); tasks.delete(tabId);
    void pending?.then((entry) => { clearTimeout(entry.recoveryTimer); entry.task.dispose(); entry.transport.dispose(); }).catch(() => undefined);
    void recovery.save(tabId, null).catch(() => undefined);
    void tabAccess.remove(tabId).catch(() => undefined);
    flagsQueue = flagsQueue.then(() => browser.storage.session.remove(flagsKey(tabId))).catch(() => undefined);
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(AI_PREFERENCES_KEY in changes)) return;
    void sharingPreferences().then((preferences) => {
      for (const pending of tasks.values()) void pending.then((entry) => entry.task.preferences(preferences)).catch(() => undefined);
    }).catch(() => undefined);
  });
  browser.runtime.onMessage.addListener((value: unknown, sender, respond) => {
    if (sender.id !== browser.runtime.id) return;
    if (sender.tab?.id !== undefined && sender.frameId === 0 && !isPanelDocument(sender)) {
      const tabId = sender.tab.id;
      void entryFor(tabId).then((entry) => {
        entry.task.pageEvent(value, tabId);
        if (isRecord(value) && value.type === 'PAGE_NAVIGATED') scheduleRecovery(entry);
      }).catch(() => undefined);
      return;
    }
    if (!isPanelDocument(sender) || !isPanelRequest(value)) return;
    void (async () => {
      if (value.type === 'INSPECT_ACTIVE_TAB') {
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id !== undefined) {
          const entry = await entryFor(tab.id); const state = entry.task.snapshot();
          await entry.task.command({ type: 'TASK_COMMAND', id: crypto.randomUUID(), epoch: state.epoch, taskId: state.taskId, action: 'stop' });
        }
      }
      const result = await handlePanelRequest(value);
      if (value.type === 'INSPECT_ACTIVE_TAB' && result.type === 'PAGE_SNAPSHOT' && sender.documentId) {
        const snapshots = debugSnapshots.get(sender.documentId) ?? new Map<number, string>();
        snapshots.set(result.tabId, result.snapshot.snapshotId);
        debugSnapshots.set(sender.documentId, snapshots);
      }
      return result;
    })().then(respond).catch(() => respond(value.type === 'INSPECT_ACTIVE_TAB'
      ? { type: 'INSPECTION_ERROR', requestId: value.requestId, reason: 'reactivate' } : { type: 'OVERLAY_RESULT', ok: false }));
    return true;
  });
}
