import { z } from 'zod';
import { WALKWAY_CLASSES, type AreaInput } from '@walkwe/core';
import { datasetMetaSchema, sourceSchema } from './common.ts';

// Pilot-area dataset. Each layer mirrors a future PostGIS table and carries
// its own source + license + update time, so the app can show where every
// layer comes from (brief §7/§9). Geometry is stored as flat [lat, lng, …]
// arrays to keep the file small; the router converts it to metres once.

const flatCoords = z.array(z.number()).refine((a) => a.length % 2 === 0, 'flat lat/lng pairs');
const layerMeta = { source: z.array(sourceSchema).min(1), updatedAt: z.string().datetime({ offset: true }) };

/** walkways (PostGIS: walkway_nodes + walkways). */
export const walkwaysLayer = z.object({
  ...layerMeta,
  nodes: flatCoords,
  ways: z.array(
    z.object({
      id: z.number().int(), // OSM way id
      cls: z.enum(WALKWAY_CLASSES),
      name: z.string(),
      flags: z.number().int().min(0).max(255),
      nodes: z.array(z.number().int().min(0)).min(2),
      mall: z.number().int().min(0).nullable().optional(),
    }),
  ),
});

/** buildings (PostGIS: buildings with height + height_source). */
export const buildingsLayer = z.object({
  ...layerMeta,
  items: z.array(
    z.object({
      h: z.number().positive().max(500),
      minH: z.number().min(0),
      heightSource: z.enum(['height', 'levels', 'type-default', 'default', 'unknown']),
      ring: flatCoords.refine((a) => a.length >= 8, 'ring needs ≥ 4 points'),
    }),
  ),
});

export const treesLayer = z.object({
  ...layerMeta,
  /** [lat, lng, crownRadiusM, heightM, …] */
  points: z.array(z.number()).refine((a) => a.length % 4 === 0),
  rows: z.array(flatCoords),
});

/** Elevated decks: BTS/MRT tracks, expressways, footbridges and skywalks. */
export const elevatedLayer = z.object({
  ...layerMeta,
  items: z.array(
    z.object({
      kind: z.enum(['rail', 'road', 'foot']),
      h: z.number().positive(),
      w: z.number().positive(),
      covered: z.boolean(),
      line: flatCoords,
    }),
  ),
});

export const mallsLayer = z.object({
  ...layerMeta,
  items: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      /** OSM opening_hours; null → city default (flagged as estimated in the UI). */
      hours: z.string().nullable(),
      ring: flatCoords,
    }),
  ),
});

/** Point layers used by night mode (Phase 4). */
export const pointsLayer = z.object({ ...layerMeta, points: flatCoords });
export const poisLayer = z.object({
  ...layerMeta,
  /** [lat, lng, dayWeight, nightWeight, …] */
  points: z.array(z.number()).refine((a) => a.length % 4 === 0),
});

export const areaDatasetSchema = datasetMetaSchema.extend({
  id: z.string().min(1),
  name: z.object({ th: z.string(), en: z.string() }),
  /** [west, south, east, north] */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  layers: z.object({
    walkways: walkwaysLayer,
    buildings: buildingsLayer,
    trees: treesLayer,
    elevated: elevatedLayer,
    malls: mallsLayer,
    cctvOsm: pointsLayer,
    cctvBma: pointsLayer,
    lamps: pointsLayer,
    pois: poisLayer,
  }),
});

export type AreaDataset = z.infer<typeof areaDatasetSchema>;

/** The router's input view of a dataset (+ optional incidents). */
export function toAreaInput(d: AreaDataset, incidents: AreaInput['incidents'] = []): AreaInput {
  return {
    night: {
      cctv: [...d.layers.cctvBma.points, ...d.layers.cctvOsm.points],
      lamps: d.layers.lamps.points,
      pois: d.layers.pois.points,
    },
    incidents,
    bbox: d.bbox,
    walkways: d.layers.walkways,
    buildings: d.layers.buildings.items,
    trees: d.layers.trees.points,
    treeRows: d.layers.trees.rows,
    elevated: d.layers.elevated.items,
    malls: d.layers.malls.items,
  };
}
