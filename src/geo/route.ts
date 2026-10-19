import type { Heightfield } from './heightfield';
import { lonLatToLocal, type Extent } from './mercator';
import { leastCostPath, polylineLengths, smoothPolyline, type Point } from './path';

export interface Waypoint { id: string; lon: number; lat: number }

export interface Route {
  /** Normalised map positions (u east, v south). */
  readonly points: readonly { u: number; v: number }[];
  /** Chainage in km at each point. */
  readonly km: readonly number[];
  readonly totalKm: number;
  /** Chainage of each waypoint. */
  readonly siteKm: Readonly<Record<string, number>>;
}

const SMOOTHING_ITERATIONS = 2;

/** Snap a waypoint chain onto the DEM's valley floors and measure it in km. */
export function buildRoute(field: Heightfield, extent: Extent, waypoints: readonly Waypoint[]): Route {
  if (waypoints.length < 2) throw new Error('Route needs at least two waypoints');
  const toCell = (w: Waypoint) => {
    const { u, v } = lonLatToLocal(extent, w.lon, w.lat);
    return { col: Math.round(u * (field.cols - 1)), row: Math.round(v * (field.rows - 1)) };
  };
  const toKm = (col: number, row: number): Point => ({
    x: (col / (field.cols - 1)) * extent.widthKm,
    y: (row / (field.rows - 1)) * extent.heightKm,
  });

  const points: Point[] = [];
  const siteIndex: Record<string, number> = { [waypoints[0].id]: 0 };
  for (let i = 1; i < waypoints.length; i++) {
    const cells = leastCostPath(field, toCell(waypoints[i - 1]), toCell(waypoints[i]));
    const segment = smoothPolyline(cells.map(c => toKm(c.col, c.row)), SMOOTHING_ITERATIONS);
    points.push(...(i === 1 ? segment : segment.slice(1)));
    siteIndex[waypoints[i].id] = points.length - 1;
  }

  const km = polylineLengths(points);
  return {
    points: points.map(p => ({ u: p.x / extent.widthKm, v: p.y / extent.heightKm })),
    km,
    totalKm: km[km.length - 1],
    siteKm: Object.fromEntries(Object.entries(siteIndex).map(([id, idx]) => [id, km[idx]])),
  };
}

/** Position along the route at a given chainage (linear interpolation). */
export function pointAtKm(route: Route, km: number): { u: number; v: number } {
  const { km: ks, points } = route;
  if (km <= 0) return points[0];
  if (km >= route.totalKm) return points[points.length - 1];
  let lo = 0, hi = ks.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ks[mid] < km) lo = mid; else hi = mid; }
  const t = (km - ks[lo]) / (ks[hi] - ks[lo] || 1);
  return { u: points[lo].u + (points[hi].u - points[lo].u) * t, v: points[lo].v + (points[hi].v - points[lo].v) * t };
}
