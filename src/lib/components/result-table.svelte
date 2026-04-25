<script lang="ts">
  import type { CalculatorState } from '$lib/state/calculator.svelte';
  import type { EntitySelectionState } from '$lib/state/entity-selection.svelte';
  import { autoScaleLengthCm } from '$lib/state/calculator.svelte';
  import { formatSigFigs } from '$lib/utils/unit-conversions';

  interface Props {
    state: CalculatorState;
    entitySelection: EntitySelectionState;
    class?: string;
  }

  let { state, entitySelection, class: className = '' }: Props = $props();

  function getAvailableUnits(): string[] {
    const particle = entitySelection.selectedParticle;
    if (!particle) return ['MeV'];
    
    if (particle.massNumber === 1) {
      return ['MeV'];
    }
    return ['MeV', 'MeV/nucl'];
  }

  function handleInputFocus(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    target.select();
  }

  function handleInputKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      state.handleBlur(index);
      
      const nextIndex = index + 1;
      const inputs = document.querySelectorAll<HTMLInputElement>('input[data-row-index]');
      if (inputs[nextIndex]) {
        inputs[nextIndex].focus();
      }
    }
  }

  function handleInputChange(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    state.updateRowText(index, target.value);
  }

  function handlePaste(event: ClipboardEvent, index: number) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const lines = pastedText.split('\n').filter(line => line.trim());
    
    const startIndex = index;
    for (let i = 0; i < lines.length; i++) {
      const targetIndex = startIndex + i;
      if (targetIndex < state.rows.length) {
        state.updateRowText(targetIndex, lines[i]);
      } else {
        // Fill up pasted values, auto-adding rows if needed
        state.updateRowText(state.rows.length - 1, lines[i]);
        state.handleBlur(state.rows.length - 1);
      }
    }
  }

  function handleUnitChange(event: Event, index: number) {
    const target = event.target as HTMLSelectElement;
    state.setRowUnit(index, target.value as typeof state.masterUnit);
  }

  function canShowPerRowUnitSelector(row: typeof state.rows[number]): boolean {
    if (!state.isPerRowMode) return false;
    
    const particle = entitySelection.selectedParticle;
    if (!particle) return false;
    
    if (particle.massNumber > 1) {
      const suffixes = ['MeV', 'MeV/nucl', 'MeV/u'];
      return suffixes.some(s => row.rawInput.includes(s));
    }
    return false;
  }

  function formatRowUnit(row: typeof state.rows[number]): string {
    if (row.unitFromSuffix) {
      return row.unit;
    }
    return state.masterUnit;
  }
</script>

<div class={`overflow-x-auto ${className}`}>
  {#if !entitySelection.isComplete}
    <div class="p-4 text-center text-muted-foreground">
      Select a particle and material to calculate.
    </div>
  {:else}
    <table class="w-full text-sm">
      <thead class="sticky top-0 bg-background">
        <tr>
          <th scope="col" class="text-left px-4 py-2 font-medium">
            Energy ({state.masterUnit})
          </th>
          <th scope="col" class="text-right px-4 py-2 font-medium">
            → MeV/nucl
          </th>
          <th scope="col" class="text-right px-4 py-2 font-medium">
            Unit
          </th>
          <th scope="col" class="text-right px-4 py-2 font-medium">
            Stopping Power ({state.stpDisplayUnit})
          </th>
          <th scope="col" class="text-right px-4 py-2 font-medium">
            CSDA Range
          </th>
        </tr>
      </thead>
      <tbody>
        {#each state.rows as row, i (row.id)}
          <tr class="even:bg-muted/30">
            <td class="px-4 py-2">
              <input
                type="text"
                data-row-index={i}
                value={row.rawInput}
                class="w-24 px-2 py-1 border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary {
                  row.status === 'invalid' || row.status === 'out-of-range'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950'
                    : 'border-input'
                }"
                onfocus={(e) => handleInputFocus(e, i)}
                onkeydown={(e) => handleInputKeyDown(e, i)}
                oninput={(e) => handleInputChange(e, i)}
                onpaste={(e) => handlePaste(e, i)}
                disabled={state.isCalculating}
              />
            </td>
            <td class="px-4 py-2 text-right font-mono">
              {#if row.normalizedMevNucl !== null}
                {formatSigFigs(row.normalizedMevNucl, 4)}
              {:else}
                -
              {/if}
            </td>
            <td class="px-4 py-2 text-right">
              {#if canShowPerRowUnitSelector(row)}
                <select
                  class="px-2 py-1 border border-input rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formatRowUnit(row)}
                  onchange={(e) => handleUnitChange(e, i)}
                  disabled={state.isCalculating}
                >
                  <option value="MeV">MeV</option>
                  <option value="MeV/nucl">MeV/nucl</option>
                </select>
              {:else}
                <span class="text-muted-foreground">{formatRowUnit(row)}</span>
              {/if}
            </td>
            <td class="px-4 py-2 text-right font-mono">
              {#if state.isCalculating}
                <span class="animate-pulse text-muted-foreground">—</span>
              {:else if row.stoppingPower !== null}
                {formatSigFigs(row.stoppingPower, 4)}
              {:else}
                -
              {/if}
            </td>
            <td class="px-4 py-2 text-right font-mono">
              {#if state.isCalculating}
                <span class="animate-pulse text-muted-foreground">—</span>
              {:else if row.csdaRangeCm !== null}
                {@const scaled = autoScaleLengthCm(row.csdaRangeCm)}
                {formatSigFigs(scaled.value, 4)} {scaled.unit}
              {:else}
                -
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if state.validationSummary.invalid > 0 || state.validationSummary.outOfRange > 0}
      <div class="p-3 text-sm text-muted-foreground border-t">
        {state.validationSummary.invalid + state.validationSummary.outOfRange} of {state.validationSummary.total} values excluded
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
