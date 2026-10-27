import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { startBackgroundTasks } from '../src/features/session/background-tasks';
import { startBackgroundSounds } from '../src/features/sounds/background';

export default defineBackground(() => {
  startBackgroundSounds();
  startBackgroundTasks();
  // Toolbar activation now shows the buddy; opening the sidebar is a separate action.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
});
