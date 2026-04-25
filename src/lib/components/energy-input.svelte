<script lang="ts">
  import { tick } from "svelte";
  import { isAdvancedMode } from "$lib/state/ui.svelte";
  import { parseEnergyInput } from "$lib/utils/energy-parser";
  import type { EnergyUnit } from "$lib/wasm/types";
  import type { EnergyInputState } from "$lib/state/energy-input.svelte";
  import EnergyUnitSelector from "./energy-unit-selector.svelte";

  interface Props {
    state: EnergyInputState;
    particleMassNumber?: number;
    particleId?: number;
  }

  let { state, particleMassNumber, particleId }: Props = $props();

  

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

  function handlePaste(index: number, event: ClipboardEvent) {
    event.preventDefault();
    const clipboardText = event.clipboardData?.getData("text") ?? "";
    const lines = clipboardText.split("\n").filter((line) => line.trim() !== "");
    
    if (lines.length === 0) {
      return;
    }

    // Update the current row with the first line
    state.updateRowText(index, lines[0]);

    // Create new rows for subsequent lines
    for (let i = 1; i < lines.length; i++) {
      state.addRow();
      state.updateRowText(index + i, lines[i]);
    }

    // Focus the last populated row
    focusEnergyInput(index + lines.length - 1);
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

  async function handleKeydown(index: number, event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (index < state.rows.length - 1) {
        focusEnergyInput(index + 1);
      } else {
        state.addRow();
        await tick();
        focusEnergyInput(index + 1);
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

  function getAvailableUnits(): EnergyUnit[] {
    const isElectron = particleId === 1001;
    const isProton = particleMassNumber === 1 && particleId !== 1001;

    if (isElectron || isProton) {
      return ["MeV"];
    }

    if (particleMassNumber !== undefined && particleMassNumber > 1) {
      // MeV/u is only available for heavy ions in advanced mode (spec §3)
      if (isAdvancedMode.value) {
        return ["MeV", "MeV/nucl", "MeV/u"];
      }
      return ["MeV", "MeV/nucl"];
    }

    return ["MeV", "MeV/nucl", "MeV/u"];
  }

  const availableUnits = $derived(getAvailableUnits());

  // Reset masterUnit to first available unit when it becomes unavailable
  // (e.g., switching particle or toggling advanced mode)
  $effect(() => {
    const units = availableUnits;
    if (!units.includes(state.masterUnit)) {
      state.setMasterUnit(units[0]);
    }
  });

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
    <span id="energy-unit-label" class="text-sm font-medium">Energy Unit</span>
    <EnergyUnitSelector
      value={state.masterUnit}
      availableUnits={availableUnits}
      onValueChange={handleUnitChange}
      disabled={state.isPerRowMode}
      labelledBy="energy-unit-label"
    />
    {#if state.isPerRowMode}
      <span class="text-xs text-muted-foreground">Mixed units — edit rows to change</span>
    {/if}
  </div>

  <div class="space-y-2">
    {#each state.rows as row, index (row.id)}
      <div class="flex items-center gap-2">
          <input
            type="text"
            value={row.text}
            placeholder="e.g. 100 keV"
            oninput={(e) => handleInputText(index, e)}
            onkeydown={(e) => handleKeydown(index, e)}
            onpaste={(e) => handlePaste(index, e)}
           onblur={() => state.handleBlur(index)}
           class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {row.error ? 'border-destructive focus-visible:ring-destructive' : ''}"
           aria-label={`Energy value ${index + 1}`}
         />
        {#snippet parsedRow()}
          {@const parsed = formatParsedValue(row.text)}
          {#if parsed && parsed.unit !== state.masterUnit}
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
    class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
  >
    Add row
  </button>
</div>
