import { describe, expect, it } from 'vitest';
import { scrub } from './errorReporter.ts';

describe('scrub', () => {
  it('removes coordinates in any common shape', () => {
    expect(scrub('at 13.7466,100.539 failed')).toBe('at [coord],[coord] failed');
    expect(scrub('GET /api?lat=13.74621&lon=100.53471')).toBe('GET /api?lat=[coord]&lon=[coord]');
    expect(scrub('{"lat":-33.8688}')).toBe('{"lat":[coord]}');
  });
  it('leaves ordinary numbers alone', () => {
    expect(scrub('step 3 of 8, 1.5x, v2.10')).toBe('step 3 of 8, 1.5x, v2.10');
  });
});
