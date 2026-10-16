import { z } from 'zod';
import { datasetMetaSchema } from './common.ts';

// Past incidents (brief §7). Stored at street-segment level (OSM way ids),
// and the schema deliberately has NO free-text fields: there is nowhere to
// write a school, shop or person name. Every entry links to its news source
// with a date. Placeholder entries (until real links are supplied) carry
// placeholder: true — shown labelled in dev, stripped from production builds.

export const INCIDENT_CATEGORIES = ['student-fight', 'assault', 'robbery', 'harassment', 'other'] as const;

export const incidentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    wayIds: z.array(z.number().int().positive()).min(1),
    category: z.enum(INCIDENT_CATEGORIES),
    occurredOn: z.string().date(),
    /** opening_hours-style window when the risk applies, e.g. "Mo-Fr 15:00-19:00"; "24/7" if unknown. */
    window: z.string().min(1),
    severity: z.number().min(0).max(1),
    sources: z
      .array(z.object({ url: z.string().url(), publishedOn: z.string().date(), publisher: z.string().max(60) }))
      .min(1),
    placeholder: z.boolean(),
  })
  .strict(); // unknown keys (e.g. a "note" with a name in it) are rejected

export const incidentsDatasetSchema = datasetMetaSchema.extend({
  id: z.string(),
  items: z.array(incidentSchema),
});

export type Incident = z.infer<typeof incidentSchema>;
export type IncidentsDataset = z.infer<typeof incidentsDatasetSchema>;

/** Production builds and runtime: drop placeholder entries. */
export function withoutPlaceholders(d: IncidentsDataset): IncidentsDataset {
  return { ...d, items: d.items.filter((i) => !i.placeholder) };
}
