import { useEffect, useRef } from 'react';
import { createCompanion, type CompanionMood } from './companion';

export function Companion({ mood = 'idle', className = '' }: { mood?: CompanionMood; className?: string }) {
  const container = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = container.current;
    element?.replaceChildren(createCompanion());
    return () => element?.replaceChildren();
  }, []);
  return <span ref={container} className={`companion-avatar ${className}`} data-mood={mood} aria-hidden="true" />;
}
