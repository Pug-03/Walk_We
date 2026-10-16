import type { LatLng } from '../geo/types.ts';

/** Cloud cover at a time and place, 0–100 %, or null when unknown. */
export interface CloudCoverProvider {
  cloudCover(at: Date, where: LatLng, signal?: AbortSignal): Promise<number | null>;
}

export interface OpenMeteoOptions {
  /** e.g. https://api.open-meteo.com (from env). */
  baseUrl: string;
  fetch?: typeof fetch;
}

/**
 * Open-Meteo hourly forecast (free, no key). Forecasts reach ~16 days ahead;
 * outside that, or on any failure, returns null and the router assumes a
 * clear sky (the conservative choice for shade).
 */
export class OpenMeteoCloud implements CloudCoverProvider {
  private cache = new Map<string, Promise<Map<number, number> | null>>();
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: OpenMeteoOptions) {
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async cloudCover(at: Date, where: LatLng, signal?: AbortSignal): Promise<number | null> {
    // Two decimals (~1 km): plenty for weather, and a coarse cache key.
    const key = `${where.lat.toFixed(2)},${where.lng.toFixed(2)}`;
    let hours = this.cache.get(key);
    if (!hours) {
      hours = this.load(where, signal).catch(() => null);
      this.cache.set(key, hours);
      // A failed forecast isn't kept: the next route tries again.
      void hours.then((h) => {
        if (!h) this.cache.delete(key);
      });
    }
    const table = await hours;
    if (!table) return null;
    const hour = Math.floor(at.getTime() / 3_600_000) * 3_600_000;
    return table.get(hour) ?? null;
  }

  private async load(where: LatLng, signal?: AbortSignal): Promise<Map<number, number> | null> {
    const url = new URL('v1/forecast', this.opts.baseUrl.endsWith('/') ? this.opts.baseUrl : `${this.opts.baseUrl}/`);
    url.searchParams.set('latitude', where.lat.toFixed(2));
    url.searchParams.set('longitude', where.lng.toFixed(2));
    url.searchParams.set('hourly', 'cloud_cover');
    url.searchParams.set('forecast_days', '16');
    url.searchParams.set('timezone', 'GMT');
    const res = await this.fetchImpl(url, signal ? { signal } : {});
    if (!res.ok) return null;
    const body = (await res.json()) as { hourly?: { time?: string[]; cloud_cover?: Array<number | null> } };
    const times = body.hourly?.time ?? [];
    const values = body.hourly?.cloud_cover ?? [];
    const table = new Map<number, number>();
    times.forEach((t, i) => {
      const v = values[i];
      if (typeof v === 'number') table.set(Date.parse(`${t}:00Z`), v);
    });
    return table;
  }
}
