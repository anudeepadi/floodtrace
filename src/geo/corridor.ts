// Cross-sections across the valley along the flood route. The water surface is drawn as a
// sheet at (bed + stage) over this corridor; the terrain hides it wherever the ground is higher,
// so the inundation edge follows the real valley walls.
import { pointAtKm, type Route } from './route';

export interface CorridorOpts {
  spacingKm: number;
  halfWidthKm: number;
  /** Samples across each section (odd, so one sits on the centre line). */
  lateral: number;
  /** Lowest point within this distance of the centre line is taken as the water base. */
  bedHalfWidthKm: number;
}

export interface Corridor {
  readonly sections: number;
  readonly lateral: number;
  /** Chainage of each section. */
  readonly km: Float32Array;
  /** Normalised map position of every sample, [u, v] pairs, section-major. */
  readonly uv: Float32Array;
  /** Lateral position of each sample within its section, −1 … 1. */
  readonly lat: Float32Array;
  /** Normal-flow water base per section (m). */
  readonly bedM: Float32Array;
  /** Ground elevation at every sample (m). */
  readonly groundM: Float32Array;
}

const HEADING_SPAN_KM = 0.6;
const BED_SMOOTHING = 3; // half-window, in sections

type Elevation = (u: number, v: number) => number;
type Dims = { widthKm: number; heightKm: number };

export function buildCorridor(route: Route, dims: Dims, elevation: Elevation, opts: CorridorOpts): Corridor {
  const sections = Math.floor(route.totalKm / opts.spacingKm) + 1;
  const { lateral } = opts;
  const km = new Float32Array(sections), uv = new Float32Array(sections * lateral * 2);
  const groundM = new Float32Array(sections * lateral), rawBed = new Float32Array(sections);
  const lat = Float32Array.from({ length: lateral }, (_, j) => (j / (lateral - 1)) * 2 - 1);

  for (let i = 0; i < sections; i++) {
    const s = Math.min(i * opts.spacingKm, route.totalKm);
    km[i] = s;
    const a = pointAtKm(route, s - HEADING_SPAN_KM), b = pointAtKm(route, s + HEADING_SPAN_KM), c = pointAtKm(route, s);
    const dx = (b.u - a.u) * dims.widthKm, dy = (b.v - a.v) * dims.heightKm, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // perpendicular to flow, in km
    let bed = Infinity;
    for (let j = 0; j < lateral; j++) {
      const offset = lat[j] * opts.halfWidthKm, k = i * lateral + j;
      const u = c.u + (nx * offset) / dims.widthKm, v = c.v + (ny * offset) / dims.heightKm;
      uv[k * 2] = u; uv[k * 2 + 1] = v;
      groundM[k] = elevation(u, v);
      if (Math.abs(offset) <= opts.bedHalfWidthKm + 1e-9) bed = Math.min(bed, groundM[k]);
    }
    rawBed[i] = bed;
  }
  return { sections, lateral, km, uv, lat, bedM: smoothMonotone(rawBed), groundM };
}

/** Moving-average, then clamp so the base only ever descends downstream. */
function smoothMonotone(raw: Float32Array): Float32Array {
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    let sum = 0, n = 0;
    for (let k = Math.max(0, i - BED_SMOOTHING); k <= Math.min(raw.length - 1, i + BED_SMOOTHING); k++) { sum += raw[k]; n++; }
    out[i] = Math.min(sum / n, raw[i]);
    if (i > 0) out[i] = Math.min(out[i], out[i - 1]);
  }
  return out;
}

/** For each terrain grid vertex, the index of the nearest section centre within reach (−1 if none). */
export function nearestSections(c: Corridor, cols: number, rows: number, dims: Dims, reachKm: number): Int32Array {
  const out = new Int32Array(cols * rows).fill(-1);
  const centre = (c.lateral - 1) / 2, cell = reachKm;
  const hash = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const cx = new Float32Array(c.sections), cy = new Float32Array(c.sections);
  for (let i = 0; i < c.sections; i++) {
    const k = (i * c.lateral + centre) * 2;
    cx[i] = c.uv[k] * dims.widthKm; cy[i] = c.uv[k + 1] * dims.heightKm;
    const h = key(cx[i], cy[i]);
    hash.set(h, [...(hash.get(h) ?? []), i]);
  }
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const x = (q / (cols - 1)) * dims.widthKm, y = (r / (rows - 1)) * dims.heightKm;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    let best = -1, bestD = reachKm * reachKm;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      for (const i of hash.get(`${gx + ox},${gy + oy}`) ?? []) {
        const d = (cx[i] - x) ** 2 + (cy[i] - y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    out[r * cols + q] = best;
  }
  return out;
}
