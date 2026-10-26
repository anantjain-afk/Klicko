import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { startBackgroundTasks } from '../src/features/session/background-tasks';

export default defineBackground(() => {
  startBackgroundTasks();
  // Toolbar activation now shows the buddy; opening the sidebar is a separate action.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
});
