import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { bangkok } from '@walkwe/config';
import {
  Area, LocalProjection, ShadeScene, WF, shadowLength, shadowPieces, solarNoon, sunPosition,
  type SunPosition,
} from '../src/index.ts';
import { ORIGIN, area, rect, way } from './helpers.ts';

const bkk = (iso: string) => new Date(`${iso}+07:00`);

describe('sun position (brief §11)', () => {
  it('Bangkok, 15 Oct, solar noon: altitude ≈ 67° (±1°)', () => {
    const noon = solarNoon(bkk('2026-10-15T12:00:00'), bangkok.center);
    const sun = sunPosition(noon, bangkok.center);
    expect(sun.altitude).toBeGreaterThan(66);
    expect(sun.altitude).toBeLessThan(68);
    // Sun is south of zenith in October at 13.7°N.
    expect(Math.abs(sun.azimuth - 180)).toBeLessThan(5);
  });
  it('morning sun is in the east, afternoon in the west', () => {
    expect(sunPosition(bkk('2026-10-15T08:00:00'), bangkok.center).azimuth).toBeGreaterThan(90);
    expect(sunPosition(bkk('2026-10-15T08:00:00'), bangkok.center).azimuth).toBeLessThan(135);
    expect(sunPosition(bkk('2026-10-15T16:00:00'), bangkok.center).azimuth).toBeGreaterThan(225);
  });
});

describe('shadow geometry (brief §11)', () => {
  it('30 m building at 40° altitude casts ≈ 36 m', () => {
    expect(shadowLength(30, 40)).toBeCloseTo(35.75, 1);
  });

  it('the shadow polygon reaches 36 m from the wall, away from the sun (Turf check)', () => {
    const P = new LocalProjection(ORIGIN);
    const sun: SunPosition = { altitude: 40, azimuth: 180 }; // sun due south → shadow due north
    const ring = [0, 0, 10, 0, 10, 10, 0, 10, 0, 0];
    const pieces = shadowPieces(ring, 30, 0, sun);
    const toPoly = (p: number[]) => {
      const c: number[][] = [];
      for (let i = 0; i < p.length; i += 2) c.push([P.lng(p[i]!), P.lat(p[i + 1]!)]);
      if (c[0]![0] !== c[c.length - 1]![0] || c[0]![1] !== c[c.length - 1]![1]) c.push(c[0]!);
      return turf.polygon([c]);
    };
    const union = turf.union(turf.featureCollection(pieces.map(toPoly)))!;
    const [, , , north] = turf.bbox(union);
    const reachM = turf.distance(turf.point([P.lng(5), P.lat(10)]), turf.point([P.lng(5), north]), { units: 'meters' });
    expect(reachM).toBeGreaterThan(35);
    expect(reachM).toBeLessThan(37);
  });

  it('fast point test agrees with the swept shadow polygon', () => {
    const P = new LocalProjection(ORIGIN);
    // An L-shaped (concave) footprint, the case a convex hull gets wrong.
    const L: Array<[number, number]> = [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30], [0, 0]];
    const input = area({ nodes: [[0, 0], [1, 1]], ways: [way(1, [0, 1])], buildings: [] });
    input.buildings.push({ h: 20, minH: 0, heightSource: 'height', ring: L.flatMap(([x, y]) => [P.lat(y), P.lng(x)]) });
    const scene = new ShadeScene(input, P);
    const sun: SunPosition = { altitude: 35, azimuth: 225 }; // shadow towards NE
    const pieces = shadowPieces(L.flat(), 20, 0, sun).map((p) => {
      const c: number[][] = [];
      for (let i = 0; i < p.length; i += 2) c.push([p[i]!, p[i + 1]!]);
      if (c[0]![0] !== c[c.length - 1]![0] || c[0]![1] !== c[c.length - 1]![1]) c.push(c[0]!);
      return turf.polygon([c]);
    });
    const out = { shade: 0, estimated: false };
    let checked = 0;
    for (let x = -10; x <= 70; x += 3.7) {
      for (let y = -10; y <= 70; y += 3.7) {
        const inPoly = pieces.some((p) => turf.booleanPointInPolygon([x, y], p, { ignoreBoundary: true }));
        const onEdge = pieces.some((p) => turf.booleanPointInPolygon([x, y], p)) !== inPoly;
        if (onEdge) continue;
        expect(scene.shadeAt(x, y, sun, out).shade === 1, `(${x}, ${y})`).toBe(inPoly);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(400);
  });
});

describe('segment coverage and permanent shade', () => {
  const sun: SunPosition = { altitude: 40, azimuth: 180 };

  it('a 10 m segment half inside a shadow is ~50% sun', () => {
    // Shadow north of the building reaches y = 10 + 35.75. Path runs north from y=20 to y=40...
    // place a north–south path whose first half (y 30→40) is in shadow, second (y 50→60) not.
    const input = area({
      nodes: [[5, 40.75], [5, 50.75]],
      ways: [way(1, [0, 1])],
      buildings: [{ h: 30, minH: 0, heightSource: 'height', ring: rect(0, 0, 10, 10) }],
    });
    const a = new Area(input);
    const sunShare = a.edgeSunShare(0, sun);
    expect(sunShare).toBeGreaterThan(0.4);
    expect(sunShare).toBeLessThan(0.6);
  });

  it('covered walkways are shaded even at noon; open ones are not', () => {
    const noon: SunPosition = { altitude: 89, azimuth: 180 };
    const input = area({
      nodes: [[0, 0], [50, 0], [0, 20], [50, 20]],
      ways: [way(1, [0, 1], { flags: WF.COVERED }), way(2, [2, 3])],
    });
    const a = new Area(input);
    expect(a.edgeSunShare(0, noon)).toBe(0);
    expect(a.edgeSunShare(1, noon)).toBe(1);
  });

  it('under the BTS deck is shaded at noon', () => {
    const noon: SunPosition = { altitude: 89, azimuth: 180 };
    const input = area({
      nodes: [[0, 0], [60, 0]],
      ways: [way(1, [0, 1])],
      elevated: [{ kind: 'rail', h: 12, w: 9, covered: false, line: rect(-10, 0, 70, 0).slice(0, 4) }],
    });
    expect(new Area(input).edgeSunShare(0, noon)).toBe(0);
  });

  it('flags shade that rests on an estimated building height', () => {
    const input = area({
      nodes: [[5, 15], [5, 25]],
      ways: [way(1, [0, 1])],
      buildings: [{ h: 30, minH: 0, heightSource: 'levels', ring: rect(0, 0, 10, 10) }],
    });
    const a = new Area(input);
    const es = a.edgeShade(0, sun);
    expect(es.sun[0]).toBe(0);
    expect(es.estimated).toBe(1);
  });

  it('no sun (night) means no exposure', () => {
    const input = area({ nodes: [[0, 0], [50, 0]], ways: [way(1, [0, 1])] });
    expect(new Area(input).edgeSunShare(0, { altitude: -5, azimuth: 270 })).toBe(0);
  });
});

describe('skywalk under the BTS', () => {
  it('a footbridge is shaded by the rail deck above it, not by its own deck', () => {
    const noon: SunPosition = { altitude: 89, azimuth: 180 };
    const input = area({
      nodes: [[0, 0], [60, 0], [0, 40], [60, 40]],
      ways: [way(1, [0, 1], { flags: WF.BRIDGE }), way(2, [2, 3], { flags: WF.BRIDGE })],
      elevated: [
        { kind: 'rail', h: 12, w: 9, covered: false, line: rect(-10, 0, 70, 0).slice(0, 4) }, // over way 1
        { kind: 'foot', h: 6, w: 4, covered: false, line: rect(-10, 40, 70, 40).slice(0, 4) }, // way 2's own deck
      ],
    });
    const a = new Area(input);
    expect(a.edgeSunShare(0, noon)).toBe(0);
    expect(a.edgeSunShare(1, noon)).toBe(1);
  });
});
