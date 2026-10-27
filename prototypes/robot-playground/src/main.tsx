import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, MotionConfig, motion, useMotionValue, useSpring } from 'motion/react';
import { Robot } from './Robot';
import { expressions, expressionDescriptions, type ExpressionPreview } from './expressions';
import './style.css';

type Scene = 'portrait' | 'buddy' | 'sidebar';
const spring = { type: 'spring' as const, stiffness: 260, damping: 25, mass: 0.8 };
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const readMotionPreference = () => motionPreference.matches;
function subscribeMotionPreference(update: () => void) {
  motionPreference.addEventListener('change', update);
  return () => motionPreference.removeEventListener('change', update);
}

function App() {
  const [scene, setScene] = useState<Scene>('portrait');
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [dark, setDark] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [onScreen, setOnScreen] = useState(true);
  const [askOpen, setAskOpen] = useState(false);
  const [preview, setPreview] = useState<ExpressionPreview>('Automatic');
  const [currentExpression, setCurrentExpression] = useState('Idle');
  const [clickSignal, setClickSignal] = useState(0);
  const reportExpression = useCallback((name: string) => setCurrentExpression(name), []);
  const [typingTarget, setTypingTarget] = useState<HTMLTextAreaElement | null>(null);
  const [area, setArea] = useState({ width: 760, height: 560 });
  const stage = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  // Subscribe directly so changing the OS preference also updates Rive immediately.
  const systemReduced = useSyncExternalStore(subscribeMotionPreference, readMotionPreference);
  const active = visible && onScreen;
  const still = paused || reduce || systemReduced || !active;
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const bounce = useSpring(0, { stiffness: 340, damping: 15 });

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setArea({ width: entry.contentRect.width, height: entry.contentRect.height });
      dragX.set(0);
      dragY.set(0);
    });
    observer.observe(stage.current);
    const intersection = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    intersection.observe(stage.current);
    return () => { observer.disconnect(); intersection.disconnect(); };
  }, [dragX, dragY]);

  useEffect(() => {
    if (still) { bounce.jump(0); dragX.stop(); dragY.stop(); }
  }, [still, bounce, dragX, dragY]);

  const size = scene === 'portrait' ? Math.min(320, area.width - 20) : scene === 'buddy' ? 108 : 180;
  const panelWidth = Math.min(320, area.width - 32);
  const x = scene === 'sidebar' ? area.width - 16 - panelWidth / 2 - size / 2
    : scene === 'buddy' ? area.width - size - 28 : (area.width - size) / 2;
  const y = scene === 'sidebar' ? 34 : scene === 'buddy' ? area.height - size - 40 : (area.height - size * 0.9) / 2 - 15;
  const transition = still ? { duration: 0 } : spring;
  const floating = !still && scene !== 'sidebar' && currentExpression !== 'Sleepy';

  function changeScene(next: Scene) {
    dragX.stop();
    dragY.stop();
    dragX.set(0);
    dragY.set(0);
    bounce.jump(0);
    setTypingTarget(null);
    setAskOpen(false);
    setScene(next);
  }

  function reactToClick() {
    if (dragged.current) { dragged.current = false; return; }
    setClickSignal((signal) => signal + 1);
    if (!still) { bounce.jump(-12); bounce.set(0); }
    if (scene === 'buddy') setAskOpen((open) => !open);
  }

  const composer = (label: string) => (
    <label className="composer">
      <span>{label}</span>
      <textarea placeholder="Try typing a little hello…" rows={3}
        onFocus={(event) => setTypingTarget(event.currentTarget)}
        onBlur={() => setTypingTarget(null)} />
      <small>Local interaction demo. Nothing is sent.</small>
    </label>
  );

  return (
    <MotionConfig reducedMotion={still ? 'always' : 'never'}>
      <main className={dark ? 'workshop dark' : 'workshop'}>
        <header className="topbar">
          <a className="wordmark" href="#main">ClickPilot<span className="brand-dot" /></a>
          <span className="review-label">Character workshop</span>
          <button className="quiet-button" onClick={() => setDark(!dark)}>{dark ? 'Light stage' : 'Dark stage'}</button>
        </header>
        <div className="workbench" id="main">
          <section className="notes" aria-labelledby="title">
            <h1 id="title">A little more<br /><em>alive.</em></h1>
            <p>A curious pair of eyes. A well-loved yellow shell. A companion that notices you.</p>
            <div className="review-state"><span /> Expression review</div>
            <h2>Meet your new co-pilot</h2>
            <p className="small-copy">Come closer for a smile. Click for a little surprise. Type, and watch it lean in.</p>
            <fieldset className="scene-picker">
              <legend>Try it in context</legend>
              {(['portrait', 'buddy', 'sidebar'] as const).map((value) => (
                <button key={value} aria-pressed={scene === value} onClick={() => changeScene(value)}>
                  <span>{value === 'portrait' ? 'Character study' : value === 'buddy' ? 'Floating buddy' : 'Sidebar perch'}</span>
                  <span aria-hidden="true">{value === 'portrait' ? '01' : value === 'buddy' ? '02' : '03'}</span>
                </button>
              ))}
            </fieldset>
            <fieldset className="expression-picker">
              <legend>Explore its expressions</legend>
              {(['Automatic', ...expressions] as const).map((name) => (
                <button key={name} aria-pressed={preview === name} onClick={() => setPreview(name)}>{name}</button>
              ))}
            </fieldset>
            <p className="stage-note">{preview === 'Automatic' ? 'Automatic follows your attention. The other buttons preview expressions locally; they do not start a task.' : expressionDescriptions[preview]}</p>
          </section>

          <section className="preview" aria-label="Interactive robot prototype">
            <div className="stage-toolbar">
              <output aria-live="polite" aria-label="Current expression">{currentExpression}{still ? ' · motion paused' : preview === 'Automatic' ? ' · automatic' : ' · preview'}</output>
              <button className="quiet-button" onClick={() => changeScene(scene)}>Reset position</button>
            </div>
            <div ref={stage} className={`stage scene-${scene}`}>
              {scene === 'portrait' && <div className="stage-ground" aria-hidden="true" />}
              {scene === 'buddy' && <div className="page-sample"><span>YOUR WEBPAGE</span><h2>Room for a<br />small companion.</h2><p>The buddy stays close without taking over.</p></div>}
              <motion.div className="robot-position" animate={{ x, y, width: size, height: size * 0.9 }} transition={transition}>
                <motion.div className="robot-drag" style={{ x: dragX, y: dragY }} drag={scene !== 'sidebar'}
                  dragConstraints={{ left: -x, right: area.width - x - size, top: -y, bottom: area.height - y - size * 0.9 }}
                  dragElastic={still ? 0 : 0.08} dragMomentum={!still} dragTransition={{ bounceStiffness: 400, bounceDamping: 28 }}
                  onDragStart={() => { dragged.current = true; setAskOpen(false); setTypingTarget(null); }}
                  onPointerDown={() => { dragged.current = false; }}>
                  <motion.div animate={{ y: floating ? [0, -4, 0] : 0 }}
                    transition={floating ? { duration: 5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}>
                    <motion.button className="robot-hit" aria-label={scene === 'buddy' ? 'ClickPilot buddy: open or close ask card' : 'Nudge ClickPilot robot'}
                      style={{ y: bounce }} whileHover={still ? {} : { scale: 1.035 }} whileTap={still ? {} : { scale: 0.95 }}
                      transition={transition} onClick={reactToClick}
                      onKeyDown={(event) => {
                        if (scene === 'sidebar' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
                        event.preventDefault();
                        if (event.key === 'Home') { dragX.set(0); dragY.set(0); return; }
                        const dx = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0;
                        const dy = event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0;
                        dragX.set(Math.max(-x, Math.min(area.width - x - size, dragX.get() + dx)));
                        dragY.set(Math.max(-y, Math.min(area.height - y - size * 0.9, dragY.get() + dy)));
                      }}>
                      <Robot still={still} visible={active} typingTarget={typingTarget} preview={preview}
                        clickSignal={clickSignal} context={scene} onExpressionChange={reportExpression} />
                    </motion.button>
                  </motion.div>
                </motion.div>
              </motion.div>

              <AnimatePresence initial={false}>
                {scene === 'sidebar' && <motion.aside key="sidebar" className="sample-sidebar" style={{ width: panelWidth }}
                  initial={{ x: still ? 0 : 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  exit={{ x: still ? 0 : 40, opacity: 0 }} transition={transition}>
                  <header><strong>ClickPilot</strong><button className="quiet-button" onClick={() => changeScene('buddy')} aria-label="Close sample sidebar">Close</button></header>
                  <div className="sidebar-intro"><span className="brand-dot" /><h2>Right here<br />when you need me.</h2><p>The workspace sits in front.<br />Your companion peeks over the edge.</p></div>
                  {composer('Give it something to look at')}
                </motion.aside>}
                {scene === 'buddy' && askOpen && <motion.section key="ask" className="sample-ask" style={{ width: panelWidth }}
                  initial={{ y: still ? 0 : 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: still ? 0 : 6, opacity: 0 }} transition={transition}>
                  <header><strong>A little help?</strong><button className="quiet-button" onClick={() => { setAskOpen(false); setTypingTarget(null); }}>Close</button></header>
                  {composer('What are you working on?')}
                  <button className="workspace-button" onClick={() => changeScene('sidebar')}>Open workspace <span aria-hidden="true">→</span></button>
                </motion.section>}
              </AnimatePresence>
              <span className="stage-caption">{scene === 'sidebar' ? 'A peek over the workspace edge' : 'Drag to move · arrow keys to adjust · Home to reset'}</span>
            </div>
            <footer className="preview-controls">
              <button className="pause-button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Resume animation' : 'Pause animation'}</button>
              <label><input type="checkbox" checked={reduce} onChange={(event) => setReduce(event.target.checked)} /> Reduce motion</label>
              {systemReduced && <small>System preference active</small>}
            </footer>
          </section>
        </div>
        <footer className="page-footer"><span>Rive expressions. Motion movement.</span><span>Standalone prototype · no extension changes</span></footer>
      </main>
    </MotionConfig>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
