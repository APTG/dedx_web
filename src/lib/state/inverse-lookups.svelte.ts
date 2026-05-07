import type { EntitySelectionState } from "./entity-selection.svelte";
import { advancedOptions, isAdvancedMode } from "./advanced-mode.svelte";
import { getService } from "$lib/wasm/loader";
import { debounce } from "$lib/utils/debounce";

/**
 * Range row for inverse CSDA lookup.
 */
export interface RangeRow {
  id: number;
  text: string;
  /** Parsed numeric value (before unit conversion) */
  value: number | null;
  /** Detected length unit: nm, um, mm, cm, m */
  unit: "nm" | "um" | "mm" | "cm" | "m";
  unitFromSuffix: boolean;
  /** Status after validation */
  status: "valid" | "invalid" | "empty" | "out-of-range";
  message?: string;
  /** Result energy in MeV/nucl (after inverse lookup) */
  energyMevNucl: number | null;
}

/**
 * Inverse STP row for inverse stopping power lookup.
 */
export interface InverseStpRow {
  id: number;
  text: string;
  /** Parsed numeric value */
  value: number | null;
  /** STP input unit */
  unit: "kev-um" | "mev-cm" | "mev-cm2-g";
  status: "valid" | "invalid" | "empty" | "no-solution";
  message?: string;
  /** Result energies in MeV/nucl */
  energyLowMevNucl: number | null;
  energyHighMevNucl: number | null;
}

/**
 * Which inverse tab is active. "forward" means no inverse tab.
 */
export type ActiveTab = "forward" | "csda" | "stp";

export interface InverseLookupState {
  activeTab: ActiveTab;
  rangeRows: RangeRow[];
  stpRows: InverseStpRow[];
  rangeMasterUnit: "cm";
  stpMasterUnit: "kev-um" | "mev-cm" | "mev-cm2-g";
  isCalculating: boolean;
  error: Error | null;
  /** Set active tab ("forward", "csda", "stp") */
  setActiveTab(tab: ActiveTab): void;
  /** Range tab: update row text */
  updateRangeRowText(index: number, text: string): void;
  /** Range tab: set master unit */
  setRangeMasterUnit(unit: "cm"): void;
  /** Range tab: add empty row */
  addRangeRow(): void;
  /** STP tab: update row text */
  updateStpRowText(index: number, text: string): void;
  /** STP tab: set master unit */
  setStpMasterUnit(unit: "kev-um" | "mev-cm" | "mev-cm2-g"): void;
  /** STP tab: add empty row */
  addStpRow(): void;
  /** Reset all inverse state */
  reset(): void;
}

/** Valid length suffixes for Range tab (case-insensitive) */
const LENGTH_SUFFIXES: Record<string, "nm" | "um" | "mm" | "cm" | "m"> = {
  nm: "nm",
  µm: "um",
  um: "um",
  mm: "mm",
  cm: "cm",
  m: "m",
};

/**
 * Parse a range input string like "7.718 cm" or "45 µm".
 * Returns { value, unit, unitFromSuffix } or null if invalid.
 */
export function parseRangeInput(text: string): {
  value: number;
  unit: "nm" | "um" | "mm" | "cm" | "m";
  unitFromSuffix: boolean;
} | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try to find a suffix at the end
  const match = trimmed.match(/^([\d.eE+-]+)\s*([a-zA-Zµ]+)$/);
  if (match) {
    const numStr = match[1];
    const suffix = match[2].toLowerCase();
    const value = parseFloat(numStr);
    if (!Number.isFinite(value) || !(suffix in LENGTH_SUFFIXES)) {
      return null;
    }
    if (value <= 0) {
      return null;
    }
    return {
      value,
      unit: LENGTH_SUFFIXES[suffix],
      unitFromSuffix: true,
    };
  }

  // No suffix - treat as plain number with master unit
  const value = parseFloat(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return {
    value,
    unit: "cm",
    unitFromSuffix: false,
  };
}

/**
 * Parse STP input - just a numeric value, no suffix detection.
 */
export function parseStpInput(text: string): { value: number } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = parseFloat(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return { value };
}

/**
 * Convert range from cm to g/cm² using density.
 */
export function cmToGcm2(rangeCm: number, density: number): number {
  return rangeCm * density;
}

/**
 * Convert STP to MeV·cm²/g (WASM native unit).
 */
export function stpToMevCm2g(
  value: number,
  unit: "kev-um" | "mev-cm" | "mev-cm2-g",
  density: number,
): number {
  switch (unit) {
    case "kev-um":
      // keV/µm → MeV·cm²/g: divide by (10 * density)
      return value / (10 * density);
    case "mev-cm":
      // MeV/cm → MeV·cm²/g: divide by density
      return value / density;
    case "mev-cm2-g":
      return value;
  }
}

let rangeRowIdCounter = 0;
let stpRowIdCounter = 0;

export function createInverseLookupState(
  entitySelection: EntitySelectionState,
): InverseLookupState {
  let activeTab = $state<ActiveTab>("forward");
  let isCalculating = $state(false);
  let error = $state<Error | null>(null);

  const rangeRows = $state<RangeRow[]>([{ id: 0, text: "", value: null, unit: "cm", unitFromSuffix: false, status: "empty", energyMevNucl: null }]);
  const stpRows = $state<InverseStpRow[]>([{ id: 0, text: "", value: null, unit: "kev-um", status: "empty", energyLowMevNucl: null, energyHighMevNucl: null }]);

  let rangeMasterUnit = "cm" as const;
  let stpMasterUnit: "kev-um" | "mev-cm" | "mev-cm2-g" = "kev-um";

  const debouncedRangeCalculation = debounce(async () => {
    await performRangeCalculation();
  }, 300);

  const debouncedStpCalculation = debounce(async () => {
    await performStpCalculation();
  }, 300);

  async function performRangeCalculation(): Promise<void> {
    if (!entitySelection.isComplete) return;

    const service = await getService();
    const programId = entitySelection.resolvedProgramId;
    const particleId = entitySelection.selectedParticle?.id;
    const materialId = entitySelection.selectedMaterial?.id;

    if (programId === null || particleId === null || materialId === null) return;

    const material = entitySelection.selectedMaterial;
    const density =
      (isAdvancedMode.value ? advancedOptions.value.densityOverride : undefined) ??
      material?.density ??
      1;

    if (density <= 0) {
      // Mark all non-empty rows as invalid due to missing density
      for (const row of rangeRows) {
        if (row.text.trim()) {
          row.status = "invalid";
          row.message = "Density not available for this material";
          row.energyMevNucl = null;
        }
      }
      return;
    }

    const validRows = rangeRows.filter(
      (r) => r.status === "valid" || r.status === "out-of-range",
    );
    if (validRows.length === 0) return;

    const rangesGcm2 = validRows.map((r) => cmToGcm2(r.value!, density));

    try {
      const results = service.getInverseCsda({
        programId,
        particleId,
        materialId,
        ranges: rangesGcm2,
        options: isAdvancedMode.value ? advancedOptions.value : undefined,
      });

      let resultIdx = 0;

      for (const row of validRows) {
        const result = results[resultIdx++];
        if (result instanceof Error) {
          row.energyMevNucl = null;
        } else {
          row.energyMevNucl = result.energy;
        }
      }
    } catch (e) {
      error = e instanceof Error ? e : new Error("Range calculation failed");
    }
  }

  async function performStpCalculation(): Promise<void> {
    if (!entitySelection.isComplete) return;

    const service = await getService();
    const programId = entitySelection.resolvedProgramId;
    const particleId = entitySelection.selectedParticle?.id;
    const materialId = entitySelection.selectedMaterial?.id;

    if (programId === null || particleId === null || materialId === null) return;

    const material = entitySelection.selectedMaterial;
    const density =
      (isAdvancedMode.value ? advancedOptions.value.densityOverride : undefined) ??
      material?.density ??
      1;

    const validRows = stpRows.filter((r) => r.status === "valid" || r.status === "no-solution");
    if (validRows.length === 0) return;

    const stpMevCm2g = validRows.map((r) => stpToMevCm2g(r.value!, r.unit, density));

    try {
      // Call for low branch (side=0)
      const lowResults = service.getInverseStp({
        programId,
        particleId,
        materialId,
        stoppingPowers: stpMevCm2g,
        side: 0,
        options: isAdvancedMode.value ? advancedOptions.value : undefined,
      });

      // Call for high branch (side=1)
      const highResults = service.getInverseStp({
        programId,
        particleId,
        materialId,
        stoppingPowers: stpMevCm2g,
        side: 1,
        options: isAdvancedMode.value ? advancedOptions.value : undefined,
      });

      let resultIdx = 0;

      for (const row of validRows) {
        const lowResult = lowResults[resultIdx];
        const highResult = highResults[resultIdx];

        if (lowResult instanceof Error) {
          row.energyLowMevNucl = null;
        } else {
          row.energyLowMevNucl = lowResult.energy;
        }

        if (highResult instanceof Error) {
          row.energyHighMevNucl = null;
        } else {
          row.energyHighMevNucl = highResult.energy;
        }

        resultIdx++;
      }
    } catch (e) {
      error = e instanceof Error ? e : new Error("STP calculation failed");
    }
  }

  function validateRangeRow(row: RangeRow): void {
    const trimmed = row.text.trim();
    if (!trimmed) {
      row.status = "empty";
      row.value = null;
      row.unit = "cm";
      row.unitFromSuffix = false;
      row.message = undefined;
      row.energyMevNucl = null;
      return;
    }

    const parsed = parseRangeInput(trimmed);
    if (!parsed) {
      // Check if it's a negative/zero value
      const negativeMatch = trimmed.match(/^(-?[\d.eE+-]+)\s*([a-zA-Zµ]+)?$/);
      if (negativeMatch) {
        const val = parseFloat(negativeMatch[1]);
        if (!Number.isFinite(val)) {
          row.status = "invalid";
          row.message = "Enter a numeric value";
        } else if (val <= 0) {
          row.status = "invalid";
          row.message = "Range must be positive";
        } else {
          row.status = "invalid";
          row.message = "Unrecognized unit";
        }
      } else {
        row.status = "invalid";
        row.message = "Enter a numeric value";
      }
      row.value = null;
      row.energyMevNucl = null;
      return;
    }

    // Check for unrecognised suffix
    if (parsed.unitFromSuffix) {
      const suffixMatch = trimmed.match(/([a-zA-Zµ]+)$/);
      if (suffixMatch) {
        const suffix = suffixMatch[1].toLowerCase();
        if (!(suffix in LENGTH_SUFFIXES)) {
          row.status = "invalid";
          row.message = `Unrecognized unit '${suffix}'`;
          row.value = null;
          row.energyMevNucl = null;
          return;
        }
      }
    }

    row.value = parsed.value;
    row.unit = parsed.unit;
    row.unitFromSuffix = parsed.unitFromSuffix;
    row.status = "valid";
    row.message = undefined;
  }

  function validateStpRow(row: InverseStpRow): void {
    const trimmed = row.text.trim();
    if (!trimmed) {
      row.status = "empty";
      row.value = null;
      row.message = undefined;
      row.energyLowMevNucl = null;
      row.energyHighMevNucl = null;
      return;
    }

    const parsed = parseStpInput(trimmed);
    if (!parsed) {
      const val = parseFloat(trimmed);
      if (!Number.isFinite(val)) {
        row.status = "invalid";
        row.message = "Enter a numeric value";
      } else if (val <= 0) {
        row.status = "invalid";
        row.message = "Stopping power must be positive";
      } else {
        row.status = "invalid";
        row.message = "Enter a numeric value";
      }
      row.value = null;
      row.energyLowMevNucl = null;
      row.energyHighMevNucl = null;
      return;
    }

    row.value = parsed.value;
    row.status = "valid";
    row.message = undefined;
  }

  return {
    get activeTab() {
      return activeTab;
    },
    get rangeRows() {
      return rangeRows;
    },
    get stpRows() {
      return stpRows;
    },
    get rangeMasterUnit() {
      return rangeMasterUnit;
    },
    get stpMasterUnit() {
      return stpMasterUnit;
    },
    get isCalculating() {
      return isCalculating;
    },
    get error() {
      return error;
    },
    setActiveTab(tab: ActiveTab) {
      activeTab = tab;
    },
    updateRangeRowText(index: number, text: string) {
      const row = rangeRows[index];
      if (!row) return;
      row.text = text;
      validateRangeRow(row);

      // Check if any row has explicit suffix → per-row mode
      const hasExplicitSuffix = rangeRows.some((r) => r.unitFromSuffix);
      if (hasExplicitSuffix) {
        rangeMasterUnit = "cm"; // Keep master unit but disable its meaning
      }

      debouncedRangeCalculation();
    },
    setRangeMasterUnit(_unit: "cm") {
      // Range master unit is always cm - this is a no-op but kept for API consistency
    },
    addRangeRow() {
      const newRow: RangeRow = {
        id: ++rangeRowIdCounter,
        text: "",
        value: null,
        unit: "cm",
        unitFromSuffix: false,
        status: "empty",
        energyMevNucl: null,
      };
      rangeRows.push(newRow);
    },
    updateStpRowText(index: number, text: string) {
      const row = stpRows[index];
      if (!row) return;
      row.text = text;
      validateStpRow(row);
      debouncedStpCalculation();
    },
    setStpMasterUnit(unit: "kev-um" | "mev-cm" | "mev-cm2-g") {
      stpMasterUnit = unit;
      debouncedStpCalculation();
    },
    addStpRow() {
      const newRow: InverseStpRow = {
        id: ++stpRowIdCounter,
        text: "",
        value: null,
        unit: stpMasterUnit,
        status: "empty",
        energyLowMevNucl: null,
        energyHighMevNucl: null,
      };
      stpRows.push(newRow);
    },
    reset() {
      activeTab = "forward";
      rangeRows.length = 0;
      rangeRows.push({
        id: ++rangeRowIdCounter,
        text: "",
        value: null,
        unit: "cm",
        unitFromSuffix: false,
        status: "empty",
        energyMevNucl: null,
      });
      stpRows.length = 0;
      stpRows.push({
        id: ++stpRowIdCounter,
        text: "",
        value: null,
        unit: "kev-um",
        status: "empty",
        energyLowMevNucl: null,
        energyHighMevNucl: null,
      });
      isCalculating = false;
      error = null;
    },
  };
}
