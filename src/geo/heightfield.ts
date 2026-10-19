/** Row-major elevation grid in metres. Row 0 is the north edge. */
export interface Heightfield {
  readonly cols: number;
  readonly rows: number;
  readonly data: Float32Array;
  readonly min: number;
  readonly max: number;
}

export function createHeightfield(cols: number, rows: number, data: Float32Array): Heightfield {
  if (data.length !== cols * rows) throw new Error(`Heightfield size mismatch: ${data.length} ≠ ${cols}×${rows}`);
  let min = Infinity, max = -Infinity;
  for (const h of data) { if (h < min) min = h; if (h > max) max = h; }
  return { cols, rows, data, min, max };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bilinear elevation at normalised (u, v) ∈ [0,1]². */
export function sampleHeight(f: Heightfield, u: number, v: number): number {
  const x = clamp(u, 0, 1) * (f.cols - 1), y = clamp(v, 0, 1) * (f.rows - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, f.cols - 1), y1 = Math.min(y0 + 1, f.rows - 1);
  const fx = x - x0, fy = y - y0, d = f.data, c = f.cols;
  const top = d[y0 * c + x0] * (1 - fx) + d[y0 * c + x1] * fx;
  const bottom = d[y1 * c + x0] * (1 - fx) + d[y1 * c + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}

/** Downsample by an integer factor using box averaging (keeps mesh vertex count sane). */
export function downsample(f: Heightfield, factor: number): Heightfield {
  const cols = Math.floor(f.cols / factor), rows = Math.floor(f.rows / factor);
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let sum = 0;
    for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) {
      sum += f.data[(r * factor + dy) * f.cols + c * factor + dx];
    }
    out[r * cols + c] = sum / (factor * factor);
  }
  return createHeightfield(cols, rows, out);
}
