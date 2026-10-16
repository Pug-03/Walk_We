import type { BBox } from '@walkwe/config';
import { bboxContains } from '../geo/bbox.ts';
import type { GeocodeQuery, GeocoderAdapter, Place } from './geocoder.ts';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
  };
}

export interface PhotonOptions {
  /** Base URL from env; the public komoot server is for development only. */
  baseUrl: string;
  /** Results outside are dropped (whole-city bounds). */
  bounds: BBox;
  limit?: number;
  fetch?: typeof fetch;
}

/** Photon (OSM) — free, made for search-as-you-type, unlike Nominatim. */
export class PhotonGeocoder implements GeocoderAdapter {
  readonly id = 'photon';
  private readonly opts: Required<Omit<PhotonOptions, 'fetch'>> & { fetch: typeof fetch };

  constructor(opts: PhotonOptions) {
    this.opts = { limit: 8, fetch: globalThis.fetch.bind(globalThis), ...opts };
  }

  async search({ text, lang, near, signal }: GeocodeQuery): Promise<Place[]> {
    const q = text.trim();
    if (q.length < 2) return [];
    const url = new URL('api/', this.opts.baseUrl.endsWith('/') ? this.opts.baseUrl : `${this.opts.baseUrl}/`);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(this.opts.limit));
    // Photon has no Thai UI language; "default" returns the local (Thai) names.
    url.searchParams.set('lang', lang === 'en' ? 'en' : 'default');
    url.searchParams.set('bbox', this.opts.bounds.join(','));
    if (near) {
      // Bias only, so ~1 km is plenty: the start point may be the user's GPS
      // fix, and an exact position must not leave the device (privacy policy).
      url.searchParams.set('lat', near.lat.toFixed(2));
      url.searchParams.set('lon', near.lng.toFixed(2));
    }
    const res = await this.opts.fetch(url, signal ? { signal } : {});
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    return toPlaces(body.features ?? [], this.opts.bounds);
  }
}

export function toPlaces(features: PhotonFeature[], bounds: BBox): Place[] {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of features) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const location = { lat, lng };
    if (!bboxContains(bounds, location)) continue;
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const name = p.name || street;
    if (!name) continue;
    const id = p.osm_type && p.osm_id != null ? `osm:${p.osm_type}${p.osm_id}` : `pt:${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const detail = [p.name ? street : '', p.district ?? p.locality, p.city]
      .filter((s): s is string => !!s && s !== name)
      .join(', ');
    places.push({ id, name, detail, location });
  }
  return places;
}
