import { defineConfig } from 'wxt';

declare const process: { env: { WXT_VOICE_ORIGIN?: string } };

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  vite: ({ mode }) => {
    if (mode !== 'voice-hosted') return {};
    const origin = process.env.WXT_VOICE_ORIGIN;
    if (!origin || !/^https:\/\/(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*$/.test(origin)
      || origin.endsWith('.localhost') || origin.endsWith('.local')) {
      throw new Error('Set WXT_VOICE_ORIGIN to an HTTPS hostname without a port, path, or trailing slash.');
    }
    return {
      define: {
        'import.meta.env.WXT_VOICE_ORIGIN': JSON.stringify(origin),
        'import.meta.env.WXT_VOICE_ENDPOINT': JSON.stringify(origin + '/v1/voice/transcribe'),
      },
    };
  },
  manifest: {
    name: 'Klicko',
    description: 'Visual guidance for websites, one user action at a time.',
    permissions: ['activeTab', 'scripting', 'storage', 'offscreen'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    web_accessible_resources: [{
      resources: ['robot.html'],
      matches: ['http://*/*', 'https://*/*'],
    }],
    action: {
      default_title: 'Turn Klicko on or off for all supported tabs',
    },
  },
});
