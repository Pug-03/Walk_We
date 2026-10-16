import { lazy, type ComponentType } from 'react';

// Ported from DeePer: React.lazy that reloads once when a chunk from an old
// deploy is gone, instead of showing a blank screen.

const KEY = 'ww_chunk_reload';
const session = {
  get: () => {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return '1';
    }
  },
  set: () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

const loaders: Array<() => Promise<unknown>> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>, { preload = true } = {}) {
  if (preload) loaders.push(load);
  return lazy(() =>
    load().then(
      (mod) => {
        session.clear();
        return mod;
      },
      (err: unknown) => {
        if (!session.get()) {
          session.set();
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err;
      },
    ),
  );
}

/** Warm up the remaining chunks once idle (skipped on data saver). */
export function preloadPages(): void {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  const run = () => loaders.forEach((l) => l().catch(() => {}));
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 4000 }) : run());
  setTimeout(idle, 2500);
}
