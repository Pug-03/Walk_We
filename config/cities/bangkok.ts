import type { CityConfig } from '../types.ts';

// Everything city-specific lives here so a second city is a new file, not a
// code change. Nothing in apps/ or packages/ may hardcode these values.
export const bangkok: CityConfig = {
  id: 'bangkok',
  name: { th: 'กรุงเทพมหานคร', en: 'Bangkok' },
  timezone: 'Asia/Bangkok',
  bounds: [100.327, 13.494, 100.939, 13.955],
  // Pilot: central Bangkok around Siam, wide enough for walks up to 5 km
  // (MAX_WALK_M): Ratchathewi to Sam Yan, Pathum Wan to Phloen Chit.
  pilotBounds: [100.505, 13.725, 100.565, 13.768],
  maxWalkM: 5000,
  center: { lat: 13.7462, lng: 100.5347 },
  defaultZoom: 15,
  defaultMallHours: 'Mo-Su 10:00-21:00',
  walkSpeedMps: 1.25, // 4.5 km/h
  routeGuides: ['siam-centralworld'],
  // An incident's weight halves each year and drops to 20 % outside its time window.
  incidents: { dataset: 'incidents/bangkok', halfLifeDays: 365, outsideWindow: 0.2 },
  emergencyNumbers: [
    { id: 'police', number: '191', label: { th: 'ตำรวจ', en: 'Police' } },
    { id: 'medical', number: '1669', label: { th: 'เจ็บป่วยฉุกเฉิน', en: 'Medical emergency' } },
    { id: 'tourist-police', number: '1155', label: { th: 'ตำรวจท่องเที่ยว', en: 'Tourist police' } },
  ],
  dataSources: [
    {
      id: 'osm',
      name: 'OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL-1.0',
    },
    {
      id: 'bma-cctv',
      name: 'Bangkok Metropolitan Administration GIS portal (CCTV layer)',
      url: 'https://cpudgiportal.bangkok.go.th',
      license: 'No license stated — permission from BMA required for commercial use',
    },
    {
      id: 'open-meteo',
      name: 'Open-Meteo',
      url: 'https://open-meteo.com',
      license: 'CC-BY-4.0',
    },
    {
      id: 'photon',
      name: 'Photon geocoder (komoot), OSM data',
      url: 'https://photon.komoot.io',
      license: 'ODbL-1.0 (data); fair-use public API',
    },
    {
      id: 'openfreemap',
      name: 'OpenFreeMap tiles',
      url: 'https://openfreemap.org',
      license: 'OpenMapTiles + OSM (ODbL-1.0); free, no key',
    },
  ],
};
