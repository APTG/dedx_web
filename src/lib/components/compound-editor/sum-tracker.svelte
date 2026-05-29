<script lang="ts">
  interface Props {
    /** Parsed weight-fraction values per row, in list order. */
    values: number[];
    /** Element symbols per row, for segment tooltips. */
    symbols: string[];
    /** Called when the user clicks the auto-rescale link. */
    onRescale: () => void;
  }

  let { values, symbols, onRescale }: Props = $props();

  // Tolerance matches the editor's Save-gating: |Σ − 100| ≤ 0.5.
  const TOLERANCE = 0.5;
  // Fixed visual scale so the 100% tick sits at a stable position; the bar
  // fills up to Σ, capped at 120%.
  const SCALE = 120;

  // A grey ramp, one shade per row (cycles for large compounds).
  const SEGMENT_GREYS = ["#171717", "#404040", "#525252", "#737373", "#a3a3a3", "#d4d4d4"];

  let sum = $derived(values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0));
  let withinTolerance = $derived(Math.abs(sum - 100) <= TOLERANCE);
</script>

<div
  class="mt-2 flex flex-col gap-1.5 rounded-md p-2 transition-colors {withinTolerance
    ? 'bg-green-50 dark:bg-green-950/30'
    : 'bg-red-50 dark:bg-red-950/30'}"
  data-testid="compound-sum-tracker"
>
  <div class="flex items-center justify-between gap-2 text-xs">
    {#if withinTolerance}
      <span
        class="font-medium text-green-700 dark:text-green-400"
        data-testid="compound-sum-status"
      >
        ✓ sum = {sum.toFixed(1)}% (within tolerance)
      </span>
    {:else}
      <span class="font-medium text-red-700 dark:text-red-400" data-testid="compound-sum-status">
        ✕ sum = {sum.toFixed(1)}% — must equal 100 ± {TOLERANCE}%
      </span>
      <button
        type="button"
        class="shrink-0 font-medium text-primary underline underline-offset-2 hover:no-underline"
        onclick={onRescale}
        data-testid="compound-sum-rescale"
      >
        auto-rescale to 100%
      </button>
    {/if}
  </div>

  <div
    class="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
    role="img"
    aria-label="Weight-fraction distribution, total {sum.toFixed(1)} percent"
  >
    <div class="flex h-full w-full">
      {#each values as value, index (index)}
        {#if value > 0}
          <div
            class="h-full"
            style="width: {(Math.max(0, value) / SCALE) * 100}%; background-color: {SEGMENT_GREYS[
              index % SEGMENT_GREYS.length
            ]};"
            title="{symbols[index] ?? `Row ${index + 1}`}: {value.toFixed(1)}%"
          ></div>
        {/if}
      {/each}
    </div>
    <!-- Fixed tick at the 100% mark. -->
    <div
      class="absolute top-0 h-full w-px bg-foreground/70"
      style="left: {(100 / SCALE) * 100}%;"
      aria-hidden="true"
    ></div>
  </div>
</div>
