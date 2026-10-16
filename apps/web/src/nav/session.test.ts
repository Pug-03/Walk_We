import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Route, RouteStep } from '@walkwe/core';
import { routeGuideSchema } from '@walkwe/data';
import { buildSession, remainingM, stepClosed } from './session.ts';

const guide = routeGuideSchema.parse(JSON.parse(readFileSync(new URL('../../../../data/routes/siam-centralworld.json', import.meta.url), 'utf8')));
const dir = guide.directions[0]!;
const step = (lat: number, lng: number, maneuver: RouteStep['maneuver'] = 'straight'): RouteStep => ({
  maneuver, name: '', wayClass: 'footway', distanceM: 50, at: { lat, lng }, covered: false, elevated: false, stairs: false, shadeSide: 0, mall: null,
});
const routeThrough = (pts: Array<{ lat: number; lng: number }>): Route => ({
  kinds: ['shadiest'],
  metric: 'shade',
  runs: [{ coordinates: pts, lengthM: 600, shade: 0.8, safety: null, permanent: false }],
  lengthM: 600, durationS: 480, shadeShare: 0.8, estimatedShadeShare: 0.1, mallsUsed: [],
  safetyScore: null, litKnownShare: null, incidentsOnRoute: 0, stairsM: 0,
  steps: [...pts.map((p, i) => step(p.lat, p.lng, i === 0 ? 'depart' : 'straight')), step(pts[pts.length - 1]!.lat, pts[pts.length - 1]!.lng, 'arrive')],
});

describe('navigation session', () => {
  it('uses the photo guide when the route follows it', () => {
    const route = routeThrough(dir.steps.map((s) => ({ lat: s.lat, lng: s.lng })));
    const s = buildSession(route, 'day', dir.from, dir.to, [guide]);
    expect(s.guideId).toBe('siam-to-centralworld');
    expect(s.steps.map((x) => x.guide?.photo)).toEqual(dir.steps.map((x) => x.photo));
    // Remaining distance is on the computed route length (what the results card showed).
    expect(remainingM(s)).toBeCloseTo(s.route.lengthM, 6);
  });

  it('falls back to generated steps when the route goes another way', () => {
    const route = routeThrough([dir.from, { lat: 13.75, lng: 100.536 }, dir.to]);
    const s = buildSession(route, 'day', dir.from, dir.to, [guide]);
    expect(s.guideId).toBeNull();
    expect(s.steps.every((x) => x.guide === null)).toBe(true);
    expect(s.steps[s.steps.length - 1]!.step.maneuver).toBe('arrive');
  });

  it('flags a guide step that is closed at the time (mall entrance at night)', () => {
    const route = routeThrough(dir.steps.map((s) => ({ lat: s.lat, lng: s.lng })));
    const s = buildSession(route, 'night', dir.from, dir.to, [guide]);
    const entrance = s.steps[s.steps.length - 1]!;
    expect(stepClosed(entrance, new Date('2026-10-15T23:00:00+07:00'))).toBe(true);
    expect(stepClosed(entrance, new Date('2026-10-15T12:00:00+07:00'))).toBe(false);
  });
});
