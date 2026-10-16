import { describe, expect, it } from 'vitest';
import { matchGuide, maxDistanceToLine } from '../src/index.ts';
import { ll } from './helpers.ts';

const pt = (x: number, y: number) => {
  const [lat, lng] = ll(x, y);
  return { lat: lat!, lng: lng! };
};

// Route: 0,0 → 300,0 → 300,200.
const route = [pt(0, 0), pt(300, 0), pt(300, 200)];
const guide = {
  matchRadiusM: 100,
  stepToleranceM: 30,
  directions: [
    { id: 'ab', from: pt(0, 0), to: pt(300, 200), steps: [pt(0, 5), pt(150, -10), pt(300, 100)] },
    { id: 'ba', from: pt(300, 200), to: pt(0, 0), steps: [pt(300, 100), pt(0, 5)] },
  ],
};

describe('photo guide matching', () => {
  it('measures the farthest step from the route', () => {
    expect(maxDistanceToLine([pt(150, 20)], route)).toBeCloseTo(20, 0);
  });
  it('matches the direction whose ends and steps fit the route', () => {
    expect(matchGuide(guide, pt(10, 10), pt(290, 190), route)?.id).toBe('ab');
    expect(matchGuide(guide, pt(300, 200), pt(0, 0), [...route].reverse())?.id).toBe('ba');
  });
  it('rejects it when the endpoints are elsewhere', () => {
    expect(matchGuide(guide, pt(500, 500), pt(290, 190), route)).toBeNull();
  });
  it('rejects it when the computed route takes another way', () => {
    const detour = [pt(0, 0), pt(0, 200), pt(300, 200)];
    expect(matchGuide(guide, pt(0, 0), pt(300, 200), detour)).toBeNull();
  });
});
