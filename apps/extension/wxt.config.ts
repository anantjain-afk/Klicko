import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
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
