import { useEffect, useRef, useState } from 'react';
import TryDemo from './TryDemo';
import { chromeStoreUrl, githubUrl, privacyPolicyUrl, releaseZipUrl } from './site-config';

const navigation = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Try it', href: '#try-it' },
  { label: 'FAQ', href: '#faq' },
];

const faqs = [
  {
    question: 'What is Klicko?',
    answer: 'Klicko is a browser extension that helps you understand the page you’re on. Ask a question and it can point to a relevant control, guide you through supported steps, or explain selected text.',
  },
  {
    question: 'Does Klicko click buttons for me?',
    answer: 'No. Klicko can highlight and explain a next step, but you make every click and every browser action yourself.',
  },
  {
    question: 'Does it work on every website?',
    answer: 'Not every page is supported. Browser-protected pages and some embedded or custom interfaces can prevent observation or highlighting. Klicko shows a clear pause or unsupported state when it cannot continue safely.',
  },
  {
    question: 'Can Klicko explain selected text?',
    answer: 'Yes. On supported pages, select a short passage and ask Klicko a question. A quick explanation appears near the selection, with more detail in the sidebar after you choose to share it.',
  },
  {
    question: 'Is Klicko free?',
    answer: 'Pricing and public availability have not been announced. The Chrome release link will appear here when one is available.',
  },
  {
    question: 'Does it support voice?',
    answer: 'Voice interaction is planned, but it is not available in the current extension.',
  },
];

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CheckIcon() { return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4.5 10 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function InfoIcon() { return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" /><path d="M10 9v5m0-8v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>; }

function PlayIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 10 7-10 7V5Z" fill="currentColor" /></svg>;
}

function GetCTA({ className = '' }: { className?: string }) {
  return <a className={`button button-primary ${className}`} href="#install">Get Klicko <ArrowIcon /></a>;
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setMenuOpen(false); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return <header className="site-header">
    <div className="header-inner page-wrap">
      <a className="brand" href="#top" aria-label="Klicko, back to top"><span className="brand-mark"><img src="/assets/klicko-robot.svg" alt="" /></span><span>Klicko<span className="brand-period">.</span></span></a>
      <nav className={`header-nav ${menuOpen ? 'is-open' : ''}`} id="primary-navigation" aria-label="Main navigation">
        {navigation.map((item) => <a href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
        <GetCTA className="mobile-cta" />
      </nav>
      <GetCTA className="header-cta" />
      <button className="menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>
        <span /><span />
      </button>
    </div>
  </header>;
}

function Hero() {
  return <section className="hero page-wrap" id="top" aria-labelledby="hero-title">
    <div className="hero-copy">
      <div className="hero-intro"><span className="hero-intro-dot" /> A little help, right where you are</div>
      <h1 id="hero-title">Meet Klicko.<br /><em>Your little browser buddy.</em></h1>
      <p>Ask anything about the webpage you’re on. Klicko shows you where to go, explains what you see, and helps you navigate — one click at a time.</p>
      <div className="hero-actions"><GetCTA /><a className="button button-text" href="#demo-video">Watch demo <PlayIcon /></a></div>
      <div className="hero-trust"><span className="hero-trust-line" /> You make every click.</div>
    </div>
    <div className="hero-art" role="img" aria-label="Klicko robot beside an example guided highlight">
      <div className="hero-art-field" />
      <div className="hero-ui-card hero-ui-card-back" aria-hidden="true"><div className="hero-ui-top"><i /><i /><i /></div><span className="ui-line long" /><span className="ui-line short" /><span className="ui-line medium" /></div>
      <div className="hero-ui-card hero-ui-card-front" aria-hidden="true"><div className="hero-ui-top"><i /><i /><i /></div><span className="ui-line medium" /><span className="ui-button">Settings <ArrowIcon /></span></div>
      <div className="hero-highlight" aria-hidden="true" />
      <img className="hero-robot" src="/assets/klicko-robot.svg" alt="" fetchPriority="high" />
      <div className="hero-speech" aria-hidden="true">Right here <ArrowIcon /></div>
      <div className="hero-art-caption">A helpful nudge.<br />The next move is yours.</div>
    </div>
  </section>;
}

function VideoShowcase() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  async function startVideo() {
    try { await video.current?.play(); }
    catch { setError(true); }
  }

  return <section className="video-section" id="demo-video" aria-labelledby="video-title">
    <div className="page-wrap">
      <div className="section-heading section-heading-center"><h2 id="video-title">See Klicko in action.</h2><p>From a question to the right click.</p></div>
      <div className="video-frame">
        <video ref={video} controls={playing} playsInline preload="none" poster="/assets/klicko-demo-poster.jpg" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError(true)} aria-label="Klicko product launch video">
          <source src="/assets/klicko-demo.mp4" type="video/mp4" />
          Your browser does not support HTML video.
        </video>
        {!playing && !error && <button className="video-play" type="button" onClick={startVideo} aria-label="Play Klicko demo video"><PlayIcon /><span>Play film</span></button>}
        {error && <p className="video-error" role="alert">The video could not play. Check that the MP4 asset loaded, then try again.</p>}
      </div>
      <p className="video-caption">A short, illustrative product film using Klicko’s real companion. <span>00:25</span></p>
    </div>
  </section>;
}

function HowItWorks() {
  return <section className="how-section page-wrap" id="how-it-works" aria-labelledby="how-title">
    <div className="section-heading"><h2 id="how-title">Just ask.<br /><em>Klicko guides.</em></h2><p>Simple help that leaves the browsing to you.</p></div>
    <div className="steps">
      <article className="step"><span className="step-number">01</span><div className="step-visual step-ask"><span className="visual-chat">Where do I change my domain?<span className="visual-cursor" /></span></div><h3>Ask Klicko</h3><p>Tell Klicko what you want to do on the current page.</p></article>
      <article className="step"><span className="step-number">02</span><div className="step-visual step-highlight"><span className="visual-window"><span className="visual-window-line" /><span className="visual-target">Settings <ArrowIcon /></span><span className="visual-window-line short" /></span></div><h3>Follow the highlight</h3><p>Klicko finds the relevant control and shows you where to click.</p></article>
      <article className="step"><span className="step-number">03</span><div className="step-visual step-continue"><img src="/assets/klicko-robot.svg" alt="" /><span className="visual-done">Next step <ArrowIcon /></span></div><h3>Keep going</h3><p>You make the click. Klicko observes the updated page and helps with the next step.</p></article>
    </div>
  </section>;
}

function Features() {
  return <section className="features-section" id="features" aria-labelledby="features-title">
    <div className="page-wrap">
      <div className="section-heading"><h2 id="features-title">A smarter way<br />to browse.</h2><p>Help that makes sense of the page in front of you.</p></div>
      <div className="feature-grid">
        <article className="feature-major feature-question"><div className="feature-copy"><span className="feature-index">01 / ASK</span><h3>Ask about any page.</h3><p>Get helpful answers about available webpage information, right in your sidebar.</p></div><div className="feature-question-art" aria-hidden="true"><div className="feature-mini-browser"><span className="mini-line a" /><span className="mini-line b" /><span className="mini-line c" /></div><div className="feature-mini-chat">What does this setting do?<span>Klicko can explain what’s on this page.</span></div></div></article>
        <article className="feature-major feature-highlight"><div className="feature-copy"><span className="feature-index">02 / GUIDE</span><h3>See exactly where to click.</h3><p>A clear highlight points to a relevant control. Your cursor and your decision stay yours.</p></div><div className="feature-highlight-art" aria-hidden="true"><span className="feature-highlight-button">Manage domains <ArrowIcon /></span><span className="feature-pointer" /></div></article>
      </div>
      <div className="feature-details">
        <article><span className="feature-detail-icon"><ArrowIcon /></span><div><h3>One step at a time</h3><p>Follow menus and supported navigation with temporary task context and a way to continue after interruptions.</p></div></article>
        <article><span className="feature-detail-icon"><QuoteIcon /></span><div><h3>Understand selected text</h3><p>Select a passage for a quick explanation, then read more in the sidebar.</p></div></article>
        <article><span className="feature-detail-icon"><BuddyIcon /></span><div><h3>A floating companion</h3><p>Klicko stays nearby on supported pages while the extension is active.</p></div></article>
        <article><span className="feature-detail-icon"><PanelIcon /></span><div><h3>A sidebar when you need more</h3><p>Open the full conversation for detailed answers and task progress.</p></div></article>
      </div>
    </div>
  </section>;
}

function QuoteIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h5v7H3v-7c0-4 2-6 6-7m8 7h5v7h-7v-7c0-4 2-6 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function BuddyIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="6" stroke="currentColor" strokeWidth="1.6" /><path d="M8 12h2m4 0h2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>; }
function PanelIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" /><path d="M15 4v16M6 8h6m-6 4h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>; }

function Install() {
  const installUrl = chromeStoreUrl ?? releaseZipUrl;
  return <section className="install-section" id="install" aria-labelledby="install-title">
    <div className="page-wrap">
      <div className="install-top">
        <div><h2 id="install-title">Get Klicko.<br /><em>Try it in your browser.</em></h2><p>Install the extension manually in Chrome or Brave. The download will open here once the release build is verified.</p></div>
        <div className="install-download">
          <span className="install-file-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M16 5v16m-6-6 6 6 6-6M6 23v4h20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div><strong>Klicko for Chromium</strong><span>{chromeStoreUrl ? 'Chrome Web Store listing' : 'Release ZIP · built extension files'}</span></div>
          {installUrl ? <a className="button button-primary" href={installUrl} {...(chromeStoreUrl ? { target: '_blank', rel: 'noopener noreferrer' } : { download: true })}>{chromeStoreUrl ? 'Add to Chrome' : 'Download Extension'} <ArrowIcon /></a> : <button className="button button-primary" type="button" disabled aria-describedby="download-status">Download Extension <ArrowIcon /></button>}
          {!installUrl && <p id="download-status" role="status">Download pending production checks.</p>}
        </div>
      </div>
      <div className="install-divider"><span>Install in five simple steps</span><span>Chrome · Brave</span></div>
      <ol className="install-steps">
        <li><span className="install-step-num">01</span><div><h3>Download and extract</h3><p>Download the release ZIP above, then extract it to a folder you’ll keep.</p></div><div className="install-illustration ill-folder" aria-hidden="true"><span className="ill-zip">ZIP</span><span className="ill-folder-shape" /></div></li>
        <li><span className="install-step-num">02</span><div><h3>Open Extensions</h3><p>In your browser’s address bar, open <code>chrome://extensions</code> or <code>brave://extensions</code>.</p></div><div className="install-illustration ill-address" aria-hidden="true"><span>chrome://extensions</span></div></li>
        <li><span className="install-step-num">03</span><div><h3>Enable Developer mode</h3><p>Turn on the Developer mode switch in the upper right corner.</p></div><div className="install-illustration ill-toggle" aria-hidden="true"><span>Developer mode</span><i /></div></li>
        <li><span className="install-step-num">04</span><div><h3>Choose Load unpacked</h3><p>Click <strong>Load unpacked</strong> in the toolbar that appears.</p></div><div className="install-illustration ill-load" aria-hidden="true"><span>Load unpacked</span></div></li>
        <li><span className="install-step-num">05</span><div><h3>Select the extracted folder</h3><p>Choose the folder that directly contains <code>manifest.json</code>. Klicko will appear in your extensions.</p></div><div className="install-illustration ill-manifest" aria-hidden="true"><span className="ill-folder-small" /><span>manifest.json</span></div></li>
      </ol>
      <p className="install-note"><InfoIcon /> This is a developer-mode installation while Klicko is not on the Chrome Web Store. Only install a release ZIP you trust.</p>
    </div>
  </section>;
}

function App() {
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Header />
    <main id="main-content">
      <Hero />
      <VideoShowcase />
      <HowItWorks />
      <section className="try-section" id="try-it" aria-labelledby="try-title"><div className="page-wrap"><div className="section-heading section-heading-center"><h2 id="try-title">Try Klicko right here.</h2><p>Take the controls in this tiny guided preview.</p></div><TryDemo /><p className="try-disclaimer">This is a local, scripted example. It does not use AI or connect to a real project.</p></div></section>
      <Features />
      <section className="control-section" id="privacy" aria-labelledby="control-title"><div className="page-wrap control-layout"><div><span className="privacy-label">PRIVACY & CONTROL</span><h2 id="control-title">Help begins<br /><em>when you ask.</em></h2><p>Klicko points the way. You decide what to ask, what to share, and when to click.</p></div><div className="control-list"><div><span aria-hidden="true"><CheckIcon /></span><p>Klicko guides; it never clicks, types, or submits for you.</p></div><div><span aria-hidden="true"><CheckIcon /></span><p>Webpage guidance and selected-text help each need your sharing choice before an AI request.</p></div><div><span aria-hidden="true"><CheckIcon /></span><p>The current extension sends filtered, bounded context after you ask. It does not upload full page HTML or screenshots.</p></div><div><span aria-hidden="true"><CheckIcon /></span><p>You can stop a task or turn Klicko off. Browser access remains under Chrome’s permission controls.</p></div><p className="control-caveat">Filtering is heuristic. Use Klicko on public, non-sensitive pages.</p></div></div></section>
      <section className="faq-section page-wrap" id="faq" aria-labelledby="faq-title"><div className="faq-heading"><h2 id="faq-title">Good questions.</h2><p>A few things you might be wondering.</p></div><div className="faq-list">{faqs.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
      <Install />
      <section className="closing-section" aria-labelledby="closing-title"><div className="page-wrap closing-layout"><div className="closing-copy"><h2 id="closing-title">Browsing is better<br />with a buddy.</h2><p>Meet your new companion for understanding and navigating the web.</p><GetCTA /></div><img className="closing-robot" src="/assets/klicko-robot.svg" alt="Klicko, the friendly yellow robot companion" loading="lazy" /></div></section>
    </main>
    <footer className="site-footer"><div className="page-wrap footer-main"><a className="footer-brand" href="#top">Klicko<span>.</span></a><p>You make every click.</p><div className="footer-links"><a href={githubUrl} target="_blank" rel="noopener noreferrer">GitHub</a><a href="#privacy">Privacy & control</a>{privacyPolicyUrl ? <a href={privacyPolicyUrl}>Privacy policy</a> : <span>Formal privacy policy required before public release</span>}</div></div><div className="page-wrap footer-bottom"><span>© {new Date().getFullYear()} Klicko</span><span>Made for more confident browsing.</span></div></footer>
  </>;
}

export default App;
