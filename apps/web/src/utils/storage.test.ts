import { describe, expect, it } from 'vitest';
import { readJson, writeJson, type KeyValueStore } from './storage.ts';

const mapStore = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

describe('storage helpers', () => {
  it('round-trips JSON and survives corrupt values', () => {
    const s = mapStore();
    writeJson(s, 'a', [1, 2]);
    expect(readJson(s, 'a')).toEqual([1, 2]);
    s.setItem('b', '{not json');
    expect(readJson(s, 'b')).toBeNull();
    expect(readJson(s, 'missing')).toBeNull();
  });
  it('swallows quota errors', () => {
    const s: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    expect(() => writeJson(s, 'a', 1)).not.toThrow();
  });
});
