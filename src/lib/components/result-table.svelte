<script lang="ts">
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import { advancedOptions } from "$lib/state/advanced-options.svelte";
  import { autoScaleLengthCm } from "$lib/utils/unit-conversions";
  import { formatSigFigs } from "$lib/utils/unit-conversions";
  import { getAvailableEnergyUnits } from "$lib/utils/available-units";
  import { computeDelta } from "$lib/utils/delta.js";
  import type { EnergyUnit } from "$lib/wasm/types";
  import type { CalculatorState, CalculatedRow } from "$lib/state/calculator.svelte";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { ELECTRON_UNSUPPORTED_MESSAGE } from "$lib/config/libdedx-version";

  /**
   * Column definition for {@link ResultTable}.
   *
   * Note: column IDs `"energy"` and `"unit"` are **reserved** by the component.
   * For these IDs the cell renderer is fixed (interactive `<input>` for `"energy"`
   * and the per-row unit `<select>`/label for `"unit"`); the `getValue` callback is
   * only used for read-only/display columns. If a future caller needs custom
   * rendering for those positions, extend `ColumnDef` with an explicit `render`
   * hook rather than overloading the reserved IDs.
   */
  export interface ColumnDef {
    id: string;
    header: (state: CalculatorState) => string;
    getValue: (
      row: CalculatedRow,
      state: CalculatorState,
      entitySelection: EntitySelectionState,
    ) => string | number | null;
    align?: "left" | "right";
    /**
     * When true, render the cell with a monospaced font. Defaults to `true` for
     * right-aligned columns (numeric values) and `false` for left-aligned ones,
     * but can be overridden per-column (e.g. set to `false` for the Unit column
     * which renders a `<select>`).
     */
    monospace?: boolean;
  }

  import type { MultiProgramState } from "$lib/state/multi-program.svelte";
  import type { MultiEntityState } from "$lib/state/multi-entity.svelte";
  import { customCompounds } from "$lib/state/custom-compounds.svelte";
  import type { CalculationResult } from "$lib/wasm/types";
  import { LibdedxError } from "$lib/wasm/types";
  import type { EntityId } from "$lib/external-data/types";

  interface Props {
    calcState: CalculatorState;
    entitySelection: EntitySelectionState;
    columns?: ColumnDef[];
    class?: string;
    // Multi-program comparison props (advanced mode)
    multiProgramState?: MultiProgramState;
    comparisonResults?: Map<EntityId, CalculationResult | LibdedxError>;
    // Multi-material or multi-particle comparison props
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

  // Derived helpers for advanced mode
  const isAdvanced = $derived(multiProgramState !== undefined);
  // Multi-entity (material or particle) comparison mode
  const isMultiEntity = $derived(multiEntityState !== undefined && multiEntityIds.length > 0);
  const visibleProgramIds = $derived<EntityId[]>(
    isAdvanced && multiProgramState
      ? multiProgramState.programDisplayOrder.filter(
          (id) => multiProgramState.columnVisibility.get(id) !== false,
        )
      : [],
  );
  const showStp = $derived(
    !isAdvanced || !multiProgramState || multiProgramState.quantityFocus !== "csda",
  );
  const showCsda = $derived(
    !isAdvanced || !multiProgramState || multiProgramState.quantityFocus !== "stp",
  );
  const defaultProgramId = $derived(
    (isAdvanced && multiProgramState ? multiProgramState.selectedProgramIds[0] : null) ?? null,
  );

  // Delta tooltip state
  let hoveredCell = $state<string | null>(null);

  // Drag-and-drop column reorder state
  let draggingProgramId = $state<EntityId | null>(null);
  let dragOverProgramId = $state<EntityId | null>(null);
  let reorderAnnouncement = $state<string>("");

  // Column visibility dropdown state
  let showColumnsDropdown = $state<boolean>(false);

  // Derived once — used in both STP and CSDA delta computations
  const defaultProgramName = $derived(
    defaultProgramId !== null ? getProgramName(defaultProgramId) : "",
  );

  // Helper functions for delta tooltip (depend on component's state and entitySelection props)

  /**
   * Returns the STP display value (already unit-converted) for a given result row, or null if the row energy doesn't match.
   */
  function getStpDisplayValue(
    result: CalculationResult | LibdedxError | undefined,
    mevNucl: number,
    density: number,
    displayUnit: string,
  ): number | null {
    if (!result || result instanceof LibdedxError) return null;
    const idx = result.energies.findIndex((e) => Math.abs(e - mevNucl) < 0.0001);
    if (idx === -1) return null;
    const mass = result.stoppingPowers[idx] ?? null;
    if (mass === null) return null;
    if (displayUnit === "keV/µm") return (mass * density) / 10;
    if (displayUnit === "MeV/cm") return mass * density;
    return mass; // MeV·cm²/g
  }

  /**
   * Returns the CSDA range value in cm for a given result row, or null.
   */
  function getCsdaDisplayCm(
    result: CalculationResult | LibdedxError | undefined,
    mevNucl: number,
    density: number,
  ): number | null {
    if (!result || result instanceof LibdedxError) return null;
    const idx = result.energies.findIndex((e) => Math.abs(e - mevNucl) < 0.0001);
    if (idx === -1) return null;
    const gcm2 = result.csdaRanges[idx] ?? null;
    if (gcm2 === null) return null;
    return density > 0 ? gcm2 / density : gcm2;
  }

  function getSelectedDensity(): number {
    return advancedOptions.value.densityOverride ?? entitySelection.selectedMaterial?.density ?? 1;
  }

  function getEntityDensity(entityId: EntityId): number {
    if (entitySelection.across !== "material") return getSelectedDensity();
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

  function getStpDisplayForRow(
    result: CalculationResult | LibdedxError | undefined,
    row: CalculatedRow,
  ): number | null {
    if (row.normalizedMevNucl === null) return null;
    return getStpDisplayValue(
      result,
      row.normalizedMevNucl,
      getSelectedDensity(),
      calcState.stpDisplayUnit,
    );
  }

  function getCsdaDisplayForRow(
    result: CalculationResult | LibdedxError | undefined,
    row: CalculatedRow,
  ): number | null {
    if (row.normalizedMevNucl === null) return null;
    return getCsdaDisplayCm(result, row.normalizedMevNucl, getSelectedDensity());
  }

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
        getValue: (row, _s, _e) => row.unit,
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

  function getAvailableUnits(): EnergyUnit[] {
    return getAvailableEnergyUnits(entitySelection.selectedParticle, isAdvancedMode.value);
  }

  function handleInputFocus(event: Event) {
    const target = event.target as HTMLInputElement;
    target.select();
  }

  function focusRowInput(targetIndex: number): boolean {
    const inputs = document.querySelectorAll<HTMLInputElement>("input[data-row-index]");
    const targetInput = inputs[targetIndex];
    if (targetInput) {
      targetInput.focus();
      return true;
    }
    return false;
  }

  function handleInputKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      calcState.handleBlur(index);
      const moved = focusRowInput(index + 1);
      if (moved) {
        return;
      }
      // No next row yet (handleBlur may add one async). Use a microtask.
      queueMicrotask(() => focusRowInput(index + 1));
      return;
    }

    if (event.key === "Tab") {
      const targetIndex = event.shiftKey ? index - 1 : index + 1;
      const inputs = document.querySelectorAll<HTMLInputElement>("input[data-row-index]");
      const targetInput = inputs[targetIndex];
      if (targetInput) {
        event.preventDefault();
        calcState.handleBlur(index);
        targetInput.focus();
      }
      // Otherwise let Tab do its default thing so users can leave the table.
    }
  }

  function handleInputChange(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    calcState.updateRowText(index, target.value);
    calcState.triggerCalculation();
  }

  function handlePaste(event: ClipboardEvent, index: number) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData("text") || "";
    const lines = pastedText
      .split(/\r?\n|\r/)
      .map((line) => line.trim())
      .filter((line) => line !== "");

    if (lines.length === 0) return;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const targetIndex = index + i;
      // updateRowText auto-adds a new row when last row gets text.
      if (targetIndex >= calcState.rows.length) {
        calcState.updateRowText(calcState.rows.length - 1, line);
      } else {
        calcState.updateRowText(targetIndex, line);
      }
    }
    calcState.triggerCalculation();
  }

  function handleUnitChange(event: Event, index: number) {
    const target = event.target as HTMLSelectElement;
    calcState.setRowUnit(index, target.value as EnergyUnit);
    calcState.triggerCalculation();
  }

  function canShowPerRowUnitSelector(row: CalculatedRow): boolean {
    if (!calcState.isPerRowMode) return false;
    const particle = entitySelection.selectedParticle;
    if (!particle) return false;
    if (!("massNumber" in particle) || particle.massNumber <= 1) return false;
    return row.unitFromSuffix;
  }

  function formatRowUnit(row: CalculatedRow): string {
    if (row.unitFromSuffix) {
      return row.unit;
    }
    return calcState.masterUnit;
  }

  // Trigger initial calculation when entity selection becomes complete.
  $effect(() => {
    if (entitySelection.isComplete) {
      calcState.triggerCalculation();
    }
  });

  // Helper to get program name by ID (built-in or external)
  function getProgramName(programId: EntityId): string {
    const builtin = entitySelection.availablePrograms.find((p) => p.id === programId);
    if (builtin) return builtin.name;
    const external = entitySelection.availableExternalPrograms.find((p) => p.id === programId);
    return external?.name ?? `Program ${String(programId)}`;
  }

  // Drag-and-drop column reorder handlers
  function handleDragStart(programId: EntityId, event: DragEvent) {
    if (programId === defaultProgramId || !event.dataTransfer) {
      return;
    }

    draggingProgramId = programId;
    event.dataTransfer.setData("text/plain", String(programId));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(programId: EntityId, event: DragEvent) {
    if (
      !event.dataTransfer ||
      programId === defaultProgramId ||
      draggingProgramId === null ||
      draggingProgramId === programId
    ) {
      return;
    }

    event.preventDefault();
    dragOverProgramId = programId;
    event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave() {
    dragOverProgramId = null;
  }

  function handleDrop(targetProgramId: EntityId, event: DragEvent) {
    event.preventDefault();
    dragOverProgramId = null;

    const draggedId = draggingProgramId;
    if (
      draggedId === null ||
      draggedId === targetProgramId ||
      targetProgramId === defaultProgramId
    ) {
      draggingProgramId = null;
      return;
    }

    // Calculate target position
    const currentOrder = multiProgramState?.programDisplayOrder || [];
    const targetIndex = currentOrder.indexOf(targetProgramId);
    const draggedIndex = currentOrder.indexOf(draggedId);

    // Move dragged program to target position
    if (multiProgramState && targetIndex !== -1 && draggedIndex !== -1) {
      const newPosition = targetIndex;
      multiProgramState.reorderPrograms(draggedId, newPosition);
      const announcedPosition = Math.min(Math.max(1, newPosition), currentOrder.length - 1) + 1;
      reorderAnnouncement = `${getProgramName(draggedId)} moved to position ${announcedPosition} of ${currentOrder.length}.`;
    }

    draggingProgramId = null;
  }

  function handleDragEnd() {
    draggingProgramId = null;
    dragOverProgramId = null;
  }

  // Keyboard column reorder (Alt+Arrow)
  function handleColumnKeydown(programId: EntityId, event: KeyboardEvent) {
    if (!multiProgramState || programId === defaultProgramId) return;

    const currentOrder = multiProgramState.programDisplayOrder;
    const currentIndex = currentOrder.indexOf(programId);
    if (currentIndex === -1) return;

    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      // Move right (increase index)
      if (currentIndex < currentOrder.length - 1) {
        const newPosition = currentIndex + 1;
        multiProgramState.reorderPrograms(programId, newPosition);
        reorderAnnouncement = `${getProgramName(programId)} moved to position ${newPosition + 1} of ${currentOrder.length}.`;
      }
    } else if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      // Move left (decrease index, but not before default at index 0)
      if (currentIndex > 1) {
        const newPosition = currentIndex - 1;
        multiProgramState.reorderPrograms(programId, newPosition);
        reorderAnnouncement = `${getProgramName(programId)} moved to position ${newPosition + 1} of ${currentOrder.length}.`;
      }
    }
  }

  // Column visibility toggle handler
  function handleToggleColumnVisibility(programId: EntityId) {
    if (!multiProgramState || programId === defaultProgramId) return;
    multiProgramState.toggleColumnVisibility(programId);
  }

  function toggleColumnsDropdown() {
    showColumnsDropdown = !showColumnsDropdown;
  }

  // Close dropdown when clicking outside
  function handleOutsideClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (showColumnsDropdown && !target.closest("[data-columns-dropdown]")) {
      showColumnsDropdown = false;
    }
  }

  $effect(() => {
    if (showColumnsDropdown) {
      document.addEventListener("click", handleOutsideClick);
      return () => document.removeEventListener("click", handleOutsideClick);
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
    {#if isAdvanced && !isMultiEntity}
      <!-- Toolbar for multi-program advanced mode -->
      <div class="mb-2 flex justify-end relative" data-columns-dropdown>
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
          aria-label="Toggle column visibility"
          aria-expanded={showColumnsDropdown}
          aria-haspopup="menu"
          onclick={toggleColumnsDropdown}
        >
          Columns…
        </button>

        {#if showColumnsDropdown}
          <!-- Column visibility dropdown menu -->
          <div
            class="absolute right-0 mt-1 w-48 rounded-md border bg-popover p-2 shadow-lg z-50"
            role="menu"
            aria-label="Column visibility"
          >
            {#each multiProgramState?.selectedProgramIds || [] as programId (programId)}
              <div class="flex items-center gap-2 px-2 py-1.5">
                <input
                  type="checkbox"
                  id={`column-toggle-${programId}`}
                  checked={multiProgramState?.columnVisibility.get(programId) !== false}
                  disabled={programId === defaultProgramId}
                  onchange={() => handleToggleColumnVisibility(programId)}
                  class="h-4 w-4 rounded border-input"
                />
                <label
                  for={`column-toggle-${programId}`}
                  class={`text-sm cursor-pointer ${programId === defaultProgramId ? "text-muted-foreground" : ""}`}
                >
                  {getProgramName(programId)}
                  {#if programId === defaultProgramId}
                    <span class="ml-1 text-xs">(default)</span>
                  {/if}
                </label>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    <table class="w-full min-w-[560px] text-sm" data-testid="result-table">
      {#if isMultiEntity}
        <!-- Multi-entity mode: two-row grouped header (material or particle comparison) -->
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
              colspan={multiEntityIds.length}
              class="px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
            >
              Stopping Power ({calcState.stpDisplayUnit})
            </th>
            <th
              scope="colgroup"
              colspan={multiEntityIds.length}
              class="px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
            >
              CSDA Range
            </th>
          </tr>
          <tr class="bg-background">
            {#each multiEntityIds as entityId (entityId)}
              {@const isAnchor = entityId === multiEntityIds[0]}
              <th
                scope="col"
                class={`px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap ${isAnchor ? "font-bold bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
              >
                {multiEntityState?.entityName(entityId) ?? String(entityId)}
                {#if isAnchor}<span aria-hidden="true"> ◆</span>{/if}
              </th>
            {/each}
            {#each multiEntityIds as entityId (entityId)}
              {@const isAnchor = entityId === multiEntityIds[0]}
              <th
                scope="col"
                class={`px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap ${isAnchor ? "font-bold bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
              >
                {multiEntityState?.entityName(entityId) ?? String(entityId)}
                {#if isAnchor}<span aria-hidden="true"> ◆</span>{/if}
              </th>
            {/each}
          </tr>
        </thead>
      {:else if isAdvanced}
        <!-- Advanced mode: two-row grouped header -->
        <thead class="sticky top-0 bg-background">
          <!-- Row 1: Group headers -->
          <tr>
            <!-- Input columns (3 columns, row-spanning); first column sticky -->
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
            <!-- Stopping Power group header (conditional) -->
            {#if showStp}
              <th
                scope="colgroup"
                colspan={visibleProgramIds.length}
                class="px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
              >
                Stopping Power ({calcState.stpDisplayUnit})
              </th>
            {/if}
            <!-- CSDA Range group header (conditional) -->
            {#if showCsda}
              <th
                scope="colgroup"
                colspan={visibleProgramIds.length}
                class="px-2 sm:px-4 py-2 font-semibold text-center border-b border-l bg-muted/50"
              >
                CSDA Range
              </th>
            {/if}
          </tr>
          <!-- Row 2: Program sub-headers -->
          <tr class="bg-background">
            {#if showStp}
              {#each visibleProgramIds as programId (programId)}
                <th
                  scope="col"
                  data-program-id={programId}
                  draggable={programId !== defaultProgramId ? "true" : "false"}
                  aria-disabled={programId === defaultProgramId ? "true" : "false"}
                  tabindex="0"
                  class={`px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap ${
                    programId === defaultProgramId ? "cursor-not-allowed" : "cursor-grab"
                  } ${
                    programId === defaultProgramId
                      ? "font-bold bg-blue-50 border-l-2 border-l-blue-500"
                      : draggingProgramId === programId
                        ? "opacity-50"
                        : "bg-background"
                  } ${dragOverProgramId === programId ? "border-l-2 border-l-blue-400" : ""}`}
                  ondragstart={(e) => handleDragStart(programId, e)}
                  ondragover={(e) => handleDragOver(programId, e)}
                  ondragleave={handleDragLeave}
                  ondrop={(e) => handleDrop(programId, e)}
                  ondragend={handleDragEnd}
                  onkeydown={(e) => handleColumnKeydown(programId, e)}
                >
                  {getProgramName(programId)}
                  {#if programId === defaultProgramId}
                    <span aria-hidden="true">◆</span>
                  {/if}
                </th>
              {/each}
            {/if}
            {#if showCsda}
              {#each visibleProgramIds as programId (programId)}
                <th
                  scope="col"
                  data-program-id={programId}
                  draggable={programId !== defaultProgramId ? "true" : "false"}
                  aria-disabled={programId === defaultProgramId ? "true" : "false"}
                  tabindex="0"
                  class={`px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap ${
                    programId === defaultProgramId ? "cursor-not-allowed" : "cursor-grab"
                  } ${
                    programId === defaultProgramId
                      ? "font-bold bg-blue-50 border-l-2 border-l-blue-500"
                      : draggingProgramId === programId
                        ? "opacity-50"
                        : "bg-background"
                  } ${dragOverProgramId === programId ? "border-l-2 border-l-blue-400" : ""}`}
                  ondragstart={(e) => handleDragStart(programId, e)}
                  ondragover={(e) => handleDragOver(programId, e)}
                  ondragleave={handleDragLeave}
                  ondrop={(e) => handleDrop(programId, e)}
                  ondragend={handleDragEnd}
                  onkeydown={(e) => handleColumnKeydown(programId, e)}
                >
                  {getProgramName(programId)}
                  {#if programId === defaultProgramId}
                    <span aria-hidden="true">◆</span>
                  {/if}
                </th>
              {/each}
            {/if}
          </tr>
        </thead>
      {:else}
        <!-- Basic mode: single-row header -->
        <thead class="sticky top-0 bg-background">
          <tr>
            {#each columns as col, colIdx (col.id)}
              <th
                scope="col"
                class={`px-2 sm:px-4 py-2 font-medium whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"} ${colIdx === 0 ? "sticky left-0 z-20 bg-background shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)]" : ""}`}
              >
                {col.header(calcState)}
              </th>
            {/each}
          </tr>
        </thead>
      {/if}
      <tbody>
        {#each calcState.rows as row, i (row.id)}
          <tr class="even:bg-muted/30">
            <!-- Input columns (always rendered the same way); first column sticky -->
            {#each columns.slice(0, 3) as col, colIdx (col.id)}
              {@const useMonospace = col.monospace ?? col.align === "right"}
              <td
                class={`px-2 sm:px-4 py-2 ${col.align === "right" ? "text-right whitespace-nowrap" : ""} ${useMonospace ? "font-mono" : ""} ${colIdx === 0 ? `sticky left-0 z-10 ${i % 2 === 1 ? "bg-muted/30" : "bg-background"} shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)]` : ""}`}
              >
                {#if col.id === "energy"}
                  <input
                    type="text"
                    inputmode="text"
                    aria-label={`Energy value row ${i + 1}`}
                    data-row-index={i}
                    data-testid={`energy-input-${i}`}
                    value={row.rawInput}
                    placeholder="e.g. 100 keV"
                    class={`w-24 px-2 py-1 border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      row.status === "invalid" || row.status === "out-of-range"
                        ? "border-red-500 bg-red-50 dark:bg-red-950"
                        : "border-input"
                    }`}
                    onfocus={(e) => handleInputFocus(e)}
                    onkeydown={(e) => handleInputKeyDown(e, i)}
                    oninput={(e) => handleInputChange(e, i)}
                    onpaste={(e) => handlePaste(e, i)}
                    disabled={calcState.isCalculating}
                  />
                  {#if row.message && (row.status === "invalid" || row.status === "out-of-range")}
                    <div class="mt-0.5 text-xs text-red-600 dark:text-red-400" role="alert">
                      {row.message}
                    </div>
                  {/if}
                {:else if col.id === "unit"}
                  {#if canShowPerRowUnitSelector(row)}
                    <select
                      aria-label={`Unit for row ${i + 1}`}
                      class="px-2 py-1 border border-input rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      value={formatRowUnit(row)}
                      onchange={(e) => handleUnitChange(e, i)}
                      disabled={calcState.isCalculating}
                    >
                      {#each getAvailableUnits() as unitOption (unitOption)}
                        <option value={unitOption}>{unitOption}</option>
                      {/each}
                    </select>
                  {:else}
                    <span class="text-muted-foreground">{formatRowUnit(row)}</span>
                  {/if}
                {:else if col.id === "mev-nucl"}
                  <span data-testid={`mev-nucl-cell-${i}`}>
                    {col.getValue(row, calcState, entitySelection)}
                  </span>
                {:else}
                  {col.getValue(row, calcState, entitySelection)}
                {/if}
              </td>
            {/each}
            <!-- Result columns for advanced mode -->
            {#if isAdvanced}
              <!-- Stopping Power columns per program -->
              {#if showStp}
                {#each visibleProgramIds as programId (programId)}
                  {@const stpDisplay = getStpDisplayForRow(comparisonResults?.get(programId), row)}
                  {@const defaultResult =
                    defaultProgramId !== null
                      ? comparisonResults?.get(defaultProgramId)
                      : undefined}
                  {@const defaultStpDisplay = getStpDisplayForRow(defaultResult, row)}
                  {@const delta =
                    programId !== defaultProgramId &&
                    stpDisplay !== null &&
                    defaultStpDisplay !== null
                      ? computeDelta(
                          stpDisplay,
                          defaultStpDisplay,
                          calcState.stpDisplayUnit,
                          defaultProgramName,
                        )
                      : null}
                  {@const stpCellKey = `stp-${programId}-${i}`}
                  {@const stpTooltipId = `delta-desc-${stpCellKey}`}
                  <td
                    data-program-id={programId}
                    data-testid={`stp-cell-${programId}-${i}`}
                    class={`relative px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono ${
                      programId === defaultProgramId ? "bg-blue-50" : ""
                    }`}
                    aria-describedby={delta ? stpTooltipId : undefined}
                    onmouseenter={() => {
                      hoveredCell = stpCellKey;
                    }}
                    onmouseleave={() => {
                      hoveredCell = null;
                    }}
                    onfocus={() => {
                      hoveredCell = stpCellKey;
                    }}
                    onblur={() => {
                      hoveredCell = null;
                    }}
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
                                {@const stpLinear = (stpMass! * density) / 10}
                                {formatSigFigs(stpLinear, 4)}
                              {:else if calcState.stpDisplayUnit === "MeV/cm"}
                                {@const stpLinear = stpMass! * density}
                                {formatSigFigs(stpLinear, 4)}
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
              <!-- CSDA Range columns per program -->
              {#if showCsda}
                {#each visibleProgramIds as programId (programId)}
                  {@const csdaCm = getCsdaDisplayForRow(comparisonResults?.get(programId), row)}
                  {@const defaultResult =
                    defaultProgramId !== null
                      ? comparisonResults?.get(defaultProgramId)
                      : undefined}
                  {@const defaultCsdaCm = getCsdaDisplayForRow(defaultResult, row)}
                  {@const csdaDelta =
                    programId !== defaultProgramId && csdaCm !== null && defaultCsdaCm !== null
                      ? computeDelta(csdaCm, defaultCsdaCm, "cm", defaultProgramName)
                      : null}
                  {@const csdaCellKey = `csda-${programId}-${i}`}
                  {@const csdaTooltipId = `delta-desc-${csdaCellKey}`}
                  <td
                    data-program-id={programId}
                    data-testid={`range-cell-${programId}-${i}`}
                    class={`relative px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono ${
                      programId === defaultProgramId ? "bg-blue-50" : ""
                    }`}
                    aria-describedby={csdaDelta ? csdaTooltipId : undefined}
                    onmouseenter={() => {
                      hoveredCell = csdaCellKey;
                    }}
                    onmouseleave={() => {
                      hoveredCell = null;
                    }}
                    onfocus={() => {
                      hoveredCell = csdaCellKey;
                    }}
                    onblur={() => {
                      hoveredCell = null;
                    }}
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
            {:else if isMultiEntity}
              <!-- Multi-entity (material or particle) comparison columns -->
              {#each multiEntityIds as entityId (entityId)}
                {@const isAnchor = entityId === multiEntityIds[0]}
                {@const result = multiEntityState?.comparisonResults.get(entityId)}
                {@const density = getEntityDensity(entityId)}
                {@const stpIndex =
                  result && !(result instanceof LibdedxError) && row.normalizedMevNucl !== null
                    ? result.energies.findIndex(
                        (e) => Math.abs(e - row.normalizedMevNucl!) < 0.0001,
                      )
                    : -1}
                <td
                  data-entity-id={entityId}
                  data-testid={`stp-entity-cell-${entityId}-${i}`}
                  class={`px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono ${isAnchor ? "bg-blue-50" : ""}`}
                >
                  {#if result instanceof LibdedxError}
                    <span title={result.message}>— ⚠️</span>
                  {:else if result && stpIndex !== -1}
                    {@const stpMass = result.stoppingPowers[stpIndex]!}
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
              {#each multiEntityIds as entityId (entityId)}
                {@const isAnchor = entityId === multiEntityIds[0]}
                {@const result = multiEntityState?.comparisonResults.get(entityId)}
                {@const density = getEntityDensity(entityId)}
                {@const csdaIndex =
                  result && !(result instanceof LibdedxError) && row.normalizedMevNucl !== null
                    ? result.energies.findIndex(
                        (e) => Math.abs(e - row.normalizedMevNucl!) < 0.0001,
                      )
                    : -1}
                <td
                  data-entity-id={entityId}
                  data-testid={`range-entity-cell-${entityId}-${i}`}
                  class={`px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono ${isAnchor ? "bg-blue-50" : ""}`}
                >
                  {#if result instanceof LibdedxError}
                    <span title={result.message}>— ⚠️</span>
                  {:else if result && csdaIndex !== -1 && result.csdaRanges.length > 0}
                    {@const csdaGcm2 = result.csdaRanges[csdaIndex]!}
                    {@const csdaCm = density > 0 ? csdaGcm2 / density : csdaGcm2}
                    {@const scaled = autoScaleLengthCm(csdaCm)}
                    {formatSigFigs(scaled.value, 4)}
                    {scaled.unit}
                  {:else}
                    —
                  {/if}
                </td>
              {/each}
            {:else}
              <!-- Basic mode: single result column per quantity -->
              {#each columns.slice(3) as col (col.id)}
                {@const useMonospace = col.monospace ?? col.align === "right"}
                <td
                  class={`px-2 sm:px-4 py-2 ${col.align === "right" ? "text-right whitespace-nowrap" : ""} ${useMonospace ? "font-mono" : ""}`}
                >
                  {#if col.id === "stopping-power"}
                    <span data-testid={`stp-cell-${i}`}>
                      {col.getValue(row, calcState, entitySelection)}
                    </span>
                  {:else if col.id === "csda-range"}
                    <span data-testid={`range-cell-${i}`}>
                      {col.getValue(row, calcState, entitySelection)}
                    </span>
                  {:else}
                    {col.getValue(row, calcState, entitySelection)}
                  {/if}
                </td>
              {/each}
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>

    <!-- Aria-live region for column reorder announcements -->
    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {reorderAnnouncement}
    </div>

    {#if calcState.validationSummary.invalid > 0 || calcState.validationSummary.outOfRange > 0}
      <div class="p-3 text-sm text-muted-foreground border-t">
        {calcState.validationSummary.invalid + calcState.validationSummary.outOfRange} of {calcState
          .validationSummary.total}
        values excluded (
        {#if calcState.validationSummary.invalid > 0}
          {calcState.validationSummary.invalid} invalid
          {#if calcState.validationSummary.outOfRange > 0},
          {/if}
        {/if}
        {#if calcState.validationSummary.outOfRange > 0}
          {calcState.validationSummary.outOfRange} out of range
        {/if}
        )
      </div>
    {/if}

    {#if calcState.error}
      <div
        class="p-3 text-sm border-t border-destructive/20 bg-destructive/5 space-y-1"
        role="alert"
      >
        <p class="text-destructive font-medium">Calculation error: {calcState.error.message}</p>
        <details class="text-xs text-muted-foreground">
          <summary class="cursor-pointer select-none">Show details</summary>
          <code class="mt-1 block">LibdedxError code: {calcState.error.code}</code>
        </details>
      </div>
    {/if}

    <div class="mt-2 flex justify-start">
      <button
        type="button"
        class="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
        onclick={() => calcState.addRow()}
      >
        + Add row
      </button>
    </div>
  {/if}
</div>
