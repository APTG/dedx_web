import { SI_PREFIX_TABLE } from "$lib/utils/energy-units";

/**
 * All energy units that may appear in typed user input, including SI-prefixed
 * variants (eV, keV, GeV) that are not part of the base `EnergyUnit` contract
 * passed to WASM. Use `convertEnergyToMeVperNucl` to normalise to MeV/nucl
 * before calling the calculation service.
 */
export type EnergySuffixUnit =
  | "eV"
  | "keV"
  | "MeV"
  | "GeV"
  | "TeV"
  | "MeV/nucl"
  | "GeV/nucl"
  | "TeV/nucl"
  | "keV/nucl"
  | "MeV/u"
  | "GeV/u"
  | "TeV/u"
  | "keV/u";

export interface ParsedEnergy {
  value: number;
  unit: EnergySuffixUnit | null;
}

export interface ParseError {
  error: string;
}

export interface EmptyInput {
  empty: true;
}

export type ParseResult = ParsedEnergy | ParseError | EmptyInput;

/**
 * Canonical SI casing for every accepted unit suffix.
 *
 * Energy units are **case sensitive**: physicists distinguish
 * `MeV` (mega-electron-volt, 10⁶ eV) from `meV` (milli-electron-volt,
 * 10⁻³ eV) — a 10⁹ ratio. Treating them as equivalent is dangerous, so
 * the parser only accepts the canonical SI casing below. Any other
 * casing (e.g. `mev`, `MEV`, `eV/Nucl`, `EV`) is rejected as an
 * unknown unit so the user sees an inline error instead of a silently
 * mis-scaled result.
 *
 * `meV`, `μeV`, `neV` etc. are NOT in this list because libdedx does
 * not operate at sub-eV beam energies; we surface them as "unknown
 * unit" rather than silently accept and underflow the WASM bounds check.
 */
const CANONICAL_UNITS: ReadonlyMap<string, EnergySuffixUnit> = new Map([
  ["eV", "eV"],
  ["keV", "keV"],
  ["MeV", "MeV"],
  ["GeV", "GeV"],
  ["TeV", "TeV"],
  ["MeV/nucl", "MeV/nucl"],
  ["GeV/nucl", "GeV/nucl"],
  ["TeV/nucl", "TeV/nucl"],
  ["keV/nucl", "keV/nucl"],
  ["MeV/u", "MeV/u"],
  ["GeV/u", "GeV/u"],
  ["TeV/u", "TeV/u"],
  ["keV/u", "keV/u"],
]);

/** Verify SI_PREFIX_TABLE has all required keys (compile-time + runtime guard) */
const _requiredPrefixes: Array<keyof typeof SI_PREFIX_TABLE> = ["eV", "keV", "MeV", "GeV", "TeV"];
for (const prefix of _requiredPrefixes) {
  if (SI_PREFIX_TABLE[prefix] === undefined) {
    throw new Error(`SI_PREFIX_TABLE missing required prefix: ${prefix}`);
  }
}

// Units whose case-fold match is ambiguous or confusing — never suggest them.
// eV (electron-volt) uses lowercase 'e' per SI convention; all-caps "EV" is
// ambiguous (sometimes used informally for electron-volts), so we never suggest it.
const NO_SUGGEST: ReadonlySet<string> = new Set(["eV"]);

// Build a case-fold lookup: lowercase(suffix) → canonical unit (if unique).
const TYPO_SUGGESTIONS: ReadonlyMap<string, EnergySuffixUnit> = (() => {
  const m = new Map<string, EnergySuffixUnit>();
  for (const canonical of CANONICAL_UNITS.values()) {
    if (NO_SUGGEST.has(canonical)) continue;
    const lower = canonical.toLowerCase();
    if (m.has(lower)) {
      m.delete(lower); // ambiguous — remove so we never suggest
    } else {
      m.set(lower, canonical);
    }
  }
  return m;
})();

export function parseEnergyInput(raw: string): ParseResult {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { empty: true };
  }

  const numberMatch = trimmed.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Z/]+)?$/);

  if (!numberMatch) {
    return { error: "invalid number" };
  }

  const [, numberStr, unitStr] = numberMatch;
  if (numberStr === undefined) return { error: "invalid number" };
  const value = parseFloat(numberStr);

  if (isNaN(value)) {
    return { error: "invalid number" };
  }

  if (value <= 0) {
    return { error: "must be positive" };
  }

  if (!unitStr) {
    return { value, unit: null };
  }

  // Case-sensitive lookup — see CANONICAL_UNITS doc-comment for rationale.
  const unit = CANONICAL_UNITS.get(unitStr);

  if (!unit) {
    const suggestion = TYPO_SUGGESTIONS.get(unitStr.toLowerCase());
    const hint = suggestion ? ` — did you mean ${suggestion}?` : "";
    return { error: `unknown unit: ${unitStr}${hint}` };
  }

  return { value, unit };
}
