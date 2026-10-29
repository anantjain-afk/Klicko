import { useEffect, useState, type FormEvent } from 'react';
import { browser } from 'wxt/browser';
import { ACTIVE_PROVIDER_KEY, PROVIDERS, PROVIDER_SETTINGS_KEY, PROVIDER_STORAGE_KEYS,
  isProvider, modelAllowed, providerSettingsKey, readProviderSettings, readProviderStore,
  type Provider, type ProviderSettings, type SavedProviders } from '../../lib/provider-settings';

export function ProviderSettings() {
  const [saved, setSaved] = useState<SavedProviders>({});
  const [provider, setProvider] = useState<Provider>('gemini');
  const [model, setModel] = useState<string>(PROVIDERS.gemini.models[0].id);
  const [apiKey, setApiKey] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let disposed = false;
    void browser.storage.local.get(PROVIDER_STORAGE_KEYS).then((data) => {
      if (disposed) return;
      const settings = readProviderStore(data);
      setSaved(settings.saved);
      if (settings.active) {
        setProvider(settings.active);
        setModel(settings.saved[settings.active]?.model ?? PROVIDERS[settings.active].models[0].id);
      }
      setReady(true);
    }).catch(() => { if (!disposed) { setMessage('Couldn’t load model settings. Try reopening Settings.'); setReady(true); } });
    return () => { disposed = true; };
  }, []);

  function chooseProvider(value: string) {
    if (!isProvider(value)) return;
    setProvider(value);
    setModel(saved[value]?.model ?? PROVIDERS[value].models[0].id);
    setApiKey('');
    setMessage('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !modelAllowed(provider, model)) return;
    const key = apiKey.trim() || saved[provider]?.apiKey || '';
    const next = readProviderSettings({ version: 1, provider, model, apiKey: key });
    if (!next) { setMessage('Enter a valid API key for this provider.'); return; }
    setBusy(true); setMessage('');
    try {
      // Keep this call inside the Save gesture so Chrome can show its permission prompt.
      const granted = await browser.permissions.request({ origins: [PROVIDERS[provider].origin] });
      if (!granted) { setMessage('Provider access was not granted. Save again to retry.'); return; }
      await browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
      const data = await browser.storage.local.get(PROVIDER_STORAGE_KEYS);
      const legacy = readProviderSettings(data[PROVIDER_SETTINGS_KEY]);
      const updates: Record<string, ProviderSettings | Provider> = {
        [providerSettingsKey(provider)]: next,
        [ACTIVE_PROVIDER_KEY]: provider,
      };
      if (legacy && legacy.provider !== provider
        && !readProviderSettings(data[providerSettingsKey(legacy.provider)])) {
        updates[providerSettingsKey(legacy.provider)] = legacy;
      }
      await browser.storage.local.set(updates);
      await browser.storage.local.remove(PROVIDER_SETTINGS_KEY);
      setSaved(readProviderStore({ ...data, ...updates, [PROVIDER_SETTINGS_KEY]: undefined }).saved);
      setApiKey('');
      setMessage(`${PROVIDERS[provider].label} and ${model} saved on this device.`);
    } catch { setMessage('Couldn’t save model settings. Try again.'); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const data = await browser.storage.local.get(PROVIDER_SETTINGS_KEY);
      const legacy = readProviderSettings(data[PROVIDER_SETTINGS_KEY]);
      await browser.storage.local.remove(legacy?.provider === provider
        ? [providerSettingsKey(provider), PROVIDER_SETTINGS_KEY] : providerSettingsKey(provider));
      setSaved((current) => { const remaining = { ...current }; delete remaining[provider]; return remaining; });
      setApiKey('');
      setMessage(`${PROVIDERS[provider].label} API key removed.`);
    } catch { setMessage('Couldn’t remove the saved API key. Try again.'); }
    finally { setBusy(false); }
  }

  return <section className="provider-settings" aria-label="AI provider and model">
    <h2>Model for Klicko</h2>
    <p>Choose the provider and model used when you ask a question. Usage may be charged to your provider account.</p>
    <form onSubmit={save}>
      <label htmlFor="provider-choice">Provider</label>
      <select id="provider-choice" value={provider} disabled={!ready || busy} onChange={(event) => chooseProvider(event.target.value)}>
        {Object.entries(PROVIDERS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
      </select>
      <label htmlFor="model-choice">Model</label>
      <select id="model-choice" value={model} disabled={!ready || busy} onChange={(event) => { setModel(event.target.value); setMessage(''); }}>
        {PROVIDERS[provider].models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <label htmlFor="provider-key">API key</label>
      <input id="provider-key" type="password" value={apiKey} autoComplete="off" spellCheck={false}
        disabled={!ready || busy} onChange={(event) => { setApiKey(event.target.value); setMessage(''); }}
        placeholder={saved[provider] ? 'Leave blank to keep saved key' : 'Paste your API key'} />
      <p className="sharing-note">{saved[provider] ? 'A key is saved for this provider. Paste a new one to replace it.'
        : 'No key is saved for this provider.'} <a href={PROVIDERS[provider].keyUrl} target="_blank" rel="noopener noreferrer">Get a {PROVIDERS[provider].label} API key</a></p>
      <button className="primary-button" type="submit" disabled={!ready || busy}>{busy ? 'Saving…' : 'Save provider'}</button>
    </form>
    {saved[provider] && <button className="text-button" type="button" disabled={busy} onClick={() => { void remove(); }}>Remove saved key</button>}
    {message && <p className="sharing-note" role="status">{message}</p>}
    <p className="sharing-note">Each provider’s key stays in this Chrome profile until you remove it or uninstall Klicko. Only the selected provider is used. Chrome extension storage is not encrypted. Keep your device and browser profile private.</p>
  </section>;
}
