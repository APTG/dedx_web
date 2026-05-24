import { LibdedxError, type CalculationResult } from "$lib/wasm/types";
import type { EntityId } from "$lib/external-data/types";

/**
 * Dimension being compared: materials (fixed particle+program) or
 * particles (fixed material+program).
 */
export type MultiEntityDimension = "material" | "particle";

/**
 * Lightweight comparison state for multi-material or multi-particle mode.
 * `selectedIds` is authoritative for ordered display (sourced from
 * `EntitySelectionState.multiSelected[dimension]`). `comparisonResults` is
 * keyed by entity ID and holds either a full CalculationResult or an error.
 * `entityName` maps IDs back to display strings for column headers.
 */
export interface MultiEntityState {
  dimension: MultiEntityDimension;
  comparisonResults: Map<EntityId, CalculationResult | LibdedxError>;
  entityName: (id: EntityId) => string;
  quantityFocus: "stp" | "range";

  setComparisonResults(results: Map<EntityId, CalculationResult | LibdedxError>): void;
  setQuantityFocus(focus: "stp" | "range"): void;
}

export function createMultiEntityState(
  dimension: MultiEntityDimension,
  nameResolver: (id: EntityId) => string,
): MultiEntityState {
  let comparisonResults = $state<Map<EntityId, CalculationResult | LibdedxError>>(new Map());
  let quantityFocus = $state<"stp" | "range">("stp");

  return {
    get dimension() {
      return dimension;
    },
    get comparisonResults() {
      return comparisonResults;
    },
    get quantityFocus() {
      return quantityFocus;
    },
    entityName(id: EntityId): string {
      return nameResolver(id);
    },
    setComparisonResults(results: Map<EntityId, CalculationResult | LibdedxError>): void {
      comparisonResults = new Map(results);
    },
    setQuantityFocus(focus: "stp" | "range"): void {
      quantityFocus = focus;
    },
  };
}
