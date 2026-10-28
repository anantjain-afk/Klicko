import { browser } from 'wxt/browser';
import { isSensitivePage } from '@clickpilot/shared/privacy';

export const GLOBAL_ACTIVATION_KEY = 'clickpilot.globally-enabled';
export const ALL_SITE_ORIGINS = ['http://*/*', 'https://*/*'];

export function supportedPage(url?: string): url is string {
  if (!url || isSensitivePage(url)) return false;
  const host = new URL(url).hostname;
  return host !== 'chromewebstore.google.com' && !(host === 'chrome.google.com' && new URL(url).pathname.startsWith('/webstore'));
}

export async function globallyEnabled(): Promise<boolean> {
  return (await browser.storage.session.get(GLOBAL_ACTIVATION_KEY))[GLOBAL_ACTIVATION_KEY] === true;
}

export async function hasAllSiteAccess(): Promise<boolean> {
  return browser.permissions.contains({ origins: ALL_SITE_ORIGINS });
}
