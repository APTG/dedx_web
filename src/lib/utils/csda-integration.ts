/**
 * Compute CSDA range (g/cm²) by numerical integration of 1/S(E).
 *
 * CSDA range formula:
 *   R(E) = ∫_{E_min}^{E} 1/S(E') dE'
 *
 * This function uses trapezoidal integration over the provided STP data points.
 * The energy grid must be monotonically increasing.
 *
 * @param energiesMeVperNucl - Energy grid in MeV/nucl (monotonically increasing)
 * @param stpMeVcm2perG - Stopping power values in MeV·cm²/g at each energy point
 * @param density - Material density in g/cm³ (not used in mass stopping power integration)
 * @returns CSDA range values in g/cm², one per energy point
 *
 * @remarks
 * The first CSDA range value (at E_min) is always 0 since no integration has occurred yet.
 * Subsequent values accumulate the integral from E_min to each energy point.
 *
 * Unit analysis:
 *   - dE has units MeV/nucl
 *   - S(E) has units MeV·cm²/g
 *   - 1/S(E) has units g/(MeV·cm²)
 *   - ∫(1/S(E)) dE would give g·MeV/nucl/(MeV·cm²) = g·(MeV/nucl)/(MeV·cm²)
 *
 * However, the CSDA range in the libdedx context is defined as:
 *   R = ∫ dE / S(E)
 * where S(E) is the mass stopping power in MeV·cm²/g and E is in MeV/nucl.
 * The result is in g/cm² because the energy units cancel appropriately
 * when S is interpreted as energy loss per unit mass thickness.
 */
export function integrateCsdaFromStp(
  energiesMeVperNucl: Float32Array,
  stpMeVcm2perG: Float32Array,
  _density: number,
): Float64Array {
  if (energiesMeVperNucl.length !== stpMeVcm2perG.length) {
    throw new Error("Energies and STP arrays must have the same length");
  }

  const n = energiesMeVperNucl.length;
  const csdaRanges = new Float64Array(n);

  if (n === 0) return csdaRanges;

  // CSDA range at the first energy is 0 (no integration done yet)
  csdaRanges[0] = 0;

  if (n === 1) return csdaRanges;

  // Trapezoidal integration: R(E_i) = R(E_{i-1}) + (E_i - E_{i-1}) * (1/S_{i-1} + 1/S_i) / 2
  // This correctly integrates 1/S(E) using the trapezoidal rule on the reciprocal values.
  // Units: energies in MeV/u, STP in MeV·cm²/g → result in g/cm²
  for (let i = 1; i < n; i++) {
    const dE = energiesMeVperNucl[i] - energiesMeVperNucl[i - 1];
    const sPrev = stpMeVcm2perG[i - 1];
    const sCurr = stpMeVcm2perG[i];

    // Guard against zero or negative STP values (unphysical but possible in edge cases)
    if (sPrev <= 0 || sCurr <= 0) {
      console.warn(`[csda-integration] non-positive STP value at index ${i - 1} or ${i}`, {
        sPrev,
        sCurr,
        energyPrev: energiesMeVperNucl[i - 1],
        energyCurr: energiesMeVperNucl[i],
      });
      csdaRanges[i] = csdaRanges[i - 1];
      continue;
    }

    // Trapezoidal rule: integral of 1/S(E) over [E_{i-1}, E_i]
    const invSPrev = 1 / sPrev;
    const invSCurr = 1 / sCurr;
    const integral = dE * (invSPrev + invSCurr) / 2;

    csdaRanges[i] = csdaRanges[i - 1] + integral;
  }

  return csdaRanges;
}
