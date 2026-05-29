import type { CompoundElementEntry } from "$lib/state/custom-compounds.svelte";
import { computeAtomCounts, normalizeAtomCounts } from "$lib/utils/element-data";

export interface CompoundPreset {
  name: string;
  shortName: string;
  density: number;
  iValue?: number;
  phase: "gas" | "condensed";
  mode: "formula" | "weight";
  // If mode === "formula", value is atom count.
  // If mode === "weight", value is weight percentage (e.g., 10.13 for 10.13%).
  elements: { atomicNumber: number; value: number }[];
}

export const COMPOUND_PRESETS: CompoundPreset[] = [
  {
    name: "Water",
    shortName: "Water",
    density: 1.0,
    iValue: 75.0,
    phase: "condensed",
    mode: "formula",
    elements: [
      { atomicNumber: 1, value: 2 },
      { atomicNumber: 8, value: 1 },
    ],
  },
  {
    name: "A-150 tissue-equivalent plastic",
    shortName: "A-150",
    density: 1.127,
    iValue: 65.1,
    phase: "condensed",
    mode: "weight",
    elements: [
      { atomicNumber: 1, value: 10.13 },
      { atomicNumber: 6, value: 77.55 },
      { atomicNumber: 7, value: 3.51 },
      { atomicNumber: 8, value: 5.23 },
      { atomicNumber: 9, value: 1.74 },
      { atomicNumber: 20, value: 1.84 },
    ],
  },
  {
    name: "ICRU compact bone",
    shortName: "Bone",
    density: 1.85,
    iValue: 91.9,
    phase: "condensed",
    mode: "weight",
    elements: [
      { atomicNumber: 1, value: 6.4 },
      { atomicNumber: 6, value: 27.8 },
      { atomicNumber: 7, value: 2.7 },
      { atomicNumber: 8, value: 41.0 },
      { atomicNumber: 12, value: 0.2 },
      { atomicNumber: 15, value: 7.0 },
      { atomicNumber: 16, value: 0.2 },
      { atomicNumber: 20, value: 14.7 },
    ],
  },
  {
    name: "ICRU striated muscle",
    shortName: "Muscle",
    density: 1.04,
    iValue: 74.7,
    phase: "condensed",
    mode: "weight",
    elements: [
      { atomicNumber: 1, value: 10.2 },
      { atomicNumber: 6, value: 12.3 },
      { atomicNumber: 7, value: 3.5 },
      { atomicNumber: 8, value: 72.9 },
      { atomicNumber: 11, value: 0.08 },
      { atomicNumber: 12, value: 0.02 },
      { atomicNumber: 15, value: 0.2 },
      { atomicNumber: 16, value: 0.5 },
      { atomicNumber: 19, value: 0.3 },
      { atomicNumber: 20, value: 0.007 },
    ],
  },
  {
    name: "ICRU lung",
    shortName: "Lung",
    density: 0.296,
    iValue: 75.3,
    phase: "condensed",
    mode: "weight",
    elements: [
      { atomicNumber: 1, value: 10.3 },
      { atomicNumber: 6, value: 10.5 },
      { atomicNumber: 7, value: 3.1 },
      { atomicNumber: 8, value: 74.9 },
      { atomicNumber: 11, value: 0.2 },
      { atomicNumber: 15, value: 0.2 },
      { atomicNumber: 16, value: 0.3 },
      { atomicNumber: 17, value: 0.3 },
      { atomicNumber: 19, value: 0.2 },
    ],
  },
  {
    name: "Air (dry)",
    shortName: "Air",
    density: 1.205e-3,
    iValue: 85.7,
    phase: "gas",
    mode: "weight",
    elements: [
      { atomicNumber: 7, value: 75.5 },
      { atomicNumber: 8, value: 23.2 },
      { atomicNumber: 18, value: 1.3 },
    ],
  },
];

export function presetToAtomCounts(preset: CompoundPreset): CompoundElementEntry[] {
  if (preset.mode === "formula") {
    return preset.elements.map((e) => ({ atomicNumber: e.atomicNumber, atomCount: e.value }));
  } else {
    // Convert weight percentages to atom counts
    const wfs = preset.elements.map((e) => ({
      atomicNumber: e.atomicNumber,
      weightFraction: e.value / 100,
    }));
    const atomCounts = computeAtomCounts(wfs);
    if (!atomCounts) {
      throw new Error(`Failed to compute atom counts for preset: ${preset.name}`);
    }
    return normalizeAtomCounts(atomCounts);
  }
}
