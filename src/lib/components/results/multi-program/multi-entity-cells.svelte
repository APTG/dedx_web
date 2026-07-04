<script lang="ts">
  import { autoScaleLengthCm, formatSigFigs } from "$lib/utils/unit-conversions";
  import { LibdedxError, type CalculationResult } from "$lib/wasm/types";
  import type { CalculatorState, CalculatedRow } from "$lib/state/calculator.svelte";
  import type { MultiEntityState } from "$lib/state/multi-entity.svelte";
  import type { EntityId } from "$lib/external-data/types";

  interface Props {
    row: CalculatedRow;
    rowIndex: number;
    calcState: CalculatorState;
    multiEntityState: MultiEntityState;
    entityIds: EntityId[];
    getEntityDensity: (id: EntityId) => number;
  }

  let { row, rowIndex, calcState, multiEntityState, entityIds, getEntityDensity }: Props = $props();

  const anchorId = $derived(entityIds[0]);

  function stpIndexFor(result: CalculationResult | LibdedxError | undefined): number {
    if (!result || result instanceof LibdedxError || row.normalizedMevNucl === null) return -1;
    return result.energies.findIndex((e) => Math.abs(e - row.normalizedMevNucl!) < 0.0001);
  }
</script>

{#each entityIds as entityId (entityId)}
  {@const isAnchor = entityId === anchorId}
  {@const result = multiEntityState.comparisonResults.get(entityId)}
  {@const density = getEntityDensity(entityId)}
  {@const idx = stpIndexFor(result)}
  <td
    data-entity-id={entityId}
    data-testid={`range-entity-cell-${entityId}-${rowIndex}`}
    class={`px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono ${isAnchor ? "bg-blue-50" : ""}`}
  >
    {#if result instanceof LibdedxError}
      <span title={result.message}>— ⚠️</span>
    {:else if result && idx !== -1 && result.csdaRanges.length > 0}
      {@const csdaGcm2 = result.csdaRanges[idx]!}
      {@const csdaCm = density > 0 ? csdaGcm2 / density : csdaGcm2}
      {@const scaled = autoScaleLengthCm(csdaCm)}
      {formatSigFigs(scaled.value, 4)}
      {scaled.unit}
    {:else}
      —
    {/if}
  </td>
{/each}
{#each entityIds as entityId (entityId)}
  {@const isAnchor = entityId === anchorId}
  {@const result = multiEntityState.comparisonResults.get(entityId)}
  {@const density = getEntityDensity(entityId)}
  {@const idx = stpIndexFor(result)}
  <td
    data-entity-id={entityId}
    data-testid={`stp-entity-cell-${entityId}-${rowIndex}`}
    class={`px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono ${isAnchor ? "bg-blue-50" : ""}`}
  >
    {#if result instanceof LibdedxError}
      <span title={result.message}>— ⚠️</span>
    {:else if result && idx !== -1}
      {@const stpMass = result.stoppingPowers[idx]!}
      {#if calcState.stpDisplayUnit === "keV/µm"}
        {formatSigFigs((stpMass * density) / 10, 4)}
      {:else if calcState.stpDisplayUnit === "MeV/cm"}
        {formatSigFigs(stpMass * density, 4)}
      {:else}
        {formatSigFigs(stpMass, 4)}
      {/if}
    {:else}
      —
    {/if}
  </td>
{/each}
