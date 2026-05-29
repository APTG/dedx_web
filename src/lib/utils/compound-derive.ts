/**
 * Pure derivations for the compound editor's live UI.
 *
 * These helpers turn a list of `{ atomicNumber, atomCount }` rows into the
 * read-only feedback the editor shows while the user types: per-row mass
 * percentages, a formula string, the total atom count, and a Bragg-additivity
 * I-value preview. They are deliberately free of Svelte runes so they can be
 * unit-tested in isolation and reused by the PDF export path.
 *
 * @packageDocumentation
 */

import { getAtomicWeight, getElementSymbol, getElementIValue } from "./element-data";

/** Subscript digits ₀–₉ for rendering formula counts. */
const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

export interface CompoundElementEntry {
  atomicNumber: number;
  atomCount: number;
}

/** Format an atom count for display: integers as-is, fractions to 2 dp. */
function formatCount(count: number): string {
  return Number.isInteger(count) ? String(count) : count.toFixed(2);
}

/** Render a positive integer as Unicode subscript digits (e.g. 143 → ₁₄₃). */
function toSubscript(value: string): string {
  return value
    .split("")
    .map((ch) => (ch >= "0" && ch <= "9" ? SUBSCRIPTS[Number(ch)] : ch))
    .join("");
}

/**
 * Per-row mass percentage, computed from `atomCount · atomicMass / Σ`.
 *
 * @returns An array aligned by index with `elements`, or `null` when the
 *   composition is empty or contains an element with no known atomic weight.
 */
export function deriveMassPercents(elements: CompoundElementEntry[]): number[] | null {
  if (elements.length === 0) return null;

  const contributions: number[] = [];
  let total = 0;
  for (const { atomicNumber, atomCount } of elements) {
    const weight = getAtomicWeight(atomicNumber);
    if (weight === undefined) return null;
    const contribution = weight * atomCount;
    contributions.push(contribution);
    total += contribution;
  }

  if (total <= 0) return null;
  return contributions.map((c) => (c / total) * 100);
}

/**
 * Build the chemical formula string in list order (the editor keeps rows
 * sorted by ascending Z). Counts of 1 are omitted, matching chemistry
 * convention.
 *
 * @returns `unicode` form with subscript digits (e.g. `H₂O`) and the plain
 *   `ascii` form for the clipboard (e.g. `H2O`).
 */
export function deriveFormulaString(elements: CompoundElementEntry[]): {
  unicode: string;
  ascii: string;
} {
  let unicode = "";
  let ascii = "";
  for (const { atomicNumber, atomCount } of elements) {
    const symbol = getElementSymbol(atomicNumber) ?? `Z${atomicNumber}`;
    const count = formatCount(atomCount);
    const showCount = atomCount !== 1;
    unicode += symbol + (showCount ? toSubscript(count) : "");
    ascii += symbol + (showCount ? count : "");
  }
  return { unicode, ascii };
}

/** Sum of atom counts across all rows. */
export function deriveTotalAtoms(elements: CompoundElementEntry[]): number {
  return elements.reduce((sum, e) => sum + e.atomCount, 0);
}

/**
 * Bragg additivity preview of the compound mean excitation energy:
 *
 *   ln(I) = Σ (nᵢ·Zᵢ·ln(Iᵢ)) / Σ (nᵢ·Zᵢ)
 *
 * This matches the elemental I-values libdedx uses, so it is a faithful
 * preview of the value the WASM layer derives when no override is given.
 *
 * @returns I-value in eV, or `null` if the composition is empty, has no
 *   electrons, or contains an element with no tabulated I-value (Z > 92).
 */
export function deriveBraggIValue(elements: CompoundElementEntry[]): number | null {
  let numerator = 0;
  let denominator = 0;
  for (const { atomicNumber, atomCount } of elements) {
    if (atomCount <= 0) continue;
    const iValue = getElementIValue(atomicNumber);
    if (iValue === undefined) return null;
    const electrons = atomCount * atomicNumber;
    numerator += electrons * Math.log(iValue);
    denominator += electrons;
  }
  if (denominator <= 0) return null;
  return Math.exp(numerator / denominator);
}

/**
 * Rescale a set of weight-fraction values so they sum to exactly 100,
 * preserving each value's relative share.
 *
 * @returns The rescaled values, or the input unchanged when the sum is not
 *   positive (nothing meaningful to scale).
 */
export function rescaleTo100(values: number[]): number[] {
  const sum = values.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) return values;
  return values.map((v) => (v / sum) * 100);
}
