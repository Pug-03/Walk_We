/** [west, south, east, north] in WGS84 degrees, same order as GeoJSON bbox. */
export type BBox = readonly [number, number, number, number];

export interface EmergencyNumber {
  /** Stable id used for icons and analytics-free lookups. */
  id: 'police' | 'medical' | 'tourist-police' | 'fire';
  number: string;
  label: { th: string; en: string };
}

export interface DataSource {
  id: string;
  name: string;
  url: string;
  license: string;
}

export interface CityConfig {
  id: string;
  name: { th: string; en: string };
  /** IANA zone. All "walk time" maths happens in this zone, not the device's. */
  timezone: string;
  /** Whole-city bounds: geocoder results outside are dropped. */
  bounds: BBox;
  /** Area that has route data today. Points outside get a "not covered yet" note. */
  pilotBounds: BBox;
  /** Longest walk the app will route (metres); farther trips get a "too far to walk" note. */
  maxWalkM: number;
  /** Initial map view. */
  center: { lat: number; lng: number };
  defaultZoom: number;
  emergencyNumbers: readonly EmergencyNumber[];
  /**
   * opening_hours used for a mall whose OSM data has none (or one we can't
   * parse). Deliberately narrow, so a route never relies on a closed mall.
   */
  defaultMallHours: string;
  /** Incident register for this city (data/incidents/<id>.json). */
  incidents: { dataset: string; halfLifeDays: number; outsideWindow: number };
  /** Photo route guides published for this city (data/routes/<id>.json). */
  routeGuides: readonly string[];
  /** Planning walk speed (m/s); slower than the usual 1.4 for heat and crowds. */
  walkSpeedMps: number;
  dataSources: readonly DataSource[];
}
