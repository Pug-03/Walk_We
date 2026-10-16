import { useSyncExternalStore } from 'react';
import { storage } from '../utils/storage.ts';

// Accessibility settings, kept on this device. Each one is independent:
//   stepFree  route around stairs (wheelchair, pram, can't climb)
//   voice     read navigation aloud: each step, the route summary, SOS
//   bigText   larger type across the app (on top of the system text size)
//   haptics   a short vibration on each new step
export interface AccessPrefs {
  stepFree: boolean;
  voice: boolean;
  bigText: boolean;
  haptics: boolean;
}

const KEY = 'ww_access';
const DEFAULTS: AccessPrefs = { stepFree: false, voice: false, bigText: false, haptics: true };

function read(): AccessPrefs {
  try {
    const raw = storage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AccessPrefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current = read();
const listeners = new Set<() => void>();

function apply(p: AccessPrefs) {
  document.documentElement.classList.toggle('big-text', p.bigText);
}
apply(current);

export function getAccess(): AccessPrefs {
  return current;
}

export function setAccess(patch: Partial<AccessPrefs>): void {
  current = { ...current, ...patch };
  storage.setItem(KEY, JSON.stringify(current));
  apply(current);
  for (const l of listeners) l();
}

export function useAccess(): AccessPrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
