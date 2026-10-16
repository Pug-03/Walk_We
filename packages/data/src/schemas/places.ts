import { z } from 'zod';
import { latLngSchema } from './common.ts';

// Device-only data (localStorage). Never sent to a server, but validated on
// read so a corrupted or old-format entry can't crash the app.

export const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  detail: z.string().max(300).default(''),
  location: latLngSchema,
});

export const savedSlotSchema = z.enum(['home', 'work', 'station', 'other']);

export const savedPlaceSchema = placeSchema.extend({
  slot: savedSlotSchema,
  savedAt: z.number().int(),
});

export const recentPlaceSchema = placeSchema.extend({
  usedAt: z.number().int(),
});

export type PlaceRecord = z.infer<typeof placeSchema>;
export type SavedSlot = z.infer<typeof savedSlotSchema>;
export type SavedPlace = z.infer<typeof savedPlaceSchema>;
export type RecentPlace = z.infer<typeof recentPlaceSchema>;

/** Parse a stored list, dropping entries that no longer match the schema. */
export function parseList<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const r = schema.safeParse(item);
    return r.success ? [r.data] : [];
  });
}
