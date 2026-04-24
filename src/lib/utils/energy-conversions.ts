import type { EnergyUnit } from "$lib/wasm/types";

const SI_PREFIX_TO_MEV: Record<string, number> = {
  eV: 1e-6,
  keV: 1e-3,
  MeV: 1,
  GeV: 1e3,
};

const BASE_UNITS: Record<string, EnergyUnit> = {
  eV: "MeV",
  keV: "MeV",
  MeV: "MeV",
  GeV: "MeV",
  "MeV/nucl": "MeV/nucl",
  "GeV/nucl": "MeV/nucl",
  "keV/nucl": "MeV/nucl",
  "MeV/u": "MeV/u",
  "GeV/u": "MeV/u",
  "keV/u": "MeV/u",
};

function getBaseUnit(unit: string): EnergyUnit {
  return BASE_UNITS[unit] || "MeV";
}

function getSiPrefixMultiplier(unit: string): number {
  const base = unit.replace(/\/nucl$|\/u$/, "");
  return SI_PREFIX_TO_MEV[base] || 1;
}

function normalizeToBaseUnit(value: number, unit: string): { value: number; baseUnit: EnergyUnit } {
  const baseUnit = getBaseUnit(unit);
  const multiplier = getSiPrefixMultiplier(unit);
  return {
    value: value * multiplier,
    baseUnit,
  };
}

export function convertEnergyToMeVperU(
  value: number,
  unit: string,
  massNumber: number,
  atomicMass?: number
): number {
  const { value: baseValue, baseUnit } = normalizeToBaseUnit(value, unit);

  const m_u = atomicMass ?? massNumber;

  switch (baseUnit) {
    case "MeV/u":
      return baseValue;
    case "MeV":
      return baseValue / m_u;
    case "MeV/nucl":
      return (baseValue * massNumber) / m_u;
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
