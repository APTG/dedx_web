import { getAvailableEnergyUnits } from "$lib/utils/available-units";
import { ENERGY_UNIT_HELP } from "$lib/config/help-text";
import type { EnergyUnit } from "$lib/wasm/types";

/**
 * Short hover-tooltip copy for the energy unit strip, sourced from the
 * contextual-help registry so the wording stays in sync with the ⓘ hints and
 * the glossary (`docs/10-terminology.md`).
 */
export const ENERGY_UNIT_TOOLTIPS: Record<EnergyUnit, string> = {
  MeV: ENERGY_UNIT_HELP.MeV.text,
  "MeV/nucl": ENERGY_UNIT_HELP["MeV/nucl"].text,
  "MeV/u": ENERGY_UNIT_HELP["MeV/u"].text,
};

export interface EnergyAnchorOption {
  value: string;
  label: string;
  tooltip: string;
  sub?: string;
}

/**
 * Build the option list for the energy unit anchor strip.
 *
 * Adds a "(≠MeV)" sub-label to MeV/u for protons in Advanced mode, since the
 * conversion factor differs from MeV by ~0.001 in that case and users may not
 * realise the distinction matters.
 */
export function getEnergyAnchorOptions(
  particle: { id: number | string; massNumber?: number; A?: number } | null | undefined,
  advancedMode: boolean,
): EnergyAnchorOption[] {
  const units = getAvailableEnergyUnits(
    particle as Parameters<typeof getAvailableEnergyUnits>[0],
    advancedMode,
  );
  const isElectron = particle?.id === 1001;
  const massNumber =
    particle && "massNumber" in particle
      ? particle.massNumber
      : (particle as { A?: number } | null)?.A;
  const isProton = massNumber === 1 && !isElectron;
  return units.map((u) => {
    const opt: EnergyAnchorOption = {
      value: u,
      label: u,
      tooltip: ENERGY_UNIT_TOOLTIPS[u],
    };
    if (u === "MeV/u" && isProton && advancedMode) opt.sub = "(≠MeV)";
    return opt;
  });
}
