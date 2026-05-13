/**
 * Piecewise linear interpolation on log-log or lin-lin axes.
 *
 * See docs/04-feature-specs/external-data.md §Q2 (interpolation).
 */

export type InterpolationScale = "log-log" | "lin-lin";

/**
 * Interpolate a value from a 1-D lookup table.
 *
 * @param energyGridMev - Energy grid in MeV, strictly increasing.
 * @param values - Corresponding STP or CSDA values (same length as energyGrid).
 *   Non-finite or non-positive values are treated as missing — null is returned.
 * @param queryEnergyMev - Query energy in MeV.
 * @param scale - Interpolation scale ('log-log' default, or 'lin-lin').
 * @returns Interpolated value, or null for out-of-range or non-finite inputs.
 */
export function interpolate(
  energyGridMev: Float64Array | readonly number[],
  values: Float32Array | readonly number[],
  queryEnergyMev: number,
  scale: InterpolationScale = "log-log",
): number | null {
  const n = energyGridMev.length;
  if (n < 2) return null;
  if (!Number.isFinite(queryEnergyMev) || queryEnergyMev <= 0) return null;

  const eMin = energyGridMev[0]!;
  const eMax = energyGridMev[n - 1]!;

  if (queryEnergyMev < eMin || queryEnergyMev > eMax) return null;

  // Binary search for the bracketing interval.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (energyGridMev[mid]! <= queryEnergyMev) lo = mid;
    else hi = mid;
  }

  const e0 = energyGridMev[lo]!;
  const e1 = energyGridMev[hi]!;
  const v0 = values[lo]!;
  const v1 = values[hi]!;

  if (!Number.isFinite(v0) || !Number.isFinite(v1)) return null;

  if (scale === "log-log") {
    if (e0 <= 0 || e1 <= 0 || v0 <= 0 || v1 <= 0) return null;
    const logE0 = Math.log(e0);
    const logE1 = Math.log(e1);
    const logV0 = Math.log(v0);
    const logV1 = Math.log(v1);
    const t = (Math.log(queryEnergyMev) - logE0) / (logE1 - logE0);
    return Math.exp(logV0 + t * (logV1 - logV0));
  } else {
    // lin-lin
    const t = (queryEnergyMev - e0) / (e1 - e0);
    return v0 + t * (v1 - v0);
  }
}
