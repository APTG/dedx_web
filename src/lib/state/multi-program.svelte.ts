import { LibdedxError, type CalculationResult } from "$lib/wasm/types";

/**
 * Multi-program comparison state for Stage 6 advanced mode.
 * Manages program selection, column visibility, display order, and quantity focus.
 *
 * Spec reference: docs/04-feature-specs/multi-program.md §State Model
 */

export type QuantityFocus = "both" | "stp" | "csda";

export interface MultiProgramState {
  /** Whether advanced mode is active (app-wide, from the action bar toggle). */
  advancedMode: boolean;

  /** Which result quantity groups are visible in the table. */
  quantityFocus: QuantityFocus;

  /**
   * Selected program IDs in advanced mode.
   * In basic mode this is always [resolvedProgramId].
   * The first element is always the auto-selected (default) program.
   */
  selectedProgramIds: number[];

  /**
   * Display order of programs within each column group.
   * The default program is always first. Additional programs can be
   * reordered via drag-and-drop; this order applies to both the
   * stopping power group and the CSDA range group simultaneously.
   */
  programDisplayOrder: number[];

  /**
   * Column visibility per program. Key = programId, value = visible.
   * Hidden columns are not removed — they exist in state but are
   * not rendered (like hidden columns in a spreadsheet).
   */
  columnVisibility: Map<number, boolean>;

  /**
   * Results keyed by programId. Each entry is either a
   * CalculationResult or a LibdedxError (for partial failure).
   */
  comparisonResults: Map<number, CalculationResult | LibdedxError>;

  /** Add a program to the selection (if not already selected). */
  addProgram(programId: number): void;

  /** Remove a program from the selection (cannot remove the default/first program). */
  removeProgram(programId: number): void;

  /** Set the default (auto-selected) program. */
  setDefaultProgram(programId: number): void;

  /** Toggle column visibility for a program. */
  toggleColumnVisibility(programId: number): void;

  /** Reorder programs via drag-and-drop (moves programId to new position). */
  reorderPrograms(programId: number, newPosition: number): void;

  /** Set quantity focus mode. */
  setQuantityFocus(focus: QuantityFocus): void;

  /** Set advanced mode on/off. */
  setAdvancedMode(enabled: boolean): void;

  /** Update comparison results map. */
  setComparisonResults(results: Map<number, CalculationResult | LibdedxError>): void;

  /** Reset all multi-program state to defaults. */
  reset(): void;

  /** Set program display order (for URL restoration). */
  setProgramDisplayOrder(order: number[]): void;

  /** Set selected program IDs (for URL restoration). */
  setSelectedProgramIds(ids: number[]): void;
}

/** Derived state helpers (used by components, not part of the core state) */
export interface MultiProgramDerivedState {
  /** Ordered list of visible program IDs for rendering. */
  visibleProgramIds: number[];

  /** The auto-selected (default/reference) program ID. */
  defaultProgramId: number | null;

  /** True if any selected program returned an error. */
  hasAnyFailedProgram: boolean;

  /** Whether the stopping-power group is currently visible. */
  showStoppingPowerGroup: boolean;

  /** Whether the CSDA-range group is currently visible. */
  showCsdaRangeGroup: boolean;
}

export function createMultiProgramState(): MultiProgramState {
  let advancedMode = $state<boolean>(false);
  let quantityFocus = $state<QuantityFocus>("both");
  let selectedProgramIds = $state<number[]>([]);
  let programDisplayOrder = $state<number[]>([]);
  let columnVisibility = $state<Map<number, boolean>>(new Map());
  let comparisonResults = $state<Map<number, CalculationResult | LibdedxError>>(new Map());

  const state: MultiProgramState = {
    get advancedMode() {
      return advancedMode;
    },

    get quantityFocus() {
      return quantityFocus;
    },

    get selectedProgramIds() {
      return selectedProgramIds;
    },

    get programDisplayOrder() {
      return programDisplayOrder;
    },

    get columnVisibility() {
      return columnVisibility;
    },

    get comparisonResults() {
      return comparisonResults;
    },

    addProgram(programId: number): void {
      if (selectedProgramIds.includes(programId)) {
        return;
      }

      // Add to selection (append to end, after default)
      selectedProgramIds = [...selectedProgramIds, programId];

      // Add to display order (at the end, after default)
      if (!programDisplayOrder.includes(programId)) {
        programDisplayOrder = [...programDisplayOrder, programId];
      }

      // Always reset column visibility to true when (re-)adding a program.
      // This ensures a previously hidden-then-removed program comes back visible
      // when the user adds it again later.
      columnVisibility = new Map(columnVisibility);
      columnVisibility.set(programId, true);
    },

    removeProgram(programId: number): void {
      // Cannot remove the default program (first in list)
      if (selectedProgramIds.length <= 1 && selectedProgramIds[0] === programId) {
        return;
      }

      // Don't allow removing the first program
      if (programId === selectedProgramIds[0]) {
        return;
      }

      selectedProgramIds = selectedProgramIds.filter((id) => id !== programId);
      programDisplayOrder = programDisplayOrder.filter((id) => id !== programId);

      // Remove stale visibility entry so a future addProgram() always starts visible.
      if (columnVisibility.has(programId)) {
        columnVisibility = new Map(columnVisibility);
        columnVisibility.delete(programId);
      }

      // Remove from results
      if (comparisonResults.has(programId)) {
        comparisonResults = new Map(comparisonResults);
        comparisonResults.delete(programId);
      }
    },

    setDefaultProgram(programId: number): void {
      // If program is not selected, add it
      if (!selectedProgramIds.includes(programId)) {
        selectedProgramIds = [programId, ...selectedProgramIds];
      } else {
        // Move to first position
        selectedProgramIds = [programId, ...selectedProgramIds.filter((id) => id !== programId)];
      }

      // Update display order to put default first
      if (!programDisplayOrder.includes(programId)) {
        programDisplayOrder = [programId, ...programDisplayOrder];
      } else {
        programDisplayOrder = [programId, ...programDisplayOrder.filter((id) => id !== programId)];
      }

      // Ensure visibility
      columnVisibility = new Map(columnVisibility);
      columnVisibility.set(programId, true);
    },

    toggleColumnVisibility(programId: number): void {
      // Cannot hide the default program
      if (programId === selectedProgramIds[0]) {
        return;
      }

      const current = columnVisibility.get(programId) ?? true;
      columnVisibility = new Map(columnVisibility);
      columnVisibility.set(programId, !current);
    },

    reorderPrograms(programId: number, newPosition: number): void {
      // Cannot reorder the default program (must stay first)
      if (programId === selectedProgramIds[0]) {
        return;
      }

      // newPosition 0 means "first after default", so actual index is newPosition + 1
      const targetIndex = Math.max(1, newPosition);

      const currentIndex = programDisplayOrder.indexOf(programId);
      if (currentIndex === -1) {
        return;
      }

      // Remove from current position
      const newOrder = programDisplayOrder.filter((id) => id !== programId);

      // Insert at new position (ensure we don't go out of bounds)
      const insertIndex = Math.min(targetIndex, newOrder.length);
      newOrder.splice(insertIndex, 0, programId);

      programDisplayOrder = newOrder;
    },

    setQuantityFocus(focus: QuantityFocus): void {
      quantityFocus = focus;
    },

    setAdvancedMode(enabled: boolean): void {
      advancedMode = enabled;

      if (!enabled) {
        // Reset to single program (keep the default)
        if (selectedProgramIds.length > 0) {
          selectedProgramIds = [selectedProgramIds[0]];
        }
        comparisonResults = new Map();
      }
    },

    setComparisonResults(results: Map<number, CalculationResult | LibdedxError>): void {
      comparisonResults = new Map(results);
    },

    reset(): void {
      advancedMode = false;
      quantityFocus = "both";
      selectedProgramIds = [];
      programDisplayOrder = [];
      columnVisibility = new Map();
      comparisonResults = new Map();
    },

    setProgramDisplayOrder(order: number[]): void {
      programDisplayOrder = order;
    },

    setSelectedProgramIds(ids: number[]): void {
      selectedProgramIds = ids;
    },
  };

  return state;
}

/**
 * Compute derived state from MultiProgramState.
 * This is a pure function that should be called from component computed properties.
 */
export function computeMultiProgramDerived(state: MultiProgramState): MultiProgramDerivedState {
  const visibleProgramIds = state.programDisplayOrder.filter(
    (id) => state.columnVisibility.get(id) !== false,
  );

  const defaultProgramId = state.selectedProgramIds[0] ?? null;

  const hasAnyFailedProgram = Array.from(state.comparisonResults.values()).some(
    (r) => r instanceof LibdedxError,
  );

  const showStoppingPowerGroup = state.quantityFocus === "both" || state.quantityFocus === "stp";

  const showCsdaRangeGroup = state.quantityFocus === "both" || state.quantityFocus === "csda";

  return {
    visibleProgramIds,
    defaultProgramId,
    hasAnyFailedProgram,
    showStoppingPowerGroup,
    showCsdaRangeGroup,
  };
}

/**
 * URL encoding helpers for multi-program state.
 */
export interface MultiProgramUrlParams {
  mode?: "advanced" | "basic";
  programs?: string; // comma-separated program IDs in display order
  hidden_programs?: string; // comma-separated hidden program IDs
  qfocus?: "both" | "stp" | "csda";
}

export function encodeMultiProgramUrl(state: MultiProgramState): MultiProgramUrlParams {
  const params: MultiProgramUrlParams = {};

  if (state.advancedMode) {
    params.mode = "advanced";

    if (state.programDisplayOrder.length > 0) {
      params.programs = state.programDisplayOrder.join(",");
    }

    const hiddenIds = state.programDisplayOrder.filter(
      (id) => state.columnVisibility.get(id) === false,
    );
    if (hiddenIds.length > 0) {
      params.hidden_programs = hiddenIds.join(",");
    }

    // Always emit qfocus in advanced mode for consistency
    params.qfocus = state.quantityFocus;
  }

  return params;
}

export function decodeMultiProgramUrl(params: URLSearchParams): Partial<MultiProgramUrlParams> & {
  parsedProgramIds?: number[];
  parsedHiddenIds?: number[];
} {
  const result: MultiProgramUrlParams & {
    parsedProgramIds?: number[];
    parsedHiddenIds?: number[];
  } = {};

  const mode = params.get("mode");
  if (mode === "advanced" || mode === "basic") {
    result.mode = mode;
  }

  const programs = params.get("programs");
  if (programs) {
    result.programs = programs;
    result.parsedProgramIds = programs
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
  }

  const hidden = params.get("hidden_programs");
  if (hidden) {
    result.hidden_programs = hidden;
    result.parsedHiddenIds = hidden
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
  }

  const qfocus = params.get("qfocus") as QuantityFocus | null;
  if (qfocus === "both" || qfocus === "stp" || qfocus === "csda") {
    result.qfocus = qfocus;
  }

  return result;
}
