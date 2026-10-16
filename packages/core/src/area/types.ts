// Plain input shape of a pilot/city area, as stored in data files (lat/lng).
// packages/data's Zod schema produces exactly this type; core converts it to
// metres once (area/build.ts) and never touches the raw form again.

export const WALKWAY_CLASSES = [
  'footway', 'pedestrian', 'path', 'steps', 'living_street', 'residential', 'service', 'unclassified',
  'tertiary', 'secondary', 'primary', 'trunk', 'corridor', 'track', 'cycleway', 'road',
] as const;
export type WalkwayClass = (typeof WALKWAY_CLASSES)[number];

/** Bit flags on a walkway (OSM tags, normalised by the bake script). */
export const WF = {
  LIT_YES: 1,
  LIT_NO: 2,
  /** covered=yes/arcade/colonnade, building passage: shaded at any sun angle. */
  COVERED: 4,
  BRIDGE: 8,
  TUNNEL: 16,
  NO_SIDEWALK: 32,
  /** indoor=yes / highway=corridor. */
  INDOOR: 64,
} as const;

/** Where a building height came from. Anything but "height" is an estimate. */
export type HeightSource = 'height' | 'levels' | 'type-default' | 'default' | 'unknown';

export interface WalkwayInput {
  id: number;
  cls: WalkwayClass;
  name: string;
  flags: number;
  /** Indexes into walkways.nodes (pairs). */
  nodes: number[];
  /** Index into `malls` when the way runs through a mall (closes with it). */
  mall?: number | null;
}

export interface AreaInput {
  /** [west, south, east, north] */
  bbox: readonly [number, number, number, number];
  walkways: { nodes: number[]; ways: WalkwayInput[] };
  buildings: Array<{ h: number; minH: number; heightSource: HeightSource; ring: number[] }>;
  /** Flat [lat, lng, crownRadiusM, heightM, …]. */
  trees: number[];
  /** Each a flat [lat, lng, …] polyline. */
  treeRows: number[][];
  /** Elevated decks: BTS/MRT tracks, expressways, footbridges/skywalks. */
  elevated: Array<{ kind: 'rail' | 'road' | 'foot'; h: number; w: number; covered: boolean; line: number[] }>;
  malls: Array<{ id: number; name: string; hours: string | null; ring: number[] }>;
  /** Night-mode point layers (flat). Optional: day routing doesn't need them. */
  night?: {
    /** [lat, lng, …] camera positions (BMA + OSM). */
    cctv: number[];
    /** [lat, lng, …] street lamps. */
    lamps: number[];
    /** [lat, lng, dayWeight, nightWeight, …] foot-traffic generators. */
    pois: number[];
  };
  /** Past incidents, tied to walkways by OSM way id (street-segment level). */
  incidents?: IncidentInput[];
}

export interface IncidentInput {
  id: string;
  /** OSM way ids of the street segments involved. Never a school/shop/person name. */
  wayIds: number[];
  category: string;
  /** ISO date of the incident. */
  occurredOn: string;
  /** OSM opening_hours-style windows when the risk applies, e.g. "Mo-Fr 15:00-19:00". */
  window: string;
  /** 0..1 */
  severity: number;
}
