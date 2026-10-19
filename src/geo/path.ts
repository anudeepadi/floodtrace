import type { Heightfield } from './heightfield';

export interface Cell { col: number; row: number }
export interface Point { x: number; y: number }

/** Steeply penalises elevation so routes hug valley floors (how floodwater travels). */
const ELEVATION_PENALTY = 200;
const ELEVATION_EXPONENT = 3;

const NEIGHBOURS = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
] as const;

/** Minimal binary min-heap keyed by cost. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];
  get size() { return this.items.length; }
  push(item: number, key: number) {
    this.items.push(item); this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!, lastKey = this.keys.pop()!;
    if (this.items.length) {
      this.items[0] = lastItem; this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

/** Dijkstra over the DEM grid with an elevation-weighted cost. */
export function leastCostPath(f: Heightfield, from: Cell, to: Cell): Cell[] {
  const n = f.cols * f.rows, range = f.max - f.min || 1;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const start = from.row * f.cols + from.col, goal = to.row * f.cols + to.col;
  const heap = new MinHeap();
  dist[start] = 0; heap.push(start, 0);

  while (heap.size) {
    const i = heap.pop();
    if (i === goal) break;
    const c = i % f.cols, r = (i / f.cols) | 0;
    for (const [dx, dy] of NEIGHBOURS) {
      const nc = c + dx, nr = r + dy;
      if (nc < 0 || nr < 0 || nc >= f.cols || nr >= f.rows) continue;
      const j = nr * f.cols + nc;
      const norm = (f.data[j] - f.min) / range;
      const step = Math.hypot(dx, dy) * (1 + ELEVATION_PENALTY * norm ** ELEVATION_EXPONENT);
      if (dist[i] + step < dist[j]) { dist[j] = dist[i] + step; prev[j] = i; heap.push(j, dist[j]); }
    }
  }
  if (!Number.isFinite(dist[goal])) throw new Error('No path between waypoints');

  const cells: Cell[] = [];
  for (let i = goal; i !== -1; i = prev[i]) cells.push({ col: i % f.cols, row: (i / f.cols) | 0 });
  return cells.reverse();
}

/** Cumulative distance at each vertex. */
export function polylineLengths(pts: readonly Point[]): number[] {
  return pts.reduce<number[]>((acc, p, i) => {
    if (i === 0) return [0];
    const q = pts[i - 1];
    return [...acc, acc[i - 1] + Math.hypot(p.x - q.x, p.y - q.y)];
  }, []);
}

/** Chaikin corner cutting; endpoints are preserved. */
export function smoothPolyline(pts: readonly Point[], iterations: number): Point[] {
  let out = [...pts];
  for (let k = 0; k < iterations; k++) {
    const next: Point[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i], b = out[i + 1];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}
