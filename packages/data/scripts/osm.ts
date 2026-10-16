// OSM → area dataset normalisation, ported from the prototype's js/data.js
// (normalise / fetchRegion) to TypeScript. Changes from the prototype:
//   • height from building:levels uses 3 m per level (brief §6; prototype 3.3)
//   • every building records where its height came from (heightSource)
//   • indoor/corridor ways get their own INDOOR flag, and ways inside a mall
//     polygon are linked to that mall so they close with it
//   • elevated decks keep their kind and whether they are covered (skywalks)
//   • output is the layered, Zod-validated format in src/schemas/area.ts

import { WALKWAY_CLASSES, WF, pointInRing, type WalkwayClass } from '@walkwe/core';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}
export interface OverpassResponse {
  osm3s?: { timestamp_osm_base?: string };
  elements: OverpassElement[];
}

export const WALKABLE = [
  'footway', 'pedestrian', 'path', 'steps', 'living_street', 'residential', 'service', 'unclassified',
  'tertiary', 'tertiary_link', 'secondary', 'secondary_link', 'primary', 'primary_link', 'trunk', 'trunk_link',
  'corridor', 'track', 'cycleway', 'road',
];

/** Overpass bbox order is south,west,north,east. */
export function overpassQueries([w, s, e, n]: readonly [number, number, number, number]) {
  const b = `${s},${w},${n},${e}`;
  return {
    roads: `[out:json][timeout:120];way["highway"~"^(${WALKABLE.join('|')})$"](${b});out body qt;>;out skel qt;`,
    shade:
      `[out:json][timeout:120];(way["building"](${b});way["building:part"](${b});way["natural"="tree_row"](${b});` +
      `way["railway"]["bridge"](${b});way["highway"]["bridge"](${b});way["man_made"="canopy"](${b});` +
      `way["amenity"="shelter"](${b});way["shop"="mall"](${b}););out tags geom qt;`,
    points:
      `[out:json][timeout:120];(node["natural"="tree"](${b});node["highway"="street_lamp"](${b});` +
      `node["man_made"="surveillance"](${b});node["shop"](${b});node["amenity"](${b});` +
      `node["public_transport"="station"](${b});node["railway"~"^(station|subway_entrance)$"](${b}););out body qt;`,
  };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

function num(v: string | undefined): number {
  if (v == null) return NaN;
  const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

function walkwayClass(h: string): WalkwayClass {
  const base = h.replace(/_link$/, '');
  return (WALKWAY_CLASSES as readonly string[]).includes(base) ? (base as WalkwayClass) : 'road';
}

// Typical heights (m) by building type, used when OSM has neither height nor
// levels. Same table as the prototype.
const TYPE_HEIGHT: Record<string, number> = {
  house: 7, detached: 7, semidetached_house: 7, terrace: 11, bungalow: 5, hut: 3, shed: 3, garage: 3,
  garages: 3, carport: 3, roof: 4, kiosk: 3, toilets: 3, service: 4, residential: 11, apartments: 24,
  dormitory: 18, commercial: 14, retail: 9, supermarket: 9, office: 30, hotel: 30, hospital: 24,
  school: 12, university: 16, college: 14, temple: 12, church: 12, mosque: 12, shrine: 4,
  industrial: 10, warehouse: 9, construction: 12, parking: 12, train_station: 14, transportation: 10,
  civic: 14, government: 16, public: 12, stadium: 20,
};
export const DEFAULT_HEIGHT_M = 10;
export const LEVEL_HEIGHT_M = 3;

export type HeightSource = 'height' | 'levels' | 'type-default' | 'default';

export function buildingHeight(t: Record<string, string>): { h: number; minH: number; heightSource: HeightSource } {
  let h = num(t.height);
  let heightSource: HeightSource = 'height';
  if (!(h > 0)) {
    const lv = num(t['building:levels']);
    if (lv > 0) {
      h = lv * LEVEL_HEIGHT_M + (num(t['roof:height']) || 0);
      heightSource = 'levels';
    }
  }
  if (!(h > 0)) {
    const typed = TYPE_HEIGHT[t.building ?? ''] ?? TYPE_HEIGHT[t['building:part'] ?? ''];
    h = typed ?? DEFAULT_HEIGHT_M;
    heightSource = typed ? 'type-default' : 'default';
  }
  let minH = num(t.min_height);
  if (!(minH >= 0)) {
    const ml = num(t['building:min_level']);
    minH = ml > 0 ? ml * LEVEL_HEIGHT_M : 0;
  }
  h = Math.min(h, 400);
  return { h: Math.round(h * 10) / 10, minH: Math.round(Math.min(minH, h) * 10) / 10, heightSource };
}

function poiWeights(t: Record<string, string>): [number, number] | null {
  // [daytime foot-traffic weight, night-time weight] — prototype values.
  if (t.shop === 'convenience') return [2, 2.6];
  if (t.public_transport === 'station' || t.railway === 'station') return [4, 3];
  if (t.railway === 'subway_entrance') return [2, 1.5];
  const a = t.amenity;
  if (a === 'police') return [2, 3];
  if (a === 'hospital' || a === 'clinic') return [1.5, 1.5];
  if (a === 'bar' || a === 'pub' || a === 'nightclub') return [0.5, 2];
  if (a === 'restaurant' || a === 'fast_food' || a === 'food_court' || a === 'cafe') return [1.2, 0.9];
  if (a === 'marketplace') return [3, 1.5];
  if (a === 'fuel') return [1, 1.5];
  if (a === 'bank' || a === 'atm' || a === 'pharmacy') return [0.8, 0.5];
  if (a && ['bench', 'waste_basket', 'parking', 'bicycle_parking', 'motorcycle_parking'].includes(a)) return null;
  if (a) return [0.5, 0.3];
  if (t.shop) return [1, 0.3];
  return null;
}

const MALL_WALK_CLASSES = new Set<WalkwayClass>(['footway', 'corridor', 'steps', 'path', 'pedestrian']);

export function normalise(roadsJson: OverpassResponse, shadeJson: OverpassResponse, pointsJson: OverpassResponse) {
  // ---- malls first: walkways inside them are linked by index.
  const malls: Array<{ id: number; name: string; hours: string | null; ring: number[] }> = [];
  for (const el of shadeJson.elements) {
    if (el.type !== 'way' || el.tags?.shop !== 'mall' || !el.geometry || el.geometry.length < 4) continue;
    malls.push({
      id: el.id,
      name: el.tags.name ?? el.tags['name:en'] ?? `mall ${el.id}`,
      hours: el.tags.opening_hours ?? null,
      ring: el.geometry.flatMap((g) => [r6(g.lat), r6(g.lon)]),
    });
  }
  // Rings as [lng, lat] for point-in-polygon in degrees (fine at this scale).
  const mallRings = malls.map((m) => {
    const r: number[] = [];
    for (let i = 0; i < m.ring.length; i += 2) r.push(m.ring[i + 1]!, m.ring[i]!);
    return r;
  });

  // ---- walkways
  const nodeLL = new Map<number, [number, number]>();
  for (const el of roadsJson.elements) if (el.type === 'node') nodeLL.set(el.id, [el.lat!, el.lon!]);
  const nodeIndex = new Map<number, number>();
  const nodes: number[] = [];
  const ways: Array<{ id: number; cls: WalkwayClass; name: string; flags: number; nodes: number[]; mall?: number | null }> = [];
  for (const el of roadsJson.elements) {
    const t = el.tags;
    if (el.type !== 'way' || !t?.highway) continue;
    if (t.foot === 'no' || t.foot === 'private') continue;
    if ((t.access === 'private' || t.access === 'no') && !/^(yes|designated|permissive)$/.test(t.foot ?? '')) continue;
    if (t.area === 'yes' && t.highway !== 'pedestrian') continue;
    const idx: number[] = [];
    for (const id of el.nodes ?? []) {
      const p = nodeLL.get(id);
      if (!p) continue;
      let i = nodeIndex.get(id);
      if (i === undefined) {
        i = nodes.length / 2;
        nodeIndex.set(id, i);
        nodes.push(r6(p[0]), r6(p[1]));
      }
      idx.push(i);
    }
    if (idx.length < 2) continue;
    let f = 0;
    if (t.lit === 'yes' || t.lit === '24/7' || t.lit === 'automatic') f |= WF.LIT_YES;
    else if (t.lit === 'no' || t.lit === 'disused') f |= WF.LIT_NO;
    if (/^(yes|arcade|colonnade)$/.test(t.covered ?? '') || t.tunnel === 'building_passage') f |= WF.COVERED;
    if (t.indoor === 'yes' || t.highway === 'corridor') f |= WF.INDOOR;
    if (t.bridge && t.bridge !== 'no') f |= WF.BRIDGE;
    if (t.tunnel === 'yes' || t.tunnel === 'culvert') f |= WF.TUNNEL;
    if (t.sidewalk === 'no' || t.sidewalk === 'none') f |= WF.NO_SIDEWALK;
    const cls = walkwayClass(t.highway);

    // Linked to a mall when it is an indoor-ish walkway whose midpoint lies inside one.
    let mall: number | null = null;
    const indoorish = f & (WF.INDOOR | WF.COVERED) || t.level != null;
    if (indoorish && MALL_WALK_CLASSES.has(cls)) {
      const mid = idx[Math.floor(idx.length / 2)]!;
      const lat = nodes[2 * mid]!, lng = nodes[2 * mid + 1]!;
      const m = mallRings.findIndex((r) => pointInRing(lng, lat, r));
      if (m >= 0) mall = m;
    }
    ways.push({ id: el.id, cls, name: t.name ?? t['name:th'] ?? t.ref ?? '', flags: f, nodes: idx, ...(mall != null ? { mall } : {}) });
  }

  // ---- shade casters
  const buildings: Array<{ h: number; minH: number; heightSource: HeightSource; ring: number[] }> = [];
  const treeRows: number[][] = [];
  const elevated: Array<{ kind: 'rail' | 'road' | 'foot'; h: number; w: number; covered: boolean; line: number[] }> = [];
  for (const el of shadeJson.elements) {
    if (el.type !== 'way' || !el.geometry) continue;
    const t = el.tags ?? {};
    const flat = el.geometry.flatMap((g) => [r6(g.lat), r6(g.lon)]);
    if (t.building || t['building:part']) {
      if (flat.length < 8) continue;
      // Building outlines at ~1 m (5 decimals): plenty for shadows, and the
      // biggest layer of the area file shrinks noticeably.
      buildings.push({ ...buildingHeight(t), ring: el.geometry.flatMap((g) => [r5(g.lat), r5(g.lon)]) });
    } else if (t.man_made === 'canopy' || t.amenity === 'shelter') {
      if (flat.length < 8) continue;
      buildings.push({ h: 3.5, minH: 0, heightSource: 'default', ring: flat });
    } else if (t.natural === 'tree_row') {
      treeRows.push(flat);
    } else if (t.bridge && t.bridge !== 'no') {
      const layer = num(t.layer) || 1;
      const covered = /^(yes|arcade|colonnade)$/.test(t.covered ?? '');
      if (t.railway) elevated.push({ kind: 'rail', h: 12 + (layer - 1) * 5, w: 9, covered, line: flat });
      else if (/^motorway/.test(t.highway ?? '')) {
        const lanes = num(t.lanes);
        elevated.push({ kind: 'road', h: 14 + (layer - 1) * 6, w: lanes > 0 ? lanes * 3.5 + 2 : 14, covered, line: flat });
      } else if (/^(trunk|primary|secondary|tertiary)/.test(t.highway ?? '')) {
        elevated.push({ kind: 'road', h: 7 + (layer - 1) * 5, w: 10, covered, line: flat });
      } else if (/^(footway|pedestrian|path|corridor|steps)$/.test(t.highway ?? '')) {
        elevated.push({ kind: 'foot', h: 6, w: 4, covered, line: flat });
      }
    }
  }

  // ---- points
  const trees: number[] = [], lamps: number[] = [], cams: number[] = [], pois: number[] = [];
  for (const el of pointsJson.elements) {
    if (el.type !== 'node' || !el.tags) continue;
    const t = el.tags;
    const lat = r6(el.lat!), lon = r6(el.lon!);
    if (t.natural === 'tree') {
      const crown = num(t.diameter_crown), h = num(t.height);
      trees.push(lat, lon, crown > 0 ? Math.min(crown / 2, 12) : 3.5, h > 0 ? Math.min(h, 40) : 8);
    }
    if (t.highway === 'street_lamp') lamps.push(lat, lon);
    if (t.man_made === 'surveillance' && t['surveillance:type'] !== 'ALPR') cams.push(lat, lon);
    const w = poiWeights(t);
    if (w) pois.push(lat, lon, w[0], w[1]);
  }

  return { walkways: { nodes, ways }, buildings, trees, treeRows, elevated, malls, lamps, cams, pois };
}
