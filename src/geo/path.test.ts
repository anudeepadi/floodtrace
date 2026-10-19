import { describe, expect, it } from 'vitest';
import { createHeightfield, downsample, sampleHeight } from './heightfield';
import { leastCostPath, polylineLengths, smoothPolyline } from './path';

// 30×30 grid: low terrain (500 m) split by an east–west ridge (5000 m) at row 15,
// with a single low pass at column 22.
function ridgeWithPass() {
  const cols = 30, rows = 30, data = new Float32Array(cols * rows).fill(500);
  for (let c = 0; c < cols; c++) data[15 * cols + c] = c === 22 ? 500 : 5000;
  return createHeightfield(cols, rows, data);
}

describe('leastCostPath', () => {
  it('routes the flood through the low pass instead of over the ridge, like water would', () => {
    const path = leastCostPath(ridgeWithPass(), { col: 5, row: 0 }, { col: 5, row: 29 });
    const crossing = path.find(p => p.row === 15);
    expect(crossing).toEqual({ col: 22, row: 15 });
  });

  it('starts and ends exactly on the requested waypoints so sites stay on the river', () => {
    const path = leastCostPath(ridgeWithPass(), { col: 5, row: 0 }, { col: 5, row: 29 });
    expect(path[0]).toEqual({ col: 5, row: 0 });
    expect(path.at(-1)).toEqual({ col: 5, row: 29 });
  });

  it('only steps to 8-connected neighbours, so the river never jumps cells', () => {
    const path = leastCostPath(ridgeWithPass(), { col: 0, row: 0 }, { col: 29, row: 29 });
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i].col - path[i - 1].col)).toBeLessThanOrEqual(1);
      expect(Math.abs(path[i].row - path[i - 1].row)).toBeLessThanOrEqual(1);
    }
  });
});

describe('polyline helpers', () => {
  it('accumulates distance so chainage (km along the river) is monotonic', () => {
    const lengths = polylineLengths([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }]);
    expect(lengths).toEqual([0, 5, 11]);
  });

  it('smoothing keeps the endpoints so the source and outlet do not drift', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }];
    const smooth = smoothPolyline(pts, 2);
    expect(smooth[0]).toEqual(pts[0]);
    expect(smooth.at(-1)).toEqual(pts.at(-1));
    expect(smooth.length).toBeGreaterThan(pts.length);
  });
});

describe('heightfield', () => {
  it('rejects mismatched data so a bad DEM decode fails loudly', () => {
    expect(() => createHeightfield(2, 2, new Float32Array(3))).toThrow(/mismatch/);
  });

  it('bilinearly interpolates between samples', () => {
    const f = createHeightfield(2, 2, Float32Array.from([0, 100, 0, 100]));
    expect(sampleHeight(f, 0.5, 0.5)).toBeCloseTo(50);
  });

  it('downsampling averages blocks and keeps min/max consistent', () => {
    const f = downsample(createHeightfield(2, 2, Float32Array.from([0, 100, 200, 300])), 2);
    expect(f.data[0]).toBe(150);
    expect(f.min).toBe(150);
  });
});
