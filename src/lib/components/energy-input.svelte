<script lang="ts">
  import { Select } from "bits-ui";
  import { createEnergyInputState } from "$lib/state/energy-input.svelte";
  import { parseEnergyInput } from "$lib/utils/energy-parser";
  import type { EnergyUnit } from "$lib/wasm/types";

  const state = createEnergyInputState();

  const ENERGY_UNITS: EnergyUnit[] = ["MeV", "keV", "GeV", "eV", "MeV/nucl", "GeV/nucl", "keV/nucl", "MeV/u", "GeV/u", "keV/u"];

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

  function handleUnitChange(unit: string) {
    state.setMasterUnit(unit as EnergyUnit);
  }

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
    <label class="text-sm font-medium">Energy Unit</label>
    <Select.Root value={state.masterUnit} onValueChange={handleUnitChange} disabled={state.isPerRowMode}>
      <Select.Trigger class="w-[180px]">
        {state.masterUnit}
      </Select.Trigger>
      <Select.Content>
        <Select.Viewport>
          {#each ENERGY_UNITS as unit (unit)}
            <Select.Item value={unit}>
              {unit}
            </Select.Item>
          {/each}
        </Select.Viewport>
      </Select.Content>
    </Select.Root>
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
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
