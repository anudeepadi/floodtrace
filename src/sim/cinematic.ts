// Cinematic water: rendering-only exaggeration for dramatic effect.
// Never feeds charts, ETAs or the inspector — those always show the modeled values.

export const CINEMATIC_SCALE = 3;
/** Extra height of the breaking front, as a fraction of the scaled peak. */
const BORE_FRACTION = 0.6;
const BORE_LENGTH_KM = 0.8;

/**
 * @param stageM   modeled stage at this point (m)
 * @param behindKm distance behind the wave front (negative = ahead of it)
 * @param peakM    modeled peak stage at this point (m)
 */
export function cinematicStage(stageM: number, behindKm: number, peakM: number): number {
  if (stageM <= 0) return 0;
  const bore = behindKm >= 0 && behindKm < BORE_LENGTH_KM
    ? peakM * CINEMATIC_SCALE * BORE_FRACTION * (1 - behindKm / BORE_LENGTH_KM) ** 2
    : 0;
  return stageM * CINEMATIC_SCALE + bore;
}
