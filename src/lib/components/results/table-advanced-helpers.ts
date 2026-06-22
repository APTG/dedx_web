import type { EnergyUnit } from "$lib/wasm/types";
import { getAvailableEnergyUnits } from "$lib/utils/available-units";

/** Option shape consumed by `UnitAnchorStrip`. */
export interface UnitAnchorOption {
  value: string;
  label: string;
  tooltip: string;
}

/** Range anchor units offered in the inverse (Range → Energy) table. */
export const RANGE_ANCHOR_OPTIONS: UnitAnchorOption[] = [
  { value: "nm", label: "nm", tooltip: "nanometres" },
  { value: "um", label: "µm", tooltip: "micrometres" },
  { value: "mm", label: "mm", tooltip: "millimetres" },
  { value: "cm", label: "cm", tooltip: "centimetres" },
  { value: "m", label: "m", tooltip: "metres" },
];

/** Tooltips for the energy anchor units offered in the forward table. */
export const ENERGY_UNIT_TOOLTIPS: Record<EnergyUnit, string> = {
  MeV: "Megaelectronvolts — total kinetic energy",
  "MeV/nucl": "MeV per nucleon — kinetic energy per nucleon (equals MeV for proton)",
  "MeV/u": "MeV per unified atomic mass unit — differs from MeV by ~0.001 for proton",
};

/**
 * Build the energy anchor options for the selected particle (Advanced mode),
 * mapping each available unit to its label + tooltip.
 */
export function buildEnergyAnchorOptions(
  particle: Parameters<typeof getAvailableEnergyUnits>[0],
): UnitAnchorOption[] {
  return getAvailableEnergyUnits(particle, true).map((u) => ({
    value: u,
    label: u,
    tooltip: ENERGY_UNIT_TOOLTIPS[u as EnergyUnit] ?? u,
  }));
}

/** Tailwind classes for a row input, highlighting error/out-of-range states. */
export function inputClass(status: string): string {
  const isError = status === "invalid" || status === "out-of-range" || status === "error";
  return `w-28 px-2 py-1 border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
    isError ? "border-destructive bg-destructive/5" : "border-input"
  }`;
}

/** Tailwind classes for a result cell (red text when out of range). */
export function cellClass(status: string): string {
  return status === "out-of-range" ? "text-destructive" : "";
}

/** Display label for a range row's unit ("um" → "µm"). */
export function rangeUnitLabel(
  row: { unitFromSuffix: boolean; unit: string },
  masterUnit = "cm",
): string {
  const u = row.unitFromSuffix ? row.unit : masterUnit;
  return u === "um" ? "µm" : u;
}

/** Split pasted clipboard text into trimmed, non-empty lines. */
export function splitPasteLines(text: string): string[] {
  return text
    .split(/\r?\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
}
