import { describe, expect, it } from 'vitest';
import { bangkok } from '@walkwe/config';
import { Area, AreaRouter, WF, incidentWeight, type IncidentInput } from '../src/index.ts';
import { area, flat, ll, rect, way } from './helpers.ts';

const bkk = (iso: string) => new Date(`${iso}+07:00`);
const opts = { timeZone: bangkok.timezone, defaultMallHours: bangkok.defaultMallHours, walkSpeedMps: bangkok.walkSpeedMps };
const pt = (x: number, y: number) => {
  const [lat, lng] = ll(x, y);
  return { lat: lat!, lng: lng! };
};
const night = bkk('2026-10-15T22:30:00');

// Dark direct alley A→B (200 m, unlit, no cameras) vs a longer detour along
// a lit main road with cameras and shops (A→C→D→B, 400 m).
function darkVsLit(incidents: IncidentInput[] = []) {
  const cams: Array<[number, number]> = [];
  for (let x = 0; x <= 200; x += 30) cams.push([x, 100]);
  const shops: number[] = [];
  for (let x = 0; x <= 200; x += 25) shops.push(...ll(x, 105), 2, 2.6);
  return new Area(area({
    nodes: [[0, 0], [200, 0], [0, 100], [200, 100]],
    ways: [
      way(1, [0, 1], { cls: 'path', flags: WF.LIT_NO }),
      way(2, [0, 2], { cls: 'primary', flags: WF.LIT_YES }),
      way(3, [2, 3], { cls: 'primary', flags: WF.LIT_YES }),
      way(4, [3, 1], { cls: 'primary', flags: WF.LIT_YES }),
    ],
    night: { cctv: flat(cams), lamps: [], pois: shops },
    incidents,
  }));
}

describe('night mode (brief §7)', () => {
  it('safety comes first: the safest route takes the lit, watched detour whatever the distance', () => {
    const { routes } = new AreaRouter(darkVsLit(), opts).routeSync({ from: pt(0, 0), to: pt(200, 0), departAt: night, mode: 'night' });
    expect(routes[0]!.kinds[0]).toBe('safest');
    expect(routes[0]!.lengthM).toBeCloseTo(400, 0); // 2× the shortest
    const shortest = routes.find((r) => r.kinds.includes('shortest'))!;
    expect(shortest.lengthM).toBeCloseTo(200, 0);
    expect(routes[0]!.safetyScore!).toBeGreaterThan(shortest.safetyScore! + 3);
    expect(routes[0]!.metric).toBe('safety');
  });

  it('only the ticked factors count', () => {
    // CCTV only: the alley has none, the main road has cameras → detour.
    const cctvOnly = new AreaRouter(darkVsLit(), opts).routeSync({ from: pt(0, 0), to: pt(200, 0), departAt: night, mode: 'night', nightFactors: ['cctv'] });
    expect(cctvOnly.routes[0]!.lengthM).toBeCloseTo(400, 0);
    const router = new AreaRouter(darkVsLit(), opts);
    expect(router.nightRisk(0, ['lit'])).toBeGreaterThan(0.9); // lit=no
    expect(router.nightRisk(1, ['lit'])).toBe(0); // lit=yes
  });

  it('records how much lighting comes from data rather than a guess', () => {
    const { routes } = new AreaRouter(darkVsLit(), opts).routeSync({ from: pt(0, 0), to: pt(200, 0), departAt: night, mode: 'night' });
    expect(routes[0]!.litKnownShare).toBe(1); // every way here has a lit tag
  });

  it('never routes through a closed mall, whatever the safety gain', () => {
    // The only lit, watched way runs through a mall that closes at 22:00.
    const a = new Area(area({
      nodes: [[0, 0], [50, 0], [100, 0], [0, 60], [100, 60]],
      ways: [
        way(1, [0, 1, 2], { cls: 'corridor', flags: WF.INDOOR | WF.LIT_YES, mall: 0 }),
        way(2, [0, 3], { cls: 'path', flags: WF.LIT_NO }), way(3, [3, 4], { cls: 'path', flags: WF.LIT_NO }), way(4, [4, 2], { cls: 'path', flags: WF.LIT_NO }),
      ],
      malls: [{ id: 1, name: 'Night Mall', hours: 'Mo-Su 10:00-22:00', ring: rect(10, -20, 90, 20) }],
    }));
    const r = new AreaRouter(a, opts).routeSync({ from: pt(0, 0), to: pt(100, 0), departAt: night, mode: 'night' });
    for (const route of r.routes) {
      expect(route.mallsUsed).toEqual([]);
      expect(route.lengthM).toBeCloseTo(220, 0);
    }
    expect(r.closedMalls).toEqual(['Night Mall']);
    // Open at 20:00 → the safest route uses it.
    const open = new AreaRouter(a, opts).routeSync({ from: pt(0, 0), to: pt(100, 0), departAt: bkk('2026-10-15T20:00:00'), mode: 'night' });
    expect(open.routes[0]!.mallsUsed).toEqual(['Night Mall']);
  });
});

describe('past incidents', () => {
  const policy = { halfLifeDays: 365, outsideWindow: 0.2, timeZone: bangkok.timezone };
  const inc: IncidentInput = { id: 'x', wayIds: [3], category: 'student-fight', occurredOn: '2026-09-15', window: 'Mo-Fr 15:00-19:00', severity: 1 };

  it('weighs most inside its time window and fades with age', () => {
    const inWindow = incidentWeight(inc, bkk('2026-10-15T16:00:00'), policy); // Thu 16:00
    const outside = incidentWeight(inc, bkk('2026-10-15T22:00:00'), policy);
    const yearLater = incidentWeight(inc, bkk('2027-09-15T16:00:00'), policy); // Wed
    expect(inWindow).toBeGreaterThan(0.9);
    expect(outside).toBeCloseTo(inWindow * 0.2, 2);
    expect(yearLater).toBeCloseTo(0.5, 1);
  });

  it('routes around the street segment of a recent incident in its window — even by day', () => {
    // Incident on the main road's middle segment (way 3), after school on a weekday.
    const a = darkVsLit([inc]);
    const r = new AreaRouter(a, opts).routeSync({ from: pt(0, 100), to: pt(200, 100), departAt: bkk('2026-10-15T16:00:00'), mode: 'day' });
    expect(r.incidentsActive).toBe(1);
    const best = r.routes[0]!;
    expect(best.incidentsOnRoute).toBe(0);
    const shortest = r.routes.find((x) => x.kinds.includes('shortest'))!;
    expect(shortest.incidentsOnRoute).toBe(1);
  });
});
