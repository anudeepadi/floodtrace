import { describe, expect, it } from 'vitest';
import { createHeightfield } from './heightfield';
import { createExtent, localToLonLat } from './mercator';
import { buildRoute, pointAtKm } from './route';

const extent = createExtent({ zoom: 11, x0: 1508, x1: 1510, y0: 855, y1: 858 });
const field = createHeightfield(40, 40, new Float32Array(1600).fill(1000));
const at = (u: number, v: number, id: string) => ({ id, ...localToLonLat(extent, u, v) });

describe('buildRoute', () => {
  const route = buildRoute(field, extent, [at(0.1, 0.1, 'a'), at(0.1, 0.9, 'b'), at(0.9, 0.9, 'c')]);

  it('assigns increasing chainage to waypoints in order, so downstream sites flood later', () => {
    expect(route.siteKm.a).toBe(0);
    expect(route.siteKm.b).toBeGreaterThan(route.siteKm.a);
    expect(route.siteKm.c).toBeGreaterThan(route.siteKm.b);
    expect(route.siteKm.c).toBeCloseTo(route.totalKm, 6);
  });

  it('measures real ground distance (flat terrain → roughly straight-line km)', () => {
    const straight = 0.8 * extent.heightKm + 0.8 * extent.widthKm;
    expect(route.totalKm).toBeGreaterThan(straight * 0.9);
    expect(route.totalKm).toBeLessThan(straight * 1.15);
  });

  it('pointAtKm clamps to the ends and interpolates in between', () => {
    expect(pointAtKm(route, -5)).toEqual(route.points[0]);
    expect(pointAtKm(route, 1e6)).toEqual(route.points.at(-1));
    const mid = pointAtKm(route, route.siteKm.b);
    expect(mid.u).toBeCloseTo(0.1, 1);
    expect(mid.v).toBeCloseTo(0.9, 1);
  });

  it('refuses a single waypoint instead of producing an empty river', () => {
    expect(() => buildRoute(field, extent, [at(0.5, 0.5, 'x')])).toThrow();
  });
});
