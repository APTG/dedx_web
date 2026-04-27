import type { EnergyUnit } from "$lib/wasm/types";

const SI_PREFIX_TO_MEV: Record<string, number> = {
  eV: 1e-6,
  keV: 1e-3,
  MeV: 1,
  GeV: 1e3,
  TeV: 1e6,
};

const BASE_UNITS: Record<string, EnergyUnit> = {
  eV: "MeV",
  keV: "MeV",
  MeV: "MeV",
  GeV: "MeV",
  TeV: "MeV",
  "MeV/nucl": "MeV/nucl",
  "GeV/nucl": "MeV/nucl",
  "TeV/nucl": "MeV/nucl",
  "keV/nucl": "MeV/nucl",
  "MeV/u": "MeV/u",
  "GeV/u": "MeV/u",
  "TeV/u": "MeV/u",
  "keV/u": "MeV/u",
};

/**
 * Returns the base unit category ('MeV' | 'MeV/nucl' | 'MeV/u') for any
 * supported energy suffix, including SI-prefixed variants like 'GeV/nucl'
 * or 'TeV/u'. Use this when reasoning about which display unit a row's
 * value should fall into after a particle switch.
 */
export function getEnergyUnitCategory(unit: string): EnergyUnit {
  return getBaseUnit(unit);
}

function getBaseUnit(unit: string): EnergyUnit {
  const base = BASE_UNITS[unit];
  if (base === undefined) {
    throw new Error(`Unsupported energy unit: ${unit}`);
  }
  return base;
}

function getSiPrefixMultiplier(unit: string): number {
  const prefix = unit.replace(/\/nucl$|\/u$/, "");
  const multiplier = SI_PREFIX_TO_MEV[prefix];
  if (multiplier === undefined) {
    throw new Error(`Unsupported energy unit prefix: ${unit}`);
  }
  return multiplier;
}

function normalizeToBaseUnit(value: number, unit: string): { value: number; baseUnit: EnergyUnit } {
  const baseUnit = getBaseUnit(unit);
  const multiplier = getSiPrefixMultiplier(unit);
  return {
    value: value * multiplier,
    baseUnit,
  };
}

export function convertEnergyToMeVperNucl(
  value: number,
  unit: string,
  massNumber: number,
  atomicMass?: number
): number {
  const { value: baseValue, baseUnit } = normalizeToBaseUnit(value, unit);

  const m_u = atomicMass ?? massNumber;

  switch (baseUnit) {
    case "MeV/u":
      return (baseValue * m_u) / massNumber;
    case "MeV":
      return baseValue / massNumber;
    case "MeV/nucl":
      return baseValue;
    default:
      throw new Error(`Unsupported energy unit: ${unit}`);
  }
}

export function convertEnergyFromMeVperU(
  valueMeVperU: number,
  targetUnit: string,
  massNumber: number,
  atomicMass?: number
): number {
  const m_u = atomicMass ?? massNumber;

  let baseValue: number;

  const targetBase = getBaseUnit(targetUnit);

  switch (targetBase) {
    case "MeV/u":
      baseValue = valueMeVperU;
      break;
    case "MeV":
      baseValue = valueMeVperU * m_u;
      break;
    case "MeV/nucl":
      baseValue = (valueMeVperU * m_u) / massNumber;
      break;
    default:
      throw new Error(`Unsupported energy unit: ${targetUnit}`);
  }

  const prefixMultiplier = getSiPrefixMultiplier(targetUnit);
  return baseValue / prefixMultiplier;
}

export function convertEnergyFromMeVperNucl(
  valueMeVperNucl: number,
  targetUnit: string,
  massNumber: number,
  atomicMass?: number
): number {
  const m_u = atomicMass ?? massNumber;

  let baseValue: number;

  const targetBase = getBaseUnit(targetUnit);

  switch (targetBase) {
    case "MeV/nucl":
      baseValue = valueMeVperNucl;
      break;
    case "MeV":
      baseValue = valueMeVperNucl * massNumber;
      break;
    case "MeV/u":
      baseValue = (valueMeVperNucl * massNumber) / m_u;
      break;
    default:
      throw new Error(`Unsupported energy unit: ${targetUnit}`);
  }

  const prefixMultiplier = getSiPrefixMultiplier(targetUnit);
  return baseValue / prefixMultiplier;
}
