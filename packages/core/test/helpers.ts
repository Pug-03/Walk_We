import { LocalProjection, type AreaInput } from '../src/index.ts';

// Build synthetic areas in metres around a fixed origin, so tests read as
// geometry ("a building 30 m tall from x=0 to x=200") instead of lat/lng.
export const ORIGIN = { lat: 13.75, lng: 100.53 };
const P = new LocalProjection(ORIGIN);
export const ll = (x: number, y: number) => [P.lat(y), P.lng(x)];
export const flat = (pts: Array<[number, number]>) => pts.flatMap(([x, y]) => ll(x, y));
export const rect = (x0: number, y0: number, x1: number, y1: number) =>
  flat([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);

export function area(parts: Partial<AreaInput> & { nodes: Array<[number, number]>; ways: AreaInput['walkways']['ways'] }): AreaInput {
  return {
    bbox: [ORIGIN.lng - 0.01, ORIGIN.lat - 0.01, ORIGIN.lng + 0.01, ORIGIN.lat + 0.01],
    walkways: { nodes: flat(parts.nodes), ways: parts.ways },
    buildings: parts.buildings ?? [],
    trees: parts.trees ?? [],
    treeRows: parts.treeRows ?? [],
    elevated: parts.elevated ?? [],
    malls: parts.malls ?? [],
    ...(parts.night ? { night: parts.night } : {}),
    ...(parts.incidents ? { incidents: parts.incidents } : {}),
  };
}

export const way = (id: number, nodes: number[], extra: Partial<AreaInput['walkways']['ways'][number]> = {}) => ({
  id, cls: 'footway' as const, name: `w${id}`, flags: 0, nodes, ...extra,
});
