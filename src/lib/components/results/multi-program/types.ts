import type { CalculatorState, CalculatedRow } from "$lib/state/calculator.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";

/**
 * Column definition for the result table.
 *
 * Note: column IDs `"energy"` and `"unit"` are **reserved** by the component.
 * For these IDs the cell renderer is fixed (interactive `<input>` for `"energy"`
 * and the per-row unit `<select>`/label for `"unit"`); the `getValue` callback is
 * only used for read-only/display columns. If a future caller needs custom
 * rendering for those positions, extend `ColumnDef` with an explicit `render`
 * hook rather than overloading the reserved IDs.
 */
export interface ColumnDef {
  id: string;
  header: (state: CalculatorState) => string;
  getValue: (
    row: CalculatedRow,
    state: CalculatorState,
    entitySelection: EntitySelectionState,
  ) => string | number | null;
  align?: "left" | "right";
  /**
   * When true, render the cell with a monospaced font. Defaults to `true` for
   * right-aligned columns (numeric values) and `false` for left-aligned ones,
   * but can be overridden per-column (e.g. set to `false` for the Unit column
   * which renders a `<select>`).
   */
  monospace?: boolean;
}
