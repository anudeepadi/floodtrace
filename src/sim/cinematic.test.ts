import { describe, expect, it } from 'vitest';
import { cinematicStage, CINEMATIC_SCALE } from './cinematic';

describe('cinematicStage', () => {
  it('leaves water untouched where the surge has not arrived, so the river ahead stays calm', () => {
    expect(cinematicStage(0, -2, 40)).toBe(0);
  });

  it('scales the modeled surge height for effect', () => {
    expect(cinematicStage(10, 5, 40)).toBeCloseTo(10 * CINEMATIC_SCALE);
  });

  it('raises a wall of water just behind the front, where the bore breaks', () => {
    const atFront = cinematicStage(10, 0.1, 40), wellBehind = cinematicStage(10, 3, 40);
    expect(atFront).toBeGreaterThan(wellBehind);
  });

  it('never makes the front wall exceed the scaled peak, so it stays proportional to the event', () => {
    expect(cinematicStage(40, 0.05, 40)).toBeLessThanOrEqual(40 * CINEMATIC_SCALE * 1.6 + 1e-9);
  });
});
