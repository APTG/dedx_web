<script lang="ts">
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import { getAvailableEnergyUnits } from "$lib/utils/available-units";
  import type { EnergyUnit } from "$lib/wasm/types";
  import type { CalculatorState, CalculatedRow } from "$lib/state/calculator.svelte";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { ColumnDef } from "./types";

  interface Props {
    row: CalculatedRow;
    rowIndex: number;
    columns: ColumnDef[];
    calcState: CalculatorState;
    entitySelection: EntitySelectionState;
  }

  let { row, rowIndex, columns, calcState, entitySelection }: Props = $props();

  function getAvailableUnits(): EnergyUnit[] {
    return getAvailableEnergyUnits(entitySelection.selectedParticle, isAdvancedMode.value);
  }

  function canShowPerRowUnitSelector(r: CalculatedRow): boolean {
    if (!calcState.isPerRowMode) return false;
    const particle = entitySelection.selectedParticle;
    if (!particle) return false;
    if (!("massNumber" in particle) || particle.massNumber <= 1) return false;
    return r.unitFromSuffix;
  }

  function formatRowUnit(r: CalculatedRow): string {
    if (r.unitFromSuffix) return r.unit;
    return calcState.masterUnit;
  }

  function handleInputFocus(event: Event) {
    (event.target as HTMLInputElement).select();
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
      if (focusRowInput(index + 1)) return;
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
    }
  }

  function handleInputChange(event: Event, index: number) {
    calcState.updateRowText(index, (event.target as HTMLInputElement).value);
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
      if (targetIndex >= calcState.rows.length) {
        calcState.updateRowText(calcState.rows.length - 1, line);
      } else {
        calcState.updateRowText(targetIndex, line);
      }
    }
    calcState.triggerCalculation();
  }

  function handleUnitChange(event: Event, index: number) {
    calcState.setRowUnit(index, (event.target as HTMLSelectElement).value as EnergyUnit);
    calcState.triggerCalculation();
  }
</script>

{#each columns.slice(0, 3) as col, colIdx (col.id)}
  {@const useMonospace = col.monospace ?? col.align === "right"}
  <td
    class={`px-2 sm:px-4 py-2 ${col.align === "right" ? "text-right whitespace-nowrap" : ""} ${useMonospace ? "font-mono" : ""} ${colIdx === 0 ? `sticky left-0 z-10 ${rowIndex % 2 === 1 ? "bg-muted/30" : "bg-background"} shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)]` : ""}`}
  >
    {#if col.id === "energy"}
      <input
        type="text"
        inputmode="text"
        aria-label={`Energy value row ${rowIndex + 1}`}
        data-row-index={rowIndex}
        data-testid={`energy-input-${rowIndex}`}
        value={row.rawInput}
        placeholder="e.g. 100 keV"
        class={`w-24 px-2 py-1 border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          row.status === "invalid" || row.status === "out-of-range"
            ? "border-red-500 bg-red-50 dark:bg-red-950"
            : "border-input"
        }`}
        onfocus={handleInputFocus}
        onkeydown={(e) => handleInputKeyDown(e, rowIndex)}
        oninput={(e) => handleInputChange(e, rowIndex)}
        onpaste={(e) => handlePaste(e, rowIndex)}
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
          aria-label={`Unit for row ${rowIndex + 1}`}
          class="px-2 py-1 border border-input rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          value={formatRowUnit(row)}
          onchange={(e) => handleUnitChange(e, rowIndex)}
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
      <span data-testid={`mev-nucl-cell-${rowIndex}`}>
        {col.getValue(row, calcState, entitySelection)}
      </span>
    {:else}
      {col.getValue(row, calcState, entitySelection)}
    {/if}
  </td>
{/each}
