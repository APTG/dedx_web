/**
 * Shared helper for which `EnergyUnit` options should be offered in any
 * unit selector (the master `EnergyUnitSelector` on the calculator
 * route, the per-row dropdowns inside `ResultTable`).
 *
 * Keeping this in one place avoids drift between the two selectors —
 * before this helper existed the master selector was missing the
 * Advanced-mode `MeV/u` entry that `ResultTable` already offered, so
 * `MeV/u` could never be picked as the master unit.
 */
import type { EnergyUnit, ParticleEntity } from "$lib/wasm/types";

export function getAvailableEnergyUnits(
  particle: ParticleEntity | null | undefined,
  advancedMode: boolean,
): EnergyUnit[] {
  if (!particle) return ["MeV"];

  const isElectron = particle.id === 1001;
  const isProton = particle.massNumber === 1 && !isElectron;
  if (isElectron || isProton) return ["MeV"];

  if (advancedMode) {
    return ["MeV", "MeV/nucl", "MeV/u"];
  }
  return ["MeV", "MeV/nucl"];
}
