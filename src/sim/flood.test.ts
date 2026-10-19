import { describe, expect, it } from 'vitest';
import { createFloodModel, formatClock } from './flood';

// Observed: collapse 08:37 NPT, Gyirong Port destroyed 08:44 NPT (CCTV) — 7 minutes.
const params = {
  totalKm: 80,
  collapseMin: 7,                      // minutes after 08:30 T0
  calibration: { distanceKm: 22, travelSec: 420 },
  debrisEstimate: 52,                  // m/s, published estimate
  vMin: 7,
  decayKm: 12,
};

describe('phase 1 · debris flow (calibrated to observation)', () => {
  const m = createFloodModel(params);

  it('reproduces the observed 7-minute collapse→Gyirong travel time exactly', () => {
    expect(m.arrivalMin(22) - params.collapseMin).toBeCloseTo(7, 6);
  });

  it('derives the debris speed from the observation, not from the estimate', () => {
    expect(m.debrisSpeed).toBeCloseTo(22_000 / 420, 6);
  });

  it('confirms consistency when the implied speed is near the published ~52 m/s estimate', () => {
    expect(m.consistentWithEstimate).toBe(true);
  });

  it('flags an implausible route/observation pairing (40 km in 7 min ≈ 95 m/s)', () => {
    const bad = createFloodModel({ ...params, calibration: { distanceKm: 40, travelSec: 420 } });
    expect(bad.consistentWithEstimate).toBe(false);
  });
});

describe('phase 2 · flood wave (modeled downstream)', () => {
  const m = createFloodModel(params);

  it('slows downstream of Gyirong as the debris flow dilutes, but never below the floor', () => {
    expect(m.velocity(10)).toBeCloseTo(m.debrisSpeed);
    expect(m.velocity(40)).toBeLessThan(m.velocity(25));
    expect(m.velocity(80)).toBeGreaterThanOrEqual(params.vMin);
  });

  it('keeps arrival continuous across the phase boundary (no jump at Gyirong)', () => {
    expect(m.arrivalMin(22.001) - m.arrivalMin(21.999)).toBeLessThan(0.01);
  });

  it('takes over an hour to cover the 58 km below Gyirong, unlike a constant 52 m/s front', () => {
    expect(m.arrivalMin(80) - m.arrivalMin(22)).toBeGreaterThan(60);
  });

  it('frontKm is the inverse of arrivalMin, so the map front and the timeline agree', () => {
    for (const km of [5, 22, 33, 61]) expect(m.frontKm(m.arrivalMin(km))).toBeCloseTo(km, 1);
  });

  it('reports no front before the collapse and caps at the end of the reach', () => {
    expect(m.frontKm(0)).toBe(0);
    expect(m.frontKm(10_000)).toBe(params.totalKm);
  });
});

describe('surge stage', () => {
  const m = createFloodModel(params);

  it('water is at normal level until the wave arrives, then surges', () => {
    const arrival = m.arrivalMin(30);
    expect(m.stage(30, arrival - 1)).toBe(0);
    expect(m.stage(30, arrival + 3)).toBeGreaterThan(5);
  });

  it('is highest near the source (settlements up to 80 m above river were hit)', () => {
    expect(m.peakStage(2)).toBeGreaterThan(60);
    expect(m.peakStage(70)).toBeLessThan(m.peakStage(2) / 3);
  });

  it('recedes after the peak', () => {
    const a = m.arrivalMin(20);
    expect(m.stage(20, a + 90)).toBeLessThan(m.stage(20, a + 5));
  });
});

describe('maxStageReached (flood scar)', () => {
  const m = createFloodModel(params);

  it('is zero before the wave arrives, so dry ground stays dry', () => {
    expect(m.maxStageReached(30, m.arrivalMin(30) - 1)).toBe(0);
  });

  it('holds the peak after the water recedes, so the silt line stays on the valley walls', () => {
    const a = m.arrivalMin(30);
    expect(m.maxStageReached(30, a + 120)).toBeCloseTo(m.peakStage(30));
    expect(m.stage(30, a + 120)).toBeLessThan(m.maxStageReached(30, a + 120));
  });

  it('tracks the rising limb exactly while the surge is still climbing', () => {
    const a = m.arrivalMin(30);
    expect(m.maxStageReached(30, a + 1)).toBeCloseTo(m.stage(30, a + 1));
  });
});

describe('formatClock', () => {
  it('renders minutes after the 08:30 NPT baseline as wall-clock time', () => {
    expect(formatClock(0)).toBe('08:30');
    expect(formatClock(14)).toBe('08:44');
    expect(formatClock(215.5)).toBe('12:05');
  });
});
