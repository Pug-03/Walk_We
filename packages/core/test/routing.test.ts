import { describe, expect, it } from 'vitest';
import { bangkok } from '@walkwe/config';
import { Area, AreaRouter, cloudFactor, RoutingError, sunPosition, type RouteRequest } from '../src/index.ts';
import { area, ll, rect, way } from './helpers.ts';

const bkk = (iso: string) => new Date(`${iso}+07:00`);
const opts = { timeZone: bangkok.timezone, defaultMallHours: bangkok.defaultMallHours, walkSpeedMps: bangkok.walkSpeedMps };
const pt = (x: number, y: number) => {
  const [lat, lng] = ll(x, y);
  return { lat: lat!, lng: lng! };
};

// Direct path A→B along y = 0 (open sky), and a detour A→C→D→B along y = 30
// that runs in the afternoon shadow of a 30 m building between them.
//   C ─────────── D      y = 30  (shaded detour, 260 m)
//   │  ▓▓▓▓▓▓▓▓▓  │      building y 5..25, h 30
//   A ─────────── B      y = 0   (sunny direct, 200 m)
function shadeVsSun() {
  return new Area(
    area({
      nodes: [[0, 0], [200, 0], [0, 30], [200, 30]],
      ways: [way(1, [0, 1]), way(2, [0, 2]), way(3, [2, 3]), way(4, [3, 1])],
      buildings: [{ h: 30, minH: 0, heightSource: 'height', ring: rect(-40, 5, 240, 25) }],
    }),
  );
}

describe('day routing (brief §11)', () => {
  // 15:00 in October: sun in the south-west, shadows fall north-east.
  const afternoon = bkk('2026-10-15T15:00:00');

  it('the synthetic scene really is shade vs sun at that time', () => {
    const a = shadeVsSun();
    const sun = sunPosition(afternoon, a.proj.origin);
    expect(a.edgeSunShare(0, sun)).toBeGreaterThan(0.9); // direct
    expect(a.edgeSunShare(2, sun)).toBeLessThan(0.1); // detour top
  });

  it('picks the shaded detour when w_sun is high, the direct path when it is 0', () => {
    const router = new AreaRouter(shadeVsSun(), opts);
    const req: RouteRequest = { from: pt(0, 0), to: pt(200, 0), departAt: afternoon, mode: 'day' };
    const { routes } = router.routeSync(req);
    const shortest = routes.find((r) => r.kinds.includes('shortest'))!;
    const shadiest = routes.find((r) => r.kinds.includes('shadiest'))!;
    expect(shortest.lengthM).toBeCloseTo(200, 0);
    expect(shortest.shadeShare).toBeLessThan(0.1);
    expect(shadiest.lengthM).toBeCloseTo(260, 0);
    expect(shadiest.shadeShare).toBeGreaterThan(0.6);
    // Shade first: the shadiest route is the default card and comes first.
    expect(routes[0]!.kinds[0]).toBe('shadiest');
  });

  it('balanced keeps its detour within 1.25× of the shortest', () => {
    // With w_sun = 1 the detour costs 260 × (1 + ~0) < 200 × (1 + 1), so A*
    // prefers it, but it is 1.3× longer — over balanced's cap — so the
    // weight backs off until the direct path wins.
    const router = new AreaRouter(shadeVsSun(), opts);
    const { routes } = router.routeSync({ from: pt(0, 0), to: pt(200, 0), departAt: afternoon, mode: 'day' });
    const balanced = routes.find((r) => r.kinds.includes('balanced'))!;
    expect(balanced.lengthM).toBeCloseTo(200, 0);
  });

  it('folds an alternative into the shortest when it is not ≥ 5 points shadier', () => {
    // Same scene without the building: the detour is longer and no shadier.
    const a = new Area(area({ nodes: [[0, 0], [200, 0], [0, 30], [200, 30]], ways: [way(1, [0, 1]), way(2, [0, 2]), way(3, [2, 3]), way(4, [3, 1])] }));
    const { routes } = new AreaRouter(a, opts).routeSync({ from: pt(0, 0), to: pt(200, 0), departAt: afternoon, mode: 'day' });
    expect(routes).toHaveLength(1);
    expect(routes[0]!.kinds).toEqual(['shadiest', 'balanced', 'shortest']);
  });

  it('heavy cloud cover reduces the sun penalty', () => {
    expect(cloudFactor(0)).toBe(1);
    expect(cloudFactor(100)).toBeCloseTo(0.3);
    expect(cloudFactor(null)).toBe(1);
  });

  it('with no sun (day mode forced after sunset) every kind is the same path', () => {
    const router = new AreaRouter(shadeVsSun(), opts);
    const { routes } = router.routeSync({ from: pt(0, 0), to: pt(200, 0), departAt: bkk('2026-10-15T22:00:00'), mode: 'day' });
    expect(routes).toHaveLength(1);
    expect(routes[0]!.kinds).toEqual(['shadiest', 'balanced', 'shortest']);
  });

  it('shade comes first: the shadiest route has no length cap', () => {
    // Detour 2× the direct length, fully shaded (covered); direct fully in sun.
    const a = new Area(area({
      nodes: [[0, 0], [100, 0], [0, 50], [100, 50]],
      ways: [way(1, [0, 1]), way(2, [0, 2], { flags: 4 }), way(3, [2, 3], { flags: 4 }), way(4, [3, 1], { flags: 4 })],
    }));
    const { routes } = new AreaRouter(a, opts).routeSync({ from: pt(0, 0), to: pt(100, 0), departAt: afternoon, mode: 'day' });
    const shadiest = routes.find((r) => r.kinds.includes('shadiest'))!;
    expect(shadiest.lengthM).toBeCloseTo(200, 0); // 2× the shortest, still chosen
    expect(shadiest.shadeShare).toBeGreaterThan(0.95);
    expect(routes.find((r) => r.kinds.includes('balanced'))!.lengthM).toBeCloseTo(100, 0); // capped at 1.25×
  });

  it('reports points far from the network as not covered', () => {
    const router = new AreaRouter(shadeVsSun(), opts);
    expect(() => router.routeSync({ from: pt(0, 0), to: pt(5000, 0), departAt: afternoon, mode: 'day' })).toThrow(RoutingError);
  });
});

describe('mall opening hours', () => {
  // Through the mall: A→M→B (100 m). Around it: A→C→D→B (220 m).
  function mallScene(hours: string | null) {
    return new Area(
      area({
        nodes: [[0, 0], [50, 0], [100, 0], [0, 60], [100, 60]],
        ways: [
          way(1, [0, 1, 2], { cls: 'corridor', flags: 64, mall: 0 }),
          way(2, [0, 3]), way(3, [3, 4]), way(4, [4, 2]),
        ],
        malls: [{ id: 1, name: 'Test Mall', hours, ring: rect(10, -20, 90, 20) }],
      }),
    );
  }
  const req = (iso: string, mode: 'day' | 'night' = 'day'): RouteRequest => ({
    from: pt(0, 0), to: pt(100, 0), departAt: bkk(iso), mode,
  });

  it('uses the mall while it is open', () => {
    const r = new AreaRouter(mallScene('Mo-Su 10:00-22:00'), opts).routeSync(req('2026-10-15T12:00:00'));
    expect(r.routes.every((x) => x.mallsUsed.includes('Test Mall'))).toBe(true);
    expect(r.closedMalls).toEqual([]);
  });

  it.each([
    ['before opening', '2026-10-15T09:30:00', 'day'],
    ['after closing', '2026-10-15T22:30:00', 'night'],
    ['closing during the walk', '2026-10-15T21:50:00', 'night'],
  ] as const)('never routes through it %s', (_label, iso, mode) => {
    const r = new AreaRouter(mallScene('Mo-Su 10:00-22:00'), opts).routeSync(req(iso, mode));
    for (const route of r.routes) {
      expect(route.mallsUsed).toEqual([]);
      expect(route.lengthM).toBeCloseTo(220, 0);
    }
    expect(r.closedMalls).toEqual(['Test Mall']);
  });

  it('unknown hours fall back to the conservative city default', () => {
    // Default is 10:00–21:00: at 21:15 it counts as closed even though most malls are open.
    const r = new AreaRouter(mallScene(null), opts).routeSync(req('2026-10-15T21:15:00', 'night'));
    expect(r.routes[0]!.mallsUsed).toEqual([]);
  });

  it('mall passages count as permanent shade', () => {
    const r = new AreaRouter(mallScene('24/7'), opts).routeSync(req('2026-10-15T12:30:00'));
    const route = r.routes.find((x) => x.kinds.includes('shortest'))!;
    expect(route.runs.some((run) => run.permanent && run.shade === 1)).toBe(true);
  });
});
