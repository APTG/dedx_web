<script lang="ts">
  import { wasmReady } from "$lib/state/ui.svelte";
  import { createEntitySelectionState, type EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import EntitySelectionComboboxes from "$lib/components/entity-selection-comboboxes.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import EnergyInput from "$lib/components/energy-input.svelte";
  import { createEnergyInputState, type EnergyInputState } from "$lib/state/energy-input.svelte";
  import { getService } from "$lib/wasm/loader";

  let state = $state<EntitySelectionState | null>(null);
  let energyState = $state<EnergyInputState | null>(null);

  $effect(() => {
    if (wasmReady.value && !state && !energyState) {
      getService().then((service) => {
        const matrix = buildCompatibilityMatrix(service);
        state = createEntitySelectionState(matrix);
        energyState = createEnergyInputState();
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

  {#if !wasmReady.value || !state}
    <div class="rounded-lg border bg-card p-6 text-center">
      <p class="text-muted-foreground">Loading...</p>
    </div>
  {:else}
    <div class="mx-auto max-w-2xl space-y-6">
      <SelectionLiveRegion {state} />
      <EntitySelectionComboboxes {state} />
      <div class="rounded-lg border bg-card p-6">
        {#if energyState}
          <EnergyInput
            state={energyState}
            particleId={state.selectedParticle?.id}
            particleMassNumber={state.selectedParticle?.massNumber}
            atomicMass={state.selectedParticle?.atomicMass}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>
