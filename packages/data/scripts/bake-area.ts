// Bake the pilot area from OpenStreetMap (Overpass) and the BMA CCTV layer
// into data/areas/<id>.json. Port of the prototype's scripts/bake.mjs.
//
//   npx tsx packages/data/scripts/bake-area.ts            # Siam pilot (config pilotBounds)
//
// Public Overpass servers are shared infrastructure: this runs three queries
// with pauses in between and identifies itself; don't put it in a loop.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { activeCity } from '@walkwe/config';
import { areaDatasetSchema, type AreaDataset } from '../src/index.ts';
import { normalise, overpassQueries, type OverpassResponse } from './osm.ts';
import { BMA_CCTV, HEIGHT_RULES, OSM } from './sources.ts';

const OUT = fileURLToPath(new URL('../../../data/areas/siam.json', import.meta.url));
const UA = 'WalkWe/0.1 (pilot-area bake script)';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const BMA_LAYERS = [
  'https://cpudgiportal.bangkok.go.th/arcgis/rest/services/Hosted/CCTV_Points/FeatureServer/3',
  'https://cpudgiportal.bangkok.go.th/arcgis/rest/services/Hosted/cctv/FeatureServer/0',
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(query: string): Promise<OverpassResponse> {
  let last: unknown;
  for (let pass = 0; pass < 3; pass++) {
    for (const ep of ENDPOINTS) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, Accept: 'application/json' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(150_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as OverpassResponse & { remark?: string };
        if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) throw new Error(json.remark);
        return json;
      } catch (e) {
        last = e;
        console.warn(`  ${new URL(ep).host}: ${(e as Error).message}, trying next…`);
        await sleep(5000);
      }
    }
    await sleep(15_000);
  }
  throw new Error(`Overpass failed: ${(last as Error)?.message}`);
}

async function bmaCctv([w, s, e, n]: readonly number[]): Promise<{ points: number[]; ok: boolean }> {
  const points: number[] = [];
  const seen = new Set<string>();
  let ok = false;
  for (const layer of BMA_LAYERS) {
    try {
      for (let offset = 0; offset < 40_000; offset += 2000) {
        const params = new URLSearchParams({
          where: '1=1', geometry: `${w},${s},${e},${n}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
          spatialRel: 'esriSpatialRelIntersects', outFields: 'objectid', returnGeometry: 'true',
          resultOffset: String(offset), resultRecordCount: '2000', f: 'json',
        });
        const res = await fetch(`${layer}/query?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { error?: { message: string }; features?: Array<{ geometry?: { x: number; y: number } }>; exceededTransferLimit?: boolean };
        if (json.error) throw new Error(json.error.message);
        for (const f of json.features ?? []) {
          const g = f.geometry;
          if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
          const key = `${g.y.toFixed(6)},${g.x.toFixed(6)}`;
          if (seen.has(key)) continue; // the two layers overlap
          seen.add(key);
          points.push(Math.round(g.y * 1e6) / 1e6, Math.round(g.x * 1e6) / 1e6);
        }
        if (!json.exceededTransferLimit) break;
      }
      ok = true;
    } catch (e) {
      console.warn(`  BMA layer failed (${(e as Error).message}); continuing with what we have`);
    }
  }
  return { points, ok };
}

const bbox = activeCity.pilotBounds;
const q = overpassQueries(bbox);
console.log('walkways…');
const roads = await overpass(q.roads);
await sleep(5000);
console.log('buildings, trees, decks, malls…');
const shade = await overpass(q.shade);
await sleep(5000);
console.log('lamps, cameras, POIs…');
const points = await overpass(q.points);
console.log('BMA CCTV…');
const bma = await bmaCctv(bbox);

const n = normalise(roads, shade, points);
const osmTime = roads.osm3s?.timestamp_osm_base ?? new Date().toISOString();
const now = new Date().toISOString();
const osm = { source: [OSM], updatedAt: osmTime };

const dataset: AreaDataset = {
  version: 2,
  id: 'siam',
  name: { th: 'สยาม – ราชประสงค์ – ชิดลม', en: 'Siam – Ratchaprasong – Chit Lom' },
  bbox: [...bbox] as [number, number, number, number],
  source: bma.ok ? [OSM, BMA_CCTV] : [OSM],
  updatedAt: now,
  layers: {
    walkways: { ...osm, ...n.walkways },
    buildings: { source: [OSM, HEIGHT_RULES], updatedAt: osmTime, items: n.buildings },
    trees: { ...osm, points: n.trees, rows: n.treeRows },
    elevated: { ...osm, items: n.elevated },
    malls: { ...osm, items: n.malls },
    cctvOsm: { ...osm, points: n.cams },
    cctvBma: { source: [BMA_CCTV], updatedAt: now, points: bma.points },
    lamps: { ...osm, points: n.lamps },
    pois: { ...osm, points: n.pois },
  },
};

const valid = areaDatasetSchema.parse(dataset);
await writeFile(OUT, JSON.stringify(valid));
const hs = valid.layers.buildings.items.reduce<Record<string, number>>((acc, b) => ((acc[b.heightSource] = (acc[b.heightSource] ?? 0) + 1), acc), {});
console.log(
  `wrote ${OUT}\n  ways ${valid.layers.walkways.ways.length}, buildings ${valid.layers.buildings.items.length} (${JSON.stringify(hs)}),` +
    ` trees ${valid.layers.trees.points.length / 4}, decks ${valid.layers.elevated.items.length}, malls ${valid.layers.malls.items.length},` +
    ` mall-linked ways ${valid.layers.walkways.ways.filter((w) => w.mall != null).length},` +
    ` cctv osm ${valid.layers.cctvOsm.points.length / 2} / bma ${valid.layers.cctvBma.points.length / 2}`,
);
