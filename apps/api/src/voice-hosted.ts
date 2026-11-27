import { transcribeVoiceClip, voiceError, type VoiceEnv } from './voice';

interface HostedVoiceEnv {
  VOICE_HOSTED_ENABLED?: string;
  VOICE_HOSTED_ORIGIN?: string;
  VOICE_RATE_LIMIT?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
  AI?: VoiceEnv['AI'];
}

export default {
  async fetch(request: Request, env: HostedVoiceEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/v1/voice/transcribe') return voiceError('not_found', 404);
    if (request.method !== 'POST') {
      const response = voiceError('method_not_allowed', 405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    const limiter = env.VOICE_RATE_LIMIT;
    if (env.VOICE_HOSTED_ENABLED !== 'enabled' || !env.VOICE_HOSTED_ORIGIN || !limiter || !env.AI) {
      return voiceError('voice_unavailable', 503);
    }
    if (url.protocol !== 'https:' || url.origin !== env.VOICE_HOSTED_ORIGIN || url.search) return voiceError('not_found', 404);
    return transcribeVoiceClip(request, env.AI, async () => {
      // This value is supplied by the Cloudflare edge, never by the extension.
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip || !/^[0-9a-f:.]{3,45}$/i.test(ip)) return voiceError('client_address_unavailable', 403);
      try {
        const { success } = await limiter.limit({ key: ip });
        if (!success) {
          const response = voiceError('voice_rate_limited', 429);
          response.headers.set('Retry-After', '60');
          return response;
        }
      } catch { return voiceError('voice_unavailable', 503); }
    });
  },
};
