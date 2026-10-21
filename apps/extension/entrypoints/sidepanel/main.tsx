import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser, type Browser } from 'wxt/browser';
import { isInspectionResponse, isOverlayResponse, isPageInvalidation, type PageSnapshot } from '../../src/lib/messages';
import { MockGuidance } from '../../src/features/session/MockGuidance';
import './style.css';

type ViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; snapshot: PageSnapshot }
  | { kind: 'error'; message: string };

const ERROR_MESSAGES = {
  'no-tab': 'No active tab was found. Open a website and try again.',
  unsupported: 'This page cannot be inspected. Open a regular website.',
  reactivate: 'Click the ClickPilot toolbar icon on this tab to allow inspection, then try again.',
  changed: 'The page changed during inspection. Try again on the current tab.',
};

function ManualInspection() {
  const [view, setView] = useState<ViewState>({ kind: 'idle' });
  const [overlayStatus, setOverlayStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlighting, setHighlighting] = useState(false);
  const requestId = useRef(0);
  const observedTabId = useRef<number | null>(null);
  const currentSnapshot = useRef<PageSnapshot | null>(null);
  const currentTargetId = useRef<string | null>(null);
  const panelConnection = useRef<Browser.runtime.Port | null>(null);

  function clearInspection() {
    requestId.current += 1;
    const tabId = observedTabId.current;
    const snapshotId = currentSnapshot.current?.snapshotId;
    observedTabId.current = null;
    currentSnapshot.current = null;
    currentTargetId.current = null;
    setSelectedId(null);
    setOverlayStatus('');
    setHighlighting(false);
    setView({ kind: 'idle' });
    if (tabId !== null) {
      void browser.runtime.sendMessage({ type: 'STOP_INSPECTION', tabId, snapshotId }).catch(() => undefined);
    }
  }

  useEffect(() => {
    const connection = browser.runtime.connect({ name: 'clickpilot-panel' });
    panelConnection.current = connection;
    connection.onDisconnect.addListener(() => {
      if (panelConnection.current !== connection) return;
      panelConnection.current = null;
      clearInspection();
      setView({ kind: 'error', message: 'The page connection closed. Reopen the panel and inspect again.' });
    });
    function onInvalidation(message: unknown, sender: { id?: string; tab?: { id?: number } }) {
      const snapshot = currentSnapshot.current;
      if (!isPageInvalidation(message) || sender.id !== browser.runtime.id
        || sender.tab?.id !== observedTabId.current || !snapshot
        || message.pageKey !== snapshot.pageKey || message.snapshotId !== snapshot.snapshotId) return;
      if (message.type === 'SNAPSHOT_INVALIDATED') {
        clearInspection();
        setView({ kind: 'error', message: 'The page changed or the list expired. Inspect again.' });
      } else {
        if (message.targetId !== currentTargetId.current) return;
        requestId.current += 1;
        currentTargetId.current = null;
        setHighlighting(false);
        setSelectedId(null);
        setOverlayStatus('Highlight removed: the target moved out of view, changed, or became covered. Inspect again if needed.');
      }
    }
    function onTabActivated() {
      clearInspection();
      setView({ kind: 'error', message: 'Tab changed. Click the ClickPilot icon on this tab before inspecting.' });
    }
    function onTabUpdated(tabId: number, change: { status?: string; url?: string }) {
      if (tabId !== observedTabId.current || (!change.url && change.status !== 'loading')) return;
      clearInspection();
      setView({ kind: 'error', message: 'Page changed. Inspect it again for a fresh list.' });
    }
    function onPageHide() {
      clearInspection();
      const connection = panelConnection.current;
      panelConnection.current = null;
      connection?.disconnect();
    }

    browser.tabs.onActivated.addListener(onTabActivated);
    browser.runtime.onMessage.addListener(onInvalidation);
    browser.tabs.onUpdated.addListener(onTabUpdated);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      requestId.current += 1;
      browser.tabs.onActivated.removeListener(onTabActivated);
      browser.runtime.onMessage.removeListener(onInvalidation);
      browser.tabs.onUpdated.removeListener(onTabUpdated);
      window.removeEventListener('pagehide', onPageHide);
      panelConnection.current = null;
      connection.disconnect();
    };
  }, []);

  async function inspectPage() {
    clearInspection();
    const currentRequestId = ++requestId.current;
    setView({ kind: 'loading' });
    try {
      const response: unknown = await browser.runtime.sendMessage({
        type: 'INSPECT_ACTIVE_TAB',
        requestId: currentRequestId,
      });
      if (currentRequestId !== requestId.current) {
        if (isInspectionResponse(response) && response.type === 'INSPECTION_RESULT') {
          void browser.runtime.sendMessage({ type: 'STOP_INSPECTION', tabId: response.tabId, snapshotId: response.snapshot.snapshotId }).catch(() => undefined);
        }
        return;
      }
      if (!isInspectionResponse(response)) {
        setView({ kind: 'error', message: 'The inspection response was invalid. Try again.' });
        return;
      }
      if (response.type === 'INSPECTION_ERROR') {
        setView({ kind: 'error', message: ERROR_MESSAGES[response.reason] });
        return;
      }
      observedTabId.current = response.tabId;
      currentSnapshot.current = response.snapshot;
      panelConnection.current?.postMessage({ type: 'TRACK_PAGE', tabId: response.tabId });
      setView({ kind: 'ready', snapshot: response.snapshot });
    } catch {
      if (currentRequestId === requestId.current) {
        setView({ kind: 'error', message: 'Could not reach the extension. Reload ClickPilot and try again.' });
      }
    }
  }

  async function highlightElement(targetId: string, name: string) {
    if (view.kind !== 'ready' || observedTabId.current === null || !panelConnection.current) return;
    const currentRequestId = ++requestId.current;
    setHighlighting(true);
    currentTargetId.current = targetId;
    setSelectedId(null);
    setOverlayStatus('Checking the target…');
    try {
      const response: unknown = await browser.runtime.sendMessage({
        type: 'HIGHLIGHT_ELEMENT',
        tabId: observedTabId.current,
        pageKey: view.snapshot.pageKey,
        snapshotId: view.snapshot.snapshotId,
        targetId,
        instruction: `Selected: ${name || 'Unnamed control'}. Use this control yourself.`,
      });
      if (currentRequestId !== requestId.current) return;
      if (isOverlayResponse(response) && response.ok) {
        setSelectedId(targetId);
        setOverlayStatus(`Highlighting ${targetId}. Waiting for you to act.`);
      } else {
        setOverlayStatus('This target is unavailable, covered, or stale. Inspect the page again.');
      }
    } catch {
      if (currentRequestId === requestId.current) setOverlayStatus('Could not show the highlight. Inspect the page again.');
    } finally {
      if (currentRequestId === requestId.current) setHighlighting(false);
    }
  }

  return (
    <>
      <section className="welcome" aria-labelledby="welcome-title">
        <h1 id="welcome-title">See what’s on this page.</h1>
        <p>Inspect this tab, then choose a control to highlight. You make every click. The list stays in this extension.</p>
        <button className="primary-button" onClick={inspectPage} disabled={view.kind === 'loading'}>
          {view.kind === 'loading' ? 'Inspecting…' : 'Inspect this page'}
        </button>
      </section>

      {view.kind === 'error' && <p className="feedback" role="alert">{view.message}</p>}

      {view.kind === 'ready' && (
        <section className="results" aria-labelledby="results-title">
          <div className="results-heading">
            <h2 id="results-title">Visible controls ({view.snapshot.elements.length})</h2>
            <button className="text-button" onClick={clearInspection}>Stop</button>
          </div>
          <p className="overlay-status" role="status">{overlayStatus || 'Manual debug mode · Choose a control below. Lists expire after one minute.'}</p>
          {view.snapshot.elements.length === 0 ? (
            <p className="empty-results">No visible controls were found in this tab.</p>
          ) : (
            <ol className="element-list">
              {view.snapshot.elements.map((element) => (
                <li key={element.id} className={selectedId === element.id ? 'selected' : undefined}>
                  <span className="element-id">{element.id}</span>
                  <span className="element-name">{element.name || `Unnamed ${element.role}`}</span>
                  <span className="element-detail">
                    {element.role}{element.context && ` · ${element.context}`}{element.disabled && ' · disabled'}
                  </span>
                  <button className="highlight-button" aria-label={`Highlight ${element.id}: ${element.name || element.role}`}
                    aria-pressed={selectedId === element.id} disabled={element.disabled || highlighting}
                    onClick={() => highlightElement(element.id, element.name)}>Highlight</button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

    </>
  );
}

function App() {
  const [mode, setMode] = useState<'mock' | 'manual'>('mock');
  return (
    <main className="panel">
      <header className="panel-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>ClickPilot</span>
        </div>
        <span className="status">{mode === 'mock' ? 'Mock mode · Local only' : 'Manual highlights'}</span>
      </header>
      <nav className="mode-switch" aria-label="Guidance mode">
        <button type="button" aria-pressed={mode === 'mock'} onClick={() => setMode('mock')}>Mock guidance</button>
        <button type="button" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>Manual highlights</button>
      </nav>
      {mode === 'mock' ? <MockGuidance /> : <ManualInspection />}
      <footer>ClickPilot waits for you. Page details stay in this extension.</footer>
    </main>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('ClickPilot panel root is missing.');
}

createRoot(rootElement).render(<App />);
