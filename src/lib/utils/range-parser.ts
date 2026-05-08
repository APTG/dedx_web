/**
 * Parse a length input string with optional suffix.
 * Supported suffixes (case-insensitive): nm, µm/um, mm, cm, m.
 * Returns { value, unit, toCm } for valid inputs,
 *         { error } for unrecognized suffixes or non-numeric input,
 *         { empty } for blank inputs.
 *
 * The toCm factor converts the value to cm:
 *   value_cm = value × toCm
 */
export function parseLengthInput(
  text: string,
):
  | { value: number; unit: string | null; toCm: number | null }
  | { error: string }
  | { empty: true } {
  const trimmed = text.trim();

  // Empty input
  if (trimmed === "") {
    return { empty: true };
  }

  const strictNumberPattern = "[+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?";
  // Regex: number (with optional scientific notation) followed by optional suffix
  // Capture groups: [1] = number, [2] = optional suffix
  const match = trimmed.match(new RegExp(`^(${strictNumberPattern})\\s*([a-zµ]+)?$`, "i"));

  if (!match) {
    return { error: "Enter a numeric value" };
  }

  const [, numStr, suffixRaw] = match;

  // Parse the numeric value
  const value = parseFloat(numStr);
  if (Number.isNaN(value)) {
    return { error: "Enter a numeric value" };
  }

  // No suffix provided
  if (!suffixRaw) {
    return { value, unit: null, toCm: null };
  }

  // Normalize suffix: lowercase, alias um → µm
  const suffix = suffixRaw.toLowerCase() === "um" ? "µm" : suffixRaw.toLowerCase();

  // Supported suffixes with their conversion factors to cm
  const suffixMap: Record<string, number> = {
    nm: 1e-7, // 1 nm = 1e-7 cm
    µm: 1e-4, // 1 µm = 1e-4 cm
    mm: 1e-1, // 1 mm = 0.1 cm
    cm: 1, // 1 cm = 1 cm
    m: 100, // 1 m = 100 cm
  };

  const toCm = suffixMap[suffix];
  if (toCm === undefined) {
    return { error: `Unrecognized unit '${suffixRaw}'` };
  }

  return { value, unit: suffix, toCm };
}
