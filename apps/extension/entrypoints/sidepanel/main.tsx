import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { createRoot } from 'react-dom/client';
import { AssistantPanel } from '../../src/features/session/AssistantPanel';
import { MockGuidance } from '../../src/features/session/MockGuidance';
import { ManualInspection } from '../../src/features/session/ManualInspection';
import { useGuidanceSession } from '../../src/features/session/useGuidanceSession';
import { useAiPreferences } from '../../src/features/settings/useAiPreferences';
import { SharingOnboarding, SharingSettings } from '../../src/features/settings/SharingSettings';
import { ProviderSettings } from '../../src/features/settings/ProviderSettings';
import './style.css';
import { uiTheme, uiDarkTheme } from '../../src/lib/ui-tokens';
import { Companion } from '../../src/features/buddy/CompanionAvatar';
import { companionMood } from '../../src/features/buddy/companion';
import '../../src/features/buddy/companion.css';
import { RobotCompanion } from '../../src/features/buddy/RobotCompanion';
import { MotionConfig, motion } from 'motion/react';
import { playSound } from '../../src/lib/sounds';

type View = 'chat' | 'settings' | 'developer' | 'text';
type Mode = 'assistant' | 'manual' | 'mock';

function App() {
  const [view, setView] = useState<View>('chat');
  const [mode, setMode] = useState<Mode>('assistant');
  const [conversationKey, setConversationKey] = useState(0);
  const [typingTarget, setTypingTarget] = useState<HTMLTextAreaElement | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sharing = useAiPreferences();
  const session = useGuidanceSession(mode === 'assistant', sharing.guidanceConsent, sharing.textConsent);
  const onboarded = sharing.ready && sharing.preferences.onboardingComplete;

  useEffect(() => { if (!browser.sidePanel.onOpened) playSound('sidebar'); }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const element = menu.current;
      if (element && event.target instanceof Node && !element.contains(event.target)) element.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !menu.current?.open) return;
      menu.current.open = false; menu.current.querySelector('summary')?.focus();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => { if (view !== 'chat') heading.current?.focus(); }, [view]);
  useEffect(() => {
    const settings = () => setView('settings');
    window.addEventListener('clickpilot-settings', settings);
    return () => window.removeEventListener('clickpilot-settings', settings);
  }, []);

  function changeMode(next: Mode) {
    if (next === mode) return;
    session.controller.current?.stop(); setMode(next);
  }
  function openView(next: View) {
    if (menu.current) menu.current.open = false;
    setView(next);
    if (next === 'chat') changeMode('assistant');
  }
  function newChat() {
    if (session.controller.current?.newChat) session.controller.current.newChat();
    else { session.textController.current?.stop(); session.controller.current?.stop(); }
    setConversationKey((value) => value + 1); openView('chat');
  }

  return <MotionConfig reducedMotion="user"><motion.main className="panel"
    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    onFocusCapture={(event) => {
      if (event.target instanceof HTMLTextAreaElement && event.target.closest('.chat-composer')) setTypingTarget(event.target);
    }}
    onBlurCapture={(event) => { if (event.target === typingTarget) setTypingTarget(null); }}>
    <div className="sidebar-perch">
      <RobotCompanion mood={companionMood(session.state, session.textState, session.sharedView?.source ?? 'guidance', session.connected)} typingTarget={typingTarget} />
    </div>
    <header className="panel-header">
      <div className="brand"><Companion mood={companionMood(session.state, session.textState, session.sharedView?.source ?? 'guidance', session.connected)} /><span>Klicko</span></div>
      {onboarded && (view !== 'chat' ? <button className="text-button back-button" onClick={() => openView('chat')}>Back to chat</button>
        : <details className="panel-menu" ref={menu}>
          <summary aria-label="More options">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          </summary>
          <div className="menu-options">
            <button onClick={newChat}>New chat</button>
            <button onClick={() => openView('settings')}>Settings</button>
            <button onClick={() => openView('text')}>Text selection</button>
            <button onClick={() => openView('developer')}>Developer tools</button>
          </div>
        </details>)}
    </header>

    {!sharing.ready ? <p className="loading-preferences" role="status">Loading…</p>
      : !onboarded ? <div className="onboarding-view"><SharingOnboarding sharing={sharing} /></div> : <>
      <div className="chat-view" hidden={view !== 'chat'}>
        <AssistantPanel key={conversationKey} session={session} live={mode === 'assistant'} visible={view === 'chat'} onSettings={() => openView('settings')} />
      </div>
      {view === 'settings' && <div className="secondary-view">
        <h1 ref={heading} tabIndex={-1}>Settings</h1>
        <ProviderSettings />
        <SharingSettings sharing={sharing} />
        <p className="settings-note">Messages stay in this panel session. Earlier messages aren’t sent with new questions.</p>
      </div>}
      {view === 'text' && <div className="secondary-view">
        <h1 ref={heading} tabIndex={-1}>Text selection</h1>
        <p className="secondary-intro">Select a passage on the page, then choose Ask Klicko. Your answer will appear in the chat.</p>
        {!session.textConsent && <p className="chat-notice">Selected-text sharing is off. <button className="text-button" onClick={() => openView('settings')}>Open Settings</button></p>}
        <p className="text-selection-status" role="status">{session.textState.message}</p>
        <div className="guidance-actions">
          <button className="primary-button" onClick={() => { session.textController.current?.enable(); }}>Enable text selection</button>
          <button className="text-button" onClick={() => session.textController.current?.stop()}>Stop text assistant</button>
        </div>
      </div>}
      {view === 'developer' && <div className="secondary-view developer-view">
        <h1 ref={heading} tabIndex={-1}>Developer tools</h1>
        <nav className="mode-switch" aria-label="Developer tools">
          <button aria-pressed={mode === 'manual'} onClick={() => changeMode('manual')}>Manual highlights</button>
          <button aria-pressed={mode === 'mock'} onClick={() => changeMode('mock')}>Mock guidance</button>
        </nav>
        {mode === 'manual' ? <ManualInspection session={session} /> : mode === 'mock' ? <MockGuidance session={session} />
          : <p className="secondary-intro">Inspect page controls or run a local mock task. Starting a tool ends active guidance.</p>}
      </div>}
    </>}
  </motion.main></MotionConfig>;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Klicko panel root is missing.');
const theme = document.createElement('style');
theme.textContent = `:root { ${uiTheme} } @media (prefers-color-scheme: dark) { :root { ${uiDarkTheme} } }`;
document.head.append(theme);
createRoot(rootElement).render(<App />);
