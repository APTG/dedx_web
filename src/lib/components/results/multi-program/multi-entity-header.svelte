<script lang="ts">
  import type { CalculatorState } from "$lib/state/calculator.svelte";
  import type { MultiEntityState } from "$lib/state/multi-entity.svelte";
  import type { EntityId } from "$lib/external-data/types";
  import StpUnitHeaderMenu from "../stp-unit-header-menu.svelte";
  import HelpHint from "$lib/components/help-hint.svelte";
  import type { StpUnit } from "$lib/wasm/types";

  interface Props {
    calcState: CalculatorState;
    multiEntityState: MultiEntityState;
    entityIds: EntityId[];
  }

  let { calcState, multiEntityState, entityIds }: Props = $props();

  const anchorId = $derived(entityIds[0]);
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
    <th
      scope="colgroup"
      colspan={entityIds.length}
      class="relative px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
    >
      <StpUnitHeaderMenu
        selected={calcState.stpDisplayUnit}
        onSelect={(u: StpUnit) => calcState.setStpDisplayUnit(u)}
        label="Stopping Power"
        testid="multi-stp-unit"
      />
    </th>
    <th
      scope="colgroup"
      colspan={entityIds.length}
      class="px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
    >
      <span class="inline-flex items-center gap-1">
        CSDA Range
        <HelpHint
          term="csdaRange"
          side="bottom"
          class="font-normal"
          testId="multi-entity-csda-help"
        />
      </span>
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
