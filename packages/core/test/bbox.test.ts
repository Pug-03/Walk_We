import { describe, expect, it } from 'vitest';
import { bangkok } from '@walkwe/config';
import { bboxContains, haversineMeters, isValidLatLng } from '../src/index.ts';

describe('geo helpers', () => {
  it('pilot area contains Siam and CentralWorld', () => {
    expect(bboxContains(bangkok.pilotBounds, { lat: 13.7456, lng: 100.5341 })).toBe(true);
    expect(bboxContains(bangkok.pilotBounds, { lat: 13.7466, lng: 100.539 })).toBe(true);
    expect(bboxContains(bangkok.pilotBounds, { lat: 13.72, lng: 100.53 })).toBe(false);
  });
  it('Siam to CentralWorld is roughly 550 m as the crow flies', () => {
    const d = haversineMeters({ lat: 13.7456, lng: 100.5341 }, { lat: 13.7466, lng: 100.539 });
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(600);
  });
  it('validates coordinates', () => {
    expect(isValidLatLng({ lat: 13.7, lng: 100.5 })).toBe(true);
    expect(isValidLatLng({ lat: NaN, lng: 100.5 })).toBe(false);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng(null)).toBe(false);
  });
});
