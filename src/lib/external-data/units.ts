import type { ExternalEnergyUnit, ExternalStpUnit, ExternalCsdaUnit } from "./schema.js";

/**
 * Convert an energy value from the source unit to MeV total kinetic energy.
 * For per-nucleon units (MeV/nucl, MeV/u), the particle's nucleon count A is required.
 * Assumes A >= 1 for per-nucleon units; if A = 0 (e.g. electrons), returns the value as-is.
 */
export function energyToMev(value: number, unit: ExternalEnergyUnit, particleA: number): number {
  switch (unit) {
    case "MeV":
      return value;
    case "keV":
      return value * 1e-3;
    case "GeV":
      return value * 1e3;
    case "MeV/nucl":
    case "MeV/u":
      return value * (particleA > 0 ? particleA : 1);
  }
}

/**
 * Convert an energy grid from source unit to MeV for a particle with nucleon count A.
 */
export function convertEnergyGrid(
  grid: readonly number[],
  unit: ExternalEnergyUnit,
  particleA: number,
): Float64Array {
  const out = new Float64Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    out[i] = energyToMev(grid[i]!, unit, particleA);
  }
  return out;
}

/**
 * Convert a STP value from the source unit to the internal unit (MeV·cm²/g).
 * Returns null if conversion requires density but density is absent.
 *
 * Conversion factors:
 *   keV/µm → MeV·cm²/g: value * 10 / density
 *   MeV/cm → MeV·cm²/g: value / density
 *   MeV·cm²/g: no conversion
 */
export function stpToInternal(
  value: number,
  unit: ExternalStpUnit,
  density?: number,
): number | null {
  switch (unit) {
    case "MeV·cm²/g":
      return value;
    case "MeV/cm":
      if (density === undefined) return null;
      return value / density;
    case "keV/µm":
      if (density === undefined) return null;
      return (value * 10) / density;
  }
}

/**
 * Convert a CSDA range value from the source unit to the internal unit (g/cm²).
 * Returns null if conversion requires density but density is absent.
 *
 * Conversion:
 *   cm → g/cm²: value * density
 *   g/cm²: no conversion
 */
export function csdaToInternal(
  value: number,
  unit: ExternalCsdaUnit,
  density?: number,
): number | null {
  switch (unit) {
    case "g/cm²":
      return value;
    case "cm":
      if (density === undefined) return null;
      return value * density;
  }
}

/**
 * Convert a full STP column (Float32Array from zarr) to internal units (MeV·cm²/g).
 * Returns null for values that cannot be converted (missing density).
 * Non-finite or non-positive values in the source are converted to null.
 */
export function convertStpColumn(
  raw: Float32Array,
  unit: ExternalStpUnit,
  density?: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i]!;
    if (!Number.isFinite(v)) {
      out[i] = null;
      continue;
    }
    out[i] = stpToInternal(v, unit, density);
  }
  return out;
}

/**
 * Compute a CSDA range column (g/cm²) by trapezoidal integration of 1/S(E)
 * over the energy grid, using already-converted STP values (MeV·cm²/g).
 *
 * Nulls propagate forward: if STP is null or ≤ 0 at either endpoint of a
 * segment, that segment cannot be integrated and all subsequent values are null.
 * CSDA at the lowest energy point is defined as 0.
 */
export function computeCsdaColumn(
  energyGridMev: Float64Array,
  stpValues: (number | null)[],
): (number | null)[] {
  const n = energyGridMev.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return out;

  out[0] = 0;

  for (let i = 1; i < n; i++) {
    const prev = out[i - 1];
    if (prev == null) {
      // Gap in previous segment — cannot continue.
      continue;
    }
    const s0 = stpValues[i - 1];
    const s1 = stpValues[i];
    if (s0 == null || s1 == null || s0 <= 0 || s1 <= 0) {
      // Cannot integrate this segment.
      continue;
    }
    const dE = energyGridMev[i]! - energyGridMev[i - 1]!;
    out[i] = prev + (dE * (1 / s0 + 1 / s1)) / 2;
  }

  return out;
}

/**
 * Convert a full CSDA column to internal units (g/cm²).
 */
export function convertCsdaColumn(
  raw: Float32Array,
  unit: ExternalCsdaUnit,
  density?: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i]!;
    if (!Number.isFinite(v)) {
      out[i] = null;
      continue;
    }
    out[i] = csdaToInternal(v, unit, density);
  }
  return out;
}
