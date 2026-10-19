// Web Mercator helpers for a rectangular block of XYZ tiles.

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export interface TileRange { zoom: number; x0: number; x1: number; y0: number; y1: number }

export interface Extent {
  zoom: number;
  /** Tile-space bounds (fractional tiles at `zoom`). */
  tx0: number; tx1: number; ty0: number; ty1: number;
  west: number; east: number; north: number; south: number;
  widthKm: number; heightKm: number;
}

const tileToLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tileToLat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};
const lonToTile = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latToTile = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

export function metersPerTile(zoom: number, lat: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

export function createExtent(range: TileRange): Extent {
  const { zoom, x0, x1, y0, y1 } = range;
  const tx0 = x0, tx1 = x1 + 1, ty0 = y0, ty1 = y1 + 1;
  const north = tileToLat(ty0, zoom), south = tileToLat(ty1, zoom);
  const mpt = metersPerTile(zoom, (north + south) / 2);
  return {
    zoom, tx0, tx1, ty0, ty1,
    west: tileToLon(tx0, zoom), east: tileToLon(tx1, zoom), north, south,
    widthKm: ((tx1 - tx0) * mpt) / 1000,
    heightKm: ((ty1 - ty0) * mpt) / 1000,
  };
}

/** Normalised position inside the extent: u → east, v → south, both 0..1. */
export function lonLatToLocal(e: Extent, lon: number, lat: number): { u: number; v: number } {
  return {
    u: (lonToTile(lon, e.zoom) - e.tx0) / (e.tx1 - e.tx0),
    v: (latToTile(lat, e.zoom) - e.ty0) / (e.ty1 - e.ty0),
  };
}

export function localToLonLat(e: Extent, u: number, v: number): { lon: number; lat: number } {
  return {
    lon: tileToLon(e.tx0 + u * (e.tx1 - e.tx0), e.zoom),
    lat: tileToLat(e.ty0 + v * (e.ty1 - e.ty0), e.zoom),
  };
}
