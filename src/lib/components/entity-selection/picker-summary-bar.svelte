<script lang="ts">
  interface Props {
    /** Number of currently selected items (0 = nothing selected → bar is hidden). */
    count: number;
    /** Short display labels for selected items, in selection order. */
    summaryLabels: string[];
    /** Called when the user clicks Clear. */
    onClear: () => void;
    /**
     * When true, the list is filtered to show only selected items.
     * Pass undefined to hide the toggle entirely (e.g. single-select mode).
     */
    onlySelected?: boolean;
    /** Toggle handler — omit to hide the All/Selected toggle button. */
    onToggleOnlySelected?: (() => void) | undefined;
    testId?: string;
  }

  const MAX_SHOWN = 3;

  let {
    count,
    summaryLabels,
    onClear,
    onlySelected = false,
    onToggleOnlySelected,
    testId = "picker-summary-bar",
  }: Props = $props();

  const summaryText = $derived.by(() => {
    if (count === 0) return "";
    const shown = summaryLabels.slice(0, MAX_SHOWN);
    const extra = count - shown.length;
    return shown.join(", ") + (extra > 0 ? ` +${extra}` : "");
  });
</script>

{#if count > 0}
  <div
    class="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5"
    data-testid={testId}
    aria-label="Selection summary: {count} selected"
    role="status"
    aria-live="polite"
  >
    <!-- Count badge -->
    <span
      class="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-orange-700 px-1 text-[11px] font-bold leading-none text-white"
      aria-hidden="true"
    >{count}</span>

    <!-- Truncated summary text -->
    <span class="min-w-0 flex-1 truncate text-xs text-foreground">{summaryText}</span>

    <!-- Toggle: All shown / Selected only (multi-select only) -->
    {#if onToggleOnlySelected !== undefined}
      <button
        type="button"
        class="shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors {onlySelected
          ? 'border-orange-400 bg-orange-100 text-orange-800'
          : 'border-orange-200 text-orange-800 hover:bg-orange-100'}"
        aria-pressed={onlySelected}
        onclick={onToggleOnlySelected}
      >{onlySelected ? "Sel. only" : "All shown"}</button>
    {/if}

    <!-- Clear -->
    <button
      type="button"
      class="shrink-0 rounded border border-orange-200 px-1.5 py-0.5 text-xs text-orange-800 transition-colors hover:border-orange-300 hover:bg-orange-100"
      aria-label="Clear selection"
      onclick={onClear}
    >Clear</button>
  </div>
{/if}
