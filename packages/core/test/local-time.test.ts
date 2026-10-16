import { describe, expect, it } from 'vitest';
import { instantFromLocal, localInputValue, localTime, zoneOffsetMinutes } from '../src/index.ts';

describe('city-time helpers', () => {
  it('reads Bangkok wall-clock time regardless of the machine zone', () => {
    const at = new Date('2026-10-15T07:30:00Z');
    expect(localTime(at, 'Asia/Bangkok')).toEqual({ weekday: 3, minutes: 14 * 60 + 30, date: '2026-10-15' });
    expect(zoneOffsetMinutes(at, 'Asia/Bangkok')).toBe(420);
  });
  it('round-trips datetime-local values in the city zone', () => {
    const at = instantFromLocal('2026-10-15T14:30', 'Asia/Bangkok');
    expect(at.toISOString()).toBe('2026-10-15T07:30:00.000Z');
    expect(localInputValue(at, 'Asia/Bangkok')).toBe('2026-10-15T14:30');
  });
  it('handles a DST zone too (multi-city readiness)', () => {
    expect(instantFromLocal('2026-07-01T12:00', 'Europe/London').toISOString()).toBe('2026-07-01T11:00:00.000Z');
    expect(instantFromLocal('2026-12-01T12:00', 'Europe/London').toISOString()).toBe('2026-12-01T12:00:00.000Z');
  });
});
