// Welcome-page illustration: a Bangkok street (skyline, buildings, BTS
// viaduct and train, rain tree, planters, a bench, people walking, a zebra crossing, sun or moon, shade on the sidewalk) drawn as faceted
// geometric line art — every silhouette is hand-placed here, then split into
// irregular triangles with a seeded Delaunay triangulation, so the result is
// a deterministic vector drawing, not a generated image.
//
//   npx tsx scripts/build-art.ts
//
// Writes apps/web/public/art/street-{day,night}.svg (line art) and
// street-day-shade.svg / street-night-light.svg (the layer that fades in:
// shadows by day, lamp light by night), plus street-wide-* versions: a
// 2400-wide panorama for the desktop welcome page.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Delaunay } from 'd3-delaunay';

type Pt = [number, number];
const W = 1000, H = 920, GROUND = 640, CURB = 724, NEAR = 860;

// Seeded RNG so the drawing never changes between builds.
let seed = 20261015;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

function inside([x, y]: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function area(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j]![0] + poly[i]![0]) * (poly[j]![1] - poly[i]![1]);
  return Math.abs(a / 2);
}
const circle = (cx: number, cy: number, r: number, n: number, jitter = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (1 + (rnd() - 0.5) * jitter);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt;
  });
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Triangulate a silhouette into facets; returns the facet-edge path and outline path. */
function facets(poly: Pt[], density: number, extra: Pt[] = []): { edges: string; outline: string } {
  // Each shape seeds its own generator from its outline, so the same shape
  // gets the same triangles in every drawing (day, night, built, still) and
  // cross-fading between them shows no doubled lines.
  let h = 2166136261 ^ density;
  for (const [x, y] of poly) {
    h = Math.imul(h ^ Math.round(x * 10), 16777619);
    h = Math.imul(h ^ Math.round(y * 10), 16777619);
  }
  let local = h >>> 0;
  const rnd = () => ((local = (local * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const pts: Pt[] = [...poly, ...extra];
  // Boundary midpoints keep long edges from producing slivers.
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const k = Math.floor(len / 110);
    for (let s = 1; s <= k; s++) pts.push([p[0] + ((q[0] - p[0]) * s) / (k + 1), p[1] + ((q[1] - p[1]) * s) / (k + 1)]);
  });
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const want = Math.max(1, Math.round(area(poly) / density));
  for (let tries = 0, got = 0; got < want && tries < want * 40; tries++) {
    const p: Pt = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
    // Keep interior points off the outline so facets stay readable.
    if (!inside(p, poly) || pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.sqrt(density) * 0.55)) continue;
    pts.push(p);
    got++;
  }
  const d = Delaunay.from(pts);
  const seen = new Set<string>();
  const segs: string[] = [];
  for (let t = 0; t < d.triangles.length; t += 3) {
    const tri = [d.triangles[t]!, d.triangles[t + 1]!, d.triangles[t + 2]!];
    const c: Pt = [(pts[tri[0]!]![0] + pts[tri[1]!]![0] + pts[tri[2]!]![0]) / 3, (pts[tri[0]!]![1] + pts[tri[1]!]![1] + pts[tri[2]!]![1]) / 3];
    if (!inside(c, poly)) continue;
    for (let e = 0; e < 3; e++) {
      const a = tri[e]!, b = tri[(e + 1) % 3]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      segs.push(`M${r1(pts[a]![0])} ${r1(pts[a]![1])}L${r1(pts[b]![0])} ${r1(pts[b]![1])}`);
    }
  }
  return { edges: segs.join(''), outline: `M${poly.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}Z` };
}

// ---------- the scene (back to front) ----------
// Far skyline, mostly hidden behind the street; only the tops show.
/**
 * King Power MahaNakhon, the tallest tower on the skyline: a slim glass
 * shaft with a stepped "pixel" crown and the ribbon of cut-out cubes that
 * spirals up and around it. The outline steps out where the ribbon crosses
 * each edge; the ribbon across the front, the glass floor lines and the crown
 * steps are drawn as plain lines on top (see mahanakhonDetail).
 */
const MAHA = { x0: 578, w: 92, top: 6 };
// Small deterministic hash so the "pixels" are the same on every build.
const pix = (i: number, j: number) => ((Math.imul(i * 73856093 ^ j * 19349663, 2654435761) >>> 0) % 100) / 100;
function mahanakhon(): Pt[] {
  const { x0, w, top } = MAHA;
  const x1 = x0 + w;
  const h = GROUND - top;
  // Right edge: the spiral ribbon breaks the silhouette into stepped pixel blocks.
  const right: Pt[] = [];
  const y0 = top + h * 0.12, y1 = top + h * 0.6;
  let y = y0;
  let i = 0;
  while (y < y1) {
    const step = 10 + Math.round(pix(i, 1) * 12);
    const depth = Math.round(6 + pix(i, 2) * 24 * Math.sin(((y - y0) / (y1 - y0)) * Math.PI));
    right.push([x1, y], [x1 - depth, y], [x1 - depth, y + step], [x1, y + step]);
    y += step + 4;
    i++;
  }
  // Left edge: a shorter run of blocks lower down, where the ribbon comes round.
  const left: Pt[] = [];
  const l0 = top + h * 0.5, l1 = top + h * 0.78;
  y = l0;
  i = 0;
  while (y < l1) {
    const step = 10 + Math.round(pix(i, 3) * 10);
    const depth = Math.round(4 + pix(i, 4) * 16 * Math.sin(((y - l0) / (l1 - l0)) * Math.PI));
    left.push([x0, y], [x0 + depth, y], [x0 + depth, y + step], [x0, y + step]);
    y += step + 4;
    i++;
  }
  // Crown: irregular pixel steps up to the top.
  const crown: Pt[] = [
    [x0, top + 40], [x0 + 8, top + 40], [x0 + 8, top + 26], [x0 + 22, top + 26], [x0 + 22, top + 12], [x0 + 38, top + 12], [x0 + 38, top],
    [x0 + 56, top], [x0 + 56, top + 8], [x0 + 70, top + 8], [x0 + 70, top + 18], [x1 - 6, top + 18], [x1 - 6, top + 30], [x1, top + 30],
  ];
  return [[x0, GROUND], ...left.reverse(), ...crown, ...right, [x1, GROUND]];
}
/**
 * Lines over the tower: faint glass floor bands, and the ribbon itself: a
 * diagonal band climbing the front, filled with a grid of pixel cubes, some
 * pushed out (outlined) and some cut away (dark).
 */
function mahanakhonDetail(): string {
  const { x0, w, top } = MAHA;
  const x1 = x0 + w;
  const h = GROUND - top;
  const floors: string[] = [];
  for (let fy = top + 48; fy < GROUND - 8; fy += 12) floors.push(`M${x0 + 2} ${fy}H${x1 - 2}`);
  const cut: string[] = [];
  const out: string[] = [];
  const c = 8;
  for (let gx = 0; gx < Math.floor(w / c); gx++) {
    const t = gx / (w / c);
    const mid = top + h * 0.66 - t * h * 0.5; // band centre climbs left → right
    for (let gy = -4; gy <= 4; gy++) {
      const r = pix(gx, gy + 10);
      if (Math.abs(gy) >= 3 && r < 0.6) continue; // ragged band edges
      const px = x0 + gx * c, py = Math.round(mid + gy * c);
      if (r < 0.45) cut.push(`M${px} ${py}h${c}v${c}h-${c}Z`);
      else if (r < 0.8) out.push(`M${px} ${py}h${c}v${c}h-${c}Z`);
    }
  }
  return (
    `<path d="${floors.join('')}" stroke="#EEF4FF" stroke-width=".8" opacity=".25"/>` +
    `<path d="${cut.join('')}" fill="#050B1A" stroke="#EEF4FF" stroke-width=".8" opacity=".9"/>` +
    `<path d="${out.join('')}" fill="none" stroke="#EEF4FF" stroke-width="1.3"/>`
  );
}
const MAHA_POLY = mahanakhon();
const towers: Pt[][] = [
  [[300, GROUND], [300, 236], [356, 236], [356, 212], [392, 212], [392, GROUND]],
  [[420, GROUND], [420, 196], [470, 164], [520, 196], [520, GROUND]],
  [[690, GROUND], [690, 252], [728, 236], [766, 252], [766, GROUND]],
  [[880, GROUND], [880, 200], [940, 200], [940, GROUND]],
  // MahaNakhon stands out above everything else.
  MAHA_POLY,
];
const buildings: Pt[][] = [
  [[40, GROUND], [40, 252], [96, 252], [96, 206], [212, 206], [212, 252], [236, 252], [236, GROUND]],
  // A low shophouse row under the viaduct between the taller blocks.
  [[256, GROUND], [256, 512], [330, 488], [404, 512], [404, GROUND]],
  [[812, GROUND], [812, 268], [900, 236], [972, 268], [972, GROUND]],
];
const pillars: Pt[][] = [
  [[478, 462], [508, 462], [512, GROUND], [474, GROUND]],
  [[734, 462], [764, 462], [768, GROUND], [730, GROUND]],
];
const train: Pt[] = [[318, 428], [318, 382], [336, 368], [700, 368], [736, 388], [742, 428]];
// Rain tree: a wide, lobed crown (lobe radius varies with angle).
const crown: Pt[] = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2;
  const r = 112 + 22 * Math.sin(a * 3 + 0.6) + (rnd() - 0.5) * 18;
  return [668 + Math.cos(a) * r * 1.25, 500 + Math.sin(a) * r * 0.78] as Pt;
});
const trunk: Pt[] = [[654, 560], [682, 560], [694, GROUND], [640, GROUND]];

const sun = circle(744, 132, 54, 14, 0.06);
const moon: Pt[] = (() => {
  const outer = circle(744, 132, 54, 16).filter(([x]) => x <= 772);
  const inner = circle(772, 120, 46, 16).filter(([x]) => x <= 772).reverse();
  return [...outer, ...inner];
})();
// Planters with lobed shrubs at both ends of the sidewalk.
const shrub = (cx: number, w: number): { box: Pt[]; bush: Pt[] } => ({
  box: [[cx - w / 2, 712], [cx - w / 2, 676], [cx + w / 2, 676], [cx + w / 2, 712]],
  bush: Array.from({ length: 17 }, (_, i) => {
    const t = Math.PI + (i / 16) * Math.PI;
    const r = 1 + 0.08 * Math.cos(i * Math.PI) + (rnd() - 0.5) * 0.06;
    return [cx + Math.cos(t) * w * 0.5 * r, 680 + Math.sin(t) * 40 * r] as Pt;
  }),
});
const planters = [shrub(86, 84), shrub(930, 72)];
// Bench in the rain tree's shade.
const bench: Pt[] = [[764, 712], [764, 688], [750, 688], [750, 678], [856, 678], [856, 688], [842, 688], [842, 712], [832, 712], [832, 688], [774, 688], [774, 712]];
const benchBack: Pt[] = [[756, 672], [756, 650], [850, 650], [850, 672]];
// Two people walking together in the viaduct's shade ("We").
function walker(x: number, foot: number, k: number): { body: Pt[]; head: Pt[] } {
  const p = (dx: number, dy: number): Pt => [x + dx * k, foot + dy * k];
  return {
    body: [p(-15, -84), p(15, -84), p(20, -52), p(13, -50), p(13, -44), p(28, 0), p(15, 0), p(1, -32), p(-11, 0), p(-25, 0), p(-13, -44), p(-13, -50), p(-20, -52)],
    head: circle(x, foot - 99 * k, 12.5 * k, 9),
  };
}
const walkers = [walker(312, 716, 1.12), walker(366, 718, 1.04), walker(580, 716, 1.06)];
// The third walker carries a parasol against the sun.
const umbrella: Pt[] = [[528, 590], [550, 568], [580, 560], [610, 568], [632, 590]];
const umbrellaPole: Pt[] = [[597, 590], [601, 590], [601, 652], [597, 652]];
// Road in front: a zebra crossing with someone on it (bollards on the near kerb are added per scene).
const crossing: Pt[][] = Array.from({ length: 7 }, (_, i) => {
  const x = 408 + i * 34;
  return [[x, CURB + 12], [x + 20, CURB + 12], [x + 30, NEAR - 12], [x + 10, NEAR - 12]] as Pt[];
});
const crosserFig = walker(560, 832, 0.98);
const lamps: Pt[][] = [
  [[150, GROUND], [150, 520], [176, 506], [196, 512], [158, 528], [158, GROUND]],
  [[900, GROUND], [900, 520], [874, 506], [854, 512], [892, 528], [892, GROUND]],
];

// ---------- scenes ----------
interface Walker { body: Pt[]; head: Pt[] }
interface Scene {
  w: number;
  top: number; // viewBox top: the wide panorama crops the empty sky away
  sky: boolean; // draw the sun / moon inside the picture
  landmark: Pt[] | null; // MahaNakhon's outline (drawn with few facets)
  landmarkDetail: string; // its floor lines and ribbon of cubes
  towers: Pt[][];
  buildings: Pt[][];
  pillars: Pt[][];
  deck: Pt;
  trains: Pt[][];
  trees: { trunk: Pt[]; crown: Pt[] }[];
  lamps: Pt[][];
  crossing: Pt[][];
  planters: { box: Pt[]; bush: Pt[] }[];
  benches: { seat: Pt[]; back: Pt[] }[];
  walkers: Walker[];
  umbrellas: { canopy: Pt[]; pole: Pt[] }[];
  crossers: Walker[];
  bollards: Pt[][];
  lanes: string; // centre lane marks
  shade: Pt[][]; // day overlay
}

const bollard = (x: number): Pt[] => [[x - 7, 902], [x - 7, 872], [x - 4, 866], [x + 4, 866], [x + 7, 872], [x + 7, 902]];
const umbrellaOver = (x: number): { canopy: Pt[]; pole: Pt[] } => ({
  canopy: [[x - 52, 590], [x - 30, 568], [x, 560], [x + 30, 568], [x + 52, 590]],
  pole: [[x + 17, 590], [x + 21, 590], [x + 21, 652], [x + 17, 652]],
});
const benchAt = (x: number) => ({
  seat: [[x + 14, 712], [x + 14, 688], [x, 688], [x, 678], [x + 106, 678], [x + 106, 688], [x + 92, 688], [x + 92, 712], [x + 82, 712], [x + 82, 688], [x + 24, 688], [x + 24, 712]] as Pt[],
  back: [[x + 6, 672], [x + 6, 650], [x + 100, 650], [x + 100, 672]] as Pt[],
});
const lampAt = (x: number, dir: 1 | -1): Pt[] =>
  [[x, GROUND], [x, 520], [x + 26 * dir, 506], [x + 46 * dir, 512], [x + 8 * dir, 528], [x + 8 * dir, GROUND]];
function rainTree(cx: number, k: number) {
  const crown: Pt[] = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2;
    const r = (112 + 22 * Math.sin(a * 3 + 0.6) + (rnd() - 0.5) * 18) * k;
    return [cx + Math.cos(a) * r * 1.25, 500 + 40 * (1 - k) + Math.sin(a) * r * 0.78] as Pt;
  });
  const trunk: Pt[] = [[cx - 14 * k, 560], [cx + 14 * k, 560], [cx + 26 * k, GROUND], [cx - 28 * k, GROUND]];
  return { trunk, crown };
}

const base: Scene = {
  w: W,
  top: 0,
  sky: true,
  landmark: MAHA_POLY,
  landmarkDetail: mahanakhonDetail(),
  towers,
  buildings,
  pillars,
  deck: [0, W],
  trains: [train],
  trees: [{ trunk, crown }],
  lamps,
  crossing,
  planters,
  benches: [{ seat: bench, back: benchBack }],
  walkers,
  umbrellas: [{ canopy: umbrella, pole: umbrellaPole }],
  crossers: [crosserFig],
  bollards: [60, 200, 340, 660, 800, 940].map(bollard),
  lanes: 'M20 792h70M150 792h70M280 792h70M680 792h70M810 792h70M940 792h60',
  shade: [
    // Viaduct and train shadow, thrown left onto the sidewalk (sun upper right).
    [[170, GROUND + 4], [740, GROUND + 4], [684, CURB - 2], [110, CURB - 2]],
    // Rain-tree shadow, a soft lobed patch beyond the viaduct's.
    [[600, GROUND + 4], [840, GROUND + 4], [800, CURB - 2], [560, CURB - 2]],
  ],
};

/**
 * Desktop panorama: the same street, 2400 wide, with the base scene in the
 * middle and a seeded run of extra buildings, pillars, trees and people on
 * either side. The sky is left to the page (the live sun sits there).
 */
function widen(): Scene {
  const WW = 2400, OFF = 700;
  const mv = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [x + OFF, y] as Pt);
  const mvW = (w: Walker): Walker => ({ body: mv(w.body), head: mv(w.head) });
  // Seeded street-front buildings in [from, to): flat, stepped, gabled or slanted roofs.
  const block = (from: number, to: number, lo: number, hi: number): Pt[][] => {
    const out: Pt[][] = [];
    for (let x = from; x < to - 90; ) {
      const w = Math.min(to - x, 110 + rnd() * 110);
      // Mixed skyline: low shophouses (tucked under the viaduct), mid-rise
      // blocks, and only some towers at full height.
      const pick = rnd();
      const t = pick < 0.4 ? 486 + rnd() * 60 : pick < 0.8 ? 340 + rnd() * 90 : lo + rnd() * (hi - lo);
      const kind = Math.floor(rnd() * 4);
      const x1 = x + w;
      if (kind === 0) out.push([[x, GROUND], [x, t], [x1, t], [x1, GROUND]]);
      else if (kind === 1) out.push([[x, GROUND], [x, t + 40], [x + w * 0.25, t + 40], [x + w * 0.25, t], [x + w * 0.8, t], [x + w * 0.8, t + 40], [x1, t + 40], [x1, GROUND]]);
      else if (kind === 2) out.push([[x, GROUND], [x, t + 30], [x + w / 2, t], [x1, t + 30], [x1, GROUND]]);
      else out.push([[x, GROUND], [x, t], [x1, t + 36], [x1, GROUND]]);
      x = x1 + 10 + rnd() * 12;
    }
    return out;
  };
  const towerRow = (from: number, to: number): Pt[][] =>
    // A sparse far skyline: only some towers, so the sky shows between them.
    block(from, to, 170, 260)
      .filter((_, i) => i % 2 === 0)
      .map((p) => p.map(([x, y]) => [x, y === GROUND ? y : Math.min(y, 300) - 20] as Pt));
  const pillarAt = (x: number): Pt[] => [[x, 462], [x + 30, 462], [x + 34, GROUND], [x - 4, GROUND]];
  const lefts = [96, 352, 608], rights = [1760, 2016, 2272];
  const trees = [rainTree(330, 0.9), rainTree(2040, 1)];
  const mahaW = mv(MAHA_POLY);
  return {
    w: WW,
    top: 0,
    sky: false,
    landmark: mahaW,
    landmarkDetail: `<g transform="translate(${OFF} 0)">${mahanakhonDetail()}</g>`,
    // A far row across the whole width first, so the skyline reads dense.
    towers: [
      ...block(10, 2390, 200, 300)
        .filter((_, i) => i % 2 === 1)
        .map((p) => p.map(([x, y]) => [x, y === GROUND ? y : Math.min(y, 380) - 30] as Pt)),
      ...towerRow(20, 680),
      ...towers.filter((t) => t !== MAHA_POLY).map(mv),
      mahaW,
      ...towerRow(1720, 2380),
      // Fill both ends so the skyline doesn't thin out at the screen edges.
      [[2236, GROUND], [2236, 214], [2290, 190], [2344, 214], [2344, GROUND]],
      [[2330, GROUND], [2330, 250], [2400, 250], [2400, GROUND]],
      [[0, GROUND], [0, 240], [60, 240], [60, GROUND]],
    ],
    buildings: [
      ...block(14, 690, 236, 330),
      ...buildings.map(mv),
      ...block(1712, 2400, 230, 320),
      // Edge infill: a mid-rise and a low shophouse at the far right, one at the far left.
      [[2290, GROUND], [2290, 360], [2400, 360], [2400, GROUND]],
      [[2190, GROUND], [2190, 470], [2260, 470], [2260, GROUND]],
      [[0, GROUND], [0, 380], [44, 380], [44, GROUND]],
    ],
    pillars: [...lefts.map(pillarAt), ...pillars.map(mv), ...rights.map(pillarAt)],
    deck: [0, WW],
    trains: [mv(train)],
    trees: [...trees, { trunk: mv(trunk), crown: mv(crown) }],
    lamps: [lampAt(120, 1), ...lamps.map(mv), lampAt(1900, -1), lampAt(2300, -1)],
    crossing: crossing.map(mv),
    planters: [shrub(560, 76), ...planters.map((p) => ({ box: mv(p.box), bush: mv(p.bush) })), shrub(2330, 80)],
    benches: [benchAt(220), { seat: mv(bench), back: mv(benchBack) }, benchAt(2100)],
    walkers: [walker(80, 716, 1.08), ...walkers.map(mvW), walker(1820, 716, 1.1), walker(1872, 718, 0.96), walker(2230, 716, 1.04)],
    umbrellas: [{ canopy: mv(umbrella), pole: mv(umbrellaPole) }, umbrellaOver(2230)],
    crossers: [mvW(crosserFig)],
    bollards: Array.from({ length: 18 }, (_, i) => 60 + i * 136).filter((x) => x < 1080 || x > 1360).map(bollard),
    lanes: Array.from({ length: 19 }, (_, i) => 20 + i * 130).filter((x) => x + 70 < 1090 || x > 1350).map((x) => `M${x} 792h70`).join(''),
    shade: [
      // The viaduct runs the whole width, so its shade does too.
      [[60, GROUND + 4], [2380, GROUND + 4], [2324, CURB - 2], [4, CURB - 2]],
      ...[330, 2040, 1368].map((x) => [[x - 130, GROUND + 4], [x + 120, GROUND + 4], [x + 80, CURB - 2], [x - 170, CURB - 2]] as Pt[]),
    ],
  };
}

/**
 * The street line art. With `build` (desktop welcome hero), every piece is
 * wrapped in a group carrying its own CSS animation, so the picture assembles
 * itself in order: the street first (kerbs, lanes, crossing), then the
 * buildings left to right, the BTS (pillars, deck, train), trees, and last
 * the people. The CSS lives inside the SVG, so it
 * runs from a plain <img> and honours reduced motion there too.
 */
type Layer = 'sky' | 'train' | 'back-tall' | 'back-mid' | 'back-low' | 'back-maha' | 'bts' | 'lamps' | 'trees' | 'ground' | 'people';
/** Building height band, so the page can raise short buildings first, then taller ones. */
const band = (poly: Pt[], landmark: Pt[] | null): Layer => {
  if (poly === landmark) return 'back-maha';
  const top = Math.min(...poly.map((q) => q[1]));
  return top >= 440 ? 'back-low' : top >= 300 ? 'back-mid' : 'back-tall';
};

function art(kind: 'day' | 'night', sc: Scene, build = false, only?: Layer): string {
  // Same as the welcome page behind it, so the drawing reads as bare line art.
  const field = '#050B1A';
  const ink = kind === 'day' ? '#EEF4FF' : '#D3DCF5';
  const parts: string[] = [];
  let anim = 'rise';
  let at = 0;
  let layer: Layer = 'back-low';
  const want = () => !only || only === layer;
  const minX = (poly: Pt[]) => Math.min(...poly.map((q) => q[0]));
  const shape = (poly: Pt[], density: number, stroke = ink, extra: Pt[] = [], plain = false) => {
    if (!want()) return;
    const f = facets(poly, density, extra);
    if (plain) f.edges = ''; // glass, not facets (MahaNakhon)
    // Fill with the field colour so nearer shapes hide what is behind them.
    const body =
      `<path d="${f.outline}" fill="${field}"/>` +
      `<path d="${f.edges}" fill="none" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" opacity=".5"/>` +
      `<path d="${f.outline}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;
    parts.push(build ? `<g class="${anim}" style="animation-delay:${at.toFixed(2)}s">${body}</g>` : body);
  };
  /** Delay for a piece starting at x: a sweep from `start` across `span` seconds. */
  const sweep = (start: number, span: number, x: number) => start + (Math.max(0, x) / sc.w) * span;
  anim = 'fade';
  at = 2.0;
  layer = 'sky';
  if (sc.sky) {
    if (kind === 'day') shape(sun, 600, ink, [[744, 132]]);
    else shape(moon, 500, ink);
  }
  anim = 'rise';
  sc.towers.forEach((b) => {
    layer = band(b, sc.landmark);
    at = sweep(0.8, 0.9, minX(b));
    if (b === sc.landmark) {
      shape(b, 4200, ink, [], true);
      if (want()) parts.push(sc.landmarkDetail);
    } else shape(b, 4200);
  });
  sc.buildings.forEach((b) => ((layer = band(b, sc.landmark)), (at = sweep(1.0, 1.0, minX(b))), shape(b, 4200)));
  layer = 'bts';
  sc.pillars.forEach((p) => ((at = sweep(2.1, 0.4, minX(p))), shape(p, 1600)));
  anim = 'wipe';
  at = 2.4;
  shape([[sc.deck[0], 428], [sc.deck[1], 428], [sc.deck[1], 462], [sc.deck[0], 462]], 2800);
  anim = 'slide';
  at = 2.7;
  layer = 'train'; // its own layer, so the page can run it along the viaduct
  sc.trains.forEach((t) => shape(t, 2400));
  layer = 'bts';
  anim = 'fade';
  at = 2.9;
  layer = 'lamps';
  // Whole drawings show lamp posts only at night; the lamps layer always has them.
  if (kind === 'night' || only === 'lamps') sc.lamps.forEach((l) => shape(l, 700, '#F5A524'));
  layer = 'trees';
  anim = 'pop';
  sc.trees.forEach((t) => {
    at = sweep(3.0, 0.5, minX(t.crown));
    shape(t.trunk, 800);
    shape(t.crown, 1600);
  });
  layer = 'ground';
  const lines = `<path d="M0 ${GROUND}H${sc.w}M0 ${CURB}H${sc.w}M0 ${NEAR}H${sc.w}" stroke="${ink}" stroke-width="2.4"/>`;
  if (want()) parts.push(build ? `<g class="wipe" style="animation-delay:0s">${lines}</g>` : lines);
  // Zebra crossing, drawn as faceted stripes slanting with the road.
  anim = 'fade';
  sc.crossing.forEach((c, i) => ((at = 0.4 + i * 0.05), shape(c, 500)));
  // Sidewalk life sits in front of the ground line.
  anim = 'rise';
  layer = 'people';
  sc.planters.forEach((p) => {
    at = sweep(3.4, 0.5, minX(p.box));
    shape(p.bush, 380);
    shape(p.box, 600);
  });
  sc.benches.forEach((b) => {
    at = sweep(3.4, 0.5, minX(b.seat));
    shape(b.back, 500);
    shape(b.seat, 400);
  });
  anim = 'walk';
  sc.umbrellas.forEach((u) => ((at = sweep(3.6, 0.5, minX(u.canopy))), shape(u.pole, 200)));
  sc.walkers.forEach((w) => {
    at = sweep(3.6, 0.5, minX(w.body));
    shape(w.body, 220);
    shape(w.head, 200);
  });
  sc.umbrellas.forEach((u) => ((at = sweep(3.6, 0.5, minX(u.canopy))), shape(u.canopy, 450)));
  // Centre lane marks, broken where the crossing is.
  layer = 'ground';
  const lanes = `<path d="${sc.lanes}" stroke="${ink}" stroke-width="2" opacity=".55"/>`;
  if (want()) parts.push(build ? `<g class="fade" style="animation-delay:.3s">${lanes}</g>` : lanes);
  // Near kerb: low bollards along the foreground sidewalk.
  anim = 'rise';
  sc.bollards.forEach((b) => ((at = sweep(0.5, 0.5, minX(b))), shape(b, 250)));
  anim = 'walk';
  at = 4.0;
  layer = 'people';
  sc.crossers.forEach((w) => {
    shape(w.body, 200);
    shape(w.head, 200);
  });
  const style = build
    ? `<style>
g{transform-box:fill-box;animation-duration:.9s;animation-fill-mode:both;animation-timing-function:cubic-bezier(.16,1,.3,1)}
.rise{transform-origin:50% 100%;animation-name:rise}
.wipe{transform-origin:0 50%;animation-name:wipe;animation-duration:1.1s}
.slide{animation-name:slide;animation-duration:1.4s}
.pop{transform-origin:50% 100%;animation-name:pop}
.fade{animation-name:fade}
.walk{animation-name:walk}
@keyframes rise{from{opacity:0;transform:translateY(60px) scaleY(.4)}}
@keyframes wipe{from{transform:scaleX(0)}}
@keyframes slide{from{opacity:0;transform:translateX(-900px)}}
@keyframes pop{from{opacity:0;transform:scale(.3)}}
@keyframes fade{from{opacity:0}}
@keyframes walk{from{opacity:0;transform:translateX(-40px)}}
@media (prefers-reduced-motion:reduce){g{animation:none}}
</style>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${sc.top} ${sc.w} ${H - sc.top}" role="img" aria-hidden="true">${style}${parts.join('')}</svg>`;
}

/**
 * The layer over the drawing. Day: cast shade, a darker faceted patch on the
 * sidewalk that fades in once the street has built. Night: each street lamp
 * switches on in turn (a short flicker, once), throwing a warm cone and a
 * pool of light on the pavement.
 */
function overlay(kind: 'day' | 'night', sc: Scene): string {
  const view = `viewBox="0 ${sc.top} ${sc.w} ${H - sc.top}"`;
  if (kind === 'day') {
    const body = sc.shade
      .map((p) => facets(p, 3400))
      .map((f) => `<path d="${f.outline}" fill="#000000" opacity="0.4"/><path d="${f.edges}" fill="none" stroke="#5E7BFF" stroke-width="1" opacity=".6"/>`)
      .join('');
    // Static: the page fades this layer in (an animated SVG image re-rasterises every frame).
    return `<svg xmlns="http://www.w3.org/2000/svg" ${view} aria-hidden="true"><g>${body}</g></svg>`;
  }
  const lamps = sc.lamps
    .map((l, i) => {
      const dir = Math.sign(l[2]![0] - l[1]![0]);
      const hx = l[3]![0] - 4 * dir; // under the lamp head
      const hy = 518;
      const cone = `M${hx - 7} ${hy}L${hx + 7} ${hy}L${hx + 78} ${CURB - 26}L${hx - 78} ${CURB - 26}Z`;
      return (
        // Posts arrive at ~3.4–3.9 s (page CSS); each lamp then flickers on in turn.
        // Every third lamp is a bit tired and flickers now and then.
        `<g class="lamp${i % 3 === 1 ? ' tired' : ''}" style="animation-delay:${(3.9 + i * 0.22).toFixed(2)}s${i % 3 === 1 ? `,${(6 + i * 1.3).toFixed(1)}s` : ''}">` +
        `<path class="cone" d="${cone}" fill="url(#cone)"/>` +
        `<ellipse cx="${hx}" cy="${CURB - 30}" rx="104" ry="18" fill="url(#pool)"/>` +
        `<circle cx="${hx}" cy="${hy - 2}" r="22" fill="url(#bulb)"/>` +
        `</g>`
      );
    })
    .join('');
  const defs = `<defs>
<linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC861" stop-opacity=".55"/><stop offset=".55" stop-color="#F5A524" stop-opacity=".18"/><stop offset="1" stop-color="#F5A524" stop-opacity="0"/></linearGradient>
<radialGradient id="pool"><stop offset="0" stop-color="#F5A524" stop-opacity=".42"/><stop offset="1" stop-color="#F5A524" stop-opacity="0"/></radialGradient>
<radialGradient id="bulb"><stop offset="0" stop-color="#FFF3D6"/><stop offset=".35" stop-color="#FFC861" stop-opacity=".7"/><stop offset="1" stop-color="#F5A524" stop-opacity="0"/></radialGradient>
</defs>`;
  const style = `<style>
.lamp{animation:on 1.1s linear both}
.tired{animation:on 1.1s linear both,flicker 7.3s steps(1) infinite}
@keyframes flicker{0%,90%,100%{opacity:1}91%{opacity:.25}92%{opacity:.9}93%{opacity:.15}95%{opacity:1}}
@keyframes on{0%{opacity:0}18%{opacity:.85}24%{opacity:.15}36%{opacity:1}44%{opacity:.55}60%,100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.lamp,.tired{animation:none}}
</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${view} aria-hidden="true">${defs}${style}${lamps}</svg>`;
}

const out = fileURLToPath(new URL('../apps/web/public/art/', import.meta.url));
mkdirSync(out, { recursive: true });
writeFileSync(`${out}street-day.svg`, art('day', base));
writeFileSync(`${out}street-night.svg`, art('night', base));
// Hero layers (phone: base street; desktop: panorama). The page animates each
// layer as one image (cheap to composite), so the street assembles itself:
// road, buildings, BTS, trees, people. Same geometry as the whole drawings.
const LAYERS: Layer[] = ['bts', 'train', 'lamps', 'trees', 'ground', 'people'];

/**
 * Buildings one by one, for the opening where they rise left to right: each
 * building as its own small SVG (same facets as the full drawing), with its
 * box in scene units. Listed back to front, so nearer ones cover farther ones.
 */
function buildingPieces(sc: Scene): { x: number; y: number; w: number; h: number; svg: string }[] {
  const ink = '#EEF4FF';
  const list = [...sc.towers, ...sc.buildings];
  return list.map((poly) => {
    const plain = poly === sc.landmark;
    const f = facets(poly, 4200);
    const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
    const pad = 3;
    const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
    const body =
      `<path d="${f.outline}" fill="#050B1A"/>` +
      (plain ? '' : `<path d="${f.edges}" fill="none" stroke="${ink}" stroke-width="1" stroke-linejoin="round" opacity=".5"/>`) +
      `<path d="${f.outline}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>` +
      (plain ? sc.landmarkDetail : '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(x)} ${r1(y)} ${r1(w)} ${r1(h)}">${body}</svg>`;
    return { x: r1(x), y: r1(y), w: r1(w), h: r1(h), svg };
  });
}
for (const l of LAYERS) writeFileSync(`${out}street-layer-${l}.svg`, art('day', base, false, l));
writeFileSync(`${out}street-buildings.json`, JSON.stringify({ w: base.w, top: base.top, h: H, pieces: buildingPieces(base) }));
writeFileSync(`${out}street-layer-sun.svg`, art('day', base, false, 'sky'));
writeFileSync(`${out}street-layer-moon.svg`, art('night', base, false, 'sky'));
writeFileSync(`${out}street-day-shade.svg`, overlay('day', base));
writeFileSync(`${out}street-night-light.svg`, overlay('night', base));
const wide = widen();
writeFileSync(`${out}street-wide-day.svg`, art('day', wide));
writeFileSync(`${out}street-wide-night.svg`, art('night', wide));
writeFileSync(`${out}street-wide-day-shade.svg`, overlay('day', wide));
writeFileSync(`${out}street-wide-night-light.svg`, overlay('night', wide));
for (const l of LAYERS) writeFileSync(`${out}street-wide-layer-${l}.svg`, art('day', wide, false, l));
writeFileSync(`${out}street-wide-buildings.json`, JSON.stringify({ w: wide.w, top: wide.top, h: H, pieces: buildingPieces(wide) }));
// The sky bodies on their own, for the live sky over the desktop panorama.
const body = (kind: 'day' | 'night') => {
  const f = kind === 'day' ? facets(sun, 600, [[744, 132]]) : facets(moon, 500);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="686 74 116 116" aria-hidden="true"><path d="${f.outline}" fill="#050B1A"/><path d="${f.edges}" fill="none" stroke="#EEF4FF" stroke-width="1.1" opacity=".72"/><path d="${f.outline}" fill="none" stroke="#EEF4FF" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
};
writeFileSync(`${out}sky-sun.svg`, body('day'));
writeFileSync(`${out}sky-moon.svg`, body('night'));
console.log('wrote', out);
