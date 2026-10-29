import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerReply } from '../../src/lib/provider-api';
import { ACTIVE_PROVIDER_KEY, PROVIDERS, PROVIDER_SETTINGS_KEY, providerSettingsKey,
  readProviderSettings, readProviderStore, type ProviderSettings } from '../../src/lib/provider-settings';

const key = 'fixture-private-key';
const answer = { kind: 'answer', message: 'Use the visible Settings control.' };
const settings = (provider: ProviderSettings['provider']): ProviderSettings => ({
  version: 1, provider, model: PROVIDERS[provider].models[0].id, apiKey: key,
});
afterEach(() => vi.unstubAllGlobals());

describe('saved provider settings', () => {
  it('accepts only the three providers and their supported models', () => {
    for (const provider of ['gemini', 'openai', 'groq'] as const) expect(readProviderSettings(settings(provider))).toEqual(settings(provider));
    expect(readProviderSettings({ ...settings('groq'), model: 'unlisted-model' })).toBeNull();
    expect(readProviderSettings({ ...settings('openai'), provider: 'other' })).toBeNull();
    expect(readProviderSettings({ ...settings('openai'), provider: 'toString' })).toBeNull();
    expect(readProviderSettings({ ...settings('gemini'), apiKey: 'a' })).toBeNull();
    expect(readProviderSettings({ ...settings('gemini'), extra: true })).toBeNull();
  });

  it('keeps distinct valid credentials for all three providers and selects the active one', () => {
    const data = {
      [providerSettingsKey('gemini')]: settings('gemini'),
      [providerSettingsKey('openai')]: settings('openai'),
      [providerSettingsKey('groq')]: settings('groq'),
      [ACTIVE_PROVIDER_KEY]: 'groq',
    };
    expect(readProviderStore(data)).toEqual({ active: 'groq', saved: {
      gemini: settings('gemini'), openai: settings('openai'), groq: settings('groq'),
    } });
    expect(readProviderStore({ ...data, [ACTIVE_PROVIDER_KEY]: 'gemini' }).saved.groq).toEqual(settings('groq'));
  });

  it('reads the earlier single-provider record but lets a newer provider entry win', () => {
    const legacy = settings('groq');
    const replacement = { ...legacy, apiKey: 'replacement-private-key' };
    expect(readProviderStore({ [PROVIDER_SETTINGS_KEY]: legacy })).toEqual({ active: 'groq', saved: { groq: legacy } });
    expect(readProviderStore({ [PROVIDER_SETTINGS_KEY]: legacy, [providerSettingsKey('groq')]: replacement,
      [ACTIVE_PROVIDER_KEY]: 'gemini' })).toEqual({ active: 'gemini', saved: { groq: replacement } });
    expect(readProviderStore({ [providerSettingsKey('gemini')]: settings('groq'), [ACTIVE_PROVIDER_KEY]: 'gemini' }))
      .toEqual({ active: 'gemini', saved: {} });
  });
});

describe('direct provider requests', () => {
  it.each(['gemini', 'openai', 'groq'] as const)('routes a bounded JSON reply through %s without putting the key in the body', async (provider) => {
    const response = provider === 'gemini'
      ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }
      : provider === 'groq'
        ? { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(answer) } }] }
        : { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] };
    const fetch = vi.fn(async () => Response.json(response)); vi.stubGlobal('fetch', fetch);
    expect(await providerReply(settings(provider), 'guidance', { page: { origin: 'https://example.com' } }, new AbortController().signal)).toEqual(answer);
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toContain(new URL(PROVIDERS[provider].origin.replace('*', '')).hostname);
    expect(init.redirect).toBe('error');
    expect(JSON.stringify(init.body)).not.toContain(key);
    expect(JSON.stringify(init.headers)).toContain(key);
    if (provider === 'openai') expect(JSON.parse(init.body as string).store).toBe(false);
    expect(JSON.parse(init.body as string)).not.toHaveProperty('tools');
  });

  it('rejects bad credentials and malformed output without exposing provider bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('secret-provider-error', { status: 401 })));
    await expect(providerReply(settings('openai'), 'text', {}, new AbortController().signal)).rejects.toThrow('rejected your API key');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'incomplete', output: [] })));
    await expect(providerReply(settings('openai'), 'text', {}, new AbortController().signal)).rejects.toThrow('reply safely');
  });
});
