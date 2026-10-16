import SunCalc from 'suncalc';
import type { LatLng } from '../geo/types.ts';

const DEG = 180 / Math.PI;

export interface SunPosition {
  /** Degrees above the horizon (negative = below). */
  altitude: number;
  /** Degrees clockwise from north (0 = N, 90 = E). */
  azimuth: number;
}

/** Sun position via SunCalc, converted to compass degrees. */
export function sunPosition(at: Date, where: LatLng): SunPosition {
  const p = SunCalc.getPosition(at, where.lat, where.lng);
  // SunCalc's azimuth is radians from south, positive towards west.
  const azimuth = (((p.azimuth * DEG + 180) % 360) + 360) % 360;
  return { altitude: p.altitude * DEG, azimuth };
}

/** Solar noon (sun highest) for the day containing `at` at this place. */
export function solarNoon(at: Date, where: LatLng): Date {
  return SunCalc.getTimes(at, where.lat, where.lng).solarNoon;
}

/** Sunrise and sunset for the day containing `at` at this place. */
export function sunTimes(at: Date, where: LatLng): { sunrise: Date; sunset: Date } {
  const { sunrise, sunset } = SunCalc.getTimes(at, where.lat, where.lng);
  return { sunrise, sunset };
}

export interface MoonState {
  /** Degrees above the horizon (negative = below). */
  altitude: number;
  /** Degrees clockwise from north. */
  azimuth: number;
  /** Lit share of the disc, 0 (new) .. 1 (full). */
  fraction: number;
  /** True while the lit part grows (lit on the right, as seen from Bangkok). */
  waxing: boolean;
}

/** Moon position and phase via SunCalc, in the same compass terms as the sun. */
export function moonState(at: Date, where: LatLng): MoonState {
  const p = SunCalc.getMoonPosition(at, where.lat, where.lng);
  const i = SunCalc.getMoonIllumination(at);
  return {
    altitude: p.altitude * DEG,
    azimuth: (((p.azimuth * DEG + 180) % 360) + 360) % 360,
    fraction: i.fraction,
    waxing: i.phase < 0.5,
  };
}
