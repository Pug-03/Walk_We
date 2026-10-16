// Planar helpers on flat rings [x0, y0, x1, y1, ...] in metres.

export function pointInRing(px: number, py: number, ring: ArrayLike<number>): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = ring[i]!, yi = ring[i + 1]!, xj = ring[j]!, yj = ring[j + 1]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function distPointSeg2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

/** Squared distance between two segments (0 if they cross). */
export function distSegSeg2(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number {
  if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    distPointSeg2(ax, ay, cx, cy, dx, dy),
    distPointSeg2(bx, by, cx, cy, dx, dy),
    distPointSeg2(cx, cy, ax, ay, bx, by),
    distPointSeg2(dx, dy, ax, ay, bx, by),
  );
}

export interface BBox2 {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function ringBBox(ring: ArrayLike<number>): BBox2 {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    const x = ring[i]!, y = ring[i + 1]!;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/** Uniform grid spatial index over bounding boxes. */
export class Grid<T> {
  private cells = new Map<number, T[]>();
  constructor(private readonly size: number) {}

  private key(ix: number, iy: number): number {
    // Fits ±32k cells per axis — plenty for any city at ≥ 20 m cells.
    return (ix + 32768) * 65536 + (iy + 32768);
  }

  insert(item: T, b: BBox2): void {
    const s = this.size;
    for (let ix = Math.floor(b.x0 / s); ix <= Math.floor(b.x1 / s); ix++) {
      for (let iy = Math.floor(b.y0 / s); iy <= Math.floor(b.y1 / s); iy++) {
        const k = this.key(ix, iy);
        const cell = this.cells.get(k);
        if (cell) cell.push(item);
        else this.cells.set(k, [item]);
      }
    }
  }

  at(x: number, y: number): readonly T[] {
    return this.cells.get(this.key(Math.floor(x / this.size), Math.floor(y / this.size))) ?? EMPTY;
  }

  /** Items whose cells touch the circle's bounding square (may include extras). */
  near(x: number, y: number, r: number, out: Set<T>): Set<T> {
    const s = this.size;
    for (let ix = Math.floor((x - r) / s); ix <= Math.floor((x + r) / s); ix++) {
      for (let iy = Math.floor((y - r) / s); iy <= Math.floor((y + r) / s); iy++) {
        for (const it of this.cells.get(this.key(ix, iy)) ?? EMPTY) out.add(it);
      }
    }
    return out;
  }
}
const EMPTY: never[] = [];
