import { haversineMeters } from '@walkwe/core';
import {
  parseList,
  recentPlaceSchema,
  savedPlaceSchema,
  type PlaceRecord,
  type RecentPlace,
  type SavedPlace,
  type SavedSlot,
} from '@walkwe/data';
import { readJson, writeJson, type KeyValueStore } from '../utils/storage.ts';

// Saved places and recent picks. Device-only (localStorage), validated on
// read. Pure functions so the rules are unit-tested without a browser.

export const SAVED_KEY = 'ww_saved_places';
export const RECENTS_KEY = 'ww_recent_places';
export const MAX_RECENTS = 8;
export const MAX_OTHER = 10;
/** Picks closer than this to an existing recent replace it instead of adding a near-duplicate. */
const SAME_SPOT_M = 25;

export const loadSaved = (s: KeyValueStore): SavedPlace[] => parseList(savedPlaceSchema, readJson(s, SAVED_KEY));
export const loadRecents = (s: KeyValueStore): RecentPlace[] => parseList(recentPlaceSchema, readJson(s, RECENTS_KEY));
export const persistSaved = (s: KeyValueStore, list: SavedPlace[]) => writeJson(s, SAVED_KEY, list);
export const persistRecents = (s: KeyValueStore, list: RecentPlace[]) => writeJson(s, RECENTS_KEY, list);

/** home / work / station hold one place each; "other" holds up to MAX_OTHER. */
export function withSaved(list: SavedPlace[], place: PlaceRecord, slot: SavedSlot, now: number): SavedPlace[] {
  const entry: SavedPlace = { ...place, slot, savedAt: now };
  if (slot !== 'other') return [entry, ...list.filter((p) => p.slot !== slot)];
  const others = list.filter((p) => p.slot === 'other' && p.id !== place.id).slice(0, MAX_OTHER - 1);
  return [...list.filter((p) => p.slot !== 'other'), entry, ...others];
}

export function withoutSaved(list: SavedPlace[], slot: SavedSlot, id: string): SavedPlace[] {
  return list.filter((p) => !(p.slot === slot && p.id === id));
}

export function withRecent(list: RecentPlace[], place: PlaceRecord, now: number): RecentPlace[] {
  const rest = list.filter((p) => p.id !== place.id && haversineMeters(p.location, place.location) > SAME_SPOT_M);
  return [{ ...place, usedAt: now }, ...rest].slice(0, MAX_RECENTS);
}
