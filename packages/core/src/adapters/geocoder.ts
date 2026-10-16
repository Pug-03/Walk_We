import type { LatLng } from '../geo/types.ts';

export interface Place {
  /** Provider-scoped stable id, e.g. "osm:W157482067". */
  id: string;
  name: string;
  /** Short secondary line (street, district). */
  detail: string;
  location: LatLng;
}

export interface GeocodeQuery {
  text: string;
  lang: 'th' | 'en';
  /** Rank results near here first. */
  near?: LatLng;
  signal?: AbortSignal;
}

/**
 * Text search -> places. Today: Photon (OSM). Later: Longdo / Google behind
 * the same interface, so the UI never changes when the provider does.
 */
export interface GeocoderAdapter {
  readonly id: string;
  search(query: GeocodeQuery): Promise<Place[]>;
}
