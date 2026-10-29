// Kept only to read the one-provider record written by earlier builds.
export const PROVIDER_SETTINGS_KEY = 'clickpilot.provider-settings';
export const ACTIVE_PROVIDER_KEY = 'clickpilot.active-provider';

export const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    origin: 'https://generativelanguage.googleapis.com/*',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    ],
  },
  openai: {
    label: 'OpenAI',
    origin: 'https://api.openai.com/*',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
    ],
  },
  groq: {
    label: 'Groq',
    origin: 'https://api.groq.com/*',
    keyUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
    ],
  },
} as const;

export type Provider = keyof typeof PROVIDERS;
export interface ProviderSettings { version: 1; provider: Provider; model: string; apiKey: string }
export type SavedProviders = Partial<Record<Provider, ProviderSettings>>;

export function providerSettingsKey(provider: Provider): string { return `clickpilot.provider.${provider}`; }
export const PROVIDER_STORAGE_KEYS = [PROVIDER_SETTINGS_KEY, ACTIVE_PROVIDER_KEY,
  providerSettingsKey('gemini'), providerSettingsKey('openai'), providerSettingsKey('groq')];

export function isProvider(value: string): value is Provider { return Object.hasOwn(PROVIDERS, value); }
export function modelAllowed(provider: Provider, model: string): boolean {
  return PROVIDERS[provider].models.some((item) => item.id === model);
}

export function readProviderSettings(value: unknown): ProviderSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join() !== 'apiKey,model,provider,version' || item.version !== 1
    || typeof item.provider !== 'string' || !isProvider(item.provider)
    || typeof item.model !== 'string' || !modelAllowed(item.provider, item.model)
    || typeof item.apiKey !== 'string' || item.apiKey.length < 8 || item.apiKey.length > 512
    || /\s/.test(item.apiKey)) return null;
  return { version: 1, provider: item.provider, model: item.model, apiKey: item.apiKey };
}

export function readProviderStore(data: Record<string, unknown>): { active: Provider | null; saved: SavedProviders } {
  const saved: SavedProviders = {};
  for (const provider of ['gemini', 'openai', 'groq'] as const) {
    const entry = readProviderSettings(data[providerSettingsKey(provider)]);
    if (entry?.provider === provider) saved[provider] = entry;
  }
  const legacy = readProviderSettings(data[PROVIDER_SETTINGS_KEY]);
  if (legacy && !saved[legacy.provider]) saved[legacy.provider] = legacy;
  const selected = data[ACTIVE_PROVIDER_KEY];
  const active = typeof selected === 'string' && isProvider(selected) ? selected : legacy?.provider ?? null;
  return { active, saved };
}
