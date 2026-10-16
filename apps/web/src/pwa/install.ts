import { storage } from '../utils/storage.ts';

// "Add to Home Screen" support. Chromium fires beforeinstallprompt, which we
// hold until the right moment (after the first successful route, brief §5.9);
// iOS has no such event, so it gets illustrated instructions instead.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const PROMPTED = 'ww_install_prompted';

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export type InstallKind = 'native' | 'ios' | null;

/** What to offer now, or null (already installed, asked before, or unsupported). */
export function installOffer(): InstallKind {
  if (isStandalone() || storage.getItem(PROMPTED)) return null;
  if (deferred) return 'native';
  if (isIOS()) return 'ios';
  return null;
}

export const markInstallPrompted = () => storage.setItem(PROMPTED, '1');

export async function runNativeInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}
