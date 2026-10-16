import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { incidentSchema, incidentsDatasetSchema, withoutPlaceholders } from '../src/index.ts';

const raw = JSON.parse(readFileSync(new URL('../../../data/incidents/bangkok.json', import.meta.url), 'utf8'));
const valid = raw.items[0];

describe('incident register', () => {
  it('validates, and every entry has a source link and date', () => {
    const d = incidentsDatasetSchema.parse(raw);
    for (const i of d.items) {
      expect(i.sources.length).toBeGreaterThan(0);
      for (const s of i.sources) expect(Date.parse(s.publishedOn)).not.toBeNaN();
    }
  });
  it('has nowhere to put a name: extra fields are rejected', () => {
    expect(() => incidentSchema.parse({ ...valid, note: 'near <school name>' })).toThrow();
    expect(() => incidentSchema.parse({ ...valid, place: 'X shop' })).toThrow();
    expect(() => incidentSchema.parse({ ...valid, category: 'fight at X school' })).toThrow();
  });
  it('requires a street segment and a source', () => {
    expect(() => incidentSchema.parse({ ...valid, wayIds: [] })).toThrow();
    expect(() => incidentSchema.parse({ ...valid, sources: [] })).toThrow();
  });
  it('production view drops placeholders', () => {
    const d = incidentsDatasetSchema.parse(raw);
    expect(d.items.every((i) => i.placeholder)).toBe(true); // all placeholders today
    expect(withoutPlaceholders(d).items).toEqual([]);
  });
});
