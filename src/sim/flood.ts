// Two-phase flood-front model along the river chainage.
//   Phase 1 (collapse → calibration point): constant debris-flow speed, solved directly
//            from the observed travel time (collapse 08:37 → Gyirong destroyed 08:44).
//   Phase 2 (downstream): speed decays toward a flood-wave floor,
//            v(s) = vMin + (v1 − vMin)·e^(−(s − d)/L).  vMin and L are ASSUMPTIONS.
// Everything downstream of the calibration point is MODELED, not measured.

export interface FloodParams {
  totalKm: number;
  collapseMin: number;
  calibration: { distanceKm: number; travelSec: number };
  /** Published debris-speed estimate (m/s), used only as a sanity check. */
  debrisEstimate: number;
  vMin: number;
  decayKm: number;
}

export interface FloodModel {
  readonly totalKm: number;
  readonly debrisSpeed: number;
  readonly consistentWithEstimate: boolean;
  velocity(km: number): number;
  arrivalMin(km: number): number;
  frontKm(tMin: number): number;
  peakStage(km: number): number;
  stage(km: number, tMin: number): number;
  /** Highest stage seen at `km` up to `tMin` (where the flood left its mark). */
  maxStageReached(km: number, tMin: number): number;
}

/** Implied speed may differ from the published estimate by this fraction before we flag it. */
const ESTIMATE_TOLERANCE = 0.25;

/** Surge height model (metres above normal flow). */
const PEAK_NEAR_SOURCE_M = 80;   // reported: settlements up to 80 m above river level were hit
const PEAK_FLOOR_M = 6;
const PEAK_DECAY_KM = 18;
const RISE_MIN = 4;
const RECESSION_TAU_MIN = 35;

const BASELINE_MIN = 8 * 60 + 30; // T0 = 08:30 NPT

export function formatClock(tMin: number): string {
  const total = Math.floor(BASELINE_MIN + tMin);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Closed-form ∫₀ˢ ds / (a + b·e^(−s/L)), in seconds. */
function decayTravelSec(sM: number, v1: number, vMin: number, decayM: number): number {
  const a = vMin, b = v1 - vMin;
  return (sM + decayM * Math.log((a + b * Math.exp(-sM / decayM)) / (a + b))) / a;
}

export function createFloodModel(p: FloodParams): FloodModel {
  const dKm = p.calibration.distanceKm;
  const v1 = (dKm * 1000) / p.calibration.travelSec;
  const decayM = p.decayKm * 1000;

  const travelSec = (km: number) => km <= dKm
    ? (km * 1000) / v1
    : p.calibration.travelSec + decayTravelSec((km - dKm) * 1000, v1, p.vMin, decayM);
  const arrivalMin = (km: number) => p.collapseMin + travelSec(km) / 60;
  const endMin = arrivalMin(p.totalKm);
  const peakStage = (km: number) => PEAK_FLOOR_M + (PEAK_NEAR_SOURCE_M - PEAK_FLOOR_M) * Math.exp(-km / PEAK_DECAY_KM);

  return {
    totalKm: p.totalKm,
    debrisSpeed: v1,
    consistentWithEstimate: Math.abs(v1 - p.debrisEstimate) / p.debrisEstimate <= ESTIMATE_TOLERANCE,
    velocity: km => km <= dKm ? v1 : p.vMin + (v1 - p.vMin) * Math.exp(-((km - dKm) * 1000) / decayM),
    arrivalMin,
    frontKm(tMin) {
      if (tMin <= p.collapseMin) return 0;
      if (tMin >= endMin) return p.totalKm;
      let lo = 0, hi = p.totalKm;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        if (arrivalMin(mid) < tMin) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    },
    peakStage,
    stage(km, tMin) {
      const dt = tMin - arrivalMin(km);
      if (dt <= 0) return 0;
      const peak = peakStage(km);
      if (dt < RISE_MIN) { const x = dt / RISE_MIN; return peak * x * x * (3 - 2 * x); }
      return peak * Math.exp(-(dt - RISE_MIN) / RECESSION_TAU_MIN);
    },
    maxStageReached(km, tMin) {
      const dt = tMin - arrivalMin(km);
      if (dt <= 0) return 0;
      if (dt >= RISE_MIN) return peakStage(km);
      const x = dt / RISE_MIN;
      return peakStage(km) * x * x * (3 - 2 * x);
    },
  };
}
