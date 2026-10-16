import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOpeningHours } from '@walkwe/core';
import { routeGuideSchema } from '../src/index.ts';

const raw = JSON.parse(readFileSync(new URL('../../../data/routes/siam-centralworld.json', import.meta.url), 'utf8'));

describe('data/routes/siam-centralworld.json', () => {
  const guide = routeGuideSchema.parse(raw);

  it('has both directions, with source and update time', () => {
    expect(guide.directions.map((d) => d.id)).toEqual(['siam-to-centralworld', 'centralworld-to-siam']);
    expect(guide.source[0]!.license).toBeTruthy();
  });

  it('uses the siam-cw-NN.jpg photo names, each once', () => {
    const photos = guide.directions.flatMap((d) => d.steps.map((s) => s.photo));
    expect(new Set(photos).size).toBe(photos.length);
    photos.forEach((p, i) => expect(p).toBe(`siam-cw-${String(i + 1).padStart(2, '0')}.jpg`));
  });

  it('every validHours parses, and only the last step has no distance', () => {
    for (const d of guide.directions) {
      d.steps.forEach((s, i) => {
        expect(parseOpeningHours(s.validHours), s.validHours).not.toBeNull();
        expect(s.distanceM === 0).toBe(i === d.steps.length - 1);
      });
    }
  });
});
