import { createHeightfield, type Heightfield } from '../geo/heightfield';
import type { TileRange } from '../geo/mercator';

const TILE = 256;

/** Analysis area: Langtang Lirung down the Trishuli to Bidur (85.08–85.61°E, 27.84–28.38°N). */
export const DEM_RANGE: TileRange = { zoom: 11, x0: 1508, x1: 1510, y0: 855, y1: 858 };
/** Imagery two zoom levels finer than the DEM, covering the same extent. */
const IMG_ZOOM = 13;

// Both hosts send `Access-Control-Allow-Origin: *`, which WebGL needs to use the pixels.
const DEM_URL = (z: number, x: number, y: number) =>
  `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`;
const IMG_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

export interface TileData {
  demRange: TileRange;
  heightfield: Heightfield;
  imagery: HTMLCanvasElement;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load map tile ${url}. Check your connection and reload.`));
    img.src = url;
  });
}

async function stitch(range: TileRange, url: (z: number, x: number, y: number) => string): Promise<HTMLCanvasElement> {
  const cols = range.x1 - range.x0 + 1, rows = range.y1 - range.y0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE; canvas.height = rows * TILE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const jobs: Promise<void>[] = [];
  for (let x = range.x0; x <= range.x1; x++) for (let y = range.y0; y <= range.y1; y++) {
    jobs.push(loadImage(url(range.zoom, x, y)).then(img => ctx.drawImage(img, (x - range.x0) * TILE, (y - range.y0) * TILE)));
  }
  await Promise.all(jobs);
  return canvas;
}

/** Terrarium encoding: metres = R·256 + G + B/256 − 32768. */
function decodeTerrarium(canvas: HTMLCanvasElement): Heightfield {
  const { width, height } = canvas;
  const px = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
  return createHeightfield(width, height, data);
}

export async function loadTiles(): Promise<TileData> {
  const scale = 2 ** (IMG_ZOOM - DEM_RANGE.zoom);
  const imgRange: TileRange = {
    zoom: IMG_ZOOM,
    x0: DEM_RANGE.x0 * scale, x1: (DEM_RANGE.x1 + 1) * scale - 1,
    y0: DEM_RANGE.y0 * scale, y1: (DEM_RANGE.y1 + 1) * scale - 1,
  };
  const [dem, imagery] = await Promise.all([stitch(DEM_RANGE, DEM_URL), stitch(imgRange, IMG_URL)]);
  return { demRange: DEM_RANGE, heightfield: decodeTerrarium(dem), imagery };
}
