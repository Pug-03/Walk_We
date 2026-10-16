import { describe, expect, it } from 'vitest';
import { bangkok } from '@walkwe/config';
import { Area, AreaRouter, WF, turnFor } from '../src/index.ts';
import { area, ll, way } from './helpers.ts';

const opts = { timeZone: bangkok.timezone, defaultMallHours: bangkok.defaultMallHours, walkSpeedMps: bangkok.walkSpeedMps };
const pt = (x: number, y: number) => {
  const [lat, lng] = ll(x, y);
  return { lat: lat!, lng: lng! };
};

describe('turn classification', () => {
  it.each([
    [0, 'straight'], [20, 'straight'], [40, 'slight-right'], [90, 'right'], [140, 'sharp-right'],
    [-40, 'slight-left'], [-90, 'left'], [-140, 'sharp-left'], [175, 'uturn'], [270, 'left'], [-270, 'right'],
  ] as const)('%i° → %s', (deg, expected) => {
    expect(turnFor(deg)).toBe(expected);
  });
});

describe('route steps', () => {
  // East along "Rama I" for 100 m, a 5 m unnamed connector, then north along a
  // covered skywalk for 80 m (a left turn when walking east → north).
  const a = new Area(
    area({
      nodes: [[0, 0], [50, 0], [100, 0], [104, 3], [104, 83]],
      ways: [
        way(1, [0, 1, 2], { name: 'Rama I', cls: 'secondary' }),
        way(2, [2, 3], { name: '' }),
        way(3, [3, 4], { name: 'Skywalk', flags: WF.BRIDGE | WF.COVERED }),
      ],
    }),
  );
  const { routes } = new AreaRouter(a, opts).routeSync({
    from: pt(0, 0), to: pt(104, 83), departAt: new Date('2026-10-15T22:00:00+07:00'), mode: 'night',
  });
  const steps = routes[0]!.steps;

  it('groups by walkway, folds short unnamed connectors, ends with arrive', () => {
    expect(steps.map((s) => s.maneuver)).toEqual(['depart', 'left', 'arrive']);
    expect(steps.map((s) => s.name)).toEqual(['Rama I', 'Skywalk', '']);
    expect(steps[0]!.distanceM).toBeGreaterThanOrEqual(100);
    expect(steps[0]!.distanceM).toBeLessThanOrEqual(106);
  });

  it('marks covered and elevated stretches', () => {
    expect(steps[1]!.covered).toBe(true);
    expect(steps[1]!.elevated).toBe(true);
    expect(steps[0]!.covered).toBe(false);
  });

  it('places each step where it begins', () => {
    const start = pt(0, 0);
    expect(steps[0]!.at.lat).toBeCloseTo(start.lat, 5);
    expect(steps[0]!.at.lng).toBeCloseTo(start.lng, 5);
  });
});
