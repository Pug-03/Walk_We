import { z } from 'zod';

// Every external URL comes from env (see .env.example) — none are hardcoded,
// so swapping tile or geocoder providers is a config change.
const schema = z.object({
  VITE_MAP_STYLE_DAY: z.string().url(),
  VITE_MAP_STYLE_NIGHT: z.string().url(),
  VITE_GEOCODER_URL: z.string().url(),
  VITE_WEATHER_URL: z.string().url(),
  VITE_ERROR_TRACKING_URL: z.union([z.literal(''), z.string().url()]).default(''),
  // Walk We AI proxy (apps/ai-proxy). Empty = AI features hidden; everything still works by hand.
  VITE_AI_PROXY_URL: z.union([z.literal(''), z.string().url()]).default(''),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(`Invalid env, see apps/web/.env.example: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
}

export const env = {
  mapStyle: { day: parsed.data.VITE_MAP_STYLE_DAY, night: parsed.data.VITE_MAP_STYLE_NIGHT },
  geocoderUrl: parsed.data.VITE_GEOCODER_URL,
  weatherUrl: parsed.data.VITE_WEATHER_URL,
  errorTrackingUrl: parsed.data.VITE_ERROR_TRACKING_URL || null,
  aiProxyUrl: parsed.data.VITE_AI_PROXY_URL.replace(/\/$/, '') || null,
};
