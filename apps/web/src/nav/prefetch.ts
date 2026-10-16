import type { LatLng } from '@walkwe/core';
import type { PhotoManifest } from '@walkwe/data';

// Warm the service-worker caches for one route, so navigation keeps working
// if the connection drops mid-route (airplane mode, mall basements): every
// photo variant of the route, both map styles with their sprites and the
// Thai/Latin glyph ranges, and the vector tiles around the route. The SW's
// CacheFirst rules (vite.config.ts) store whatever passes through here.

/** Slippy-map tile containing a point. */
export function tileOf(p: LatLng, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const lat = (p.lat * Math.PI) / 180;
  return {
    x: Math.floor(((p.lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n),
  };
}

/** Tiles covering the route's bounding box plus a margin, for zooms [z0, z1]. */
export function tilesForRoute(line: LatLng[], z0: number, z1: number, marginDeg = 0.0015): Array<[number, number, number]> {
  const lats = line.map((p) => p.lat), lngs = line.map((p) => p.lng);
  const sw = { lat: Math.min(...lats) - marginDeg, lng: Math.min(...lngs) - marginDeg };
  const ne = { lat: Math.max(...lats) + marginDeg, lng: Math.max(...lngs) + marginDeg };
  const out: Array<[number, number, number]> = [];
  for (let z = z0; z <= z1; z++) {
    const a = tileOf({ lat: ne.lat, lng: sw.lng }, z), b = tileOf({ lat: sw.lat, lng: ne.lng }, z);
    for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) out.push([z, x, y]);
  }
  return out;
}

// Unicode blocks the labels need: Basic Latin, Thai (U+0E00–0E7F), General Punctuation.
const GLYPH_RANGES = ['0-255', '3584-3839', '8192-8447'];

interface StyleJson {
  sprite?: string | Array<{ url: string }>;
  glyphs?: string;
  sources?: Record<string, { type: string; url?: string; tiles?: string[]; maxzoom?: number }>;
  layers?: Array<{ layout?: { 'text-font'?: unknown } }>;
}

const get = (url: string) => fetch(url, { mode: 'cors' }).then((r) => (r.ok ? r : Promise.reject(new Error(`${r.status} ${url}`))));

async function warmStyle(styleUrl: string, line: LatLng[], urls: Set<string>): Promise<void> {
  const style = (await (await get(styleUrl)).json()) as StyleJson;
  const sprites = typeof style.sprite === 'string' ? [style.sprite] : (style.sprite ?? []).map((s) => s.url);
  for (const sp of sprites) for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) urls.add(`${sp}${suffix}`);
  if (style.glyphs) {
    const stacks = new Set<string>();
    for (const l of style.layers ?? []) {
      const f = l.layout?.['text-font'];
      if (Array.isArray(f) && f.every((x) => typeof x === 'string')) stacks.add(f.join(','));
    }
    for (const st of stacks) for (const r of GLYPH_RANGES) urls.add(style.glyphs.replace('{fontstack}', encodeURIComponent(st)).replace('{range}', r));
  }
  for (const src of Object.values(style.sources ?? {})) {
    if (src.type !== 'vector') continue;
    let templates = src.tiles;
    let maxzoom = src.maxzoom ?? 14;
    if (!templates && src.url) {
      const tj = (await (await get(src.url)).json()) as { tiles?: string[]; maxzoom?: number };
      templates = tj.tiles;
      maxzoom = tj.maxzoom ?? maxzoom;
    }
    const t = templates?.[0];
    if (!t) continue;
    // Vector tiles over-zoom past maxzoom, so up to maxzoom is all we need.
    for (const [z, x, y] of tilesForRoute(line, Math.max(0, maxzoom - 2), maxzoom)) {
      urls.add(t.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
    }
  }
}

export interface PrefetchResult {
  ok: number;
  failed: number;
}

export async function prefetchForRoute(
  line: LatLng[],
  photos: string[],
  manifest: PhotoManifest | null,
  styleUrls: string[],
): Promise<PrefetchResult> {
  const urls = new Set<string>();
  for (const name of photos) {
    const m = manifest?.photos[name];
    const base = name.replace(/\.jpg$/, '');
    for (const w of m?.widths ?? []) for (const ext of ['avif', 'webp', 'jpg']) urls.add(`/data/routes/photos/generated/${base}-${w}.${ext}`);
  }
  await Promise.allSettled(styleUrls.map((s) => warmStyle(s, line, urls)));
  let ok = 0, failed = 0;
  // A few at a time: polite to the tile server and to a weak connection.
  const list = [...urls];
  for (let i = 0; i < list.length; i += 6) {
    const batch = await Promise.allSettled(list.slice(i, i + 6).map((u) => get(u).then((r) => r.arrayBuffer())));
    for (const b of batch) b.status === 'fulfilled' ? ok++ : failed++;
  }
  return { ok, failed };
}
