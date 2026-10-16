import { describe, expect, it, vi } from 'vitest';
import { bangkok } from '@walkwe/config';
import { PhotonGeocoder, toPlaces } from '../src/index.ts';

const feature = (name: string, lng: number, lat: number, id = 1, extra = {}) => ({
  geometry: { coordinates: [lng, lat] },
  properties: { osm_type: 'W', osm_id: id, name, district: 'ปทุมวัน', city: 'กรุงเทพมหานคร', ...extra },
});

describe('toPlaces', () => {
  it('maps, drops out-of-city results and duplicates', () => {
    const places = toPlaces(
      [
        feature('centralwOrld', 100.539, 13.7466, 1, { street: 'ถนนราชดำริ', housenumber: '999/9' }),
        feature('centralwOrld', 100.539, 13.7466, 1),
        feature('Chiang Mai thing', 98.98, 18.79, 2),
      ] as never,
      bangkok.bounds,
    );
    expect(places).toEqual([
      {
        id: 'osm:W1',
        name: 'centralwOrld',
        detail: '999/9 ถนนราชดำริ, ปทุมวัน, กรุงเทพมหานคร',
        location: { lat: 13.7466, lng: 100.539 },
      },
    ]);
  });
});

describe('PhotonGeocoder', () => {
  it('builds the request with bounds, bias and language', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ features: [] })));
    const geo = new PhotonGeocoder({ baseUrl: 'https://photon.example', bounds: bangkok.bounds, fetch: fetchMock as never });
    await geo.search({ text: ' siam ', lang: 'th', near: { lat: 13.74621, lng: 100.53471 } });
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/api/');
    expect(url.searchParams.get('q')).toBe('siam');
    expect(url.searchParams.get('lang')).toBe('default');
    expect(url.searchParams.get('bbox')).toBe(bangkok.bounds.join(','));
    expect(url.searchParams.get('lat')).toBe('13.75');
  });

  it('skips the network for one-character queries', async () => {
    const fetchMock = vi.fn();
    const geo = new PhotonGeocoder({ baseUrl: 'https://photon.example', bounds: bangkok.bounds, fetch: fetchMock as never });
    expect(await geo.search({ text: 'a', lang: 'en' })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
