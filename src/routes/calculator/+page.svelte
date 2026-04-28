<script lang="ts">
  import { wasmReady, isAdvancedMode } from "$lib/state/ui.svelte";
  import { createEntitySelectionState, type EntitySelectionState, type AutoSelectProgram } from "$lib/state/entity-selection.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import { createCalculatorState, type CalculatorState } from "$lib/state/calculator.svelte";
  import EntitySelectionComboboxes from "$lib/components/entity-selection-comboboxes.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import ResultTable from "$lib/components/result-table.svelte";
  import EnergyUnitSelector from "$lib/components/energy-unit-selector.svelte";
  import { Button } from "$lib/components/ui/button";
  import { getService } from "$lib/wasm/loader";
  import { getAvailableEnergyUnits } from "$lib/utils/available-units";
  import { page } from "$app/stores";
  import { replaceState } from "$app/navigation";
  import { decodeCalculatorUrl, encodeCalculatorUrl } from "$lib/utils/calculator-url";

  let state = $state<EntitySelectionState | null>(null);
  let calcState = $state<CalculatorState | null>(null);
  let energyRangeLabel = $state<string>("");
  let urlInitialized = $state(false);

  $effect(() => {
    if (wasmReady.value && !state && !calcState) {
      getService().then((service) => {
        const matrix = buildCompatibilityMatrix(service);
        state = createEntitySelectionState(matrix);
        calcState = createCalculatorState(state, service);

        const urlState = decodeCalculatorUrl($page.url.searchParams);
        if (urlState.particleId !== null) state.selectParticle(urlState.particleId);
        if (urlState.materialId !== null) state.selectMaterial(urlState.materialId);
        if (urlState.programId !== null) state.selectProgram(urlState.programId);
        calcState.setMasterUnit(urlState.masterUnit);
        if ($page.url.searchParams.has("energies")) {
          urlState.rows.forEach((r, i) => {
            const text = r.unitFromSuffix ? `${r.rawInput} ${r.unit}` : r.rawInput;
            if (i === 0) {
              calcState!.updateRowText(0, text);
            } else {
              calcState!.addRow();
              calcState!.updateRowText(i, text);
            }
          });
        }
        urlInitialized = true;
      });
    }
  });

  $effect(() => {
    if (!urlInitialized || !calcState || !state) return;
    const params = encodeCalculatorUrl({
      particleId: state.selectedParticle?.id ?? null,
      materialId: state.selectedMaterial?.id ?? null,
      programId: state.resolvedProgramId,
      rows: calcState.rows,
      masterUnit: calcState.masterUnit,
    });
    replaceState(`${$page.url.pathname}?${params}`, {});
  });

  $effect(() => {
    if (calcState && state?.isComplete) {
      const programId = state.resolvedProgramId;
      const particleId = state.selectedParticle?.id;
      if (programId !== null && particleId !== null) {
        getService().then((service) => {
          const min = service.getMinEnergy(programId, particleId);
          const max = service.getMaxEnergy(programId, particleId);
          energyRangeLabel = `${min.toLocaleString()} – ${max.toLocaleString()} MeV/nucl`;
        });
      }
    }
  });

  let programLabel = $derived.by(() => {
    if (!state) return "";
    const program = state.selectedProgram;
    if (program.id === -1 && (program as AutoSelectProgram).resolvedProgram) {
      return `Results calculated using ${(program as AutoSelectProgram).resolvedProgram!.name} (auto-selected)`;
    } else if (program.id !== -1) {
      return `Results calculated using ${program.name}`;
    }
    return "";
  });
</script>

<svelte:head>
  <title>Calculator - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-bold">Calculator</h1>
    {#if calcState}
      <Button variant="ghost" size="sm" onclick={() => calcState.resetAll()}>
        Restore defaults
      </Button>
    {/if}
  </div>
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
      <EntitySelectionComboboxes {state} onParticleSelect={(particleId) => calcState.switchParticle(particleId)} />
      <EnergyUnitSelector
        value={calcState.masterUnit}
        availableUnits={getAvailableEnergyUnits(state.selectedParticle, isAdvancedMode.value)}
        disabled={calcState.isPerRowMode}
        onValueChange={(unit) => calcState.setMasterUnit(unit)}
      />
      <div class="rounded-lg border bg-card p-6">
        <ResultTable state={calcState} entitySelection={state} />
      </div>
      {#if programLabel}
        <p class="text-sm text-muted-foreground -mt-2">{programLabel}</p>
      {/if}
      {#if state.isComplete && energyRangeLabel}
        <p class="text-xs text-muted-foreground">
          Valid range: {energyRangeLabel}
          ({state.selectedProgram.id === -1
            ? (state.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto"
            : state.selectedProgram.name},
          {state.selectedParticle?.name ?? ""})
        </p>
      {/if}
      {#if calcState?.hasLargeInput}
        <p class="text-sm text-amber-600" role="status">
          Large input ({calcState.rows.filter(r => r.status !== 'empty').length} values).
          Calculation may be slow.
        </p>
      {/if}
    </div>
  {/if}
</div>
