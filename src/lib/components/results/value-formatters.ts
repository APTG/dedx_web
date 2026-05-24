import { formatRangeValue, formatStpValue as _formatStpValue } from "$lib/state/calculator.svelte";
import type { StpUnit } from "$lib/wasm/types";
import { formatEnergyWithUnit } from "$lib/utils/energy-autoscale";

/** Format a CSDA range (in cm) as an auto-scaled string with inline SI unit. */
export function formatRangeCm(cm: number): string {
  return formatRangeValue(cm);
}

/** Format a mass-specific stopping power with unit conversion applied. */
export function formatStpValue(value: number, unit: StpUnit): string {
  return _formatStpValue(value, unit);
}

/** Format an energy in MeV/nucl as an auto-scaled string (e.g. "500.0 keV"). */
export function formatEnergy(energyMevNucl: number): string {
  return formatEnergyWithUnit(energyMevNucl, "MeV");
}
