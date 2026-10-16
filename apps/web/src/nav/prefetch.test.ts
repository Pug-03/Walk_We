import { describe, expect, it } from 'vitest';
import { tileOf, tilesForRoute } from './prefetch.ts';

describe('tile maths', () => {
  it('finds the standard slippy tile for Siam', () => {
    // By hand: x = (100.5341 + 180) / 360 × 2^14 = 12767.9;
    // y = (1 − asinh(tan 13.7456°) / π) / 2 × 2^14 = 7560.4.
    expect(tileOf({ lat: 13.7456, lng: 100.5341 }, 14)).toEqual({ x: 12767, y: 7560 });
  });
  it('covers a route with a small, bounded set of tiles', () => {
    const tiles = tilesForRoute([{ lat: 13.7456, lng: 100.5341 }, { lat: 13.7466, lng: 100.539 }], 12, 14);
    expect(tiles.length).toBeGreaterThan(2);
    expect(tiles.length).toBeLessThan(20);
    expect(tiles.every(([z]) => z >= 12 && z <= 14)).toBe(true);
  });
});
