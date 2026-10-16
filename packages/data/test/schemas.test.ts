import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { JsonRepository, datasetMetaSchema, parseList, savedPlaceSchema } from '../src/index.ts';

describe('datasetMetaSchema', () => {
  it('requires at least one source with a license', () => {
    expect(() => datasetMetaSchema.parse({ version: 1, source: [], updatedAt: '2026-10-15T00:00:00Z' })).toThrow();
    expect(
      datasetMetaSchema.parse({
        version: 1,
        source: [{ name: 'OSM', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL-1.0' }],
        updatedAt: '2026-10-15T00:00:00+07:00',
      }).source[0]?.license,
    ).toBe('ODbL-1.0');
  });
});

describe('parseList', () => {
  it('keeps valid entries and drops broken ones', () => {
    const good = { id: 'a', name: 'Home', detail: '', location: { lat: 13.7, lng: 100.5 }, slot: 'home', savedAt: 1 };
    const list = parseList(savedPlaceSchema, [good, { id: 'b' }, 'junk']);
    expect(list).toEqual([good]);
    expect(parseList(savedPlaceSchema, 'not an array')).toEqual([]);
  });
});

describe('JsonRepository', () => {
  it('fetches and validates through the given parser', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ n: 3 })));
    const repo = new JsonRepository({ baseUrl: '/data', fetch: fetchMock as never });
    const data = await repo.load('routes/siam-centralworld', z.object({ n: z.number() }).parse);
    expect(data).toEqual({ n: 3 });
    expect(fetchMock).toHaveBeenCalledWith('/data/routes/siam-centralworld.json', {});
  });
  it('rejects path traversal', async () => {
    const repo = new JsonRepository({ baseUrl: '/data', fetch: vi.fn() as never });
    await expect(repo.load('../secret', (x) => x)).rejects.toThrow('Invalid dataset');
  });
});
