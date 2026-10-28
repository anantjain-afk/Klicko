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
import { ALL_SITE_ORIGINS, GLOBAL_ACTIVATION_KEY, globallyEnabled, hasAllSiteAccess, supportedPage } from '../../lib/activation';

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
  let globalOn: boolean | undefined;
  let activationRevision = 0;
  let activationQueue: Promise<unknown> = Promise.resolve();
  const tabQueues = new Map<number, Promise<void>>();
  const initialRevision = activationRevision;
  void globallyEnabled().then((enabled) => { if (activationRevision === initialRevision) globalOn = enabled; })
    .catch(() => { if (activationRevision === initialRevision) globalOn = false; });
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
  async function showBuddy(tabId: number, globalOnly = false) {
    const entry = await entryFor(tabId);
    await entry.transport.permittedPage();
    if (!entry.task.snapshot().buddyVisible) return;
    if (globalOnly && (globalOn === false || !await globallyEnabled())) return;
    let result: unknown;
    try { result = await browser.tabs.sendMessage(tabId, { type: 'SHOW_BUDDY', globalOnly }, { frameId: 0 }); }
    catch {
      if (globalOnly && (globalOn === false || !await globallyEnabled())) return;
      await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
      result = await browser.tabs.sendMessage(tabId, { type: 'SHOW_BUDDY', globalOnly }, { frameId: 0 });
    }
    if (isRecord(result) && result.ok === true && entry.task.snapshot().buddyVisible
      && (!globalOnly || (globalOn !== false && await globallyEnabled()))) entry.task.reconnectText();
  }
  async function activateTab(tabId: number, notice?: string, globalOnly = true, revision = activationRevision) {
    if (revision !== activationRevision) return;
    if (globalOnly && (globalOn === false || !await globallyEnabled())) return;
    const tab = await browser.tabs.get(tabId);
    const allowed = supportedPage(tab.url) && await tabAccess.allows(tabId, tab.url);
    if (revision !== activationRevision) return;
    if (!allowed) {
      await deactivateTab(tabId, true, revision); return;
    }
    const entry = await entryFor(tabId);
    if (revision !== activationRevision || (globalOnly && (globalOn === false || !await globallyEnabled()))) return;
    entry.task.activate(notice);
    await showBuddy(tabId, globalOnly);
  }
  async function deactivateTab(tabId: number, accessLost = false, revision = activationRevision) {
    if (revision !== activationRevision) return;
    const pending = tasks.get(tabId);
    if (pending) {
      const entry = await pending;
      if (revision !== activationRevision) return;
      clearTimeout(entry.recoveryTimer);
      if (accessLost) entry.task.accessLost();
      else entry.task.deactivate();
      entry.transport.stopText();
    }
    // Remove page UI independently of storage or a slow permission probe.
    void browser.tabs.sendMessage(tabId, { type: 'DEACTIVATE_PAGE', globalOnly: false }, { frameId: 0 }).catch(() => undefined);
    await tabAccess.remove(tabId);
    await flagsQueue;
    if (revision !== activationRevision) return;
    await browser.storage.session.remove(flagsKey(tabId));
  }
  async function setGlobal(enabled: boolean) {
    activationRevision++;
    const revision = activationRevision;
    globalOn = enabled;
    if (!enabled) {
      // A previous current-tab fallback must not survive a global OFF.
      const values = await browser.storage.session.get(null);
      const keys = Object.keys(values).filter((key) => key.startsWith('clickpilot.activation.'));
      if (keys.length) await browser.storage.session.remove(keys);
    }
    await browser.storage.session.set({ [GLOBAL_ACTIVATION_KEY]: enabled });
    await browser.action.setBadgeText({ text: enabled ? 'ON' : '' });
    await browser.action.setTitle({ title: enabled ? 'Turn Klicko off on all tabs' : 'Turn Klicko on for all supported tabs' });
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      void (enabled ? activateTab(tab.id, undefined, true, revision) : deactivateTab(tab.id, false, revision)).catch(() => undefined);
    }
  }
  function queueTabWork(tabId: number, work: () => Promise<void>) {
    const next = (tabQueues.get(tabId) ?? Promise.resolve()).then(work).catch(() => undefined);
    tabQueues.set(tabId, next);
    void next.then(() => { if (tabQueues.get(tabId) === next) tabQueues.delete(tabId); });
  }
  async function activationAllowed(tabId: number, globalOnly: boolean) {
    const global = await globallyEnabled();
    const entry = tasks.get(tabId);
    if (!global && (globalOnly || !entry || !(await entry).task.snapshot().buddyVisible)) return false;
    const tab = await browser.tabs.get(tabId);
    if (!tab.url || !await tabAccess.allows(tabId, tab.url)) return false;
    if (await globallyEnabled()) return true;
    return !globalOnly && !!entry && (await entry).task.snapshot().buddyVisible;
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
      if (tabId === undefined) return;
      pageKey = !panel && typeof value.pageKey === 'string' && /^[\w-]{1,80}$/.test(value.pageKey) ? value.pageKey : undefined;
      boundTab = tabId;
      if (!await currentPage()) { post({ type: 'PAGE_CHANGED' }); return; }
      const entry = await entryFor(tabId);
      if (closed || attempt !== attachNumber) return;
      if (!panel) {
        try { await entry.transport.permittedPage(); }
        catch { if (!closed && attempt === attachNumber) await deactivateTab(tabId, true); return; }
        if (closed || attempt !== attachNumber) return;
      }
      unsubscribe?.(); attached = entry;
      unsubscribe = entry.task.subscribe(post);
      if (panel && active?.windowId !== undefined && settingsIntents.delete(active.windowId)) post({ type: 'VIEW_SETTINGS' });
      if (!panel) entry.task.reconnectText();
    }
    port.onMessage.addListener((value: unknown) => {
      if (!isRecord(value)) return;
      if (value.type === 'ATTACH' && Object.keys(value).every((key) => ['type', 'pageKey'].includes(key))) {
        void attach(value).catch(() => post({ type: 'VIEW_ERROR', message: 'Klicko couldn’t connect. Try again.' })); return;
      }
      // Invoke Chrome's gesture-gated API before any await, storage read or probe.
      if (value.type === 'OPEN_SIDEBAR' && Object.keys(value).every((key) => ['type', 'settings'].includes(key))
        && (value.settings === undefined || typeof value.settings === 'boolean') && !panel && attached && boundTab !== undefined) {
        if (value.settings === true && port.sender!.tab!.windowId !== undefined) settingsIntents.add(port.sender!.tab!.windowId!);
        void browser.sidePanel.open({ windowId: port.sender!.tab!.windowId }).catch(() => post({ type: 'VIEW_ERROR', message: 'Use the Klicko entry in Chrome’s side panel to open the conversation.' }));
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
            && error.message === 'For your privacy, Klicko is unavailable on this page.' ? error.message
            : 'Click the Klicko toolbar icon on this public page, then try again.');
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
    // Chrome requires the permission request inside the original toolbar gesture.
    // On a cold worker the request is harmless if the all-site grant already exists.
    const grant = globalOn === true ? Promise.resolve(false)
      : browser.permissions.request({ origins: ALL_SITE_ORIGINS }).catch(() => false);
    activationQueue = activationQueue.then(async () => {
      if (await globallyEnabled()) { await setGlobal(false); return; }
      await grant;
      if (await hasAllSiteAccess()) { await setGlobal(true); return; }
      await browser.action.setBadgeText({ text: 'TAB' });
      await browser.action.setTitle({ title: 'All-site access was not granted. Current-tab activation is available on supported webpages; click to retry global mode.' });
      if (tab.id === undefined || !supportedPage(tab.url)) return;
      await tabAccess.activate(tab.id, tab.url);
      void activateTab(tab.id, 'All-site access was not granted. Klicko works only on this tab. Use the toolbar to try global mode again.', false).catch(() => undefined);
    }).catch(() => { void browser.action.setTitle({ title: 'Klicko could not change access. Try the toolbar again.' }); });
  });
  browser.permissions.onRemoved.addListener(() => {
    activationQueue = activationQueue.then(async () => {
      if (await globallyEnabled() && !await hasAllSiteAccess()) await setGlobal(false);
      for (const tabId of tasks.keys()) {
        void (async () => {
          const tab = await browser.tabs.get(tabId).catch(() => null);
          if (!tab?.url || !await tabAccess.allows(tabId, tab.url)) await deactivateTab(tabId, true);
        })().catch(() => undefined);
      }
    }).catch(() => undefined);
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    for (const [id, pending] of tasks) if (id !== tabId) void pending.then((entry) => {
      clearTimeout(entry.recoveryTimer); entry.task.pauseForTabChange();
    }).catch(() => undefined);
  });
  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (!change.url && change.status !== 'loading' && change.status !== 'complete') return;
    const url = change.url ?? tab.url;
    // A slow page must not block the toolbar or updates for other tabs.
    queueTabWork(tabId, async () => {
      if (url) await tabAccess.navigation(tabId, url);
      else await tabAccess.remove(tabId);
      let pending = tasks.get(tabId);
      if (!pending) {
        const data = await browser.storage.session.get([flagsKey(tabId), taskKey(tabId)]);
        if (data[flagsKey(tabId)] !== undefined || data[taskKey(tabId)] !== undefined) pending = entryFor(tabId);
      }
      const entry = pending ? await pending : undefined;
      if (!supportedPage(url)) { if (entry) void deactivateTab(tabId, true).catch(() => undefined); return; }
      if (entry) {
        if (change.url && change.url !== entry.lastUrl) {
          let sameOrigin = false;
          try { sameOrigin = new URL(change.url).origin === new URL(entry.lastUrl ?? '').origin; } catch { /* Access can be lost. */ }
          entry.lastUrl = change.url; entry.task.navigation(sameOrigin); scheduleRecovery(entry);
        } else if (change.status === 'loading') { entry.task.navigation(true); scheduleRecovery(entry); }
        else if (change.status === 'complete') scheduleRecovery(entry);
      }
      if (change.status !== 'complete' && !change.url) return;
      if (await globallyEnabled()) void activateTab(tabId).catch(() => undefined);
      else if (entry?.task.snapshot().buddyVisible) {
        if (await tabAccess.allows(tabId, url)) void showBuddy(tabId).catch(() => undefined);
        else void deactivateTab(tabId, true).catch(() => undefined);
      }
    });
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    closedTabs.add(tabId);
    const pending = tasks.get(tabId); tasks.delete(tabId);
    tabQueues.delete(tabId);
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
      if (isRecord(value) && value.type === 'CHECK_ACTIVATION' && typeof value.globalOnly === 'boolean'
        && Object.keys(value).every((key) => ['type', 'globalOnly'].includes(key))) {
        void activationAllowed(tabId, value.globalOnly).then((allowed) => respond({ allowed })).catch(() => respond({ allowed: false }));
        return true;
      }
      if (isRecord(value) && value.type === 'PAGE_RESTORED' && typeof value.pageKey === 'string' && /^[\w-]{1,80}$/.test(value.pageKey)) {
        const pageKey = value.pageKey;
        void (async () => {
          const identity: unknown = await browser.tabs.sendMessage(tabId, { type: 'PAGE_IDENTITY' }, { frameId: 0 });
          if (!isRecord(identity) || identity.pageKey !== pageKey) return;
          if (await globallyEnabled()) await activateTab(tabId);
          else {
            const entry = await entryFor(tabId);
            if (entry.task.snapshot().buddyVisible) await showBuddy(tabId);
          }
        })().catch(() => undefined);
        return;
      }
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
      if (value.type === 'INSPECT_ACTIVE_TAB' && 'type' in result && result.type === 'INSPECTION_RESULT' && sender.documentId) {
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
