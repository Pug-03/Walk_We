import { WALKWAY_CLASSES, WF, type WalkwayClass } from './types.ts';
import type { Area } from './build.ts';
import { Grid } from '../shadow/geometry.ts';

// Static night-time attributes per edge, ported from the prototype's
// Region.computeStaticAttributes (same radii and class defaults):
//   cctv  – share of the edge within 40 m of a camera
//   lit   – OSM lit=yes/no, else lamps within 25 m, else a class default,
//           nudged up by night-open shop fronts
//   crowd – foot traffic at night from nearby POIs + a class base
// Each is 0..1, higher is better. `litKnown` says whether lighting came from
// data (tag or lamp) rather than the class default.

const CCTV_R = 40;
const LAMP_R = 25;
const POI_R = 60;
const SAMPLE_M = 8;

const LIT_DEFAULT: Record<WalkwayClass, number> = {
  footway: 0.35, pedestrian: 0.65, path: 0.2, steps: 0.4, living_street: 0.55, residential: 0.5, service: 0.4,
  unclassified: 0.55, tertiary: 0.7, secondary: 0.8, primary: 0.85, trunk: 0.85, corridor: 0.9, track: 0.15,
  cycleway: 0.4, road: 0.5,
};
const CROWD_BASE: Record<WalkwayClass, number> = {
  footway: 0.15, pedestrian: 0.5, path: 0.08, steps: 0.2, living_street: 0.25, residential: 0.2, service: 0.12,
  unclassified: 0.22, tertiary: 0.35, secondary: 0.45, primary: 0.5, trunk: 0.45, corridor: 0.5, track: 0.05,
  cycleway: 0.15, road: 0.2,
};

export interface NightAttrs {
  cctv: Float32Array;
  lit: Float32Array;
  litKnown: Uint8Array;
  crowd: Float32Array;
}

export function computeNightAttrs(area: Area): NightAttrs {
  const ne = area.edgeCount;
  const night = area.input.night ?? { cctv: [], lamps: [], pois: [] };
  const P = area.proj;
  const grid = (flat: number[], stride: number) => {
    const g = new Grid<number>(50);
    for (let i = 0; i < flat.length; i += stride) {
      const x = P.x(flat[i + 1]!), y = P.y(flat[i]!);
      g.insert(i, { x0: x, y0: y, x1: x, y1: y });
    }
    return g;
  };
  const camG = grid(night.cctv, 2), lampG = grid(night.lamps, 2), poiG = grid(night.pois, 4);
  const near = (g: Grid<number>, flat: number[], x: number, y: number, r: number, visit: (i: number, d2: number) => void) => {
    for (const i of g.near(x, y, r, new Set())) {
      const d2 = (P.x(flat[i + 1]!) - x) ** 2 + (P.y(flat[i]!) - y) ** 2;
      if (d2 <= r * r) visit(i, d2);
    }
  };

  const out: NightAttrs = { cctv: new Float32Array(ne), lit: new Float32Array(ne), litKnown: new Uint8Array(ne), crowd: new Float32Array(ne) };
  for (let e = 0; e < ne; e++) {
    const a = area.ea[e]!, b = area.eb[e]!;
    const ax = area.nx[a]!, ay = area.ny[a]!, dx = area.nx[b]! - ax, dy = area.ny[b]! - ay;
    const n = Math.max(1, Math.ceil(area.elen[e]! / SAMPLE_M));
    let cam = 0, lamp = 0, wn = 0, shops = 0;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = ax + dx * t, y = ay + dy * t;
      let hitCam = false, hitLamp = false;
      near(camG, night.cctv, x, y, CCTV_R, () => (hitCam = true));
      near(lampG, night.lamps, x, y, LAMP_R, () => (hitLamp = true));
      near(poiG, night.pois, x, y, POI_R, (i, d2) => {
        const f = 1 - Math.sqrt(d2) / POI_R;
        wn += night.pois[i + 3]! * f;
        if (night.pois[i + 3]! >= 2 && d2 < 900) shops++;
      });
      if (hitCam) cam++;
      if (hitLamp) lamp++;
    }
    const cls = WALKWAY_CLASSES[area.eclass[e]!]!;
    const fl = area.eflags[e]!;
    out.cctv[e] = cam / n;
    let lit: number;
    if (fl & WF.LIT_YES) {
      lit = 1;
      out.litKnown[e] = 1;
    } else if (fl & WF.LIT_NO) {
      lit = 0.05;
      out.litKnown[e] = 1;
    } else if (lamp > 0) {
      lit = Math.max(LIT_DEFAULT[cls], 0.6 + 0.4 * (lamp / n));
      out.litKnown[e] = 1;
    } else lit = LIT_DEFAULT[cls];
    if (fl & WF.INDOOR) lit = Math.max(lit, 0.9);
    lit = Math.min(1, lit + 0.08 * Math.min(shops / n, 3)); // shop fronts light the sidewalk
    out.lit[e] = lit;
    const pn = 1 - Math.exp(-(wn / n) / 4);
    out.crowd[e] = 1 - (1 - CROWD_BASE[cls] * 0.7) * (1 - pn);
  }
  return out;
}
