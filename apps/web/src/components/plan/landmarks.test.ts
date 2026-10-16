import { describe, expect, it } from 'vitest';
import { searchLandmarks } from './landmarks.ts';

describe('searchLandmarks', () => {
  it('finds a mall by its English name, Thai name and alias', () => {
    expect(searchLandmarks('Siam Paragon', 'en')[0]?.name).toBe('Siam Paragon');
    expect(searchLandmarks('พารากอน', 'th')[0]?.name).toBe('สยามพารากอน');
    expect(searchLandmarks('mbk', 'en')[0]?.name).toBe('MBK Center');
  });

  it('ignores case and spaces', () => {
    expect(searchLandmarks('central world', 'en')[0]?.name).toBe('centralwOrld');
  });

  it('ranks prefix matches before substring matches', () => {
    const names = searchLandmarks('siam', 'en').map((p) => p.name);
    expect(names[0]).toMatch(/^Siam/);
  });

  it('returns nothing for one character or no match', () => {
    expect(searchLandmarks('s', 'en')).toEqual([]);
    expect(searchLandmarks('zzzz', 'en')).toEqual([]);
  });
});
