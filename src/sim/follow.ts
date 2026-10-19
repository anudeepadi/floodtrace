// Follow-the-flood camera: playback pacing and chase-camera placement.
import { pointAtKm, type Route } from '../geo/route';

/** Simulated minutes per real second so the front moves `kmPerSec` across the screen. */
export function followRate(frontVelocityMs: number, opts: { kmPerSec: number; idleRate: number }): number {
  if (frontVelocityMs <= 0) return opts.idleRate;
  const kmPerSimMin = (frontVelocityMs * 60) / 1000;
  return opts.kmPerSec / kmPerSimMin;
}

export interface ChaseOpts { backKm: number; lookAheadKm: number; sideKm: number }

/** Window used to estimate the river heading; wider = smoother camera through bends. */
const HEADING_BEHIND_KM = 3;
const HEADING_AHEAD_KM = 4;

/** Ground positions (normalised u,v) for the chase camera eye and its look-at target. */
export function chasePose(route: Route, km: number, dims: { widthKm: number; heightKm: number }, opts: ChaseOpts) {
  const toKm = (p: { u: number; v: number }) => ({ x: p.u * dims.widthKm, y: p.v * dims.heightKm });
  const toUv = (x: number, y: number) => ({ u: x / dims.widthKm, v: y / dims.heightKm });

  const a = toKm(pointAtKm(route, km - HEADING_BEHIND_KM)), b = toKm(pointAtKm(route, km + HEADING_AHEAD_KM));
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;    // downstream heading
  const front = toKm(pointAtKm(route, km));
  const target = toKm(pointAtKm(route, km + opts.lookAheadKm));

  return {
    target: toUv(target.x, target.y),
    // Back along the heading, then sideways (perpendicular, to the right of travel).
    eye: toUv(front.x - dx * opts.backKm - dy * opts.sideKm, front.y - dy * opts.backKm + dx * opts.sideKm),
  };
}
