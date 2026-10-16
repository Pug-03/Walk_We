import type { LatLng } from '../geo/types.ts';
import type { WalkMode } from '../sun/daylight.ts';

export type RouteKind = 'shortest' | 'shadiest' | 'safest' | 'balanced';
export type NightFactor = 'crowded' | 'cctv' | 'lit';

export interface RouteRequest {
  from: LatLng;
  to: LatLng;
  /** Planned start of the walk (absolute instant). */
  departAt: Date;
  mode: WalkMode;
  /** Night-mode factors the user ticked. */
  nightFactors?: readonly NightFactor[];
  /** Cloud cover at departure, 0–100 %, if known. Reduces the sun penalty. */
  cloudCover?: number | null;
  /** Wheelchair / pram / can't climb: avoid stairs wherever a step-free way exists. */
  stepFree?: boolean;
}

export interface RouteRun {
  coordinates: LatLng[];
  lengthM: number;
  /** 0..1 share in shade (day mode). Runs are split where shade/sun flips. */
  shade: number;
  /** 0..1 night safety from the chosen factors (night mode), else null. */
  safety: number | null;
  /** Covered / indoor / under a deck: shaded regardless of the sun. */
  permanent: boolean;
}

export type Maneuver =
  | 'depart' | 'straight' | 'slight-left' | 'left' | 'sharp-left'
  | 'slight-right' | 'right' | 'sharp-right' | 'uturn' | 'arrive';

/** One navigation step: what to do at `at`, then walk `distanceM`. Text is built by the UI (i18n). */
export interface RouteStep {
  maneuver: Maneuver;
  /** Street / walkway name, '' if unnamed. */
  name: string;
  /** Walkway class of the stretch, for wording ("skywalk", "footbridge", …). */
  wayClass: string | null;
  distanceM: number;
  at: LatLng;
  /** The stretch is covered/indoor (shade regardless of sun). */
  covered: boolean;
  /** The stretch is an elevated walkway (footbridge / skywalk). */
  elevated: boolean;
  stairs: boolean;
  /** Shadier side of a road for this stretch: -1 left, 1 right, 0 either. Day mode only. */
  shadeSide: -1 | 0 | 1;
  /** Mall this stretch passes through, if any. */
  mall: string | null;
}

export interface Route {
  /** Every label this path earns (identical paths are merged); first is primary. */
  kinds: RouteKind[];
  /** What the runs are coloured by: shade (day) or night safety. */
  metric: 'shade' | 'safety';
  runs: RouteRun[];
  lengthM: number;
  durationS: number;
  /** Length-weighted share in shade, 0..1 (day mode). */
  shadeShare: number;
  /** Share of that shade resting on estimated building heights, 0..1. */
  estimatedShadeShare: number;
  /** Mall passages on the path (open for the whole walk). */
  mallsUsed: string[];
  steps: RouteStep[];
  /** Night: 0–10 from the chosen factors, length-weighted ("safer, based on available data"). */
  safetyScore: number | null;
  /** Night: share of the route whose lighting comes from data, not a road-type guess. */
  litKnownShare: number | null;
  /** Past incidents (in force at departure) on this path's street segments. */
  incidentsOnRoute: number;
  /** Metres of stairs on the path (0 = step-free, as far as the map knows). */
  stairsM: number;
}

export interface RouteResult {
  routes: Route[];
  /** Sun at departure, for the UI ("sun 62° high"). */
  sun: { altitude: number; azimuth: number };
  /** Malls skipped because they are closed at that time. */
  closedMalls: string[];
  /** Past incidents carrying weight at departure (anywhere in the area). */
  incidentsActive: number;
  /** Straight-line legs from the chosen points to the walk network (m). */
  snapM: { from: number; to: number };
}

export class RoutingError extends Error {
  constructor(
    readonly reason: 'outside-coverage' | 'no-path',
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'RoutingError';
  }
}

/**
 * Today: client-side A* over the pilot graph (AreaRouter, in a Web Worker).
 * Later: GraphHopper or a server endpoint, same interface.
 */
export interface RoutingEngine {
  readonly id: string;
  route(request: RouteRequest): Promise<RouteResult>;
}
