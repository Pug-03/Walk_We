// Convert the prototype's baked zone (old compact format) into the area
// dataset format, unchanged in content, so the new engine can be compared
// with the prototype engine on identical inputs.
//
//   npx tsx packages/data/scripts/import-prototype.ts [path/to/siam.json]
//
// Writes data/areas/siam-prototype.json (regression input only; not served).

import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WALKWAY_CLASSES, WF } from '@walkwe/core';
import { areaDatasetSchema, type AreaDataset } from '../src/index.ts';
import { PROTOTYPE } from './sources.ts';

// Prototype class codes (js/data.js HIGHWAY_CLASSES) — same list and order.
const OLD_CLASSES = WALKWAY_CLASSES;
const OLD_COVERED = 4; // the prototype folded indoor/corridor/tunnel into COVERED

interface OldZone {
  bbox: [number, number, number, number]; // s, w, n, e
  generatedAt: string;
  coords: number[];
  roads: Array<[number, string, number, number[], number]>;
  buildings: Array<[number, number, number[]]>;
  trees: number[];
  treeRows: number[][];
  bridges: Array<[number, number, number[]]>;
  lamps: number[];
  cams: number[];
  pois: number[];
}

const src = process.argv[2] ?? `${homedir()}/Documents/Code/Walk We/data/zones/siam.json`;
const old = JSON.parse(await readFile(src, 'utf8')) as OldZone;
const [s, w, n, e] = old.bbox;
const meta = { source: [PROTOTYPE], updatedAt: old.generatedAt };

const dataset: AreaDataset = {
  version: 2,
  id: 'siam-prototype',
  name: { th: 'สยาม (ข้อมูล prototype)', en: 'Siam (prototype data)' },
  bbox: [w, s, e, n],
  source: [PROTOTYPE],
  updatedAt: new Date().toISOString(),
  layers: {
    walkways: {
      ...meta,
      nodes: old.coords,
      ways: old.roads.map(([cls, name, flags, nodes, id]) => ({
        id,
        cls: OLD_CLASSES[cls] ?? 'road',
        name,
        // Same bit values; the prototype's COVERED already meant "never sun".
        flags: flags & (WF.LIT_YES | WF.LIT_NO | OLD_COVERED | WF.BRIDGE | WF.TUNNEL | WF.NO_SIDEWALK),
        nodes,
      })),
    },
    buildings: {
      ...meta,
      // Heights were pre-computed and their source discarded by the prototype.
      items: old.buildings.map(([h, minH, ring]) => ({ h: Math.max(h, 0.1), minH, heightSource: 'unknown' as const, ring })),
    },
    trees: { ...meta, points: old.trees, rows: old.treeRows },
    elevated: {
      ...meta,
      // The prototype kept only height and width; kind is inferred from them.
      items: old.bridges.map(([h, wd, line]) => ({ kind: h <= 6 ? ('foot' as const) : wd === 9 ? ('rail' as const) : ('road' as const), h, w: wd, covered: false, line })),
    },
    malls: { ...meta, items: [] },
    cctvOsm: { ...meta, points: [] },
    cctvBma: { ...meta, points: old.cams },
    lamps: { ...meta, points: old.lamps },
    pois: { ...meta, points: old.pois },
  },
};

const out = fileURLToPath(new URL('../../../data/areas/siam-prototype.json', import.meta.url));
await writeFile(out, JSON.stringify(areaDatasetSchema.parse(dataset)));
console.log(`wrote ${out}: ${dataset.layers.walkways.ways.length} ways, ${dataset.layers.buildings.items.length} buildings`);
