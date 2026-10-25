import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    name: 'ClickPilot',
    description: 'Visual guidance for websites, one user action at a time.',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['http://127.0.0.1:8787/*'],
    action: {
      default_title: 'Open ClickPilot',
    },
  },
});
