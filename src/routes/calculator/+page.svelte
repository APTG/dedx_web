<script lang="ts">
  import { wasmReady } from "$lib/state/ui.svelte";
  import { createEntitySelectionState, type EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import { createCalculatorState, type CalculatorState } from "$lib/state/calculator.svelte";
  import EntitySelectionComboboxes from "$lib/components/entity-selection-comboboxes.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import ResultTable from "$lib/components/result-table.svelte";
  import { getService } from "$lib/wasm/loader";

  let state = $state<EntitySelectionState | null>(null);
  let calcState = $state<CalculatorState | null>(null);

  $effect(() => {
    if (wasmReady.value && !state && !calcState) {
      getService().then((service) => {
        const matrix = buildCompatibilityMatrix(service);
        state = createEntitySelectionState(matrix);
        calcState = createCalculatorState(state, service);
      });
    }
  });
</script>

<svelte:head>
  <title>Calculator - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">Calculator</h1>
  <p class="text-muted-foreground">
    Select a particle, material, and program to calculate stopping powers and CSDA ranges.
  </p>

  {#if !wasmReady.value || !state || !calcState}
    <div class="rounded-lg border bg-card p-6 text-center">
      <p class="text-muted-foreground">Loading...</p>
    </div>
  {:else}
    <div class="mx-auto max-w-4xl space-y-6">
      <SelectionLiveRegion {state} />
      <EntitySelectionComboboxes {state} />
      <div class="rounded-lg border bg-card p-6">
        <ResultTable {state} {calcState} entitySelection={state} />
      </div>
    </div>
  {/if}
</div>
