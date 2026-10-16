import { storage } from '../utils/storage.ts';

const KEY = 'ww_onboarded';

export const hasOnboarded = () => storage.getItem(KEY) === '1';
export const markOnboarded = () => storage.setItem(KEY, '1');

/**
 * /start: replay the first-run flow (landing → safety setup).
 * Only the "already seen" flags are cleared; saved places, contacts and the
 * user's own number stay, so opening the link by accident costs nothing.
 */
export function resetFirstRun(): void {
  storage.removeItem(KEY);
  storage.removeItem('ww_setup_done');
}
