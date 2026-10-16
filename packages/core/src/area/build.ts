import { LocalProjection } from '../geo/projection.ts';
import { Grid } from '../shadow/geometry.ts';
import { ShadeScene, type ShadeSample } from '../shadow/scene.ts';
import type { SunPosition } from '../sun/position.ts';
import { WALKWAY_CLASSES, WF, type AreaInput, type WalkwayClass } from './types.ts';

/** Target length of the pieces shade is computed on (brief: ~10 m). */
export const SEGMENT_M = 10;
/** Shade samples along a segment, this far apart. */
const SAMPLE_M = 2;

// Where people walk relative to the mapped centre line: roads are drawn down
// the middle, sidewalks sit this far either side. Paths/footways: on the line.
const HALF_WIDTH: Record<WalkwayClass, number> = {
  footway: 0, pedestrian: 0, path: 0, steps: 0, corridor: 0, track: 0, cycleway: 0,
  living_street: 3, residential: 3.5, service: 3, unclassified: 4, road: 4,
  tertiary: 6, secondary: 8, primary: 10, trunk: 12,
};

export interface EdgeShade {
  /** Per segment: share exposed to sun, 0..1. */
  sun: Float32Array;
  /** Length-weighted share of shade that came from estimated building heights. */
  estimated: number;
  /** Shadier side of a road: -1 left of a→b, 1 right, 0 same/none. */
  side: number;
}

/**
 * An area ready for routing: walk graph in metres (CSR adjacency), 10 m
 * segments per edge, and the shade scene. Pure computation — runs in Node
 * (precompute script, tests) and in a browser Web Worker alike.
 */
export class Area {
  readonly proj: LocalProjection;
  readonly scene: ShadeScene;
  readonly nx: Float64Array;
  readonly ny: Float64Array;
  readonly ea: Int32Array;
  readonly eb: Int32Array;
  readonly elen: Float32Array;
  readonly eway: Int32Array;
  readonly eflags: Uint8Array;
  readonly eclass: Uint8Array;
  /** Mall index per edge, -1 if none. */
  readonly emall: Int32Array;
  readonly adjStart: Int32Array;
  readonly adjEdge: Int32Array;
  readonly mainComponent: Uint8Array;
  readonly segCount: Uint16Array;
  private readonly nodeGrid = new Grid<number>(60);
  private shadeCache = new Map<string, Map<number, EdgeShade>>();

  constructor(readonly input: AreaInput) {
    const [w, s, e, n] = input.bbox;
    this.proj = new LocalProjection({ lat: (s + n) / 2, lng: (w + e) / 2 });
    const P = this.proj;
    this.scene = new ShadeScene(input, P);

    const coords = input.walkways.nodes;
    const nc = coords.length / 2;
    this.nx = new Float64Array(nc);
    this.ny = new Float64Array(nc);
    for (let i = 0; i < nc; i++) {
      this.nx[i] = P.x(coords[2 * i + 1]!);
      this.ny[i] = P.y(coords[2 * i]!);
    }

    const ea: number[] = [], eb: number[] = [], eway: number[] = [];
    input.walkways.ways.forEach((way, wi) => {
      for (let k = 0; k + 1 < way.nodes.length; k++) {
        if (way.nodes[k] === way.nodes[k + 1]) continue;
        ea.push(way.nodes[k]!);
        eb.push(way.nodes[k + 1]!);
        eway.push(wi);
      }
    });
    const ne = ea.length;
    this.ea = Int32Array.from(ea);
    this.eb = Int32Array.from(eb);
    this.eway = Int32Array.from(eway);
    this.elen = new Float32Array(ne);
    this.eflags = new Uint8Array(ne);
    this.eclass = new Uint8Array(ne);
    this.emall = new Int32Array(ne);
    this.segCount = new Uint16Array(ne);
    for (let i = 0; i < ne; i++) {
      const a = this.ea[i]!, b = this.eb[i]!;
      const way = input.walkways.ways[this.eway[i]!]!;
      this.elen[i] = Math.hypot(this.nx[b]! - this.nx[a]!, this.ny[b]! - this.ny[a]!);
      this.eflags[i] = way.flags;
      this.eclass[i] = WALKWAY_CLASSES.indexOf(way.cls);
      this.emall[i] = way.mall ?? -1;
      this.segCount[i] = Math.max(1, Math.round(this.elen[i]! / SEGMENT_M));
    }

    // CSR adjacency (undirected).
    const deg = new Int32Array(nc + 1);
    for (let i = 0; i < ne; i++) {
      deg[this.ea[i]! + 1]!++;
      deg[this.eb[i]! + 1]!++;
    }
    for (let i = 0; i < nc; i++) deg[i + 1]! += deg[i]!;
    this.adjStart = deg;
    this.adjEdge = new Int32Array(2 * ne);
    const fill = deg.slice(0, nc);
    for (let i = 0; i < ne; i++) {
      this.adjEdge[fill[this.ea[i]!]!++] = i;
      this.adjEdge[fill[this.eb[i]!]!++] = i;
    }

    // Largest connected component: snapping only lands there, so a route
    // can never start on an isolated scrap of mapped path.
    const comp = new Int32Array(nc).fill(-1);
    let best = -1, bestSize = 0;
    const stack: number[] = [];
    for (let s0 = 0, cid = 0; s0 < nc; s0++) {
      if (comp[s0] !== -1 || deg[s0 + 1] === deg[s0]) continue;
      let size = 0;
      comp[s0] = cid;
      stack.push(s0);
      while (stack.length) {
        const u = stack.pop()!;
        size++;
        for (let j = deg[u]!; j < deg[u + 1]!; j++) {
          const v = this.other(this.adjEdge[j]!, u);
          if (comp[v] === -1) {
            comp[v] = cid;
            stack.push(v);
          }
        }
      }
      if (size > bestSize) {
        bestSize = size;
        best = cid;
      }
      cid++;
    }
    this.mainComponent = new Uint8Array(nc);
    for (let i = 0; i < nc; i++) {
      if (comp[i] === best) {
        this.mainComponent[i] = 1;
        this.nodeGrid.insert(i, { x0: this.nx[i]!, y0: this.ny[i]!, x1: this.nx[i]!, y1: this.ny[i]! });
      }
    }
  }

  get nodeCount(): number {
    return this.nx.length;
  }
  get edgeCount(): number {
    return this.ea.length;
  }

  other(edge: number, node: number): number {
    return this.ea[edge] === node ? this.eb[edge]! : this.ea[edge]!;
  }

  /** Nearest routable node within maxM metres, or null. */
  nearestNode(lat: number, lng: number, maxM: number): { node: number; dist: number } | null {
    const x = this.proj.x(lng), y = this.proj.y(lat);
    let best = -1, bd = Infinity;
    for (let r = 60; r <= maxM * 2 && best < 0; r *= 2) {
      for (const i of this.nodeGrid.near(x, y, Math.min(r, maxM), new Set())) {
        const d = (this.nx[i]! - x) ** 2 + (this.ny[i]! - y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    return best >= 0 && Math.sqrt(bd) <= maxM ? { node: best, dist: Math.sqrt(bd) } : null;
  }

  /** Shade of every segment of an edge for one sun position (memoised). */
  edgeShade(edge: number, sun: SunPosition): EdgeShade {
    const key = `${sun.altitude.toFixed(2)}|${sun.azimuth.toFixed(2)}`;
    let bucket = this.shadeCache.get(key);
    if (!bucket) {
      bucket = new Map();
      this.shadeCache.set(key, bucket);
      // Keep a handful of sun positions (a day's precompute walks through many).
      if (this.shadeCache.size > 6) this.shadeCache.delete(this.shadeCache.keys().next().value!);
    }
    let es = bucket.get(edge);
    if (!es) {
      es = this.computeEdgeShade(edge, sun);
      bucket.set(edge, es);
    }
    return es;
  }

  private computeEdgeShade(edge: number, sun: SunPosition): EdgeShade {
    const n = this.segCount[edge]!;
    const sunShare = new Float32Array(n);
    const flags = this.eflags[edge]!;
    // Permanent shade: covered walkways, building passages, indoor corridors
    // and tunnels never see the sun.
    if (flags & (WF.COVERED | WF.INDOOR | WF.TUNNEL)) return { sun: sunShare, estimated: 0, side: 0 };
    if (sun.altitude <= 0) return { sun: sunShare, estimated: 0, side: 0 };

    const a = this.ea[edge]!, b = this.eb[edge]!;
    const ax = this.nx[a]!, ay = this.ny[a]!, dx = this.nx[b]! - ax, dy = this.ny[b]! - ay;
    const len = this.elen[edge]! || 1;
    const hw = HALF_WIDTH[WALKWAY_CLASSES[this.eclass[edge]!]!];
    const nxo = (-dy / len) * hw, nyo = (dx / len) * hw; // left-hand normal × half width
    const onDeck = (flags & WF.BRIDGE) !== 0;
    const sample: ShadeSample = { shade: 0, estimated: false };
    let left = 0, right = 0, estLen = 0, shadeLen = 0;

    for (let s = 0; s < n; s++) {
      const k = Math.max(2, Math.round(len / n / SAMPLE_M));
      let sl = 0, sr = 0, el = 0, er = 0;
      for (let i = 0; i < k; i++) {
        const t = (s + (i + 0.5) / k) / n;
        const px = ax + dx * t, py = ay + dy * t;
        if (hw === 0) {
          this.scene.shadeAt(px, py, sun, sample, onDeck);
          sl += sample.shade;
          if (sample.estimated) el += sample.shade;
        } else {
          this.scene.shadeAt(px + nxo, py + nyo, sun, sample, onDeck);
          sl += sample.shade;
          if (sample.estimated) el += sample.shade;
          this.scene.shadeAt(px - nxo, py - nyo, sun, sample, onDeck);
          sr += sample.shade;
          if (sample.estimated) er += sample.shade;
        }
      }
      sl /= k;
      sr /= k;
      left += sl;
      right += sr;
      // A walker can take the shadier sidewalk.
      const useLeft = hw === 0 || sl >= sr;
      const shade = useLeft ? sl : sr;
      sunShare[s] = 1 - shade;
      shadeLen += shade;
      estLen += (useLeft ? el : er) / k;
    }
    const side = hw === 0 ? 0 : left > right + 0.25 * n ? -1 : right > left + 0.25 * n ? 1 : 0;
    return { sun: sunShare, estimated: shadeLen > 0 ? estLen / shadeLen : 0, side };
  }

  /** Length-weighted sun exposure of a whole edge, 0..1. */
  edgeSunShare(edge: number, sun: SunPosition): number {
    const s = this.edgeShade(edge, sun).sun;
    let sum = 0;
    for (let i = 0; i < s.length; i++) sum += s[i]!;
    return sum / s.length;
  }
}
