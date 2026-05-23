/**
 * Pure-function parsers for range and STP input columns.
 *
 * Input fields accept ASCII-only unit strings. The Greek letter µ cannot
 * be typed on most keyboards — users type `um` for micrometres and
 * `keV/um` for the stopping-power unit. Display labels may use the proper
 * Unicode symbols (µm, keV/µm, MeV·cm²/g).
 *
 * Unit matching is case-insensitive (unlike energy-parser.ts, which is
 * case-sensitive to prevent MeV/meV confusion — range/STP units have no
 * such dangerous case ambiguities).
 */

// Reuse the error/empty shapes from energy-parser so callers handle all
// three result types uniformly.
export interface ParseError {
  error: string;
}

export interface EmptyInput {
  empty: true;
}

// ─── Range ───────────────────────────────────────────────────────────────────

export type RangeUnit = "nm" | "um" | "mm" | "cm" | "m" | "km";

export interface ParsedRange {
  /** Value already normalised to centimetres (the unit WASM expects). */
  valueCm: number;
  /** The unit the user typed, or null if they typed a bare number (→ cm). */
  unit: RangeUnit | null;
}

export type RangeParseResult = ParsedRange | ParseError | EmptyInput;

/** Factors to multiply by to convert each range unit to centimetres. */
const RANGE_TO_CM: ReadonlyMap<RangeUnit, number> = new Map([
  ["nm", 1e-7],
  ["um", 1e-4],
  ["mm", 0.1],
  ["cm", 1],
  ["m", 100],
  ["km", 1e5],
]);

/** Case-fold map: lowercase input token → canonical RangeUnit. */
const RANGE_UNIT_MAP: ReadonlyMap<string, RangeUnit> = new Map(
  [...RANGE_TO_CM.keys()].map((u) => [u.toLowerCase(), u]),
);

/**
 * Parse a user-typed range value.
 *
 * Returns `{ valueCm, unit }` on success, `{ error }` on bad input, or
 * `{ empty: true }` for blank/whitespace-only strings.
 */
export function parseRangeInput(raw: string): RangeParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { empty: true };

  const match = trimmed.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return { error: "invalid number" };

  const [, numStr, unitStr] = match;
  const value = parseFloat(numStr!);

  if (isNaN(value)) return { error: "invalid number" };
  if (value <= 0) return { error: "must be positive" };

  if (!unitStr) {
    // Bare number — caller interprets as default unit (cm)
    return { valueCm: value, unit: null };
  }

  const unit = RANGE_UNIT_MAP.get(unitStr.toLowerCase());
  if (!unit) {
    return { error: `unknown range unit: ${unitStr} — accepted: nm, um, mm, cm, m, km` };
  }

  return { valueCm: value * RANGE_TO_CM.get(unit)!, unit };
}

// ─── STP ─────────────────────────────────────────────────────────────────────

export type STPInputUnit = "keV/um" | "MeV/cm" | "MeV*cm2/g";

export interface ParsedSTP {
  value: number;
  /** The unit the user typed, or null for a bare number (→ column default). */
  unit: STPInputUnit | null;
}

export type STPParseResult = ParsedSTP | ParseError | EmptyInput;

/**
 * Case-fold map: lowercase input token → canonical STPInputUnit.
 *
 * Accepted ASCII variants:
 *   keV/um        → "keV/um"   (linear stopping power in µm)
 *   MeV/cm        → "MeV/cm"   (linear stopping power in cm)
 *   MeV*cm2/g     → "MeV*cm2/g"  (mass stopping power)
 *   MeV*cm^2/g    → "MeV*cm2/g"  (caret exponent alias)
 */
const STP_UNIT_MAP: ReadonlyMap<string, STPInputUnit> = new Map([
  ["kev/um", "keV/um"],
  ["mev/cm", "MeV/cm"],
  ["mev*cm2/g", "MeV*cm2/g"],
  ["mev*cm^2/g", "MeV*cm2/g"],
]);

/**
 * Parse a user-typed STP (stopping power) value.
 *
 * Returns `{ value, unit }` on success, `{ error }` on bad input, or
 * `{ empty: true }` for blank strings.
 *
 * NOTE: converting `keV/um` or `MeV/cm` to the WASM-native `MeV·cm²/g`
 * requires material density — the caller (calculator state) is responsible
 * for that step.
 */
export function parseSTPInput(raw: string): STPParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { empty: true };

  // Unit tokens contain letters, digits, /, *, ^
  const match = trimmed.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Z0-9/*^]+)?$/);
  if (!match) return { error: "invalid number" };

  const [, numStr, unitStr] = match;
  const value = parseFloat(numStr!);

  if (isNaN(value)) return { error: "invalid number" };
  if (value <= 0) return { error: "must be positive" };

  if (!unitStr) {
    return { value, unit: null };
  }

  const unit = STP_UNIT_MAP.get(unitStr.toLowerCase());
  if (!unit) {
    return {
      error: `unknown STP unit: ${unitStr} — accepted: keV/um, MeV/cm, MeV*cm2/g`,
    };
  }

  return { value, unit };
}

// ─── URL token helpers ────────────────────────────────────────────────────────
// Keep the URL layer (hyphen-separated lowercase tokens used in lookups=)
// decoupled from the parser's natural notation.

const STP_TO_URL_TOKEN: ReadonlyMap<STPInputUnit, string> = new Map([
  ["keV/um", "kev-um"],
  ["MeV/cm", "mev-cm"],
  ["MeV*cm2/g", "mev-cm2-g"],
]);

const URL_TOKEN_TO_STP: ReadonlyMap<string, STPInputUnit> = new Map(
  [...STP_TO_URL_TOKEN.entries()].map(([unit, token]) => [token, unit]),
);

/** Convert a `STPInputUnit` to its URL-safe token (e.g. `"keV/um"` → `"kev-um"`). */
export function stpInputUnitToUrlToken(unit: STPInputUnit): string {
  return STP_TO_URL_TOKEN.get(unit)!;
}

/** Convert a URL token back to `STPInputUnit`, or `null` if unrecognised. */
export function urlTokenToSTPInputUnit(token: string): STPInputUnit | null {
  return URL_TOKEN_TO_STP.get(token) ?? null;
}

/** Convert a `RangeUnit` to its URL-safe token (already URL-safe — identity). */
export function rangeUnitToUrlToken(unit: RangeUnit): string {
  return unit;
}

/** Convert a URL token to `RangeUnit`, or `null` if unrecognised. */
export function urlTokenToRangeUnit(token: string): RangeUnit | null {
  return RANGE_UNIT_MAP.get(token.toLowerCase()) ?? null;
}
