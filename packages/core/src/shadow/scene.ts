import type { AreaInput, HeightSource } from '../area/types.ts';
import type { LocalProjection } from '../geo/projection.ts';
import type { SunPosition } from '../sun/position.ts';
import { distPointSeg2, distSegSeg2, Grid, pointInRing, ringBBox, segmentsIntersect, type BBox2 } from './geometry.ts';
import { shadowDirection, shadowLength } from './shadow.ts';

// Shade at a point for a given sun. Sources, strongest first:
//   1. Permanent: under an elevated deck (BTS/MRT, expressway, skywalk) or a
//      tree crown — overhead cover that works even at noon, when Bangkok's
//      near-vertical sun leaves building shadows tiny.
//   2. Building shadows: shadow length = h / tan(altitude), cast towards
//      azimuth + 180°. A point is in a building's shadow iff the segment
//      from the point back towards the sun, between the heights minH and h,
//      hits the footprint — the same as being inside the swept shadow
//      polygon (see shadowPieces), without building polygons per frame.
//   3. Projected tree / tree-row / deck shadows (partial for trees).

export const TREE_SHADE = 0.7; // canopy lets some light through
const TREE_ROW_REACH_M = 3;
/** Treat crowns as starting at this share of tree height. */
const CROWN_FRACTION = 0.65;
/** Decks at least this high still shade someone standing on a footbridge. */
const UPPER_DECK_M = 10;

export interface ShadeSample {
  /** 0 = full sun, 1 = full shade. */
  shade: number;
  /** The shade came from a building whose height is an estimate. */
  estimated: boolean;
}

interface Building { ring: Float64Array; h: number; minH: number; estimated: boolean; bb: BBox2 }
interface Tree { x: number; y: number; r: number; h: number }
interface Line { line: Float64Array; bb: BBox2 }
interface Deck extends Line { h: number; halfW: number; covered: boolean }

type Caster =
  | { k: 'b'; b: Building; ax: number; ay: number; bx: number; by: number }
  | { k: 't'; cx: number; cy: number; r2: number }
  | { k: 'r'; line: Float64Array; dx: number; dy: number }
  | { k: 'd'; deck: Deck; ax: number; ay: number; bx: number; by: number };

const estimatedSource = (s: HeightSource) => s !== 'height';

function toRing(flat: number[], P: LocalProjection): Float64Array {
  const ring = new Float64Array(flat.length);
  for (let i = 0; i < flat.length; i += 2) {
    ring[i] = P.x(flat[i + 1]!);
    ring[i + 1] = P.y(flat[i]!);
  }
  return ring;
}

export class ShadeScene {
  private readonly buildings: Building[];
  private readonly trees: Tree[];
  private readonly treeRows: Line[];
  private readonly decks: Deck[];
  /** Static overhead cover, independent of the sun. */
  private readonly overhead = new Grid<{ k: 't'; t: Tree } | { k: 'r'; l: Line } | { k: 'd'; d: Deck }>(40);
  private cache: { key: string; grid: Grid<Caster> } | null = null;

  /**
   * `overhead: false` turns off the permanent overhead layer (tree crowns,
   * under decks). Only the prototype regression script uses it, to separate
   * that new layer from everything else when comparing engines.
   */
  constructor(input: AreaInput, readonly proj: LocalProjection, private readonly opts: { overhead?: boolean } = {}) {
    this.buildings = input.buildings.map((b) => {
      const ring = toRing(b.ring, proj);
      return { ring, h: b.h, minH: b.minH, estimated: estimatedSource(b.heightSource), bb: ringBBox(ring) };
    });
    this.trees = [];
    for (let i = 0; i < input.trees.length; i += 4) {
      this.trees.push({ x: proj.x(input.trees[i + 1]!), y: proj.y(input.trees[i]!), r: input.trees[i + 2]!, h: input.trees[i + 3]! });
    }
    this.treeRows = input.treeRows.map((flat) => {
      const line = toRing(flat, proj);
      return { line, bb: ringBBox(line) };
    });
    this.decks = input.elevated.map((e) => {
      const line = toRing(e.line, proj);
      return { line, bb: ringBBox(line), h: e.h, halfW: e.w / 2, covered: e.covered };
    });
    for (const t of this.trees) this.overhead.insert({ k: 't', t }, { x0: t.x - t.r, y0: t.y - t.r, x1: t.x + t.r, y1: t.y + t.r });
    for (const l of this.treeRows) this.overhead.insert({ k: 'r', l }, grow(l.bb, TREE_ROW_REACH_M));
    for (const d of this.decks) this.overhead.insert({ k: 'd', d }, grow(d.bb, d.halfW));
  }

  get buildingCount(): number {
    return this.buildings.length;
  }
  get estimatedBuildingShare(): number {
    return this.buildings.length ? this.buildings.filter((b) => b.estimated).length / this.buildings.length : 0;
  }

  /**
   * Shade from overhead cover only (sun-independent). `onDeck`: the point is
   * itself on an elevated walkway (~6 m up), so only decks well above it —
   * BTS tracks over the Ratchaprasong skywalk — still shade it. A covered
   * skywalk is handled by the caller via walkway flags.
   */
  overheadShade(x: number, y: number, onDeck = false): number {
    if (this.opts.overhead === false) return 0;
    let best = 0;
    for (const it of this.overhead.at(x, y)) {
      if (it.k === 'd') {
        if (onDeck && it.d.h < UPPER_DECK_M) continue;
        const L = it.d.line;
        for (let j = 0; j + 3 < L.length; j += 2) {
          if (distPointSeg2(x, y, L[j]!, L[j + 1]!, L[j + 2]!, L[j + 3]!) <= it.d.halfW ** 2) return 1;
        }
      } else if (best < TREE_SHADE) {
        if (it.k === 't') {
          if ((x - it.t.x) ** 2 + (y - it.t.y) ** 2 <= it.t.r ** 2) best = TREE_SHADE;
        } else {
          const L = it.l.line;
          for (let j = 0; j + 3 < L.length; j += 2) {
            if (distPointSeg2(x, y, L[j]!, L[j + 1]!, L[j + 2]!, L[j + 3]!) <= TREE_ROW_REACH_M ** 2) {
              best = TREE_SHADE;
              break;
            }
          }
        }
      }
    }
    return best;
  }

  /** Index of sun-dependent casters for one sun position (cached per sun). */
  private casters(sun: SunPosition): Grid<Caster> {
    const key = `${sun.altitude.toFixed(2)}|${sun.azimuth.toFixed(2)}`;
    if (this.cache?.key === key) return this.cache.grid;
    const grid = new Grid<Caster>(40);
    const d = shadowDirection(sun);
    // Vector from a ground point back towards the sun, for a caster of height h.
    const back = (h: number) => {
      const l = shadowLength(h, sun.altitude);
      return { x: -d.x * l, y: -d.y * l };
    };
    for (const b of this.buildings) {
      const top = back(b.h), bottom = back(b.minH);
      // Region of ground points whose back-segment can reach the footprint.
      const reach: BBox2 = {
        x0: b.bb.x0 - Math.max(top.x, bottom.x, 0), x1: b.bb.x1 - Math.min(top.x, bottom.x, 0),
        y0: b.bb.y0 - Math.max(top.y, bottom.y, 0), y1: b.bb.y1 - Math.min(top.y, bottom.y, 0),
      };
      grid.insert({ k: 'b', b, ax: top.x, ay: top.y, bx: bottom.x, by: bottom.y }, reach);
    }
    for (const t of this.trees) {
      const v = back(t.h * CROWN_FRACTION);
      const cx = t.x - v.x, cy = t.y - v.y;
      grid.insert({ k: 't', cx, cy, r2: t.r * t.r }, { x0: cx - t.r, y0: cy - t.r, x1: cx + t.r, y1: cy + t.r });
    }
    for (const r of this.treeRows) {
      const v = back(5.5);
      grid.insert({ k: 'r', line: r.line, dx: -v.x, dy: -v.y }, grow(shift(r.bb, -v.x, -v.y, r.bb), TREE_ROW_REACH_M));
    }
    for (const deck of this.decks) {
      const top = back(deck.h), bottom = back(Math.max(0, deck.h - 2));
      grid.insert({ k: 'd', deck, ax: top.x, ay: top.y, bx: bottom.x, by: bottom.y }, grow(shift(deck.bb, -top.x, -top.y, deck.bb), deck.halfW));
    }
    this.cache = { key, grid };
    return grid;
  }

  /** Full shade at a ground point (overhead + cast shadows). */
  shadeAt(x: number, y: number, sun: SunPosition, out: ShadeSample, onDeck = false): ShadeSample {
    out.shade = this.overheadShade(x, y, onDeck);
    out.estimated = false;
    if (out.shade >= 1) return out;
    if (sun.altitude <= 0) {
      out.shade = 1;
      return out;
    }
    for (const c of this.casters(sun).at(x, y)) {
      if (c.k === 'b') {
        const ring = c.b.ring;
        const ax = x + c.ax, ay = y + c.ay, bx = x + c.bx, by = y + c.by;
        const bb = c.b.bb;
        if (Math.max(ax, bx) < bb.x0 || Math.min(ax, bx) > bb.x1 || Math.max(ay, by) < bb.y0 || Math.min(ay, by) > bb.y1) continue;
        let hit = pointInRing(ax, ay, ring) || pointInRing(bx, by, ring);
        for (let j = 0; !hit && j + 3 < ring.length; j += 2) {
          hit = segmentsIntersect(ax, ay, bx, by, ring[j]!, ring[j + 1]!, ring[j + 2]!, ring[j + 3]!);
        }
        if (hit) {
          out.shade = 1;
          out.estimated = c.b.estimated;
          if (!c.b.estimated) return out; // a measured building wins
        }
      } else if (c.k === 'd') {
        if (onDeck && c.deck.h < UPPER_DECK_M) continue;
        const ax = x + c.ax, ay = y + c.ay, bx = x + c.bx, by = y + c.by, L = c.deck.line;
        for (let j = 0; j + 3 < L.length; j += 2) {
          if (distSegSeg2(ax, ay, bx, by, L[j]!, L[j + 1]!, L[j + 2]!, L[j + 3]!) <= c.deck.halfW ** 2) {
            out.shade = 1;
            out.estimated = false;
            return out;
          }
        }
      } else if (out.shade < TREE_SHADE) {
        if (c.k === 't') {
          if ((x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r2) out.shade = TREE_SHADE;
        } else {
          const qx = x - c.dx, qy = y - c.dy, L = c.line;
          for (let j = 0; j + 3 < L.length; j += 2) {
            if (distPointSeg2(qx, qy, L[j]!, L[j + 1]!, L[j + 2]!, L[j + 3]!) <= TREE_ROW_REACH_M ** 2) {
              out.shade = TREE_SHADE;
              break;
            }
          }
        }
      }
    }
    return out;
  }
}

function grow(b: BBox2, r: number): BBox2 {
  return { x0: b.x0 - r, y0: b.y0 - r, x1: b.x1 + r, y1: b.y1 + r };
}
/** Union of a bbox and the same bbox shifted by (dx, dy). */
function shift(b: BBox2, dx: number, dy: number, orig: BBox2): BBox2 {
  return {
    x0: Math.min(orig.x0, b.x0 + dx), y0: Math.min(orig.y0, b.y0 + dy),
    x1: Math.max(orig.x1, b.x1 + dx), y1: Math.max(orig.y1, b.y1 + dy),
  };
}
