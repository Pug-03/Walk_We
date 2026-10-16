import type { Area } from '../area/build.ts';
import { WALKWAY_CLASSES, WF } from '../area/types.ts';
import type { LatLng } from '../geo/types.ts';
import type { SunPosition } from '../sun/position.ts';
import type { Maneuver, RouteStep } from '../adapters/routing.ts';

// Turn-by-turn steps from a path, ported from the prototype's
// Region.instructions(): group consecutive edges of the same walkway, fold
// short unnamed connectors into the previous group, and classify the turn
// between groups by bearing change. Output is structured; wording is i18n.

/** Unnamed pieces shorter than this are folded into the previous step. */
const FOLD_M = 12;

interface Group {
  key: string;
  name: string;
  wayClass: string;
  len: number;
  startBearing: number;
  endBearing: number;
  startNode: number;
  sideSum: number;
  covered: boolean;
  elevated: boolean;
  stairs: boolean;
  mall: string | null;
}

export function turnFor(deltaDeg: number): Maneuver {
  let d = deltaDeg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  const a = Math.abs(d);
  if (a < 25) return 'straight';
  if (a > 155) return 'uturn';
  if (d > 0) return a < 50 ? 'slight-right' : a < 120 ? 'right' : 'sharp-right';
  return a < 50 ? 'slight-left' : a < 120 ? 'left' : 'sharp-left';
}

export function buildSteps(area: Area, edges: number[], nodes: number[], sun: SunPosition | null): RouteStep[] {
  const groups: Group[] = [];
  edges.forEach((e, i) => {
    const way = area.input.walkways.ways[area.eway[e]!]!;
    const u = nodes[i]!, v = nodes[i + 1]!;
    // Compass bearing (clockwise from north) of this edge as walked.
    const bearing = (Math.atan2(area.nx[v]! - area.nx[u]!, area.ny[v]! - area.ny[u]!) * 180) / Math.PI;
    const forward = area.ea[e] === u;
    const side = sun && sun.altitude > 0 ? area.edgeShade(e, sun).side * (forward ? 1 : -1) : 0;
    const flags = area.eflags[e]!;
    const mallIdx = area.emall[e]!;
    const key = way.name || `#${way.id}`;
    const g = groups[groups.length - 1];
    if (g && g.key === key) {
      g.len += area.elen[e]!;
      g.endBearing = bearing;
      g.sideSum += side * area.elen[e]!;
      g.stairs ||= way.cls === 'steps';
      g.covered &&= (flags & (WF.COVERED | WF.INDOOR | WF.TUNNEL)) !== 0;
    } else {
      groups.push({
        key,
        name: way.name,
        wayClass: WALKWAY_CLASSES[area.eclass[e]!]!,
        len: area.elen[e]!,
        startBearing: bearing,
        endBearing: bearing,
        startNode: u,
        sideSum: side * area.elen[e]!,
        covered: (flags & (WF.COVERED | WF.INDOOR | WF.TUNNEL)) !== 0,
        elevated: (flags & WF.BRIDGE) !== 0,
        stairs: way.cls === 'steps',
        mall: mallIdx >= 0 ? area.input.malls[mallIdx]!.name : null,
      });
    }
  });

  const merged: Group[] = [];
  for (const g of groups) {
    const prev = merged[merged.length - 1];
    if (prev && g.len < FOLD_M && !g.name) {
      prev.len += g.len;
      prev.endBearing = g.endBearing;
      continue;
    }
    // A named stretch split by a short connector keeps going as one step.
    if (prev && prev.key === g.key) {
      prev.len += g.len;
      prev.endBearing = g.endBearing;
      continue;
    }
    merged.push(g);
  }

  const at = (node: number): LatLng => area.proj.toLatLng(area.nx[node]!, area.ny[node]!);
  const steps: RouteStep[] = merged.map((g, i) => {
    const side = g.len > 40 ? g.sideSum / g.len : 0;
    return {
      maneuver: i === 0 ? 'depart' : turnFor(g.startBearing - merged[i - 1]!.endBearing),
      name: g.name,
      wayClass: g.wayClass,
      distanceM: Math.round(g.len),
      at: at(g.startNode),
      covered: g.covered,
      elevated: g.elevated,
      stairs: g.stairs,
      shadeSide: side < -0.3 ? -1 : side > 0.3 ? 1 : 0,
      mall: g.mall,
    };
  });
  steps.push({
    maneuver: 'arrive', name: '', wayClass: null, distanceM: 0, at: at(nodes[nodes.length - 1]!),
    covered: false, elevated: false, stairs: false, shadeSide: 0, mall: null,
  });
  return steps;
}
