import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';

// Page-to-page motion. Where the browser has the View Transitions API, the
// outgoing page slides and fades out while the next one slides in (forward)
// or the reverse (back) — transform/opacity only, 260 ms, see styles/app.css.
// Elsewhere, and with reduced motion, navigation is instant and pages keep
// their CSS entrance.

type Dir = 'forward' | 'back';
type Doc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

export const supportsViewTransitions = () => typeof document !== 'undefined' && 'startViewTransition' in document;

export function withViewTransition(update: () => void, dir: Dir = 'forward'): void {
  const doc = document as Doc;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.navDir = dir;
  root.classList.add('vt-running');
  const vt = doc.startViewTransition(() => flushSync(update));
  void vt.finished.finally(() => root.classList.remove('vt-running'));
}

/** navigate() with a view transition. Numbers (history steps) count as "back". */
export function useGo() {
  const navigate = useNavigate();
  return useCallback(
    (to: To | number, opts?: NavigateOptions & { dir?: Dir }) => {
      const dir = opts?.dir ?? (typeof to === 'number' && to < 0 ? 'back' : 'forward');
      withViewTransition(() => (typeof to === 'number' ? navigate(to) : navigate(to, opts)), dir);
    },
    [navigate],
  );
}
