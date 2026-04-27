<script lang="ts">
  import { wasmReady } from "$lib/state/ui.svelte";
  import { createEntitySelectionState, type EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import { createCalculatorState, type CalculatorState } from "$lib/state/calculator.svelte";
  import EntitySelectionComboboxes from "$lib/components/entity-selection-comboboxes.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import ResultTable from "$lib/components/result-table.svelte";
  import EnergyUnitSelector from "$lib/components/energy-unit-selector.svelte";
  import { getService } from "$lib/wasm/loader";
  import type { EnergyUnit } from "$lib/wasm/types";

  let state = $state<EntitySelectionState | null>(null);
  let calcState = $state<CalculatorState | null>(null);

  function getAvailableUnits(): EnergyUnit[] {
    if (!state?.selectedParticle) return ["MeV"];
    const particle = state.selectedParticle;
    const isElectron = particle.id === 1001;
    const isProton = particle.massNumber === 1 && !isElectron;
    if (isElectron || isProton) return ["MeV"];
    return ["MeV", "MeV/nucl"];
  }

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
      <EnergyUnitSelector
        value={calcState.masterUnit}
        availableUnits={getAvailableUnits()}
        disabled={calcState.isPerRowMode}
        onValueChange={(unit) => calcState.setMasterUnit(unit)}
      />
      <div class="rounded-lg border bg-card p-6">
        <ResultTable state={calcState} entitySelection={state} />
      </div>
    </div>
  {/if}
</div>
