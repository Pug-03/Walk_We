import { describe, expect, it } from 'vitest';
import { shareToken } from '../src/index.ts';

describe('share tokens', () => {
  it('are 128-bit, URL-safe and unique', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const t = shareToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
      seen.add(t);
    }
    expect(seen.size).toBe(1000);
  });
});
