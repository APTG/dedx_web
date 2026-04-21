import type { EnergyUnit } from "../wasm/types";

export function parseEnergyInput(text: string, _unit?: EnergyUnit): number[] {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const energies: number[] = [];

  for (const line of lines) {
    const value = parseFloat(line.trim());
    if (!isNaN(value) && value > 0) {
      energies.push(value);
    }
  }

  return energies;
}

export function convertEnergy(
  value: number,
  fromUnit: EnergyUnit,
  toUnit: EnergyUnit,
  massNumber: number,
  atomicMass: number
): number {
  if (fromUnit === toUnit) return value;
  if (massNumber <= 0 || atomicMass <= 0) return value;

  const toMeV = {
    MeV: (v: number) => v,
    "MeV/nucl": (v: number) => v * massNumber,
    "MeV/u": (v: number) => v * atomicMass
  };

  const fromMeV = {
    MeV: (v: number) => v,
    "MeV/nucl": (v: number) => v / massNumber,
    "MeV/u": (v: number) => v / atomicMass
  };

  const mev = toMeV[fromUnit](value);
  return fromMeV[toUnit](mev);
}
