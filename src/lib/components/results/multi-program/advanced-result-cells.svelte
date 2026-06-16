<script lang="ts">
  import { advancedOptions } from "$lib/state/advanced-options.svelte";
  import { autoScaleLengthCm, formatSigFigs } from "$lib/utils/unit-conversions";
  import { computeDelta } from "$lib/utils/delta.js";
  import { LibdedxError, type CalculationResult } from "$lib/wasm/types";
  import type { CalculatorState, CalculatedRow } from "$lib/state/calculator.svelte";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { EntityId } from "$lib/external-data/types";

  interface Props {
    row: CalculatedRow;
    rowIndex: number;
    calcState: CalculatorState;
    entitySelection: EntitySelectionState;
    visibleProgramIds: EntityId[];
    defaultProgramId: EntityId | null;
    defaultProgramName: string;
    comparisonResults: Map<EntityId, CalculationResult | LibdedxError> | undefined;
    showStp: boolean;
    showCsda: boolean;
    hoveredCell: string | null;
    onHover: (key: string | null) => void;
  }

  let {
    row,
    rowIndex,
    calcState,
    entitySelection,
    visibleProgramIds,
    defaultProgramId,
    defaultProgramName,
    comparisonResults,
    showStp,
    showCsda,
    hoveredCell,
    onHover,
  }: Props = $props();

  function selectedDensity(): number {
    return advancedOptions.value.densityOverride ?? entitySelection.selectedMaterial?.density ?? 1;
  }

  function stpDisplayValue(result: CalculationResult | LibdedxError | undefined): number | null {
    if (!result || result instanceof LibdedxError || row.normalizedMevNucl === null) return null;
    const idx = result.energies.findIndex((e) => Math.abs(e - row.normalizedMevNucl!) < 0.0001);
    if (idx === -1) return null;
    const mass = result.stoppingPowers[idx] ?? null;
    if (mass === null) return null;
    const density = selectedDensity();
    if (calcState.stpDisplayUnit === "keV/µm") return (mass * density) / 10;
    if (calcState.stpDisplayUnit === "MeV/cm") return mass * density;
    return mass;
  }

  function csdaDisplayCm(result: CalculationResult | LibdedxError | undefined): number | null {
    if (!result || result instanceof LibdedxError || row.normalizedMevNucl === null) return null;
    const idx = result.energies.findIndex((e) => Math.abs(e - row.normalizedMevNucl!) < 0.0001);
    if (idx === -1) return null;
    const gcm2 = result.csdaRanges[idx] ?? null;
    if (gcm2 === null) return null;
    const density = selectedDensity();
    return density > 0 ? gcm2 / density : gcm2;
  }
</script>

{#if showStp}
  {#each visibleProgramIds as programId (programId)}
    {@const stpDisplay = stpDisplayValue(comparisonResults?.get(programId))}
    {@const defaultResult =
      defaultProgramId !== null ? comparisonResults?.get(defaultProgramId) : undefined}
    {@const defaultStpDisplay = stpDisplayValue(defaultResult)}
    {@const delta =
      programId !== defaultProgramId && stpDisplay !== null && defaultStpDisplay !== null
        ? computeDelta(stpDisplay, defaultStpDisplay, calcState.stpDisplayUnit, defaultProgramName)
        : null}
    {@const stpCellKey = `stp-${programId}-${rowIndex}`}
    {@const stpTooltipId = `delta-desc-${stpCellKey}`}
    <td
      data-program-id={programId}
      data-testid={`stp-cell-${programId}-${rowIndex}`}
      class={`relative px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono ${
        programId === defaultProgramId ? "bg-blue-50" : ""
      }`}
      aria-describedby={delta ? stpTooltipId : undefined}
      onmouseenter={() => onHover(stpCellKey)}
      onmouseleave={() => onHover(null)}
      onfocus={() => onHover(stpCellKey)}
      onblur={() => onHover(null)}
      tabindex="0"
    >
      {#if comparisonResults && comparisonResults.has(programId)}
        {@const result = comparisonResults.get(programId)}
        {#if result instanceof LibdedxError}
          <span title={result.message}>— ⚠️</span>
        {:else if result && row.normalizedMevNucl !== null}
          {#if result.stoppingPowers && result.stoppingPowers.length > 0}
            {#if entitySelection.selectedMaterial}
              {@const density =
                advancedOptions.value.densityOverride ??
                entitySelection.selectedMaterial.density ??
                1}
              {@const stpIndex = result.energies.findIndex(
                (e) => Math.abs(e - row.normalizedMevNucl!) < 0.0001,
              )}
              {#if stpIndex !== -1}
                {@const stpMass = result.stoppingPowers[stpIndex]}
                {#if calcState.stpDisplayUnit === "keV/µm"}
                  {formatSigFigs((stpMass! * density) / 10, 4)}
                {:else if calcState.stpDisplayUnit === "MeV/cm"}
                  {formatSigFigs(stpMass! * density, 4)}
                {:else}
                  {formatSigFigs(stpMass!, 4)}
                {/if}
              {:else}
                —
              {/if}
            {:else}
              {formatSigFigs(result.stoppingPowers[0]!, 4)}
            {/if}
          {:else}
            —
          {/if}
        {:else}
          —
        {/if}
      {:else}
        —
      {/if}
      {#if delta}
        <span id={stpTooltipId} class="sr-only">{delta.label}</span>
        {#if hoveredCell === stpCellKey}
          <div
            data-testid={`delta-tooltip-${stpCellKey}`}
            role="tooltip"
            class="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1
                   rounded bg-popover text-popover-foreground text-xs shadow-md
                   whitespace-nowrap border pointer-events-none"
          >
            {delta.label}
          </div>
        {/if}
      {/if}
    </td>
  {/each}
{/if}
{#if showCsda}
  {#each visibleProgramIds as programId (programId)}
    {@const csdaCm = csdaDisplayCm(comparisonResults?.get(programId))}
    {@const defaultResult =
      defaultProgramId !== null ? comparisonResults?.get(defaultProgramId) : undefined}
    {@const defaultCsdaCm = csdaDisplayCm(defaultResult)}
    {@const csdaDelta =
      programId !== defaultProgramId && csdaCm !== null && defaultCsdaCm !== null
        ? computeDelta(csdaCm, defaultCsdaCm, "cm", defaultProgramName)
        : null}
    {@const csdaCellKey = `csda-${programId}-${rowIndex}`}
    {@const csdaTooltipId = `delta-desc-${csdaCellKey}`}
    <td
      data-program-id={programId}
      data-testid={`range-cell-${programId}-${rowIndex}`}
      class={`relative px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono ${
        programId === defaultProgramId ? "bg-blue-50" : ""
      }`}
      aria-describedby={csdaDelta ? csdaTooltipId : undefined}
      onmouseenter={() => onHover(csdaCellKey)}
      onmouseleave={() => onHover(null)}
      onfocus={() => onHover(csdaCellKey)}
      onblur={() => onHover(null)}
      tabindex="0"
    >
      {#if comparisonResults && comparisonResults.has(programId)}
        {@const result = comparisonResults.get(programId)}
        {#if result instanceof LibdedxError}
          <span title={result.message}>— ⚠️</span>
        {:else if result && row.normalizedMevNucl !== null}
          {#if result.csdaRanges && result.csdaRanges.length > 0}
            {#if entitySelection.selectedMaterial}
              {@const density =
                advancedOptions.value.densityOverride ??
                entitySelection.selectedMaterial.density ??
                1}
              {@const csdaIndex = result.energies.findIndex(
                (e) => Math.abs(e - row.normalizedMevNucl!) < 0.0001,
              )}
              {#if csdaIndex !== -1}
                {@const csdaGcm2 = result.csdaRanges[csdaIndex]}
                {@const csdaCmVal = density > 0 ? csdaGcm2! / density : csdaGcm2!}
                {@const scaled = autoScaleLengthCm(csdaCmVal)}
                {formatSigFigs(scaled.value, 4)}
                {scaled.unit}
              {:else}
                —
              {/if}
            {:else}
              {formatSigFigs(result.csdaRanges[0]!, 4)} cm
            {/if}
          {:else}
            —
          {/if}
        {:else}
          —
        {/if}
      {:else}
        —
      {/if}
      {#if csdaDelta}
        <span id={csdaTooltipId} class="sr-only">{csdaDelta.label}</span>
        {#if hoveredCell === csdaCellKey}
          <div
            data-testid={`delta-tooltip-${csdaCellKey}`}
            role="tooltip"
            class="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1
                   rounded bg-popover text-popover-foreground text-xs shadow-md
                   whitespace-nowrap border pointer-events-none"
          >
            {csdaDelta.label}
          </div>
        {/if}
      {/if}
    </td>
  {/each}
{/if}
