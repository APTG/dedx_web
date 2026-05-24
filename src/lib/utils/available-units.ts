/**
 * Shared helper for which `EnergyUnit` options should be offered in any
 * unit selector (the master `UnitAnchorStrip` on the calculator
 * route, the per-row dropdowns inside `ResultTable`).
 *
 * Keeping this in one place avoids drift between the two selectors —
 * before this helper existed the master selector was missing the
 * Advanced-mode `MeV/u` entry that `ResultTable` already offered, so
 * `MeV/u` could never be picked as the master unit.
 */
import type { EnergyUnit, ParticleEntity } from "$lib/wasm/types";

type EnergyUnitParticle = ParticleEntity | { id: number | string; A: number };

export function getAvailableEnergyUnits(
  particle: EnergyUnitParticle | null | undefined,
  advancedMode: boolean,
): EnergyUnit[] {
  if (!particle) return ["MeV"];

  const isElectron = particle.id === 1001;
  const massNumber = "massNumber" in particle ? particle.massNumber : particle.A;
  const isProton = massNumber === 1 && !isElectron;

  if (isElectron) return ["MeV"];

  // Proton: MeV/nucl ≡ MeV numerically, so omit it; MeV/u differs by ~0.001
  if (isProton) return advancedMode ? ["MeV", "MeV/u"] : ["MeV"];

  if (advancedMode) {
    return ["MeV", "MeV/nucl", "MeV/u"];
  }
  return ["MeV", "MeV/nucl"];
}
