import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const readPreference = () => preference.matches;
function subscribe(update: () => void) {
  preference.addEventListener('change', update);
  return () => preference.removeEventListener('change', update);
}

export function useRobotActivity(element: RefObject<HTMLElement | null>, visible: boolean) {
  const reduced = useSyncExternalStore(subscribe, readPreference);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  useEffect(() => {
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => { if (entry) setOnScreen(entry.isIntersecting); });
    if (element.current) observer.observe(element.current);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [element]);
  const active = visible && onScreen && pageVisible;
  return { active, still: reduced || !active };
}
