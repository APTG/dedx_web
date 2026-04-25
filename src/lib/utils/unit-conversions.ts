/** Convert mass stopping power (MeV·cm²/g) to linear stopping power (keV/µm).
 *  Formula: S_kevum = S_mass × ρ / 10   where ρ in g/cm³.
 *  Returns null when density is missing or ≤ 0. */
export function stpMassToKevUm(stpMass: number, densityGcm3: number): number | null {
  if (densityGcm3 <= 0) return null;
  return (stpMass * densityGcm3) / 10;
}

/** Convert mass stopping power (MeV·cm²/g) to MeV/cm.
 *  Formula: S_linear = S_mass × ρ */
export function stpMassToMeVcm(stpMass: number, densityGcm3: number): number | null {
  if (densityGcm3 <= 0) return null;
  return stpMass * densityGcm3;
}

/** Convert CSDA range from g/cm² to cm.
 *  Formula: range_cm = range_gcm2 / ρ
 *  Returns null when density ≤ 0. */
export function csdaGcm2ToCm(csdaGcm2: number, densityGcm3: number): number | null {
  if (densityGcm3 <= 0) return null;
  return csdaGcm2 / densityGcm3;
}

/** Auto-scale a length in cm to the most human-readable SI prefix.
 *  Returns { value, unit } where unit is one of: 'nm' | 'µm' | 'mm' | 'cm' | 'm'.
 *  Rule: choose prefix so the displayed number is in [1, 9999].
 *  Table:
 *    ≥ 100 cm  → m
 *    ≥ 1 cm    → cm
 *    ≥ 0.1 cm  → mm  (i.e. ≥ 1 mm)
 *    ≥ 1e-4 cm → µm  (i.e. ≥ 1 µm)
 *    < 1e-4 cm → nm
 */
export function autoScaleLengthCm(cm: number): { value: number; unit: 'nm' | 'µm' | 'mm' | 'cm' | 'm' } {
  if (cm >= 100) {
    return { value: cm / 100, unit: 'm' };
  } else if (cm >= 1) {
    return { value: cm, unit: 'cm' };
  } else if (cm >= 0.1) {
    return { value: cm * 10, unit: 'mm' };
  } else if (cm >= 1e-4) {
    return { value: cm * 10000, unit: 'µm' };
  } else {
    return { value: cm * 1e7, unit: 'nm' };
  }
}

/** Format a number to n significant figures, no scientific notation, no grouping separators. */
export function formatSigFigs(value: number, sigFigs: number): string {
  if (value === 0) return '0';
  
  const absValue = Math.abs(value);
  const magnitude = Math.floor(Math.log10(absValue));
  const decimalPlaces = Math.max(0, sigFigs - magnitude - 1);
  
  const multiplier = Math.pow(10, decimalPlaces);
  const rounded = Math.round(value * multiplier) / multiplier;
  
  let formatted = rounded.toFixed(decimalPlaces);
  
  if (formatted.includes('.')) {
    formatted = formatted.replace(/\.?0+$/, '');
  }
  
  return formatted;
}
