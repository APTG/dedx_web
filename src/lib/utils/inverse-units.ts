/**
 * Unit-conversion helpers shared by inverse-lookup calculations.
 *
 * - Range units (length) → cm
 * - Stopping-power units → MeV·cm²/g (the canonical unit used internally
 *   by libdedx)
 */

export type RangeUnit = "nm" | "um" | "mm" | "cm" | "m";
export type StpUnit = "kev-um" | "mev-cm" | "mev-cm2-g";

export function rangeUnitToCmFactor(unit: RangeUnit): number {
  switch (unit) {
    case "nm":
      return 1e-7;
    case "um":
      return 1e-4;
    case "mm":
      return 0.1;
    case "cm":
      return 1;
    case "m":
      return 100;
  }
}

export function stpToMevCm2g(value: number, unit: StpUnit, density: number): number {
  switch (unit) {
    case "kev-um":
      // 1 keV/µm = 10 MeV/cm; divide by density
      return (value * 10) / density;
    case "mev-cm":
      return value / density;
    case "mev-cm2-g":
      return value;
  }
}
