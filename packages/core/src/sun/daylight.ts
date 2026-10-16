import SunCalc from 'suncalc';
import type { LatLng } from '../geo/types.ts';

export type WalkMode = 'day' | 'night';

/**
 * Day mode while the sun is up (sunrise..sunset at this place and instant),
 * otherwise night mode. Instants are absolute, so the device time zone
 * doesn't matter.
 */
export function modeForTime(at: Date, where: LatLng): WalkMode {
  const { sunrise, sunset } = SunCalc.getTimes(at, where.lat, where.lng);
  // Near the poles SunCalc can return Invalid Date; Bangkok never does, but
  // fall back to the sun's altitude rather than guessing.
  if (Number.isNaN(sunrise.getTime()) || Number.isNaN(sunset.getTime())) {
    return SunCalc.getPosition(at, where.lat, where.lng).altitude > 0 ? 'day' : 'night';
  }
  return at >= sunrise && at < sunset ? 'day' : 'night';
}
