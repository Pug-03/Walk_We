import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bangkok } from '@walkwe/config';
import { Area, bboxContains } from '@walkwe/core';
import { areaDatasetSchema, toAreaInput } from '../src/index.ts';

const raw = JSON.parse(readFileSync(new URL('../../../data/areas/siam.json', import.meta.url), 'utf8'));

describe('data/areas/siam.json', () => {
  const ds = areaDatasetSchema.parse(raw);

  it('validates against the schema', () => {
    expect(ds.id).toBe('siam');
    expect(ds.layers.walkways.ways.length).toBeGreaterThan(1000);
  });

  it('every layer names its sources with a license and an update time', () => {
    for (const [name, layer] of Object.entries(ds.layers)) {
      expect(layer.source.length, name).toBeGreaterThan(0);
      for (const s of layer.source) expect(s.license.trim(), `${name}: ${s.name}`).not.toBe('');
      expect(Date.parse(layer.updatedAt), name).not.toBeNaN();
    }
    // BMA cameras carry the commercial-use caveat.
    expect(ds.layers.cctvBma.source[0]!.notes).toMatch(/permission/i);
  });

  it('covers the pilot route and routes Siam ↔ CentralWorld', () => {
    expect(bboxContains(ds.bbox, { lat: 13.74563, lng: 100.53412 })).toBe(true);
    expect(bboxContains(ds.bbox, { lat: 13.7465769, lng: 100.5390414 })).toBe(true);
    const area = new Area(toAreaInput(ds));
    expect(area.nearestNode(13.74563, 100.53412, 150)).not.toBeNull();
    expect(area.nearestNode(13.7465769, 100.5390414, 150)).not.toBeNull();
  });

  it('records where every building height came from', () => {
    const sources = new Set(ds.layers.buildings.items.map((b) => b.heightSource));
    expect([...sources].every((s) => ['height', 'levels', 'type-default', 'default'].includes(s))).toBe(true);
  });

  it('mall links point at real malls', () => {
    const n = ds.layers.malls.items.length;
    for (const w of ds.layers.walkways.ways) if (w.mall != null) expect(w.mall).toBeLessThan(n);
    expect(bangkok.defaultMallHours).toBeTruthy();
  });
});
