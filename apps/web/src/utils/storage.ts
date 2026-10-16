// localStorage that never throws (Safari private mode, quota, disabled
// storage) — the app keeps working, it just forgets on reload.

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memory = new Map<string, string>();
const memoryStore: KeyValueStore = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

function pick(): KeyValueStore {
  try {
    const ls = globalThis.localStorage;
    const probe = '__ww_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStore;
  }
}

export const storage: KeyValueStore = typeof globalThis.localStorage === 'undefined' ? memoryStore : pick();

export function readJson(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled storage: keep running without persistence */
  }
}
