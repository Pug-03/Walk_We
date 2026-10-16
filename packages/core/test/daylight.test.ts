import { describe, expect, it } from 'vitest';
import { bangkok } from '@walkwe/config';
import { modeForTime } from '../src/index.ts';

// Bangkok is UTC+7 with no DST; build instants explicitly so the test machine's
// zone can't change the result.
const bkk = (iso: string) => new Date(`${iso}+07:00`);

describe('modeForTime (Bangkok)', () => {
  it.each([
    ['2026-10-15T05:30:00', 'night'],
    ['2026-10-15T06:30:00', 'day'],
    ['2026-10-15T12:00:00', 'day'],
    ['2026-10-15T17:45:00', 'day'],
    ['2026-10-15T18:30:00', 'night'],
    ['2026-10-15T23:30:00', 'night'],
    ['2026-10-16T01:00:00', 'night'],
  ])('%s is %s', (iso, expected) => {
    expect(modeForTime(bkk(iso), bangkok.center)).toBe(expected);
  });
});
