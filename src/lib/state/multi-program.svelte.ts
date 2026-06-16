import { LibdedxError, type CalculationResult } from "$lib/wasm/types";
import type { EntityId } from "$lib/external-data/types";
import { formatEntityIdList, parseEntityIdList } from "$lib/external-data/ids";

/**
 * Multi-program comparison state for Stage 6 advanced mode.
 * Manages program selection, column visibility, display order, and quantity focus.
 *
 * Spec reference: docs/04-feature-specs/multi-program.md §State Model
 */

export type QuantityFocus = "stp" | "range";

export interface MultiProgramState {
  /** Whether advanced mode is active (app-wide, from the action bar toggle). */
  advancedMode: boolean;

  /** Which result quantity groups are visible in the table. */
  quantityFocus: QuantityFocus;

  /**
   * Selected program IDs in advanced mode (built-in numeric or external ExtRef string).
   * In basic mode this is always [resolvedProgramId].
   * The first element is always the auto-selected (default) program.
   */
  selectedProgramIds: EntityId[];

  /**
   * Display order of programs within each column group.
   * The default program is always first. Additional programs can be
   * reordered via drag-and-drop; this order applies to both the
   * stopping power group and the CSDA range group simultaneously.
   */
  programDisplayOrder: EntityId[];

  /**
   * Column visibility per program. Key = programId, value = visible.
   * Hidden columns are not removed — they exist in state but are
   * not rendered (like hidden columns in a spreadsheet).
   */
  columnVisibility: Map<EntityId, boolean>;

  /**
   * Results keyed by programId. Each entry is either a
   * CalculationResult or a LibdedxError (for partial failure).
   */
  comparisonResults: Map<EntityId, CalculationResult | LibdedxError>;

  /** Add a program to the selection (if not already selected). */
  addProgram(programId: EntityId): void;

  /** Remove a program from the selection (cannot remove the default/first program). */
  removeProgram(programId: EntityId): void;

  /** Set the default (auto-selected) program. */
  setDefaultProgram(programId: EntityId): void;

  /** Toggle column visibility for a program. */
  toggleColumnVisibility(programId: EntityId): void;

  /** Reorder programs via drag-and-drop (moves programId to new position). */
  reorderPrograms(programId: EntityId, newPosition: number): void;

  /** Set quantity focus mode. */
  setQuantityFocus(focus: QuantityFocus): void;

  /** Set advanced mode on/off. */
  setAdvancedMode(enabled: boolean): void;

  /** Update comparison results map. */
  setComparisonResults(results: Map<EntityId, CalculationResult | LibdedxError>): void;

  /** Reset all multi-program state to defaults. */
  reset(): void;

  /** Set program display order (for URL restoration). */
  setProgramDisplayOrder(order: EntityId[]): void;

  /** Set selected program IDs (for URL restoration). */
  setSelectedProgramIds(ids: EntityId[]): void;
}

/** Derived state helpers (used by components, not part of the core state) */
export interface MultiProgramDerivedState {
  /** Ordered list of visible program IDs for rendering. */
  visibleProgramIds: EntityId[];

  /** The auto-selected (default/reference) program ID. */
  defaultProgramId: EntityId | null;

  /** True if any selected program returned an error. */
  hasAnyFailedProgram: boolean;

  /** Whether the stopping-power group is currently visible. */
  showStoppingPowerGroup: boolean;

  /** Whether the CSDA-range group is currently visible. */
  showCsdaRangeGroup: boolean;
}

export function createMultiProgramState(): MultiProgramState {
  let advancedMode = $state<boolean>(false);
  let quantityFocus = $state<QuantityFocus>("stp");
  let selectedProgramIds = $state<EntityId[]>([]);
  let programDisplayOrder = $state<EntityId[]>([]);
  let columnVisibility = $state<Map<EntityId, boolean>>(new Map());
  let comparisonResults = $state<Map<EntityId, CalculationResult | LibdedxError>>(new Map());

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

    addProgram(programId: EntityId): void {
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

    removeProgram(programId: EntityId): void {
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

    setDefaultProgram(programId: EntityId): void {
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

    toggleColumnVisibility(programId: EntityId): void {
      // Cannot hide the default program
      if (programId === selectedProgramIds[0]) {
        return;
      }

      const current = columnVisibility.get(programId) ?? true;
      columnVisibility = new Map(columnVisibility);
      columnVisibility.set(programId, !current);
    },

    reorderPrograms(programId: EntityId, newPosition: number): void {
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
          selectedProgramIds = [selectedProgramIds[0]!];
        }
        comparisonResults = new Map();
      }
    },

    setComparisonResults(results: Map<EntityId, CalculationResult | LibdedxError>): void {
      comparisonResults = new Map(results);
    },

    reset(): void {
      advancedMode = false;
      quantityFocus = "stp";
      selectedProgramIds = [];
      programDisplayOrder = [];
      columnVisibility = new Map();
      comparisonResults = new Map();
    },

    setProgramDisplayOrder(order: EntityId[]): void {
      programDisplayOrder = order;
    },

    setSelectedProgramIds(ids: EntityId[]): void {
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

  const showStoppingPowerGroup = state.quantityFocus === "stp";

  const showCsdaRangeGroup = state.quantityFocus === "range";

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
  programs?: string; // ~-separated program IDs in display order (issue #672)
  qshow?: "stp" | "range";
}

export function encodeMultiProgramUrl(state: MultiProgramState): MultiProgramUrlParams {
  const params: MultiProgramUrlParams = {};

  if (state.advancedMode) {
    params.mode = "advanced";

    if (state.programDisplayOrder.length > 0) {
      params.programs = formatEntityIdList(state.programDisplayOrder);
    }

    // Omit qshow when it is the default ("stp") per ADR 006 default-omission rule.
    if (state.quantityFocus !== "stp") {
      params.qshow = state.quantityFocus;
    }
  }

  return params;
}

export function decodeMultiProgramUrl(params: URLSearchParams): Partial<MultiProgramUrlParams> & {
  parsedProgramIds?: number[];
  parsedProgramEntityIds?: EntityId[];
} {
  const result: MultiProgramUrlParams & {
    parsedProgramIds?: number[];
    parsedProgramEntityIds?: EntityId[];
  } = {};

  const mode = params.get("mode");
  if (mode === "advanced" || mode === "basic") {
    result.mode = mode;
  }

  const programs = params.get("programs");
  if (programs) {
    result.programs = programs;
    const entityIds = parseEntityIdList(programs);
    result.parsedProgramEntityIds = entityIds;
    // Backward-compat: numeric-only subset for existing callers.
    result.parsedProgramIds = entityIds.filter((id): id is number => typeof id === "number");
  }

  // Silently drop legacy hidden_programs / hidden params (per #554 / ADR 006).
  // No state is applied — the picker now governs entity visibility.

  // Parse qshow (v2) or migrate legacy qfocus (v1) per ADR 006 migration rules.
  const qshowRaw = params.get("qshow") as QuantityFocus | null;
  const qfocusRaw = params.get("qfocus");
  if (qshowRaw === "stp" || qshowRaw === "range") {
    result.qshow = qshowRaw;
  } else if (!qshowRaw && qfocusRaw) {
    // Legacy migration: qfocus=stp→stp, qfocus=csda→range, qfocus=both→omit (default)
    if (qfocusRaw === "stp") result.qshow = "stp";
    else if (qfocusRaw === "csda") result.qshow = "range";
    // qfocus=both → omit (default, no assignment)
  }

  return result;
}

/**
 * Format a mixed EntityId[] list for the `programs` or `hidden_programs` URL param.
 * Re-exported here so multi-program URL helpers are co-located.
 */
export { parseEntityIdList, formatEntityIdList } from "$lib/external-data/ids";
export type { EntityId } from "$lib/external-data/types";
