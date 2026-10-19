import { describe, expect, it } from 'vitest';
import { buildCorridor, nearestSections } from './corridor';
import type { Route } from './route';

// 20 × 20 km map, river running due south down the middle (u = 0.5).
const dims = { widthKm: 20, heightKm: 20 };
const route: Route = {
  points: Array.from({ length: 21 }, (_, i) => ({ u: 0.5, v: i / 20 })),
  km: Array.from({ length: 21 }, (_, i) => i),
  totalKm: 20,
  siteKm: {},
};
// V-shaped valley: floor drops 20 m per km downstream, walls rise 200 m per km sideways.
const valley = (u: number, v: number) => 1000 - v * 20 * 20 + Math.abs(u - 0.5) * 20 * 200;
const opts = { spacingKm: 0.5, halfWidthKm: 1.5, lateral: 7, bedHalfWidthKm: 0.3 };

describe('buildCorridor', () => {
  const c = buildCorridor(route, dims, valley, opts);

  it('samples cross-sections along the whole river at the requested spacing', () => {
    expect(c.sections).toBe(41);
    expect(c.km[0]).toBe(0);
    expect(c.km[c.sections - 1]).toBeCloseTo(20);
  });

  it('finds the valley floor as the water base, so water sits in the channel and not on the walls', () => {
    const mid = 20; // section at 10 km
    expect(c.bedM[mid]).toBeCloseTo(valley(0.5, 0.5), -1);
  });

  it('never lets the water base rise downstream, so the river cannot flow uphill through DEM noise', () => {
    for (let i = 1; i < c.sections; i++) expect(c.bedM[i]).toBeLessThanOrEqual(c.bedM[i - 1]);
  });

  it('spans the full corridor width perpendicular to the flow', () => {
    const row = 10, first = row * opts.lateral, last = first + opts.lateral - 1;
    const widthKm = (c.uv[last * 2] - c.uv[first * 2]) * dims.widthKm;
    expect(Math.abs(widthKm)).toBeCloseTo(3, 1);
    expect(c.uv[first * 2 + 1]).toBeCloseTo(c.uv[last * 2 + 1], 6); // same v → perpendicular to a N–S river
  });

  it('records ground height at every sample for shoreline foam', () => {
    expect(c.groundM.length).toBe(c.sections * opts.lateral);
    expect(c.groundM[10 * opts.lateral]).toBeGreaterThan(c.bedM[10]); // the wall is above the bed
  });
});

describe('nearestSections', () => {
  const c = buildCorridor(route, dims, valley, opts);
  const grid = nearestSections(c, 21, 21, dims, opts.halfWidthKm);

  it('links ground on the river to the cross-section beside it, so the flood mark lands in the right place', () => {
    const centre = 10 * 21 + 10; // u = 0.5, v = 0.5 → 10 km
    expect(c.km[grid[centre]]).toBeCloseTo(10, 0);
  });

  it('marks ground outside the corridor as unaffected (-1)', () => {
    expect(grid[10 * 21 + 0]).toBe(-1); // 10 km west of the river
  });
});
