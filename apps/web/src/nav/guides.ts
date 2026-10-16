import { activeCity } from '@walkwe/config';
import { JsonRepository, photoManifestSchema, routeGuideSchema, type PhotoManifest, type RouteGuide } from '@walkwe/data';

const repo = new JsonRepository({ baseUrl: '/data/' });

/** Published photo guides for the city; a missing/broken one is skipped. */
export async function loadGuides(): Promise<RouteGuide[]> {
  const all = await Promise.allSettled(activeCity.routeGuides.map((id) => repo.load(`routes/${id}`, (raw) => routeGuideSchema.parse(raw))));
  return all.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

let manifest: Promise<PhotoManifest | null> | null = null;
export function loadPhotoManifest(): Promise<PhotoManifest | null> {
  manifest ??= repo.load('routes/photos/generated/manifest', (raw) => photoManifestSchema.parse(raw)).catch(() => {
    manifest = null;
    return null;
  });
  return manifest;
}
