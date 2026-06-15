import { parseEnergyInput } from "$lib/utils/energy-parser";
import {
  convertEnergyToMeVperNucl,
  convertEnergyFromMeVperNucl,
  getEnergyUnitCategory,
} from "$lib/utils/energy-conversions";
import { formatSigFigs } from "$lib/utils/unit-conversions";
import type { EnergyUnit } from "$lib/wasm/types";

/**
 * Minimal mass-bearing shape needed by the per-nucleon conversion helpers.
 * Decoupled from `ParticleEntity` so these functions stay testable with plain
 * object literals and free of any state/WASM dependency.
 */
export interface ParticleMass {
  /** Particle id — only the electron sentinel (1001) is special-cased. */
  id: number;
  massNumber: number;
  atomicMass: number;
}

/**
 * Outcome of parsing + unit-normalising a single energy row, expressed as a
 * discriminated union so callers can map it onto their own row shape without
 * re-deriving the unit/validation fields.
 *
 * - `empty`   — blank input.
 * - `invalid` — unparseable input or an unsupported unit/conversion error.
 * - `valid`   — value successfully normalised to MeV/nucl.
 */
export type RowParseOutcome =
  | { status: "empty"; unit: EnergyUnit; unitFromSuffix: false; normalizedMevNucl: null }
  | {
      status: "invalid";
      unit: EnergyUnit;
      unitFromSuffix: boolean;
      normalizedMevNucl: null;
      message: string;
    }
  | {
      status: "valid";
      unit: EnergyUnit;
      unitFromSuffix: boolean;
      normalizedMevNucl: number;
    };

/**
 * Parse one row's raw text and normalise it to MeV/nucl using the active
 * master unit as the fallback for plain (suffix-less) numbers.
 *
 * Pure: no state, no engine lookups — the caller layers result data and STP
 * conversion on top of a `valid` outcome.
 */
export function parseRowEnergy(
  text: string,
  masterUnit: EnergyUnit,
  particleMassNumber: number,
  particleAtomicMass?: number,
): RowParseOutcome {
  const parsed = parseEnergyInput(text);

  if ("empty" in parsed) {
    return {
      status: "empty",
      unit: masterUnit,
      unitFromSuffix: false,
      normalizedMevNucl: null,
    };
  }

  if ("error" in parsed) {
    return {
      status: "invalid",
      unit: masterUnit,
      unitFromSuffix: false,
      normalizedMevNucl: null,
      message: parsed.error,
    };
  }

  // The parser may return SI-prefixed suffixes (e.g. `GeV`, `TeV/u`) that are
  // not part of the base `EnergyUnit` contract; collapse those to the base
  // display category for the row's `unit` field while keeping the original
  // suffix string for the value conversion below.
  const effectiveUnit: EnergyUnit =
    parsed.unit === "MeV" || parsed.unit === "MeV/nucl" || parsed.unit === "MeV/u"
      ? parsed.unit
      : masterUnit;
  const unitFromSuffix = parsed.unit !== null;

  let normalizedMevNucl: number;
  try {
    normalizedMevNucl = convertEnergyToMeVperNucl(
      parsed.value,
      parsed.unit ?? masterUnit,
      particleMassNumber,
      particleAtomicMass,
    );
  } catch {
    return {
      status: "invalid",
      unit: effectiveUnit,
      unitFromSuffix,
      normalizedMevNucl: null,
      message: "conversion error",
    };
  }

  return {
    status: "valid",
    unit: effectiveUnit,
    unitFromSuffix,
    normalizedMevNucl,
  };
}

/**
 * Rescale one row's text when switching the active particle, conserving the
 * per-nucleon kinetic energy (E_nucl). Returns the new row text, or `null`
 * when the row is blank/unparseable and should be left untouched.
 *
 * Plain numbers (no typed suffix) are interpreted under the active master
 * unit so every row obeys the same "conserve E_nucl across the particle
 * change" rule regardless of whether the user typed an explicit suffix
 * (see PR #379).
 */
export function convertRowTextForNewParticle(
  text: string,
  masterUnit: EnergyUnit,
  oldParticle: ParticleMass,
  newParticle: ParticleMass,
): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;

  const parsed = parseEnergyInput(trimmed);
  if (!("value" in parsed)) return null;

  const oldUnitSuffix: string = parsed.unit ?? masterUnit;
  const oldUnitCategory: EnergyUnit = getEnergyUnitCategory(oldUnitSuffix);

  // Convert to E_nucl (MeV/nucl) to conserve per-nucleon kinetic energy.
  const mevPerNucl = convertEnergyToMeVperNucl(
    parsed.value,
    oldUnitSuffix,
    oldParticle.massNumber,
    oldParticle.atomicMass,
  );

  let newUnit: EnergyUnit;
  // Proton (A=1) and electron always use total MeV display.
  if (newParticle.id === 1001 || newParticle.massNumber === 1) {
    newUnit = "MeV";
  } else if (oldUnitCategory === "MeV/nucl") {
    // Preserve MeV/nucl for heavy ions (A>1).
    newUnit = "MeV/nucl";
  } else if (oldUnitCategory === "MeV/u") {
    // Preserve MeV/u for heavy ions (A>1).
    newUnit = "MeV/u";
  } else {
    newUnit = "MeV";
  }

  let newValue: number;
  if (newParticle.id === 1001) {
    // Electron: use old particle's A to compute total MeV (electron has no nucleons).
    newValue = mevPerNucl * oldParticle.massNumber;
  } else if (newParticle.massNumber === 1) {
    // Proton: E_nucl × 1 = total MeV (same numeric value as E_nucl).
    newValue = mevPerNucl;
  } else {
    // Heavy ion: convert E_nucl back to the new display unit using the new
    // particle's mass data. This is the inverse of the `convertEnergyToMeVperNucl`
    // call above and correctly handles MeV/u (which depends on atomicMass / m_u,
    // not just A).
    newValue = convertEnergyFromMeVperNucl(
      mevPerNucl,
      newUnit,
      newParticle.massNumber,
      newParticle.atomicMass,
    );
  }

  return `${formatSigFigs(newValue, 4)} ${newUnit}`;
}

/**
 * Convert one row's text to a new display unit while preserving the kinetic
 * energy for the current particle. Returns the new row text, or `null` when
 * the row is blank/unparseable and should be left untouched.
 */
export function convertRowTextToUnit(
  text: string,
  masterUnit: EnergyUnit,
  targetUnit: EnergyUnit,
  particleMassNumber: number,
  particleAtomicMass?: number,
): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;

  const parsed = parseEnergyInput(trimmed);
  if (!("value" in parsed)) return null;

  const currentUnit = parsed.unit ?? masterUnit;
  const mevNucl = convertEnergyToMeVperNucl(
    parsed.value,
    currentUnit,
    particleMassNumber,
    particleAtomicMass,
  );
  const converted = convertEnergyFromMeVperNucl(
    mevNucl,
    targetUnit,
    particleMassNumber,
    particleAtomicMass,
  );
  return `${formatSigFigs(converted, 4)} ${targetUnit}`;
}
