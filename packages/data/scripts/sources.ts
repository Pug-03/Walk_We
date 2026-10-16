import type { Source } from '../src/index.ts';

// Every upstream source, with its license, in one place. Bake/import scripts
// attach the relevant ones to each layer they write.
export const OSM: Source = {
  name: 'OpenStreetMap contributors (via Overpass API)',
  url: 'https://www.openstreetmap.org/copyright',
  license: 'ODbL-1.0',
  notes: 'Attribution "© OpenStreetMap contributors" required; derived databases must stay ODbL.',
};

export const BMA_CCTV: Source = {
  name: 'Bangkok Metropolitan Administration GIS portal — CCTV layers',
  url: 'https://cpudgiportal.bangkok.go.th/arcgis/rest/services',
  license: 'No license stated (public ArcGIS layer)',
  notes: 'Positions only. Commercial use needs written permission from the BMA; re-check before launch.',
};

export const HEIGHT_RULES: Source = {
  name: 'Walk We height rules (OSM height → building:levels × 3 m → per-type default)',
  url: 'https://wiki.openstreetmap.org/wiki/Key:height',
  license: 'ODbL-1.0 (derived from OSM)',
  notes: 'Only heightSource "height" is measured; every other value is an estimate and is flagged in the app.',
};

export const PROTOTYPE: Source = {
  name: 'Walk We prototype bake (~/Documents/Code/Walk We, data/zones/siam.json, 2026-10-11)',
  url: 'https://www.openstreetmap.org/copyright',
  license: 'ODbL-1.0 (OSM-derived) + BMA layer terms for cameras',
  notes: 'Imported for regression comparison only. Original height tags were not kept, so heightSource is "unknown".',
};
