/**
 * Human-friendly program name utilities.
 *
 * The libdedx C API returns short internal identifiers for stopping power programs
 * (e.g., "ASTAR", "ICRU73_OLD", "BETHE_EXT00", "DEFAULT").
 * This module provides display names that are readable without knowledge of the
 * internal naming conventions.
 */

/**
 * Converts a raw program identifier to a displayable string.
 * Pure alphabetic acronyms (ASTAR, PSTAR, MSTAR, ESTAR) are kept as-is.
 * Names with underscores are converted to title-case with spaces.
 */
export function formatProgramName(rawName: string): string {
  if (!rawName) return rawName;
  if (!rawName.includes("_") && /^[A-Za-z]+$/.test(rawName)) return rawName;
  return rawName
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();
}

/**
 * Override table for program IDs where the raw C identifier is ambiguous or
 * uses non-standard formatting (underscores, numeric suffixes, generic names).
 *
 * Key reasons for an override:
 *  - Numeric suffix: "ICRU73" → "ICRU 73" (space before report number)
 *  - Variant marker:  "ICRU73_OLD" → "ICRU 73 (old)"
 *  - Generic name:    "DEFAULT" → "Default (Bethe)"
 *  - Revision suffix: "BETHE_EXT00" → "Bethe Extended"
 */
export const PROGRAM_NAME_OVERRIDES: ReadonlyMap<number, string> = new Map([
  [5, "ICRU 73 (old)"],
  [6, "ICRU 73"],
  [7, "ICRU 49"],
  [100, "Default (Bethe)"],
  [101, "Bethe Extended"],
]);

/**
 * Returns the human-friendly display name for a program.
 *
 * 1. Checks the override table (covers programs with non-obvious raw names).
 * 2. Falls back to formatProgramName(rawName) for unmapped IDs
 *    (handles pure acronyms like ASTAR, PSTAR, MSTAR, ESTAR unchanged).
 *
 * @param id      libdedx program ID
 * @param rawName Raw name from dedx_get_program_name()
 */
export function getProgramFriendlyName(id: number, rawName: string): string {
  return PROGRAM_NAME_OVERRIDES.get(id) ?? formatProgramName(rawName);
}

/**
 * Short human-readable description of what each program calculates.
 * Used as the subtitle in the program dropdown (e.g., "PSTAR — protons (NIST)").
 *
 * Kept intentionally brief — the full citation lives in docs.
 */
export const PROGRAM_DESCRIPTIONS: ReadonlyMap<number, string> = new Map([
  [1, "α particles (NIST)"],
  [2, "protons (NIST)"],
  [3, "electrons (NIST, N/A)"],
  [4, "heavy ions (parametric)"],
  [5, "heavy ions"],
  [6, "heavy ions, revised"],
  [7, "protons & α particles"],
  [100, "any ion, Bethe formula"],
  [101, "any ion, extended Bethe"],
]);

/**
 * Returns the short human-readable description for a program, or undefined
 * for unknown program IDs.
 */
export function getProgramDescription(id: number): string | undefined {
  return PROGRAM_DESCRIPTIONS.get(id);
}

/**
 * Contextual-help text shown on the per-program "ⓘ" hint in the picker.
 *
 * Unlike {@link PROGRAM_DESCRIPTIONS} (a terse subtitle that says *what* the
 * program covers), this map explains *what + why* — which data source it is and
 * when it is the sensible choice. Wording is kept ≤150 chars and consistent with
 * the PSTAR/ESTAR/ASTAR, MSTAR and ICRU entries in `docs/10-terminology.md`.
 */
export const PROGRAM_HELP: ReadonlyMap<number, string> = new Map([
  [1, "ASTAR — NIST alpha-particle stopping powers (ICRU 49). Use for He-4."],
  [2, "PSTAR — NIST proton stopping powers (ICRU 49). Best for protons in standard materials."],
  [3, "ESTAR — NIST electron data (Berger). Covers all materials; energy entered in MeV."],
  [4, "MSTAR — semi-empirical heavy-ion model (Z>2). Six modes available in Advanced; default B."],
  [5, "ICRU 73 (old) — superseded revision of the ICRU heavy-ion tables; kept for comparison."],
  [6, "ICRU 73 — tabulated heavy-ion (Z>2) stopping powers from ICRU Report 73."],
  [7, "ICRU 49 — ICRU tabulated proton & alpha-particle stopping powers."],
  [100, "Default (Bethe) — analytical Bethe formula for any ion. Use when no table exists."],
  [101, "Bethe Extended — Bethe formula with extended corrections for any ion."],
]);

/**
 * Returns the contextual-help ("what + why") text for a program, or undefined
 * for unknown program IDs.
 */
export function getProgramHelp(id: number): string | undefined {
  return PROGRAM_HELP.get(id);
}
