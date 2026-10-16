import { describe, expect, it } from 'vitest';
import { isOpenAt, isOpenThrough, parseOpeningHours } from '../src/index.ts';

const TZ = 'Asia/Bangkok';
const bkk = (iso: string) => new Date(`${iso}+07:00`);
// 2026-10-15 is a Thursday; 10-17 Saturday; 10-18 Sunday.

describe('opening hours', () => {
  it('parses the common mall formats', () => {
    const h = parseOpeningHours('Mo-Su 10:00-22:00')!;
    expect(isOpenAt(h, bkk('2026-10-15T09:59:00'), TZ)).toBe(false);
    expect(isOpenAt(h, bkk('2026-10-15T10:00:00'), TZ)).toBe(true);
    expect(isOpenAt(h, bkk('2026-10-15T21:59:00'), TZ)).toBe(true);
    expect(isOpenAt(h, bkk('2026-10-15T22:00:00'), TZ)).toBe(false);
  });
  it('respects weekdays and later-rule overrides', () => {
    const weekdays = parseOpeningHours('Mo-Fr 09:00-20:00')!;
    expect(isOpenAt(weekdays, bkk('2026-10-15T12:00:00'), TZ)).toBe(true);
    expect(isOpenAt(weekdays, bkk('2026-10-17T12:00:00'), TZ)).toBe(false);
    const mixed = parseOpeningHours('Mo-Su 10:00-22:00; Su off')!;
    expect(isOpenAt(mixed, bkk('2026-10-17T12:00:00'), TZ)).toBe(true);
    expect(isOpenAt(mixed, bkk('2026-10-18T12:00:00'), TZ)).toBe(false);
  });
  it('handles spans past midnight and PH', () => {
    const late = parseOpeningHours('Fr-Sa 18:00-02:00')!;
    expect(isOpenAt(late, bkk('2026-10-17T01:30:00'), TZ)).toBe(true); // Sat 01:30 from Fri
    expect(isOpenAt(late, bkk('2026-10-19T01:30:00'), TZ)).toBe(false); // Mon 01:30
    expect(parseOpeningHours('Mo-Su,PH 10:00-22:00')).not.toBeNull();
    expect(parseOpeningHours('24/7')).toEqual({ always: true });
  });
  it('rejects what it does not understand (caller uses the default)', () => {
    expect(parseOpeningHours('sunrise-sunset')).toBeNull();
    expect(parseOpeningHours('"call ahead"')).toBeNull();
    expect(parseOpeningHours('')).toBeNull();
  });
  it('checks a whole time window', () => {
    const h = parseOpeningHours('10:00-22:00')!;
    expect(isOpenThrough(h, bkk('2026-10-15T21:30:00'), 20, TZ)).toBe(true);
    expect(isOpenThrough(h, bkk('2026-10-15T21:45:00'), 20, TZ)).toBe(false);
  });
});
