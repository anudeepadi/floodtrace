import { describe, expect, it } from 'vitest';
import { createExtent, lonLatToLocal, localToLonLat, metersPerTile } from './mercator';

// Extent matches the fetched DEM: z11 tiles x 1508–1510, y 855–858.
const extent = createExtent({ zoom: 11, x0: 1508, x1: 1510, y0: 855, y1: 858 });

describe('mercator extent', () => {
  it('covers the Langtang–Trishuli corridor so every incident site can be placed', () => {
    expect(extent.west).toBeLessThan(85.13);   // Devighat
    expect(extent.east).toBeGreaterThan(85.52); // Langtang Lirung
    expect(extent.north).toBeGreaterThan(28.3);
    expect(extent.south).toBeLessThan(27.87);
  });

  it('has ground dimensions near 52 × 69 km, so distances along the river are realistic', () => {
    expect(extent.widthKm).toBeGreaterThan(50);
    expect(extent.widthKm).toBeLessThan(54);
    expect(extent.heightKm).toBeGreaterThan(67);
    expect(extent.heightKm).toBeLessThan(71);
  });
});

describe('lonLatToLocal', () => {
  it('maps the NW corner to (0,0) and SE corner to (1,1) for texture/grid lookups', () => {
    expect(lonLatToLocal(extent, extent.west, extent.north)).toEqual({ u: 0, v: 0 });
    const se = lonLatToLocal(extent, extent.east, extent.south);
    expect(se.u).toBeCloseTo(1, 9);
    expect(se.v).toBeCloseTo(1, 9);
  });

  it('round-trips so a clicked map point reports the correct coordinates', () => {
    const p = lonLatToLocal(extent, 85.378, 28.276);
    const back = localToLonLat(extent, p.u, p.v);
    expect(back.lon).toBeCloseTo(85.378, 9);
    expect(back.lat).toBeCloseTo(28.276, 9);
  });
});

describe('metersPerTile', () => {
  it('shrinks with latitude (Mercator), which keeps km scale honest at 28°N', () => {
    expect(metersPerTile(11, 28.1)).toBeLessThan(metersPerTile(11, 0));
    expect(metersPerTile(11, 28.1)).toBeCloseTo(17260, -2);
  });
});
