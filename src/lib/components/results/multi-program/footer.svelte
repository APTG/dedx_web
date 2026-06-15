<script lang="ts">
  import type { CalculatorState } from "$lib/state/calculator.svelte";

  interface Props {
    calcState: CalculatorState;
  }

  let { calcState }: Props = $props();
</script>

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
  <div class="p-3 text-sm border-t border-destructive/20 bg-destructive/5 space-y-1" role="alert">
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
