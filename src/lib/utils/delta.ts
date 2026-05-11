/**
 * Format a number to exactly n significant figures, preserving trailing zeros.
 */
function formatSigFigsFixed(value: number, sigFigs: number): string {
  if (!Number.isFinite(value) || Number.isNaN(value)) return "—";
  if (value === 0) return sigFigs <= 1 ? "0" : `0.${"0".repeat(sigFigs - 1)}`;

  const absValue = Math.abs(value);
  const magnitude = Math.floor(Math.log10(absValue));
  const decimalPlaces = Math.max(0, sigFigs - magnitude - 1);

  return absValue.toFixed(decimalPlaces);
}

/**
 * Compute the absolute and percentage difference between two values.
 *
 * @param displayValue - The value to compare (may be null)
 * @param defaultDisplayValue - The reference/default value (may be null)
 * @param unit - The unit string for the display value (e.g., "keV/µm", "cm")
 * @param defaultName - The name of the default program for the label (e.g., "ICRU 90")
 * @returns An object with delta, pct, and label, or null if inputs are invalid
 */
export function computeDelta(
  displayValue: number | null,
  defaultDisplayValue: number | null,
  unit: string,
  defaultName: string,
): { delta: number; pct: number; label: string } | null {
  // Return null for invalid inputs
  if (displayValue === null || defaultDisplayValue === null || defaultDisplayValue === 0) {
    return null;
  }

  const delta = displayValue - defaultDisplayValue;
  const pct = (delta / defaultDisplayValue) * 100;

  // Use U+2212 (−) for negative, + for positive/zero
  const sign = delta >= 0 ? "+" : "−";
  const absDelta = formatSigFigsFixed(Math.abs(delta), 3);
  const absPct = Math.abs(pct).toFixed(1);

  const label = `Δ = ${sign}${absDelta} ${unit} (${sign}${absPct}% vs ${defaultName})`;

  return { delta, pct, label };
}
