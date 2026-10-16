import { z } from 'zod';
import { datasetMetaSchema } from './common.ts';

// Hand-made, photo-led guide for a pilot route (brief §9). One file holds
// both directions. Mirrors the future PostGIS tables route_guides +
// route_guide_steps.

const text = z.object({ th: z.string().min(1), en: z.string().min(1) });

export const guideStepSchema = z.object({
  /** File name the photographer drops in, e.g. siam-cw-01.jpg. */
  photo: z.string().regex(/^[a-z0-9-]+\.jpg$/),
  caption: text,
  instruction: text,
  landmark: text,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** OSM opening_hours for when this step is passable, e.g. "24/7", "Mo-Su 10:00-22:00". */
  validHours: z.string().min(1),
  /** Walk from this step to the next (m); 0 on the last step. */
  distanceM: z.number().min(0),
  /** Checked on site. Drafts are shown, but flagged in dev and in the data notes. */
  verified: z.boolean(),
});

export const guideDirectionSchema = z.object({
  id: z.string().min(1),
  from: z.object({ name: text, lat: z.number(), lng: z.number() }),
  to: z.object({ name: text, lat: z.number(), lng: z.number() }),
  steps: z.array(guideStepSchema).min(2),
});

export const routeGuideSchema = datasetMetaSchema.extend({
  id: z.string().min(1),
  name: text,
  /** Chosen points must be this close to a direction's ends to use the guide. */
  matchRadiusM: z.number().positive(),
  /** Every guide step must lie this close to the computed route. */
  stepToleranceM: z.number().positive(),
  directions: z.array(guideDirectionSchema).min(1),
});

export type GuideStep = z.infer<typeof guideStepSchema>;
export type GuideDirection = z.infer<typeof guideDirectionSchema>;
export type RouteGuide = z.infer<typeof routeGuideSchema>;

/** Photo manifest written by scripts/build-photos.ts. */
export const photoManifestSchema = z.object({
  updatedAt: z.string(),
  photos: z.record(
    z.string(),
    z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      /** Tiny blurred WebP as a data URL, shown while the real image loads. */
      blur: z.string().startsWith('data:image/'),
      /** True while the file is still the generated placeholder. */
      placeholder: z.boolean(),
      /** Widths available for srcset (webp + avif + jpg fallback). */
      widths: z.array(z.number().int().positive()).min(1),
    }),
  ),
});
export type PhotoManifest = z.infer<typeof photoManifestSchema>;
