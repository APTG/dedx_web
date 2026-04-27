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
    return { error: `unknown unit: ${unitStr}` };
  }

  return { value, unit };
}
