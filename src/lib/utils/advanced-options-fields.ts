import type { AdvancedOptions } from "$lib/wasm/types";

/** Shape of `AdvancedOptions.interpolation` (always defined here). */
type Interpolation = NonNullable<AdvancedOptions["interpolation"]>;

/** Select-control values for the interpolation axis-scale dropdown. */
export type ScaleSelectValue = "log-log" | "lin-lin";
/** Select-control values for the interpolation method dropdown. */
export type MethodSelectValue = "linear" | "spline";

/** Result of validating a numeric override field (density / I-value). */
export interface FieldValidation {
  valid: boolean;
  parsedValue?: number;
  error?: string;
}

/** Upper bound for the I-value override (eV) — physical maximum. */
const MAX_IVALUE_EV = 10000;

/**
 * Format a density for placeholder / header display: scientific notation
 * below 0.01 g/cm³ (trimming trailing zeros), otherwise 3 decimals.
 */
export function formatDensityForDisplay(value: number): string {
  if (value < 0.01) {
    return value.toExponential(2).replace(/\.?0+e/, "e");
  }
  return value.toFixed(3);
}

/** Placeholder for the density input: the built-in density, or "—" when unknown. */
export function getDensityPlaceholder(materialBuiltInDensity: number | undefined): string {
  if (materialBuiltInDensity === undefined) return "—";
  return formatDensityForDisplay(materialBuiltInDensity);
}

/** Context-sensitive tooltip explaining when/why to override the density. */
export function getDensityTooltip(isCustomCompoundActive: boolean, materialIsGas: boolean): string {
  if (isCustomCompoundActive) {
    return "Custom compounds carry their own density. Edit the compound to change density.";
  }
  if (materialIsGas) {
    return "Gas density depends on pressure and temperature. The built-in value is at standard conditions (STP). Override for non-standard conditions.";
  }
  return "The built-in density is for bulk material at standard conditions. Override for non-standard forms (e.g., powder, pressed pellets, or machined samples).";
}

/** Validate the density override input. Empty is valid (no override). */
export function validateDensity(value: string): FieldValidation {
  if (value === "") return { valid: true };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { valid: false, error: "Enter a numeric value" };
  if (parsed <= 0) return { valid: false, error: "Density must be greater than 0" };
  return { valid: true, parsedValue: parsed };
}

/** Validate the I-value override input. Empty is valid (no override). */
export function validateIValue(value: string): FieldValidation {
  if (value === "") return { valid: true };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { valid: false, error: "Enter a numeric value" };
  if (parsed <= 0) return { valid: false, error: "I-value must be greater than 0" };
  if (parsed > MAX_IVALUE_EV) {
    return { valid: false, error: "I-value exceeds 10 000 eV (physical maximum)" };
  }
  return { valid: true, parsedValue: parsed };
}

/** Accordion header text, appending the active density override when set. */
export function buildHeaderText(densityOverride: number | undefined): string {
  let text = "Advanced Options";
  if (densityOverride !== undefined) {
    text += ` (ρ = ${formatDensityForDisplay(densityOverride)} g/cm³)`;
  }
  return text;
}

/** Map the stored interpolation scale to its select-control value. */
export function scaleToSelectValue(scale: Interpolation["scale"]): ScaleSelectValue {
  return scale === "linear" ? "lin-lin" : "log-log";
}

/** Map the stored interpolation method to its select-control value. */
export function methodToSelectValue(method: Interpolation["method"]): MethodSelectValue {
  return method === "cubic" ? "spline" : "linear";
}

/**
 * Compute the next `interpolation` object after an axis-scale change.
 * "log-log" is the default and drops the scale (returning the bare method, or
 * `undefined` when nothing else remains). Returns `undefined` to mean "no
 * interpolation override".
 */
export function nextInterpolationForScale(
  current: Interpolation | undefined,
  selectValue: string,
): Interpolation | undefined {
  if (selectValue === "lin-lin") {
    return { ...current, scale: "linear" };
  }
  // "log-log" → drop the scale
  if (!current || current.method === undefined) return undefined;
  return { method: current.method };
}

/**
 * Compute the next `interpolation` object after a method change.
 * "linear" is the default and drops the method (keeping any scale, or
 * `undefined` when nothing else remains).
 */
export function nextInterpolationForMethod(
  current: Interpolation | undefined,
  selectValue: string,
): Interpolation | undefined {
  if (selectValue === "spline") {
    return { ...current, method: "cubic" };
  }
  // "linear" → drop the method
  if (!current || current.scale === undefined) return undefined;
  return { scale: current.scale };
}
