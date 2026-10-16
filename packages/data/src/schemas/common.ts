import { z } from 'zod';

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** One upstream source of a dataset. Every published file lists all of them. */
export const sourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  license: z.string().min(1),
  /** e.g. "commercial use needs BMA permission", "heights estimated". */
  notes: z.string().optional(),
});

/**
 * Header every data file carries. Mirrors the `datasets` table planned for
 * PostGIS (id, version, source jsonb, updated_at).
 */
export const datasetMetaSchema = z.object({
  version: z.number().int().positive(),
  source: z.array(sourceSchema).min(1),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Source = z.infer<typeof sourceSchema>;
export type DatasetMeta = z.infer<typeof datasetMetaSchema>;
