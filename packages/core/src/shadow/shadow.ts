import type { SunPosition } from '../sun/position.ts';

const RAD = Math.PI / 180;

/** Longest shadow considered (m). Below ~4° altitude everything is in shade anyway. */
export const MAX_SHADOW_M = 400;

/** Shadow length of an object of height h (m) at the given sun altitude (°). */
export function shadowLength(heightM: number, altitudeDeg: number): number {
  if (altitudeDeg <= 0) return Infinity;
  return Math.min(heightM / Math.tan(altitudeDeg * RAD), MAX_SHADOW_M);
}

/**
 * Unit vector (x = east, y = north) along which shadows fall: the sun's
 * azimuth + 180°.
 */
export function shadowDirection(sun: SunPosition): { x: number; y: number } {
  const a = (sun.azimuth + 180) * RAD;
  return { x: Math.sin(a), y: Math.cos(a) };
}

/**
 * Shadow polygon of a prism footprint (flat [x, y, …] ring in metres) of
 * height h raised minH above ground: the footprint swept along the shadow
 * vector, as a set of convex pieces (translated footprints + one quad per
 * edge). Point-in-any-piece ⇔ point in the swept shadow. Used for display
 * and to cross-check the fast point test in ShadeScene.
 */
export function shadowPieces(ring: ArrayLike<number>, h: number, minH: number, sun: SunPosition): number[][] {
  const d = shadowDirection(sun);
  const l1 = shadowLength(h, sun.altitude);
  const l0 = shadowLength(minH, sun.altitude);
  if (!Number.isFinite(l1)) return [];
  const off = (l: number) => {
    const out: number[] = [];
    for (let i = 0; i < ring.length; i += 2) out.push(ring[i]! + d.x * l, ring[i + 1]! + d.y * l);
    return out;
  };
  const near = off(l0);
  const far = off(l1);
  const pieces = [near, far];
  for (let i = 0; i + 3 < near.length; i += 2) {
    pieces.push([near[i]!, near[i + 1]!, near[i + 2]!, near[i + 3]!, far[i + 2]!, far[i + 3]!, far[i]!, far[i + 1]!, near[i]!, near[i + 1]!]);
  }
  return pieces;
}
