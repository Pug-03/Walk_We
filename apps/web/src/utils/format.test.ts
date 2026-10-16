import { describe, expect, it } from 'vitest';
import { formatDistance } from './format.ts';

describe('formatDistance', () => {
  it('rounds metres to 10 and switches to km', () => {
    expect(formatDistance(4, 'en')).toBe('10 m');
    expect(formatDistance(547, 'th')).toBe('550 ม.');
    expect(formatDistance(1260, 'en')).toBe('1.3 km');
    expect(formatDistance(12_400, 'th')).toBe('12 กม.');
  });
});
