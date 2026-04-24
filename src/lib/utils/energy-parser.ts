/**
 * All energy units that may appear in typed user input, including SI-prefixed
 * variants (eV, keV, GeV) that are not part of the base `EnergyUnit` contract
 * passed to WASM. Use `convertEnergyToMeVperU` to normalise to a base unit
 * before calling the calculation service.
 */
export type EnergySuffixUnit =
  | "eV"
  | "keV"
  | "MeV"
  | "GeV"
  | "MeV/nucl"
  | "GeV/nucl"
  | "keV/nucl"
  | "MeV/u"
  | "GeV/u"
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

const VALID_UNITS: ReadonlySet<string> = new Set([
  "ev",
  "kev",
  "mev",
  "gev",
  "mev/nucl",
  "gev/nucl",
  "kev/nucl",
  "mev/u",
  "gev/u",
  "kev/u",
]);

const UNIT_BASES: ReadonlyMap<string, EnergySuffixUnit> = new Map([
  ["ev", "eV"],
  ["kev", "keV"],
  ["mev", "MeV"],
  ["gev", "GeV"],
  ["mev/nucl", "MeV/nucl"],
  ["gev/nucl", "GeV/nucl"],
  ["kev/nucl", "keV/nucl"],
  ["mev/u", "MeV/u"],
  ["gev/u", "GeV/u"],
  ["kev/u", "keV/u"],
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

  const unitLower = unitStr.toLowerCase();

  if (!VALID_UNITS.has(unitLower)) {
    return { error: `unknown unit: ${unitStr}` };
  }

  const unit = UNIT_BASES.get(unitLower)!;

  return { value, unit };
}
