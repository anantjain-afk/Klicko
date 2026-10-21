import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return (
    <main className="panel">
      <header className="panel-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>ClickPilot</span>
        </div>
        <span className="status">Foundation build</span>
      </header>

      <section className="welcome" aria-labelledby="welcome-title">
        <div className="guide-line" aria-hidden="true">
          <span className="guide-point" />
        </div>
        <h1 id="welcome-title">Find your way around.</h1>
        <p>
          ClickPilot will guide you through websites one step at a time, while
          you stay in control of every action.
        </p>
      </section>

      <section className="availability" aria-labelledby="availability-title">
        <h2 id="availability-title">What works now</h2>
        <p>The side panel opens from the toolbar. Page guidance is not available in this build yet.</p>
      </section>

      <footer>ClickPilot never clicks or types for you.</footer>
    </main>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('ClickPilot panel root is missing.');
}

createRoot(rootElement).render(<App />);
