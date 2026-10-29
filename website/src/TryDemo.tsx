import { useState } from 'react';

type DemoStep = 'ready' | 'settings' | 'domains' | 'complete';

const messages: Record<DemoStep, string> = {
  ready: 'Choose the example task to see how guidance works.',
  settings: 'Start with Settings. You make the click.',
  domains: 'Nice. Now open Domains.',
  complete: 'You found domain settings. Every click was yours.',
};

export default function TryDemo() {
  const [step, setStep] = useState<DemoStep>('ready');
  const [hint, setHint] = useState('');

  function choose(control: 'overview' | 'settings' | 'domains' | 'deployments') {
    if (step === 'settings' && control === 'settings') {
      setStep('domains');
      setHint('');
      return;
    }
    if (step === 'domains' && control === 'domains') {
      setStep('complete');
      setHint('');
      return;
    }
    if (step === 'ready') {
      setHint('Start the example task first.');
      return;
    }
    if (step !== 'complete') setHint(`Follow the highlight: choose ${step === 'settings' ? 'Settings' : 'Domains'}.`);
  }

  return <div className="try-shell">
    <div className="try-toolbar">
      <span className="try-dot" aria-hidden="true" />
      <span className="try-address">studio.example / projects / horizon</span>
      <span className="demo-label">Interactive demo</span>
    </div>
    <div className="try-content">
      <div className="try-dashboard">
        <div className="try-side">
          <div className="try-side-brand"><span className="try-side-mark" /> Northstar <span className="try-side-chevron" aria-hidden="true" /></div>
          <p className="try-side-caption">WORKSPACE</p>
          <nav aria-label="Demo dashboard navigation">
            <button type="button" className="try-nav-item" onClick={() => choose('overview')}>Overview</button>
            <button type="button" className={`try-nav-item ${step === 'settings' ? 'is-target' : ''} ${step !== 'ready' ? 'is-active' : ''}`} onClick={() => choose('settings')}>
              Settings {step === 'settings' && <span className="target-pulse" aria-hidden="true" />}
            </button>
            <button type="button" className={`try-nav-item ${step === 'domains' ? 'is-target' : ''} ${step === 'complete' ? 'is-active' : ''}`} onClick={() => choose('domains')}>
              Domains {step === 'domains' && <span className="target-pulse" aria-hidden="true" />}
            </button>
            <button type="button" className="try-nav-item" onClick={() => choose('deployments')}>Deployments</button>
          </nav>
          <p className="try-side-foot">Illustrative workspace</p>
        </div>
        <div className="try-main" key={step === 'ready' ? 'ready' : step === 'settings' ? 'ready' : step === 'domains' ? 'settings' : 'complete'}>
          <div className="try-main-top"><span>Northstar / Horizon</span><span className="try-avatar">N</span></div>
          {step === 'ready' || step === 'settings' ? <>
            <span className="try-page-label">PROJECT OVERVIEW</span>
            <h3>Horizon</h3>
            <p>Your project is looking good. Everything you need is close by.</p>
            <div className="try-summary"><span>Production</span><strong>All systems ready</strong><span className="try-online-dot" /></div>
            <div className="try-placeholder-row"><span /><span /><span /></div>
          </> : step === 'domains' ? <>
            <span className="try-page-label">PROJECT SETTINGS</span>
            <h3>Settings</h3>
            <p>Manage your project details and connected domains.</p>
            <div className="try-summary"><span>Project name</span><strong>Horizon</strong></div>
            <div className="try-summary"><span>Default region</span><strong>Auto</strong></div>
          </> : <>
            <span className="try-page-label">PROJECT SETTINGS / DOMAINS</span>
            <h3>Domains</h3>
            <p>Here’s where you manage domains connected to this project.</p>
            <div className="try-domain"><span className="try-online-dot" /><strong>horizon.example</strong><span>Connected</span></div>
            <div className="try-success">Destination found <span aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="m4.5 10 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span></div>
          </>}
        </div>
      </div>
      <aside className="demo-buddy" aria-label="Klicko demo assistant">
        <div className="demo-buddy-head"><img src="/assets/klicko-robot.svg" alt="" /><span>Klicko</span><span className="demo-buddy-live">Demo</span></div>
        <div className="demo-chat">
          {step !== 'ready' && <div className="demo-user-line">Help me find domain settings.</div>}
          <div className="demo-buddy-line" aria-live="polite" aria-atomic="true">{messages[step]}</div>
          {hint && <p className="demo-hint" role="status">{hint}</p>}
        </div>
        <div className="demo-action">
          {step === 'ready' && <button className="button button-primary" type="button" onClick={() => { setStep('settings'); setHint(''); }}>Start example task <Arrow /></button>}
          {step === 'complete' && <button className="button button-secondary" type="button" onClick={() => { setStep('ready'); setHint(''); }}>Try again <Arrow /></button>}
          {(step === 'settings' || step === 'domains') && <span className="demo-action-note">Click the highlighted control on the left.</span>}
        </div>
      </aside>
    </div>
  </div>;
}

function Arrow() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
