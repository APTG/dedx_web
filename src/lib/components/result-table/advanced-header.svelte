<script lang="ts">
  import type { CalculatorState } from "$lib/state/calculator.svelte";
  import type { EntityId } from "$lib/external-data/types";
  import {
    draggableColumn,
    type ColumnReorderController,
  } from "$lib/actions/draggable-column.svelte";
  import StpUnitHeaderMenu from "$lib/components/results/stp-unit-header-menu.svelte";
  import type { StpUnit } from "$lib/wasm/types";

  interface Props {
    calcState: CalculatorState;
    visibleProgramIds: EntityId[];
    defaultProgramId: EntityId | null;
    showStp: boolean;
    showCsda: boolean;
    getProgramName: (id: EntityId) => string;
    reorder: ColumnReorderController<EntityId>;
  }

  let {
    calcState,
    visibleProgramIds,
    defaultProgramId,
    showStp,
    showCsda,
    getProgramName,
    reorder,
  }: Props = $props();

  function thClass(programId: EntityId): string {
    const isDefault = programId === defaultProgramId;
    const draggingThis = reorder.draggingId === programId;
    const dropTarget = reorder.dragOverId === programId;
    return [
      "px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap",
      isDefault ? "cursor-not-allowed" : "cursor-grab",
      isDefault
        ? "font-bold bg-blue-50 border-l-2 border-l-blue-500"
        : draggingThis
          ? "opacity-50"
          : "bg-background",
      dropTarget ? "border-l-2 border-l-blue-400" : "",
    ].join(" ");
  }
</script>

<thead class="sticky top-0 z-10 bg-background">
  <tr>
    <th
      scope="col"
      rowspan="2"
      class="sticky left-0 z-20 bg-background shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)] px-2 sm:px-4 py-2 font-medium whitespace-nowrap text-left border-b border-r"
    >
      Energy ({calcState.masterUnit})
    </th>
    <th
      scope="col"
      rowspan="2"
      class="px-2 sm:px-4 py-2 font-medium whitespace-nowrap text-right border-b border-r"
    >
      → MeV/nucl
    </th>
    <th
      scope="col"
      rowspan="2"
      class="px-2 sm:px-4 py-2 font-medium whitespace-nowrap text-right border-b"
    >
      Unit
    </th>
    {#if showStp}
      <th
        scope="colgroup"
        colspan={visibleProgramIds.length}
        class="relative px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
      >
        <StpUnitHeaderMenu
          selected={calcState.stpDisplayUnit}
          onSelect={(u: StpUnit) => calcState.setStpDisplayUnit(u)}
          label="Stopping Power"
          testid="multi-stp-unit"
        />
      </th>
    {/if}
    {#if showCsda}
      <th
        scope="colgroup"
        colspan={visibleProgramIds.length}
        class="px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
      >
        CSDA Range
      </th>
    {/if}
  </tr>
  <tr class="bg-background">
    {#if showStp}
      {#each visibleProgramIds as programId (programId)}
        <th
          scope="col"
          data-program-id={programId}
          class={thClass(programId)}
          use:draggableColumn={{
            id: programId,
            disabled: programId === defaultProgramId,
            draggingId: reorder.draggingId,
            dragOverId: reorder.dragOverId,
            onDragStart: reorder.handleDragStart,
            onDragOver: reorder.handleDragOver,
            onDragLeave: reorder.handleDragLeave,
            onDrop: reorder.handleDrop,
            onDragEnd: reorder.handleDragEnd,
            onKeyDown: reorder.handleKeyDown,
          }}
        >
          {getProgramName(programId)}
          {#if programId === defaultProgramId}
            <span aria-hidden="true">◆</span>
          {/if}
        </th>
      {/each}
    {/if}
    {#if showCsda}
      {#each visibleProgramIds as programId (programId)}
        <th
          scope="col"
          data-program-id={programId}
          class={thClass(programId)}
          use:draggableColumn={{
            id: programId,
            disabled: programId === defaultProgramId,
            draggingId: reorder.draggingId,
            dragOverId: reorder.dragOverId,
            onDragStart: reorder.handleDragStart,
            onDragOver: reorder.handleDragOver,
            onDragLeave: reorder.handleDragLeave,
            onDrop: reorder.handleDrop,
            onDragEnd: reorder.handleDragEnd,
            onKeyDown: reorder.handleKeyDown,
          }}
        >
          {getProgramName(programId)}
          {#if programId === defaultProgramId}
            <span aria-hidden="true">◆</span>
          {/if}
        </th>
      {/each}
    {/if}
  </tr>
</thead>
