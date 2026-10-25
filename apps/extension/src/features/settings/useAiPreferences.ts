import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { AI_PREFERENCES_KEY, DEFAULT_AI_PREFERENCES, readAiPreferences, type AiPreferences } from '../../lib/preferences';

export function useAiPreferences() {
  const [preferences, setPreferences] = useState<AiPreferences>({ ...DEFAULT_AI_PREFERENCES });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(preferences);
  const confirmed = useRef(preferences);
  const writing = useRef(false);
  const storageRevision = useRef(0);

  function apply(value: AiPreferences) { current.current = value; setPreferences(value); }
  function applySaved(value: AiPreferences) { confirmed.current = value; apply(value); }

  useEffect(() => {
    let disposed = false;
    let changed = false;
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !(AI_PREFERENCES_KEY in changes)) return;
      changed = true;
      storageRevision.current++;
      applySaved(readAiPreferences(changes[AI_PREFERENCES_KEY]?.newValue));
      setReady(true);
    };
    browser.storage.onChanged.addListener(onChanged);
    void browser.storage.local.get(AI_PREFERENCES_KEY).then((data) => {
      if (!disposed && !changed) { applySaved(readAiPreferences(data[AI_PREFERENCES_KEY])); setReady(true); }
    }).catch(() => {
      if (!disposed && !changed) {
        setError('Couldn’t load your sharing choices. AI sharing is off. Save your choices to try again.'); setReady(true);
      }
    });
    return () => { disposed = true; browser.storage.onChanged.removeListener(onChanged); };
  }, []);

  async function save(changes: Partial<Pick<AiPreferences, 'guidance' | 'selectedText' | 'onboardingComplete'>>) {
    if (writing.current) return;
    const next = readAiPreferences({ ...current.current, ...changes });
    const revision = storageRevision.current;
    // Reflect the gesture immediately; uploads require both the choice and a saved grant.
    apply({ ...next, onboardingComplete: current.current.onboardingComplete });
    writing.current = true; setSaving(true); setError('');
    try {
      await browser.storage.local.set({ [AI_PREFERENCES_KEY]: next });
      if (storageRevision.current === revision) applySaved(next);
    } catch {
      apply({ ...current.current, guidance: current.current.guidance && confirmed.current.guidance,
        selectedText: current.current.selectedText && confirmed.current.selectedText });
      setError('Couldn’t save your choices. Sharing turned off here stays off in this panel; retry saving before you close it.');
    } finally { writing.current = false; setSaving(false); }
  }

  return { preferences, ready, saving, error, save,
    guidanceConsent: ready && preferences.guidance && confirmed.current.guidance,
    textConsent: ready && preferences.selectedText && confirmed.current.selectedText };
}
