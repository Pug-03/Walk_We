import { computeNightAttrs, type NightAttrs } from '../area/night.ts';
import { incidentWeight, type IncidentPolicy } from '../area/incidents.ts';
import { WF } from '../area/types.ts';
import type { Area } from '../area/build.ts';
import type { LatLng } from '../geo/types.ts';
import { sunPosition, type SunPosition } from '../sun/position.ts';
import { isOpenThrough, parseOpeningHours } from '../time/hours.ts';
import {
  RoutingError,
  type NightFactor,
  type Route,
  type RouteKind,
  type RouteRequest,
  type RouteResult,
  type RouteRun,
  type RoutingEngine,
} from '../adapters/routing.ts';
import { MinHeap } from './heap.ts';
import { buildSteps } from './steps.ts';
import { WALKWAY_CLASSES } from '../area/types.ts';

export interface RouterOptions {
  timeZone: string;
  /** Used when a mall has no (parseable) opening_hours. Keep it conservative. */
  defaultMallHours: string;
  walkSpeedMps: number;
  /** Chosen points farther than this from the network are "not covered". */
  maxSnapM?: number;
  /** A mall must stay open this long after departure to be routed through. */
  mallWindowMin?: number;
  incidents?: Omit<IncidentPolicy, 'timeZone'>;
}

interface Profile {
  kind: RouteKind;
  /** Weight on sun exposure (day) or on night risk (night). */
  w: number;
  /** Weight on past incidents in force at departure. */
  wIncident: number;
  /** Max length vs the shortest route. Infinity = shade/safety come first, whatever the distance. */
  maxStretch: number;
}

// Product rule: shade by day and safety by night come before distance. The
// shadiest / safest routes have no length cap and are the default card;
// "balanced" is offered for people in a hurry; "shortest" is the baseline.
// Safety outranks shade: a street segment with a recent incident in force
// costs far more than walking in the sun (wIncident 20 vs w 5), so the
// shadiest route won't trade safety for shade.
export const DAY_PROFILES: Profile[] = [
  { kind: 'shortest', w: 0, wIncident: 0, maxStretch: Infinity },
  { kind: 'shadiest', w: 5, wIncident: 20, maxStretch: Infinity },
  { kind: 'balanced', w: 1, wIncident: 4, maxStretch: 1.25 },
];
export const NIGHT_PROFILES: Profile[] = [
  { kind: 'shortest', w: 0, wIncident: 0, maxStretch: Infinity },
  { kind: 'safest', w: 6, wIncident: 20, maxStretch: Infinity },
  { kind: 'balanced', w: 1.5, wIncident: 4, maxStretch: 1.25 },
];
const ORDER: Record<'day' | 'night', RouteKind[]> = {
  day: ['shadiest', 'balanced', 'shortest'],
  night: ['safest', 'balanced', 'shortest'],
};

/** An alternative must beat the shortest by this much to get its own card. */
export const MIN_SHADE_GAIN = 0.05;
export const MIN_SAFETY_GAIN = 0.3; // points out of 10
/** Incidents below this weight at departure are treated as not in force. */
const INCIDENT_FLOOR = 0.1;

/** Cloud cover softens the sun: overcast (100 %) keeps 30 % of the penalty. */
export function cloudFactor(cloudCover: number | null | undefined): number {
  const c = Math.min(100, Math.max(0, cloudCover ?? 0));
  return 1 - 0.7 * (c / 100);
}

interface Path {
  edges: number[];
  nodes: number[];
}

/** RoutingEngine over an in-memory Area (pilot graph). Pure; no I/O. */
export class AreaRouter implements RoutingEngine {
  readonly id = 'area-astar';
  private nightAttrs: NightAttrs | null = null;
  private edgesByWay: Map<number, number[]> | null = null;

  constructor(
    readonly area: Area,
    private readonly opts: RouterOptions,
  ) {}

  async route(req: RouteRequest): Promise<RouteResult> {
    return this.routeSync(req);
  }

  get night(): NightAttrs {
    return (this.nightAttrs ??= computeNightAttrs(this.area));
  }

  /** 0..1 risk of an edge from the chosen night factors (higher = worse). */
  nightRisk(e: number, factors: readonly NightFactor[]): number {
    const n = this.night;
    const fs = factors.length ? factors : (['crowded', 'cctv', 'lit'] as const);
    let sum = 0;
    for (const f of fs) sum += 1 - (f === 'lit' ? n.lit[e]! : f === 'cctv' ? n.cctv[e]! : n.crowd[e]!);
    let risk = sum / fs.length;
    if (this.area.eflags[e]! & WF.TUNNEL) risk = Math.min(1, risk + 0.3);
    return risk;
  }

  /** Incident weight per edge at this time (street-segment level, by OSM way id). */
  incidentWeights(at: Date): { perEdge: Map<number, number>; active: number } {
    const list = this.area.input.incidents ?? [];
    const perEdge = new Map<number, number>();
    if (!list.length) return { perEdge, active: 0 };
    if (!this.edgesByWay) {
      this.edgesByWay = new Map();
      for (let e = 0; e < this.area.edgeCount; e++) {
        const id = this.area.input.walkways.ways[this.area.eway[e]!]!.id;
        const arr = this.edgesByWay.get(id);
        if (arr) arr.push(e);
        else this.edgesByWay.set(id, [e]);
      }
    }
    const policy = { halfLifeDays: 365, outsideWindow: 0.2, ...this.opts.incidents, timeZone: this.opts.timeZone };
    let active = 0;
    for (const inc of list) {
      const w = incidentWeight(inc, at, policy);
      if (w < INCIDENT_FLOOR) continue;
      active++;
      for (const id of inc.wayIds) for (const e of this.edgesByWay.get(id) ?? []) perEdge.set(e, Math.max(perEdge.get(e) ?? 0, w));
    }
    return { perEdge, active };
  }

  routeSync(req: RouteRequest): RouteResult {
    const { area } = this;
    const maxSnap = this.opts.maxSnapM ?? 300;
    const s = area.nearestNode(req.from.lat, req.from.lng, maxSnap);
    const t = area.nearestNode(req.to.lat, req.to.lng, maxSnap);
    if (!s || !t) throw new RoutingError('outside-coverage');

    const sun = sunPosition(req.departAt, area.proj.origin);
    const closed = this.closedMalls(req.departAt);
    const mode = req.mode;
    const sunUp = sun.altitude > 0;
    const sunWeight = mode === 'day' && sunUp ? cloudFactor(req.cloudCover) : 0;
    const factors = req.nightFactors ?? ['crowded', 'cctv', 'lit'];
    const { perEdge: incidents, active } = this.incidentWeights(req.departAt);

    // Step-free: stairs are off the map for every route. Only if that leaves
    // no way at all are they allowed back, at 40× their length (used as little
    // as possible), and the cards say how many metres of stairs remain.
    const STEPS = WALKWAY_CLASSES.indexOf('steps');
    let stairFactor = req.stepFree ? Infinity : 1;
    const costFor = (p: Profile) => (e: number) => {
      if (closed.has(area.emall[e]!)) return Infinity;
      const isStair = area.eclass[e] === STEPS;
      if (isStair && stairFactor === Infinity) return Infinity;
      const len = area.elen[e]! * (isStair ? stairFactor : 1);
      if (p.w === 0 && p.wIncident === 0) return len;
      const bad = mode === 'day' ? (sunWeight ? p.w * sunWeight * area.edgeSunShare(e, sun) : 0) : p.w * this.nightRisk(e, factors);
      return len * (1 + bad + p.wIncident * (incidents.get(e) ?? 0));
    };

    const profiles = mode === 'day' ? DAY_PROFILES : NIGHT_PROFILES;
    let plain = this.astar(s.node, t.node, costFor(profiles[0]!));
    if (!plain && req.stepFree) {
      stairFactor = 40;
      plain = this.astar(s.node, t.node, costFor(profiles[0]!));
    }
    if (!plain) throw new RoutingError('no-path');
    const shortestLen = this.pathLength(plain);

    const found: Array<{ kinds: RouteKind[]; path: Path }> = [{ kinds: ['shortest'], path: plain }];
    for (const p of profiles.slice(1)) {
      let path: Path | null = null;
      let prof = p;
      // Only capped profiles back off; uncapped ones keep shade/safety first.
      for (let tries = 0; tries < 4; tries++) {
        path = this.astar(s.node, t.node, costFor(prof));
        if (!path || this.pathLength(path) <= shortestLen * p.maxStretch) break;
        prof = { ...prof, w: prof.w / 2, wIncident: prof.wIncident / 2 };
      }
      if (!path) continue;
      const same = found.find((f) => samePath(f.path, path!));
      if (same) same.kinds.push(p.kind);
      else found.push({ kinds: [p.kind], path });
    }

    const snapM = { from: s.dist, to: t.dist };
    const described = found.map((f) => ({ kinds: f.kinds, route: this.describe(f.kinds, f.path, req, sun, sunWeight > 0, factors, incidents, snapM) }));
    // Fold alternatives that aren't meaningfully better than the shortest.
    const base = described[0]!;
    const kept = [base];
    for (const d of described.slice(1)) {
      const better =
        mode === 'day'
          ? d.route.shadeShare - base.route.shadeShare >= MIN_SHADE_GAIN || d.route.incidentsOnRoute < base.route.incidentsOnRoute
          : (d.route.safetyScore ?? 0) - (base.route.safetyScore ?? 0) >= MIN_SAFETY_GAIN || d.route.incidentsOnRoute < base.route.incidentsOnRoute;
      if (better) kept.push(d);
      else base.kinds.push(...d.kinds);
    }
    const order = ORDER[mode];
    const routes = kept
      .map((d) => ({ ...d.route, kinds: [...new Set(d.kinds)].sort((a, b) => order.indexOf(a) - order.indexOf(b)) }))
      .sort((a, b) => order.indexOf(a.kinds[0]!) - order.indexOf(b.kinds[0]!));

    const mallNames = area.input.malls.map((m) => m.name);
    return {
      routes,
      sun: { altitude: sun.altitude, azimuth: sun.azimuth },
      closedMalls: [...closed].map((i) => mallNames[i]!).filter(Boolean),
      incidentsActive: active,
      snapM,
    };
  }

  /** Indexes of malls closed at any point of the window after departure. */
  closedMalls(at: Date): Set<number> {
    const fallback = parseOpeningHours(this.opts.defaultMallHours);
    const closed = new Set<number>();
    this.area.input.malls.forEach((m, i) => {
      const hours = parseOpeningHours(m.hours) ?? fallback;
      if (!hours || !isOpenThrough(hours, at, this.opts.mallWindowMin ?? 20, this.opts.timeZone)) closed.add(i);
    });
    return closed;
  }

  private astar(src: number, dst: number, cost: (edge: number) => number): Path | null {
    const { area } = this;
    const nc = area.nodeCount;
    const g = new Float64Array(nc).fill(Infinity);
    const prevEdge = new Int32Array(nc).fill(-1);
    const closedSet = new Uint8Array(nc);
    const tx = area.nx[dst]!, ty = area.ny[dst]!;
    const h = (v: number) => Math.hypot(area.nx[v]! - tx, area.ny[v]! - ty); // ≤ cost: admissible
    const heap = new MinHeap();
    g[src] = 0;
    heap.push(h(src), src);
    while (heap.size) {
      const u = heap.pop();
      if (closedSet[u]) continue;
      if (u === dst) break;
      closedSet[u] = 1;
      for (let j = area.adjStart[u]!; j < area.adjStart[u + 1]!; j++) {
        const e = area.adjEdge[j]!;
        const v = area.other(e, u);
        if (closedSet[v]) continue;
        const c = cost(e);
        if (!Number.isFinite(c)) continue;
        const ng = g[u]! + c;
        if (ng < g[v]!) {
          g[v] = ng;
          prevEdge[v] = e;
          heap.push(ng + h(v), v);
        }
      }
    }
    if (!Number.isFinite(g[dst]!)) return null;
    const edges: number[] = [];
    const nodes = [dst];
    for (let v = dst; v !== src; ) {
      const e = prevEdge[v]!;
      edges.push(e);
      v = area.other(e, v);
      nodes.push(v);
    }
    return { edges: edges.reverse(), nodes: nodes.reverse() };
  }

  private pathLength(p: Path): number {
    let sum = 0;
    for (const e of p.edges) sum += this.area.elen[e]!;
    return sum;
  }

  private describe(
    kinds: RouteKind[],
    path: Path,
    req: RouteRequest,
    sun: SunPosition,
    day: boolean,
    factors: readonly NightFactor[],
    incidents: Map<number, number>,
    snap: { from: number; to: number },
  ): Route {
    const { area } = this;
    const P = area.proj;
    const nightMode = req.mode === 'night';
    const runs: RouteRun[] = [];
    let total = 0, shadeLen = 0, estLen = 0, safeLen = 0, litKnownLen = 0, netLen = 0;
    const malls = new Set<string>();
    let incidentsOnRoute = 0;

    const push = (a: LatLng, b: LatLng, len: number, shade: number, safety: number | null, permanent: boolean) => {
      total += len;
      shadeLen += len * shade;
      const last = runs[runs.length - 1];
      const good = nightMode ? (safety ?? 0) >= 0.5 : shade >= 0.5;
      const lastGood = last && (nightMode ? (last.safety ?? 0) >= 0.5 : last.shade >= 0.5);
      if (last && lastGood === good && last.permanent === permanent) {
        const L = last.lengthM + len;
        last.shade = (last.shade * last.lengthM + shade * len) / L;
        if (safety != null && last.safety != null) last.safety = (last.safety * last.lengthM + safety * len) / L;
        last.lengthM = L;
        last.coordinates.push(b);
      } else {
        runs.push({ coordinates: [a, b], lengthM: len, shade, safety, permanent });
      }
    };

    const startNode = P.toLatLng(area.nx[path.nodes[0]!]!, area.ny[path.nodes[0]!]!);
    // The leg from the chosen point to the network: unknown, count it as sun / low safety.
    if (snap.from > 1) push(req.from, startNode, snap.from, 0, nightMode ? 0 : null, false);

    const seenIncident = new Set<number>();
    path.edges.forEach((e, i) => {
      const u = path.nodes[i]!;
      const forward = area.ea[e] === u;
      const n = area.segCount[e]!;
      const segLen = area.elen[e]! / n;
      const permanent = (area.eflags[e]! & (WF.COVERED | WF.INDOOR | WF.TUNNEL)) !== 0;
      const shade = day ? area.edgeShade(e, sun) : null;
      const safety = nightMode ? 1 - this.nightRisk(e, factors) : null;
      if (nightMode) {
        safeLen += area.elen[e]! * safety!;
        netLen += area.elen[e]!;
        if (this.night.litKnown[e]) litKnownLen += area.elen[e]!;
      }
      const inc = incidents.get(e) ?? 0;
      if (inc > 0) {
        const wayId = area.input.walkways.ways[area.eway[e]!]!.id;
        if (!seenIncident.has(wayId)) {
          seenIncident.add(wayId);
          incidentsOnRoute++;
        }
      }
      if (area.emall[e]! >= 0) malls.add(area.input.malls[area.emall[e]!]!.name);
      const ax = area.nx[area.ea[e]!]!, ay = area.ny[area.ea[e]!]!;
      const dx = area.nx[area.eb[e]!]! - ax, dy = area.ny[area.eb[e]!]! - ay;
      for (let k = 0; k < n; k++) {
        const si = forward ? k : n - 1 - k;
        const t0 = forward ? si / n : (si + 1) / n;
        const t1 = forward ? (si + 1) / n : si / n;
        const segShade = shade ? 1 - shade.sun[si]! : permanent ? 1 : 0;
        if (shade) estLen += segLen * segShade * shade.estimated;
        push(P.toLatLng(ax + dx * t0, ay + dy * t0), P.toLatLng(ax + dx * t1, ay + dy * t1), segLen, segShade, safety, permanent);
      }
    });

    const endNode = P.toLatLng(area.nx[path.nodes[path.nodes.length - 1]!]!, area.ny[path.nodes[path.nodes.length - 1]!]!);
    if (snap.to > 1) push(endNode, req.to, snap.to, 0, nightMode ? 0 : null, false);

    return {
      kinds,
      metric: nightMode ? 'safety' : 'shade',
      runs,
      lengthM: total,
      durationS: total / this.opts.walkSpeedMps,
      shadeShare: total > 0 ? shadeLen / total : 0,
      estimatedShadeShare: shadeLen > 0 ? estLen / shadeLen : 0,
      mallsUsed: [...malls],
      steps: buildSteps(area, path.edges, path.nodes, day ? sun : null),
      safetyScore: nightMode && netLen > 0 ? Math.round((safeLen / netLen) * 100) / 10 : null,
      litKnownShare: nightMode && netLen > 0 ? litKnownLen / netLen : null,
      incidentsOnRoute,
      stairsM: path.edges.reduce((m, e) => m + (area.eclass[e] === WALKWAY_CLASSES.indexOf('steps') ? area.elen[e]! : 0), 0),
    };
  }
}

function samePath(a: Path, b: Path): boolean {
  return a.edges.length === b.edges.length && a.edges.every((e, i) => e === b.edges[i]);
}
