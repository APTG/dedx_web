<script lang="ts">
  import { createEnergyInputState } from "$lib/state/energy-input.svelte";
  import { parseEnergyInput } from "$lib/utils/energy-parser";
  import type { EnergyUnit } from "$lib/wasm/types";
  import EnergyUnitSelector from "./energy-unit-selector.svelte";

  const state = createEnergyInputState();

  

  function handleAddRow() {
    state.addRow();
  }

  function handleRemoveRow(index: number) {
    state.removeRow(index);
  }

  function handleInputText(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    state.updateRowText(index, target.value);
  }

  function focusEnergyInput(index: number) {
    const input = document.querySelector(
      `input[aria-label="Energy value ${index + 1}"]`,
    ) as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }

  function handleKeydown(index: number, event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (index < state.rows.length - 1) {
        focusEnergyInput(index + 1);
      } else {
        state.addRow();
        setTimeout(() => {
          focusEnergyInput(index + 1);
        }, 0);
      }
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    if (event.shiftKey) {
      // Shift+Tab: move to previous row; if already at the first row let the
      // browser handle focus so users can tab out of the component.
      if (index > 0) {
        event.preventDefault();
        focusEnergyInput(index - 1);
      }
      return;
    }

    // Tab: move to next row; if already on the last row let the browser move
    // focus out of the component naturally.
    if (index < state.rows.length - 1) {
      event.preventDefault();
      focusEnergyInput(index + 1);
    }
  }

  function handleUnitChange(unit: string) {
    state.setMasterUnit(unit as EnergyUnit);
  }

  // Default available units for the master selector
  // TODO: derive from particleMassNumber/particleId props (unit-handling.md §2)
  const AVAILABLE_UNITS: EnergyUnit[] = ["MeV", "MeV/nucl", "MeV/u"];

  function formatParsedValue(text: string): { value: string; unit: string } | null {
    const parsed = parseEnergyInput(text);
    if ("value" in parsed && parsed.unit !== null) {
      return { value: String(parsed.value), unit: parsed.unit };
    }
    if ("value" in parsed && parsed.unit === null) {
      return { value: String(parsed.value), unit: state.masterUnit };
    }
    return null;
  }
</script>

<div class="w-full space-y-4">
  <div class="flex items-center gap-4">
    <label for="energy-unit-selector" class="text-sm font-medium">Energy Unit</label>
    <EnergyUnitSelector
      id="energy-unit-selector"
      value={state.masterUnit}
      availableUnits={AVAILABLE_UNITS}
      onValueChange={handleUnitChange}
      disabled={state.isPerRowMode}
    />
    {#if state.isPerRowMode}
      <span class="text-xs text-muted-foreground">(per-row mode active)</span>
    {/if}
  </div>

  <div class="space-y-2">
    {#each state.rows as row, index (row.id)}
      <div class="flex items-center gap-2">
        <input
          type="text"
          value={row.text}
          placeholder={row.text || ""}
          oninput={(e) => handleInputText(index, e)}
          onkeydown={(e) => handleKeydown(index, e)}
          onblur={() => state.handleBlur(index)}
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {row.error ? 'border-destructive focus-visible:ring-destructive' : ''}"
          aria-label={`Energy value ${index + 1}`}
        />
        {#snippet parsedRow()}
          {@const parsed = formatParsedValue(row.text)}
          {#if parsed}
            <div class="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              <span>→</span>
              <span>{parsed.value}</span>
              <span>{parsed.unit}</span>
            </div>
          {/if}
        {/snippet}
        {@render parsedRow()}
        {#if row.error}
          <span class="text-xs text-destructive whitespace-nowrap">{row.error}</span>
        {/if}
        <button
          type="button"
          onclick={() => handleRemoveRow(index)}
          disabled={state.rows.length <= 1}
          class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive hover:text-destructive-foreground h-10 px-3"
          aria-label={`Remove row ${index + 1}`}
        >
          ✕
        </button>
      </div>
    {/each}
  </div>

  <button
    type="button"
    onclick={handleAddRow}
    class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
  >
    Add row
  </button>
</div>
