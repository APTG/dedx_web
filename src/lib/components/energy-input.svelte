<script lang="ts">
  import { tick } from "svelte";
  import { isAdvancedMode } from "$lib/state/ui.svelte";
  import { parseEnergyInput, type ParseResult } from "$lib/utils/energy-parser";
  import type { EnergyUnit } from "$lib/wasm/types";
  import type { EnergyInputState } from "$lib/state/energy-input.svelte";
  import EnergyUnitSelector from "./energy-unit-selector.svelte";

  interface Props {
    state: EnergyInputState;
    particleMassNumber?: number;
    particleId?: number;
  }

  const { state: inputState, particleMassNumber = 1, particleId = 1 } = $props();

  let inputRefs: HTMLInputElement[] = $state([]);

  function focusEnergyInput(index: number) {
    const input = inputRefs[index];
    if (input) {
      input.focus();
      input.select();
    }
  }

  function handleAddRow() {
    inputState.addRow();
  }

  function handleRemoveRow(index: number) {
    inputState.removeRow(index);
  }

  function handleInputText(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    inputState.updateRowText(index, target.value);
  }

  function handlePaste(index: number, event: ClipboardEvent) {
    event.preventDefault();
    const clipboardText = event.clipboardData?.getData("text") ?? "";
    const lines = clipboardText.split("\n").filter((line) => line.trim() !== "");
    
    if (lines.length === 0) {
      return;
    }

    inputState.updateRowText(index, lines[0]);

    for (let i = 1; i < lines.length; i++) {
      inputState.addRow();
      inputState.updateRowText(index + i, lines[i]);
    }

    focusEnergyInput(index + lines.length - 1);
  }

  async function handleKeydown(index: number, event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (index < inputState.rows.length - 1) {
        focusEnergyInput(index + 1);
      } else {
        inputState.addRow();
        await tick();
        focusEnergyInput(index + 1);
      }
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    if (event.shiftKey) {
      if (index > 0) {
        event.preventDefault();
        focusEnergyInput(index - 1);
      }
      return;
    }

    if (index < inputState.rows.length - 1) {
      event.preventDefault();
      focusEnergyInput(index + 1);
    }
  }

  function handleUnitChange(unit: string) {
    inputState.setMasterUnit(unit as EnergyUnit);
  }

  function getAvailableUnits(): EnergyUnit[] {
    const isElectron = particleId === 1001;
    const isProton = particleMassNumber === 1 && particleId !== 1001;

    if (isElectron || isProton) {
      return ["MeV"];
    }

    if (particleMassNumber !== undefined && particleMassNumber > 1) {
      if (isAdvancedMode.value) {
        return ["MeV", "MeV/nucl", "MeV/u"];
      }
      return ["MeV", "MeV/nucl"];
    }

    return ["MeV", "MeV/nucl", "MeV/u"];
  }

  const availableUnits = $derived(getAvailableUnits());

  $effect(() => {
    const units = availableUnits;
    if (!units.includes(inputState.masterUnit)) {
      inputState.setMasterUnit(units[0]);
    }
  });

  function formatParsedValue(text: string): { value: string; unit: string } | null {
    const parsed = parseEnergyInput(text);
    if ("value" in parsed && parsed.unit !== null) {
      return { value: String(parsed.value), unit: parsed.unit };
    }
    if ("value" in parsed && parsed.unit === null) {
      return { value: String(parsed.value), unit: inputState.masterUnit };
    }
    return null;
  }

  function getRowUnit(rowText: string): string {
    const parsed = parseEnergyInput(rowText);
    if ("value" in parsed && parsed.unit !== null) {
      return parsed.unit;
    }
    return inputState.masterUnit;
  }

  function handleRowUnitChange(index: number, newUnit: string) {
    const row = inputState.rows[index];
    const parsed = parseEnergyInput(row.text);
    let newText = row.text;
    
    if ("value" in parsed) {
      if (parsed.unit !== null) {
        newText = `${parsed.value} ${newUnit}`;
      } else {
        newText = `${parsed.value} ${newUnit}`;
      }
    }
    
    inputState.updateRowText(index, newText);
  }

  function formatNumber(value: number): string {
    if (value === 0) return "0";
    const absValue = Math.abs(value);
    if (absValue < 0.001 || absValue >= 10000) {
      return value.toExponential(3);
    }
    return value.toFixed(3);
  }

  function convertToMeVNucl(value: number, unit: string): number {
    const conversions: Record<string, number> = {
      "eV": 1e-6,
      "keV": 1e-3,
      "MeV": 1,
      "GeV": 1000,
      "TeV": 1e6,
      "eV/nucl": 1e-6,
      "keV/nucl": 1e-3,
      "MeV/nucl": 1,
      "GeV/nucl": 1000,
      "TeV/nucl": 1e6,
      "MeV/u": 1,
    };
    const factor = conversions[unit] ?? 1;
    return value * factor;
  }
</script>

<div class="w-full space-y-4">
  <div class="flex items-center gap-4">
    <span id="energy-unit-label" class="text-sm font-medium">Energy Unit</span>
    <EnergyUnitSelector
      value={inputState.masterUnit}
      availableUnits={availableUnits}
      onValueChange={handleUnitChange}
      disabled={inputState.isPerRowMode}
      labelledBy="energy-unit-label"
    />
    {#if inputState.isPerRowMode}
      <span class="text-xs text-muted-foreground">Mixed units — edit rows to change</span>
    {/if}
  </div>

  <div class="overflow-x-auto">
    <table class="w-full border-collapse">
      <thead>
        <tr class="border-b bg-muted/30">
          <th class="text-left p-2 font-medium">Energy ({inputState.masterUnit})</th>
          <th class="text-right p-2 font-medium">→ MeV/nucl</th>
          <th class="text-center p-2 font-medium">Unit</th>
          <th class="text-right p-2 font-medium">Stopping Power</th>
          <th class="text-right p-2 font-medium">CSDA Range</th>
        </tr>
      </thead>
      <tbody>
        {#each inputState.rows as row, index (row.id)}
          <tr class="border-b hover:bg-muted/20 {row.error ? 'bg-destructive/10' : ''}">
            <td class="p-2">
              <input
                type="text"
                value={row.text}
                placeholder="e.g. 100 keV"
                oninput={(e) => handleInputText(index, e)}
                onkeydown={(e) => handleKeydown(index, e)}
                onpaste={(e) => handlePaste(index, e)}
                onblur={() => inputState.handleBlur(index)}
                bind:this={inputRefs[index]}
                class="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {row.error ? 'border-destructive focus-visible:ring-destructive' : ''}"
              />
            </td>
            <td class="p-2 text-right font-mono">
              {#if "value" in parseEnergyInput(row.text)}
                {@const parsed = parseEnergyInput(row.text) as { value: number; unit: string | null }}
                {#if parsed.unit !== null}
                  {formatNumber(convertToMeVNucl(parsed.value, parsed.unit))}
                {:else}
                  {formatNumber(convertToMeVNucl(parsed.value, inputState.masterUnit))}
                {/if}
              {:else}
                —
              {/if}
            </td>
            <td class="p-2 text-center">
              <select
                value={getRowUnit(row.text)}
                oninput={(e) => handleRowUnitChange(index, (e.target as HTMLSelectElement).value)}
                class="h-8 px-2 text-sm rounded border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {#each availableUnits as unit}
                  <option value={unit}>{unit}</option>
                {/each}
              </select>
            </td>
            <td class="p-2 text-right font-mono text-muted-foreground">
              —
            </td>
            <td class="p-2 text-right font-mono text-muted-foreground">
              —
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <button
    type="button"
    onclick={handleAddRow}
    class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
  >
    Add row
  </button>
</div>
