import type { EntitySelectionState } from "./entity-selection.svelte";

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
  status: "valid" | "invalid" | "empty" | "out-of-range" | "error";
  message?: string | undefined;
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
  status: "valid" | "invalid" | "empty" | "no-solution" | "error";
  message?: string | undefined;
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
  rangeMasterUnit: "nm" | "um" | "mm" | "cm" | "m";
  stpMasterUnit: "kev-um" | "mev-cm" | "mev-cm2-g";
  isCalculating: boolean;
  error: Error | null;
  /** Set active tab ("forward", "csda", "stp") */
  setActiveTab(tab: ActiveTab): void;
  /** Range tab: update row text */
  updateRangeRowText(index: number, text: string): void;
  /** Range tab: set master unit */
  setRangeMasterUnit(unit: "nm" | "um" | "mm" | "cm" | "m"): void;
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

const STRICT_NUMBER_RE = /^[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?$/;
const RANGE_WITH_SUFFIX_RE = /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Zµ]+)$/;

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
  const match = trimmed.match(RANGE_WITH_SUFFIX_RE);
  if (match) {
    const numStr = match[1]!;
    const suffix = match[2]!.toLowerCase();
    const value = parseFloat(numStr);
    const unit = LENGTH_SUFFIXES[suffix];
    if (!Number.isFinite(value) || !unit) {
      return null;
    }
    if (value <= 0) {
      return null;
    }
    return {
      value,
      unit,
      unitFromSuffix: true,
    };
  }

  // No suffix - treat as plain number with master unit
  if (!STRICT_NUMBER_RE.test(trimmed)) {
    return null;
  }
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
  if (!STRICT_NUMBER_RE.test(trimmed)) {
    return null;
  }
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
      // keV/µm → MeV·cm²/g: 1 keV/µm = 10 MeV/cm; divide by density
      return (value * 10) / density;
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
  _entitySelection: EntitySelectionState,
): InverseLookupState {
  // Use $state for arrays and properties that need to be reactive
  // This allows the component to directly use the returned object without wrapping in $state()
  const state = $state<{ activeTab: ActiveTab }>({ activeTab: "forward" });
  const rangeRows = $state<RangeRow[]>([]);
  const stpRows = $state<InverseStpRow[]>([]);
  const meta = $state<{
    rangeMasterUnit: "nm" | "um" | "mm" | "cm" | "m";
    stpMasterUnit: "kev-um" | "mev-cm" | "mev-cm2-g";
    isCalculating: boolean;
    error: Error | null;
  }>({
    rangeMasterUnit: "cm",
    stpMasterUnit: "kev-um",
    isCalculating: false,
    error: null,
  });

  // Initialize with one empty row
  rangeRows.push({
    id: ++rangeRowIdCounter,
    text: "",
    value: null,
    unit: "cm",
    unitFromSuffix: false,
    status: "empty",
    energyMevNucl: null,
  });
  stpRows.push({
    id: ++stpRowIdCounter,
    text: "",
    value: null,
    unit: "kev-um",
    status: "empty",
    energyLowMevNucl: null,
    energyHighMevNucl: null,
  });

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
      const suffixTokenMatch = trimmed.match(/\s*([a-zA-Zµ]+)$/);
      if (suffixTokenMatch) {
        const suffix = suffixTokenMatch[1]!;
        const numberPart = trimmed.slice(0, trimmed.length - suffixTokenMatch[0].length).trim();
        if (!STRICT_NUMBER_RE.test(numberPart)) {
          row.status = "invalid";
          row.message = "Enter a numeric value";
        } else if (parseFloat(numberPart) <= 0) {
          row.status = "invalid";
          row.message = "Range must be positive";
        } else {
          row.status = "invalid";
          row.message = `Unrecognized unit '${suffix}'`;
        }
      } else {
        if (!STRICT_NUMBER_RE.test(trimmed)) {
          row.status = "invalid";
          row.message = "Enter a numeric value";
        } else if (parseFloat(trimmed) <= 0) {
          row.status = "invalid";
          row.message = "Range must be positive";
        }
      }
      row.value = null;
      row.energyMevNucl = null;
      return;
    }

    if (parsed.unitFromSuffix) {
      const suffixMatch = trimmed.match(/([a-zA-Zµ]+)$/);
      if (suffixMatch) {
        const suffix = suffixMatch[1]!.toLowerCase();
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
    row.unit = parsed.unitFromSuffix ? parsed.unit : meta.rangeMasterUnit;
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
      if (!STRICT_NUMBER_RE.test(trimmed)) {
        row.status = "invalid";
        row.message = "Enter a numeric value";
      } else if (parseFloat(trimmed) <= 0) {
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
      return state.activeTab;
    },
    set activeTab(v: ActiveTab) {
      state.activeTab = v;
    },
    get rangeRows() {
      return rangeRows;
    },
    get stpRows() {
      return stpRows;
    },
    get rangeMasterUnit() {
      return meta.rangeMasterUnit;
    },
    set rangeMasterUnit(v: "nm" | "um" | "mm" | "cm" | "m") {
      meta.rangeMasterUnit = v;
    },
    get stpMasterUnit() {
      return meta.stpMasterUnit;
    },
    set stpMasterUnit(v: "kev-um" | "mev-cm" | "mev-cm2-g") {
      meta.stpMasterUnit = v;
    },
    get isCalculating() {
      return meta.isCalculating;
    },
    get error() {
      return meta.error;
    },
    set error(v: Error | null) {
      meta.error = v;
    },
    setActiveTab(tab: ActiveTab) {
      state.activeTab = tab;
    },
    updateRangeRowText(index: number, text: string) {
      const row = rangeRows[index];
      if (!row) return;
      row.text = text;
      validateRangeRow(row);

      const hasExplicitSuffix = rangeRows.some((r) => r.unitFromSuffix);
      if (hasExplicitSuffix) {
        meta.rangeMasterUnit = "cm";
      }
    },
    setRangeMasterUnit(unit: "nm" | "um" | "mm" | "cm" | "m") {
      meta.rangeMasterUnit = unit;
      for (const row of rangeRows) {
        if (!row.unitFromSuffix) {
          row.unit = unit;
        }
      }
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
    },
    setStpMasterUnit(unit: "kev-um" | "mev-cm" | "mev-cm2-g") {
      meta.stpMasterUnit = unit;
      for (const row of stpRows) {
        row.unit = unit;
      }
    },
    addStpRow() {
      const newRow: InverseStpRow = {
        id: ++stpRowIdCounter,
        text: "",
        value: null,
        unit: meta.stpMasterUnit,
        status: "empty",
        energyLowMevNucl: null,
        energyHighMevNucl: null,
      };
      stpRows.push(newRow);
    },
    reset() {
      state.activeTab = "forward";
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
      meta.rangeMasterUnit = "cm";
      meta.stpMasterUnit = "kev-um";
      meta.isCalculating = false;
      meta.error = null;
    },
  };
}
