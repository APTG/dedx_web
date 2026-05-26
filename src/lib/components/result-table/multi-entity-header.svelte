<script lang="ts">
  import type { CalculatorState } from "$lib/state/calculator.svelte";
  import type { MultiEntityState } from "$lib/state/multi-entity.svelte";
  import type { EntityId } from "$lib/external-data/types";

  interface Props {
    calcState: CalculatorState;
    multiEntityState: MultiEntityState;
    entityIds: EntityId[];
  }

  let { calcState, multiEntityState, entityIds }: Props = $props();

  const anchorId = $derived(entityIds[0]);
</script>

<thead class="sticky top-0 bg-background">
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
    <th
      scope="colgroup"
      colspan={entityIds.length}
      class="px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
    >
      Stopping Power ({calcState.stpDisplayUnit})
    </th>
    <th
      scope="colgroup"
      colspan={entityIds.length}
      class="px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
    >
      CSDA Range
    </th>
  </tr>
  <tr class="bg-background">
    {#each entityIds as entityId (entityId)}
      {@const isAnchor = entityId === anchorId}
      <th
        scope="col"
        class={`px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap ${isAnchor ? "font-bold bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
      >
        {multiEntityState.entityName(entityId) ?? String(entityId)}
        {#if isAnchor}<span aria-hidden="true"> ◆</span>{/if}
      </th>
    {/each}
    {#each entityIds as entityId (entityId)}
      {@const isAnchor = entityId === anchorId}
      <th
        scope="col"
        class={`px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap ${isAnchor ? "font-bold bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
      >
        {multiEntityState.entityName(entityId) ?? String(entityId)}
        {#if isAnchor}<span aria-hidden="true"> ◆</span>{/if}
      </th>
    {/each}
  </tr>
</thead>
