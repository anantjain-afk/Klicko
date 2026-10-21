import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { isInspectionResponse, type PageSnapshot } from '../../src/lib/messages';
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

function App() {
  const [view, setView] = useState<ViewState>({ kind: 'idle' });
  const requestId = useRef(0);
  const observedTabId = useRef<number | null>(null);

  function clearInspection() {
    requestId.current += 1;
    const tabId = observedTabId.current;
    observedTabId.current = null;
    setView({ kind: 'idle' });
    if (tabId !== null) {
      void browser.runtime.sendMessage({ type: 'STOP_INSPECTION', tabId }).catch(() => undefined);
    }
  }

  useEffect(() => {
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
    }

    browser.tabs.onActivated.addListener(onTabActivated);
    browser.tabs.onUpdated.addListener(onTabUpdated);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      browser.tabs.onActivated.removeListener(onTabActivated);
      browser.tabs.onUpdated.removeListener(onTabUpdated);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  async function inspectPage() {
    const currentRequestId = ++requestId.current;
    setView({ kind: 'loading' });
    try {
      const response: unknown = await browser.runtime.sendMessage({
        type: 'INSPECT_ACTIVE_TAB',
        requestId: currentRequestId,
      });
      if (currentRequestId !== requestId.current) {
        if (isInspectionResponse(response) && response.type === 'INSPECTION_RESULT') {
          void browser.runtime.sendMessage({ type: 'STOP_INSPECTION', tabId: response.tabId }).catch(() => undefined);
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
      setView({ kind: 'ready', snapshot: response.snapshot });
    } catch {
      if (currentRequestId === requestId.current) {
        setView({ kind: 'error', message: 'Could not reach the extension. Reload ClickPilot and try again.' });
      }
    }
  }

  return (
    <main className="panel">
      <header className="panel-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>ClickPilot</span>
        </div>
        <span className="status">Page inspection</span>
      </header>

      <section className="welcome" aria-labelledby="welcome-title">
        <h1 id="welcome-title">See what’s on this page.</h1>
        <p>Inspect visible controls on the tab you activated. The list stays in this extension.</p>
        <button className="primary-button" onClick={inspectPage} disabled={view.kind === 'loading'}>
          {view.kind === 'loading' ? 'Inspecting…' : 'Inspect this page'}
        </button>
      </section>

      {view.kind === 'error' && <p className="feedback" role="alert">{view.message}</p>}

      {view.kind === 'ready' && (
        <section className="results" aria-labelledby="results-title">
          <div className="results-heading">
            <h2 id="results-title">Visible controls ({view.snapshot.elements.length})</h2>
            <button className="text-button" onClick={clearInspection}>Clear</button>
          </div>
          {view.snapshot.elements.length === 0 ? (
            <p className="empty-results">No visible controls were found in this tab.</p>
          ) : (
            <ol className="element-list">
              {view.snapshot.elements.map((element) => (
                <li key={element.id}>
                  <span className="element-id">{element.id}</span>
                  <span className="element-name">{element.name || `Unnamed ${element.role}`}</span>
                  <span className="element-detail">
                    {element.role}{element.context && ` · ${element.context}`}{element.disabled && ' · disabled'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <footer>Inspection does not click, type, or send page details to a server.</footer>
    </main>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('ClickPilot panel root is missing.');
}

createRoot(rootElement).render(<App />);
