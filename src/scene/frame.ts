import { Vector3 } from 'three';
import { sampleHeight, type Heightfield } from '../geo/heightfield';
import type { Extent } from '../geo/mercator';

/** Vertical exaggeration applied to terrain and water (1 = true scale). */
export const EXAGGERATION = 1.35;

/** Maps normalised map coordinates to world space (1 unit = 1 km, y up, north = −z). */
export interface Frame {
  readonly extent: Extent;
  readonly field: Heightfield;
  elevationM(u: number, v: number): number;
  toWorld(u: number, v: number, liftM?: number): Vector3;
}

export function createFrame(extent: Extent, field: Heightfield): Frame {
  const elevationM = (u: number, v: number) => sampleHeight(field, u, v);
  return {
    extent,
    field,
    elevationM,
    toWorld: (u, v, liftM = 0) => new Vector3(
      (u - 0.5) * extent.widthKm,
      ((elevationM(u, v) + liftM) / 1000) * EXAGGERATION,
      (v - 0.5) * extent.heightKm,
    ),
  };
}
