<script lang="ts">
  import { isAdvancedMode } from "$lib/state/ui.svelte";
  import { autoScaleLengthCm } from "$lib/utils/unit-conversions";
  import { formatSigFigs } from "$lib/utils/unit-conversions";
  import type { EnergyUnit } from "$lib/wasm/types";
  import type { CalculatorState, CalculatedRow } from "$lib/state/calculator.svelte";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { ELECTRON_UNSUPPORTED_MESSAGE } from "$lib/config/libdedx-version";

  export interface ColumnDef {
    id: string;
    header: (state: CalculatorState) => string;
    getValue: (row: CalculatedRow, state: CalculatorState, entitySelection: EntitySelectionState) => string | number | null;
    align?: "left" | "right";
  }

  interface Props {
    state: CalculatorState;
    entitySelection: EntitySelectionState;
    columns?: ColumnDef[];
    class?: string;
  }

  let { state, entitySelection, columns = getDefaultColumns(), class: className = "" }: Props = $props();

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
        getValue: (row) => row.normalizedMevNucl !== null ? formatSigFigs(row.normalizedMevNucl, 4) : "-",
        align: "right",
      },
      {
        id: "unit",
        header: () => "Unit",
        getValue: (row, _s, _e) => row.unit,
        align: "right",
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
    const particle = entitySelection.selectedParticle;
    if (!particle) return ["MeV"];

    const isElectron = particle.id === 1001;
    const isProton = particle.massNumber === 1 && !isElectron;
    if (isElectron || isProton) return ["MeV"];

    if (isAdvancedMode.value) {
      return ["MeV", "MeV/nucl", "MeV/u"];
    }
    return ["MeV", "MeV/nucl"];
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
      state.handleBlur(index);
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
        state.handleBlur(index);
        targetInput.focus();
      }
      // Otherwise let Tab do its default thing so users can leave the table.
    }
  }

  function handleInputChange(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    state.updateRowText(index, target.value);
    state.triggerCalculation();
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
      const targetIndex = index + i;
      // updateRowText auto-adds a new row when last row gets text.
      if (targetIndex >= state.rows.length) {
        state.updateRowText(state.rows.length - 1, lines[i]);
      } else {
        state.updateRowText(targetIndex, lines[i]);
      }
    }
    state.triggerCalculation();
  }

  function handleUnitChange(event: Event, index: number) {
    const target = event.target as HTMLSelectElement;
    state.setRowUnit(index, target.value as EnergyUnit);
    state.triggerCalculation();
  }

  function canShowPerRowUnitSelector(row: CalculatedRow): boolean {
    if (!state.isPerRowMode) return false;
    const particle = entitySelection.selectedParticle;
    if (!particle) return false;
    if (particle.massNumber <= 1) return false;
    return row.unitFromSuffix;
  }

  function formatRowUnit(row: CalculatedRow): string {
    if (row.unitFromSuffix) {
      return row.unit;
    }
    return state.masterUnit;
  }

  // Trigger initial calculation when entity selection becomes complete.
  $effect(() => {
    if (entitySelection.isComplete) {
      state.triggerCalculation();
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
        <strong>{entitySelection.selectedMaterial.name}</strong>.
        Change the particle or material selection to continue.
      {:else}
        Select a particle and material to calculate.
      {/if}
    </div>
  {:else}
    <table class="w-full text-sm">
      <thead class="sticky top-0 bg-background">
        <tr>
          {#each columns as col (col.id)}
            <th
              scope="col"
              class={`px-4 py-2 font-medium ${col.align === "right" ? "text-right" : "text-left"}`}
            >
              {col.header(state)}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each state.rows as row, i (row.id)}
          <tr class="even:bg-muted/30">
            {#each columns as col, colIndex (col.id)}
              <td class={`px-4 py-2 ${col.align === "right" ? "text-right font-mono" : ""}`}>
                {#if col.id === "energy"}
                  <input
                    type="text"
                    aria-label={`Energy value row ${i + 1}`}
                    data-row-index={i}
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
                    disabled={state.isCalculating}
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
                      disabled={state.isCalculating}
                    >
                      {#each getAvailableUnits() as unitOption (unitOption)}
                        <option value={unitOption}>{unitOption}</option>
                      {/each}
                    </select>
                  {:else}
                    <span class="text-muted-foreground">{formatRowUnit(row)}</span>
                  {/if}
                {:else}
                  {col.getValue(row, state, entitySelection)}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>

    {#if state.validationSummary.invalid > 0 || state.validationSummary.outOfRange > 0}
      <div class="p-3 text-sm text-muted-foreground border-t">
        {state.validationSummary.invalid + state.validationSummary.outOfRange} of {state.validationSummary.total}
        values excluded
        (
        {#if state.validationSummary.invalid > 0}
          {state.validationSummary.invalid} invalid
          {#if state.validationSummary.outOfRange > 0}, {/if}
        {/if}
        {#if state.validationSummary.outOfRange > 0}
          {state.validationSummary.outOfRange} out of range
        {/if}
        )
      </div>
    {/if}
  {/if}
</div>
