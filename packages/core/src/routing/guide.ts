import { haversineMeters } from '../geo/bbox.ts';
import { LocalProjection } from '../geo/projection.ts';
import type { LatLng } from '../geo/types.ts';
import { distPointSeg2 } from '../shadow/geometry.ts';

// Decide whether a hand-made photo guide describes the route the user is
// about to walk. Only then are its photos and wording shown; otherwise the
// generated turn-by-turn steps are used. Structural types, so core stays
// independent of packages/data.

export interface GuideLike {
  matchRadiusM: number;
  stepToleranceM: number;
  directions: ReadonlyArray<{ id: string; from: LatLng; to: LatLng; steps: ReadonlyArray<LatLng> }>;
}

/** Farthest distance (m) from any of `points` to the polyline. */
export function maxDistanceToLine(points: ReadonlyArray<LatLng>, line: ReadonlyArray<LatLng>): number {
  if (!line.length) return Infinity;
  const P = new LocalProjection(line[0]!);
  const xs = line.map((p) => P.x(p.lng)), ys = line.map((p) => P.y(p.lat));
  let worst = 0;
  for (const p of points) {
    const x = P.x(p.lng), y = P.y(p.lat);
    let best = Infinity;
    for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, distPointSeg2(x, y, xs[i]!, ys[i]!, xs[i + 1]!, ys[i + 1]!));
    if (line.length === 1) best = (x - xs[0]!) ** 2 + (y - ys[0]!) ** 2;
    worst = Math.max(worst, Math.sqrt(best));
  }
  return worst;
}

/** The guide direction matching this trip and route geometry, or null. */
export function matchGuide<G extends GuideLike>(
  guide: G,
  from: LatLng,
  to: LatLng,
  routeLine: ReadonlyArray<LatLng>,
): G['directions'][number] | null {
  for (const d of guide.directions) {
    if (haversineMeters(from, d.from) > guide.matchRadiusM || haversineMeters(to, d.to) > guide.matchRadiusM) continue;
    if (maxDistanceToLine(d.steps, routeLine) <= guide.stepToleranceM) return d;
  }
  return null;
}
