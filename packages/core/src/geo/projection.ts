import type { LatLng } from './types.ts';

/**
 * Local equirectangular projection in metres around an origin. Error is well
 * under 0.1% across a few kilometres — fine for a pilot area or a city tile,
 * and far cheaper than reprojecting every sample.
 */
export class LocalProjection {
  readonly kx: number;
  readonly ky = 110_574;

  constructor(readonly origin: LatLng) {
    this.kx = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  }

  x(lng: number): number {
    return (lng - this.origin.lng) * this.kx;
  }
  y(lat: number): number {
    return (lat - this.origin.lat) * this.ky;
  }
  lng(x: number): number {
    return x / this.kx + this.origin.lng;
  }
  lat(y: number): number {
    return y / this.ky + this.origin.lat;
  }
  toLatLng(x: number, y: number): LatLng {
    return { lat: this.lat(y), lng: this.lng(x) };
  }
}
