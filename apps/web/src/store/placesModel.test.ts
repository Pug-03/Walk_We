import { describe, expect, it } from 'vitest';
import type { PlaceRecord } from '@walkwe/data';
import { loadSaved, MAX_RECENTS, persistSaved, withRecent, withSaved, withoutSaved } from './placesModel.ts';
import type { KeyValueStore } from '../utils/storage.ts';

const place = (id: string, lat = 13.7456, lng = 100.5341): PlaceRecord => ({ id, name: id, detail: '', location: { lat, lng } });

describe('saved places', () => {
  it('keeps one place per fixed slot', () => {
    let list = withSaved([], place('a'), 'home', 1);
    list = withSaved(list, place('b'), 'home', 2);
    list = withSaved(list, place('c'), 'work', 3);
    expect(list.map((p) => `${p.slot}:${p.id}`).sort()).toEqual(['home:b', 'work:c']);
  });
  it('allows many "other" places without duplicates', () => {
    let list = withSaved([], place('a'), 'other', 1);
    list = withSaved(list, place('b'), 'other', 2);
    list = withSaved(list, place('a'), 'other', 3);
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('removes by slot and id', () => {
    const list = withSaved(withSaved([], place('a'), 'home', 1), place('b'), 'other', 2);
    expect(withoutSaved(list, 'home', 'a').map((p) => p.id)).toEqual(['b']);
  });
  it('drops corrupted stored entries on load', () => {
    const m = new Map<string, string>();
    const s: KeyValueStore = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: () => {} };
    persistSaved(s, withSaved([], place('a'), 'home', 1));
    m.set('ww_saved_places', JSON.stringify([...JSON.parse(m.get('ww_saved_places')!), { id: 'x', slot: 'nope' }]));
    expect(loadSaved(s).map((p) => p.id)).toEqual(['a']);
  });
});

describe('recent places', () => {
  it('puts the newest first, dedupes by id and by proximity, and caps the list', () => {
    let list = withRecent([], place('a'), 1);
    list = withRecent(list, place('b', 13.75, 100.54), 2);
    list = withRecent(list, place('a'), 3);
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
    // 10 m away from "b" with a different id replaces it.
    list = withRecent(list, place('b2', 13.75009, 100.54), 4);
    expect(list.map((p) => p.id)).toEqual(['b2', 'a']);
    for (let i = 0; i < 20; i++) list = withRecent(list, place(`p${i}`, 13.7 + i * 0.01, 100.5), 10 + i);
    expect(list).toHaveLength(MAX_RECENTS);
  });
});
