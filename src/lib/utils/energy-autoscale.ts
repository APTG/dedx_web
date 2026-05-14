/**
 * Auto-scale an energy value in MeV to the most human-readable SI prefix.
 * Prefix ladder (from spec §6):
 *   ≥ 1000 MeV → GeV
 *   ≥ 1 MeV    → MeV
 *   ≥ 0.001 MeV → keV
 *   < 0.001 MeV → eV
 *
 * Rule: choose prefix so the displayed numeric value falls in [1.000, 9999].
 *
 * @param valueMev - Energy value in MeV
 * @returns { scaled, prefix } where scaled is the numeric value and prefix is one of: 'eV' | 'keV' | 'MeV' | 'GeV'
 */
export function autoScaleEnergy(valueMev: number): { scaled: number; prefix: string } {
  if (valueMev >= 1000) {
    return { scaled: valueMev / 1000, prefix: "GeV" };
  } else if (valueMev >= 1) {
    return { scaled: valueMev, prefix: "MeV" };
  } else if (valueMev >= 0.001) {
    return { scaled: valueMev * 1000, prefix: "keV" };
  } else {
    return { scaled: valueMev * 1e6, prefix: "eV" };
  }
}

/**
 * Format a number to exactly 4 significant figures, preserving trailing zeros.
 * This is specialized for energy auto-scaling output where we want to show
 * values like "1.000" and "500.0" rather than "1" and "500".
 *
 * @param value - The numeric value to format
 * @returns Formatted string with 4 significant figures
 */
function formatEnergyValue(value: number): string {
  if (!Number.isFinite(value) || Number.isNaN(value)) return "—";
  if (value === 0) return "0";

  const absValue = Math.abs(value);
  const magnitude = Math.floor(Math.log10(absValue));

  // Calculate decimal places needed for 4 significant figures
  const decimalPlaces = Math.max(0, 3 - magnitude);

  // Use toFixed with the calculated decimal places
  return value.toFixed(decimalPlaces);
}

/**
 * Format an energy value with auto-scaled prefix and base unit.
 *
 * @param valueMev - Energy value in MeV
 * @param baseUnit - Base unit string (e.g., 'MeV', 'MeV/nucl', 'MeV/u')
 * @returns Formatted string like '1.200 GeV/nucl' or '500.0 eV'
 *
 * The base unit is transformed by replacing the 'MeV' part with the auto-scaled prefix.
 * For example:
 *   - baseUnit 'MeV' + prefix 'GeV' → 'GeV'
 *   - baseUnit 'MeV/nucl' + prefix 'GeV' → 'GeV/nucl'
 *   - baseUnit 'MeV/u' + prefix 'keV' → 'keV/u'
 */
export function formatEnergyWithUnit(valueMev: number, baseUnit: string): string {
  const { scaled, prefix } = autoScaleEnergy(valueMev);

  // Format to 4 significant figures with trailing zeros
  const formatted = formatEnergyValue(scaled);

  // Transform base unit: replace 'MeV' with the auto-scaled prefix
  // Handle case-insensitively to be robust
  const unitWithPrefix = baseUnit.replace(/MeV/i, prefix);

  return `${formatted} ${unitWithPrefix}`;
}

/**
 * Determine the column header unit string based on auto-scale results from all rows.
 *
 * @param rows - Array of row data with energyMev and autoResult
 * @returns Common prefix unit if all valid rows share the same prefix, else '(auto)'
 *
 * The returned string is just the prefix (e.g., 'MeV', 'keV', 'GeV'),
 * or '(auto)' if rows use mixed prefixes. The caller adds this to the column header.
 */
export function columnHeaderUnit(
  rows: Array<{ energyMev: number; autoResult: { scaled: number; prefix: string } }>,
): string {
  if (rows.length === 0) {
    return "(auto)";
  }

  // Get all unique prefixes from valid rows
  const prefixes = new Set(rows.map((row) => row.autoResult.prefix));

  if (prefixes.size === 1) {
    // All rows share the same prefix
    const prefixesArray = Array.from(prefixes);
    return prefixesArray[0] ?? "(auto)";
  }

  // Mixed prefixes
  return "(auto)";
}
