<script lang="ts">
  import { autoScaleLengthCm, formatSigFigs } from "$lib/utils/unit-conversions";
  import { advancedOptions } from "$lib/state/advanced-options.svelte";
  import { customCompounds } from "$lib/state/custom-compounds.svelte";
  import { createColumnReorder } from "$lib/actions/draggable-column.svelte";
  import { ELECTRON_UNSUPPORTED_MESSAGE } from "$lib/config/libdedx-version";
  import type { CalculatorState } from "$lib/state/calculator.svelte";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { MultiProgramState } from "$lib/state/multi-program.svelte";
  import type { MultiEntityState } from "$lib/state/multi-entity.svelte";
  import type { CalculationResult } from "$lib/wasm/types";
  import { LibdedxError } from "$lib/wasm/types";
  import type { EntityId } from "$lib/external-data/types";
  import type { ColumnDef } from "./result-table/types";

  import BasicHeader from "./result-table/basic-header.svelte";
  import AdvancedHeader from "./result-table/advanced-header.svelte";
  import MultiEntityHeader from "./result-table/multi-entity-header.svelte";
  import InputRowCells from "./result-table/input-row-cells.svelte";
  import BasicResultCells from "./result-table/basic-result-cells.svelte";
  import AdvancedResultCells from "./result-table/advanced-result-cells.svelte";
  import MultiEntityCells from "./result-table/multi-entity-cells.svelte";
  import ResultTableFooter from "./result-table/result-table-footer.svelte";

  interface Props {
    calcState: CalculatorState;
    entitySelection: EntitySelectionState;
    columns?: ColumnDef[];
    class?: string;
    multiProgramState?: MultiProgramState;
    comparisonResults?: Map<EntityId, CalculationResult | LibdedxError>;
    multiEntityState?: MultiEntityState;
    multiEntityIds?: EntityId[];
  }

  let {
    calcState,
    entitySelection,
    columns = getDefaultColumns(),
    class: className = "",
    multiProgramState,
    comparisonResults,
    multiEntityState,
    multiEntityIds = [],
  }: Props = $props();

  const isAdvanced = $derived(multiProgramState !== undefined);
  const isMultiEntity = $derived(multiEntityState !== undefined && multiEntityIds.length > 0);
  const visibleProgramIds = $derived<EntityId[]>(
    isAdvanced && multiProgramState
      ? multiProgramState.programDisplayOrder.filter(
          (id) => multiProgramState.columnVisibility.get(id) !== false,
        )
      : [],
  );
  const showStp = $derived(
    !isAdvanced || !multiProgramState || multiProgramState.quantityFocus === "stp",
  );
  const showCsda = $derived(
    !isAdvanced || !multiProgramState || multiProgramState.quantityFocus === "range",
  );
  const defaultProgramId = $derived(
    (isAdvanced && multiProgramState ? multiProgramState.selectedProgramIds[0] : null) ?? null,
  );
  const defaultProgramName = $derived(
    defaultProgramId !== null ? getProgramName(defaultProgramId) : "",
  );

  let hoveredCell = $state<string | null>(null);

  const reorder = createColumnReorder<EntityId>({
    getOrder: () => multiProgramState?.programDisplayOrder ?? [],
    getLockedId: () => defaultProgramId,
    reorder: (id, idx) => multiProgramState?.reorderPrograms(id, idx),
    getName: (id) => getProgramName(id),
  });

  function getDefaultColumns(): ColumnDef[] {
    return [
      {
        id: "energy",
        header: (s) => `Energy (${s.masterUnit})`,
        getValue: (row) => row.rawInput,
        align: "left",
      },
      {
        id: "mev-nucl",
        header: () => "→ MeV/nucl",
        getValue: (row) =>
          row.normalizedMevNucl !== null ? formatSigFigs(row.normalizedMevNucl, 4) : "-",
        align: "right",
      },
      {
        id: "unit",
        header: () => "Unit",
        getValue: (row) => row.unit,
        align: "right",
        monospace: false,
      },
      {
        id: "stopping-power",
        header: (s) => `Stopping Power (${s.stpDisplayUnit})`,
        getValue: (row, s) => {
          if (s.isCalculating) return "—";
          if (row.stoppingPower !== null) return formatSigFigs(row.stoppingPower, 4);
          return "-";
        },
        align: "right",
      },
      {
        id: "csda-range",
        header: () => "CSDA Range",
        getValue: (row, s) => {
          if (s.isCalculating) return "—";
          if (row.csdaRangeCm !== null) {
            const scaled = autoScaleLengthCm(row.csdaRangeCm);
            return `${formatSigFigs(scaled.value, 4)} ${scaled.unit}`;
          }
          return "-";
        },
        align: "right",
      },
    ];
  }

  function getProgramName(programId: EntityId): string {
    const builtin = entitySelection.availablePrograms.find((p) => p.id === programId);
    if (builtin) return builtin.name;
    const external = entitySelection.availableExternalPrograms.find((p) => p.id === programId);
    return external?.name ?? `Program ${String(programId)}`;
  }

  function getEntityDensity(entityId: EntityId): number {
    if (entitySelection.across !== "material") {
      return (
        advancedOptions.value.densityOverride ?? entitySelection.selectedMaterial?.density ?? 1
      );
    }
    if (typeof entityId === "number") {
      return (
        entitySelection.allMaterials.find((material) => material.id === entityId)?.density ?? 1
      );
    }
    if (entityId.startsWith("ext:")) {
      return (
        entitySelection.externalOnlyMaterials.find((material) => material.id === entityId)
          ?.density ?? 1
      );
    }
    return customCompounds.getById(entityId)?.density ?? 1;
  }

  // Trigger initial calculation when entity selection becomes complete.
  $effect(() => {
    if (entitySelection.isComplete) {
      calcState.triggerCalculation();
    }
  });
</script>

<div class={`overflow-x-auto ${className}`}>
  {#if !entitySelection.isComplete}
    <div class="p-4 text-center text-muted-foreground">
      {#if entitySelection.selectedParticle?.id === 1001}
        {ELECTRON_UNSUPPORTED_MESSAGE}
      {:else if entitySelection.selectedParticle && entitySelection.selectedMaterial}
        No program supports <strong>{entitySelection.selectedParticle.name}</strong> in
        <strong>{entitySelection.selectedMaterial.name}</strong>. Change the particle or material
        selection to continue.
      {:else}
        Select a particle and material to calculate.
      {/if}
    </div>
  {:else}
    <table class="w-full min-w-[560px] text-sm" data-testid="result-table">
      {#if isMultiEntity && multiEntityState}
        <MultiEntityHeader {calcState} {multiEntityState} entityIds={multiEntityIds} />
      {:else if isAdvanced}
        <AdvancedHeader
          {calcState}
          {visibleProgramIds}
          {defaultProgramId}
          {showStp}
          {showCsda}
          {getProgramName}
          {reorder}
        />
      {:else}
        <BasicHeader {columns} {calcState} />
      {/if}
      <tbody>
        {#each calcState.rows as row, i (row.id)}
          <tr class="even:bg-muted/30">
            <InputRowCells {row} rowIndex={i} {columns} {calcState} {entitySelection} />
            {#if isAdvanced}
              <AdvancedResultCells
                {row}
                rowIndex={i}
                {calcState}
                {entitySelection}
                {visibleProgramIds}
                {defaultProgramId}
                {defaultProgramName}
                {comparisonResults}
                {showStp}
                {showCsda}
                {hoveredCell}
                onHover={(k) => (hoveredCell = k)}
              />
            {:else if isMultiEntity && multiEntityState}
              <MultiEntityCells
                {row}
                rowIndex={i}
                {calcState}
                {multiEntityState}
                entityIds={multiEntityIds}
                {getEntityDensity}
              />
            {:else}
              <BasicResultCells {row} rowIndex={i} {columns} {calcState} {entitySelection} />
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>

    <!-- Aria-live region for column reorder announcements -->
    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {reorder.announcement}
    </div>

    <ResultTableFooter {calcState} />
  {/if}
</div>
