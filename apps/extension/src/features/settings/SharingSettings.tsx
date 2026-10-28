import { useState, type FormEvent } from 'react';
import type { useAiPreferences } from './useAiPreferences';

type Sharing = ReturnType<typeof useAiPreferences>;

function SharingChoices({ guidance, selectedText, disabled, onChange }: {
  guidance: boolean; selectedText: boolean; disabled: boolean;
  onChange: (key: 'guidance' | 'selectedText', value: boolean) => void;
}) {
  return <fieldset className="sharing-choices" disabled={disabled}>
    <legend>Choose what you share with Gemini</legend>
    <label><input type="checkbox" checked={guidance} onChange={(event) => onChange('guidance', event.target.checked)} />
      <span><strong>Webpage guidance</strong><small>Your question, site origin, visible control labels, and brief task progress.</small></span></label>
    <label><input type="checkbox" checked={selectedText} onChange={(event) => onChange('selectedText', event.target.checked)} />
      <span><strong>Selected-text assistance</strong><small>Only the passage you select and the question you submit.</small></span></label>
  </fieldset>;
}

function PrivacyNote() {
  return <p className="sharing-note">Requests go through your configured backend to Google Gemini. Filtering has limits; use public pages and avoid personal information. Unpaid API usage may help improve Google’s products. No screenshots or input values are shared. Active task goals and a short reply summary may stay in extension memory for up to 30 minutes for recovery; Stop or revoke sharing to clear them. Your choices stay on this device and can be changed here anytime.</p>;
}

export function SharingOnboarding({ sharing }: { sharing: Sharing }) {
  const [guidance, setGuidance] = useState(false);
  const [selectedText, setSelectedText] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    void sharing.save({ onboardingComplete: true, guidance, selectedText });
  }
  return <section className="sharing-onboarding" aria-labelledby="onboarding-title">
    <h1 id="onboarding-title">A little help.<br />Your next move.</h1>
    <p>Ask about a page or a selected passage. Klicko explains and points the way. You make every click.</p>
    <form onSubmit={submit}>
      <SharingChoices guidance={guidance} selectedText={selectedText} disabled={sharing.saving}
        onChange={(key, value) => { if (key === 'guidance') setGuidance(value); else setSelectedText(value); }} />
      <PrivacyNote />
      <p className="sharing-note">Chrome’s toolbar button separately allows access to the current tab. Choosing AI sharing does not grant browser access.</p>
      {sharing.error && <p className="feedback" role="alert">{sharing.error}</p>}
      <button type="submit" className="primary-button" disabled={sharing.saving}>{sharing.saving ? 'Saving…' : 'Save choices and continue'}</button>
      <p className="sharing-note">Both choices are optional. Leave them off to explore local tools.</p>
    </form>
  </section>;
}

export function SharingSettings({ sharing }: { sharing: Sharing }) {
  const { guidance, selectedText } = sharing.preferences;
  return <section className="sharing-settings" id="sharing-settings" aria-label="AI sharing">
    <SharingChoices guidance={guidance} selectedText={selectedText} disabled={!sharing.ready || sharing.saving}
      onChange={(key, value) => { void sharing.save({ [key]: value }); }} />
    <PrivacyNote />
    <p className="sharing-note">Turning a choice off stops that assistance. A request already sent may have reached Google.</p>
    {sharing.error && <div role="alert"><p>{sharing.error}</p><button type="button" className="text-button" disabled={sharing.saving}
      onClick={() => { void sharing.save({}); }}>Retry saving choices</button></div>}
  </section>;
}
