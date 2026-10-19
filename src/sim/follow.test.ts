import { describe, expect, it } from 'vitest';
import type { Route } from '../geo/route';
import { chasePose, followRate } from './follow';

describe('followRate', () => {
  const opts = { kmPerSec: 1.5, idleRate: 2 };

  it('slows the clock while the debris flow is fast, so the first 22 km are watchable', () => {
    // 52 m/s = 3.12 km/min → 1.5 km/s on screen needs < 0.5 sim-min per second.
    expect(followRate(52, opts)).toBeCloseTo(1.5 / 3.12, 3);
  });

  it('speeds the clock up downstream, keeping the on-screen front pace constant', () => {
    expect(followRate(7, opts)).toBeGreaterThan(followRate(52, opts) * 7);
  });

  it('uses the idle rate before the collapse, when nothing moves', () => {
    expect(followRate(0, opts)).toBe(2);
  });
});

describe('chasePose', () => {
  // Straight river running due south (v increases) across a 50 × 50 km map.
  const route: Route = {
    points: Array.from({ length: 51 }, (_, i) => ({ u: 0.5, v: i / 50 })),
    km: Array.from({ length: 51 }, (_, i) => i),
    totalKm: 50,
    siteKm: {},
  };
  const dims = { widthKm: 50, heightKm: 50 };
  const opts = { backKm: 5, lookAheadKm: 2, sideKm: 0 };

  it('places the camera upstream of the front so the view looks downstream, with the flood', () => {
    const { eye, target } = chasePose(route, 20, dims, opts);
    expect(eye.v).toBeLessThan(target.v);
  });

  it('keeps the camera the requested distance behind the front', () => {
    const { eye } = chasePose(route, 20, dims, opts);
    expect(Math.abs((0.4 - eye.v) * 50)).toBeCloseTo(5, 1);
  });

  it('aims slightly ahead of the front so the next stretch is in view', () => {
    const { target } = chasePose(route, 20, dims, opts);
    expect(target.v * 50).toBeCloseTo(22, 1);
  });

  it('offsets sideways for an oblique angle on the valley walls', () => {
    const { eye } = chasePose(route, 20, dims, { ...opts, sideKm: 3 });
    expect(Math.abs((eye.u - 0.5) * 50)).toBeCloseTo(3, 1);
  });
});
