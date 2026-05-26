<script lang="ts">
  import type { CalculatorState } from "$lib/state/calculator.svelte";
  import type { ColumnDef } from "./types";

  interface Props {
    columns: ColumnDef[];
    calcState: CalculatorState;
  }

  let { columns, calcState }: Props = $props();
</script>

<thead class="sticky top-0 bg-background">
  <tr>
    {#each columns as col, colIdx (col.id)}
      <th
        scope="col"
        class={`px-2 sm:px-4 py-2 font-medium whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"} ${colIdx === 0 ? "sticky left-0 z-20 bg-background shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)]" : ""}`}
      >
        {col.header(calcState)}
      </th>
    {/each}
  </tr>
</thead>
