<script lang="ts">
  import { autoScaleLengthCm, formatSigFigs } from "$lib/utils/unit-conversions";
  import { LibdedxError, type CalculationResult } from "$lib/wasm/types";
  import type { CalculatorState } from "$lib/state/calculator.svelte";
  import type { EntityId } from "$lib/external-data/types";

  interface Props {
    calcState: CalculatorState;
    entityIds: EntityId[];
    results: Map<EntityId, CalculationResult | LibdedxError>;
    entityName: (id: EntityId) => string;
    quantityFocus: "stp" | "range";
    getDensity: (entityId: EntityId) => number;
  }

  let { calcState, entityIds, results, entityName, quantityFocus, getDensity }: Props = $props();

  function findEnergyIndex(result: CalculationResult, mevNucl: number): number {
    return result.energies.findIndex((e) => Math.abs(e - mevNucl) < 0.0001);
  }

  function formatStp(entityId: EntityId, result: CalculationResult, idx: number): string {
    const stpMass = result.stoppingPowers[idx];
    if (stpMass == null) return "—";
    const density = getDensity(entityId);
    const unit = calcState.stpDisplayUnit;
    if (unit === "keV/µm") return formatSigFigs((stpMass * density) / 10, 4);
    if (unit === "MeV/cm") return formatSigFigs(stpMass * density, 4);
    return formatSigFigs(stpMass, 4);
  }

  function formatRange(entityId: EntityId, result: CalculationResult, idx: number): string {
    if (result.csdaRanges.length === 0) return "—";
    const gcm2 = result.csdaRanges[idx];
    if (gcm2 == null) return "—";
    const density = getDensity(entityId);
    const cm = density > 0 ? gcm2 / density : gcm2;
    const scaled = autoScaleLengthCm(cm);
    return `${formatSigFigs(scaled.value, 4)} ${scaled.unit}`;
  }
</script>

<div class="overflow-x-auto" data-testid="table-multi">
  <table class="w-full min-w-[420px] text-sm">
    <thead class="sticky top-0 bg-background">
      <tr>
        <th
          scope="col"
          class="sticky left-0 z-20 bg-background px-2 py-2 text-left font-medium whitespace-nowrap border-b border-r shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)]"
        >
          Energy ({calcState.masterUnit})
        </th>
        {#each entityIds as entityId (entityId)}
          {@const isDefault = entityId === entityIds[0]}
          <th
            scope="col"
            class="px-2 py-2 text-center font-medium whitespace-nowrap border-b border-l"
            class:bg-yellow-50={isDefault}
            class:dark:bg-yellow-950={isDefault}
            class:font-bold={isDefault}
            data-testid={`table-multi-col-${entityId}`}
          >
            {entityName(entityId)}
            {#if isDefault}
              <span class="ml-1 text-xs font-normal text-muted-foreground">◆ DEFAULT</span>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each calcState.rows as row (row.id)}
        <tr class="border-b last:border-0 hover:bg-muted/30 transition-colors">
          <td
            class="sticky left-0 bg-background px-2 py-2 text-left whitespace-nowrap font-mono border-r shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)]"
          >
            {row.rawInput}{#if !row.unitFromSuffix} {row.unit}{/if}
          </td>
          {#each entityIds as entityId (entityId)}
            {@const isDefault = entityId === entityIds[0]}
            {@const result = results.get(entityId)}
            {@const idx =
              result && !(result instanceof LibdedxError) && row.normalizedMevNucl !== null
                ? findEnergyIndex(result, row.normalizedMevNucl)
                : -1}
            <td
              class="px-2 py-2 text-right whitespace-nowrap font-mono border-l"
              class:bg-yellow-50={isDefault}
              class:dark:bg-yellow-950={isDefault}
              data-testid={`${quantityFocus}-entity-cell-${entityId}-${row.id}`}
            >
              {#if result instanceof LibdedxError}
                <span title={result.message}>— ⚠️</span>
              {:else if result && idx !== -1}
                {quantityFocus === "stp"
                  ? formatStp(entityId, result, idx)
                  : formatRange(entityId, result, idx)}
              {:else}
                —
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
