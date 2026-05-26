<script lang="ts">
  import type { CalculatorState, CalculatedRow } from "$lib/state/calculator.svelte";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { ColumnDef } from "./types";

  interface Props {
    row: CalculatedRow;
    rowIndex: number;
    columns: ColumnDef[];
    calcState: CalculatorState;
    entitySelection: EntitySelectionState;
  }

  let { row, rowIndex, columns, calcState, entitySelection }: Props = $props();
</script>

{#each columns.slice(3) as col (col.id)}
  {@const useMonospace = col.monospace ?? col.align === "right"}
  <td
    class={`px-2 sm:px-4 py-2 ${col.align === "right" ? "text-right whitespace-nowrap" : ""} ${useMonospace ? "font-mono" : ""}`}
  >
    {#if col.id === "stopping-power"}
      <span data-testid={`stp-cell-${rowIndex}`}>
        {col.getValue(row, calcState, entitySelection)}
      </span>
    {:else if col.id === "csda-range"}
      <span data-testid={`range-cell-${rowIndex}`}>
        {col.getValue(row, calcState, entitySelection)}
      </span>
    {:else}
      {col.getValue(row, calcState, entitySelection)}
    {/if}
  </td>
{/each}
