<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { PlotSeries } from "$lib/state/plot.svelte";

  interface Props {
    series: PlotSeries[];
    preview: PlotSeries | null;
    editingSeriesId: number | null;
    jsrootSwatchColors: Map<number, string> | null;
    previewError?: string | null;
    onAdd: () => void;
    onRemove: (seriesId: number) => void;
    onToggleVisibility: (seriesId: number) => void;
    onTogglePreview: () => void;
    onSelectForEdit: (seriesId: number) => void;
    onDone: () => void;
  }

  let {
    series,
    preview,
    editingSeriesId,
    jsrootSwatchColors,
    previewError = null,
    onAdd,
    onRemove,
    onToggleVisibility,
    onTogglePreview,
    onSelectForEdit,
    onDone,
  }: Props = $props();

  const isEditing = $derived(editingSeriesId !== null);
</script>

<div data-testid="plot-series-strip" class="space-y-1" role="list" aria-label="Plot series">
  <!-- Header row -->
  <div
    data-testid="plot-series-header"
    class="flex items-center justify-between py-1"
  >
    <span class="text-sm font-medium text-muted-foreground">
      Series{series.length > 0 ? ` · ${series.length}` : ""}
    </span>

    {#if isEditing}
      <button
        type="button"
        data-testid="plot-series-done"
        class="rounded-md border bg-background px-2 py-1 text-xs font-medium text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        onclick={onDone}
      >
        Done editing
      </button>
    {:else}
      <button
        type="button"
        data-testid="plot-add-series"
        disabled={series.length >= 20}
        aria-disabled={series.length >= 20}
        class="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        onclick={onAdd}
      >
        ＋ Add
      </button>
    {/if}
  </div>

  {#if previewError}
    <p class="text-xs text-destructive" role="alert">Preview failed: {previewError}</p>
  {/if}

  <!-- Preview row -->
  {#if preview}
    <div
      role="listitem"
      data-testid="preview-series"
      data-density={preview.density}
      class="flex items-center gap-2 text-sm italic text-muted-foreground"
    >
      <span
        role="img"
        class="inline-block h-4 w-4 shrink-0 rounded-sm border border-dashed"
        style="background-color: #000; opacity: 0.5"
        aria-label="Black, dashed line (preview)"
      ></span>
      <span class="min-w-0 flex-1 truncate">
        Preview — {preview.particleName} in {preview.materialName}
      </span>
      <button
        type="button"
        aria-label="Toggle preview visibility"
        onclick={onTogglePreview}
        class="shrink-0 text-muted-foreground hover:text-foreground"
      >👁</button>
    </div>
  {/if}

  <!-- Committed series rows -->
  {#each series as s, idx (s.seriesId)}
    {@const isEditingThis = editingSeriesId === s.seriesId}
    <div
      role="listitem"
      data-testid="plot-series-row-{idx}"
      class={cn(
        "flex items-center gap-2 rounded-md px-1 text-sm",
        isEditingThis && "ring-2 ring-primary",
        !s.visible && "opacity-40",
      )}
    >
      <span
        class="inline-block h-4 w-4 shrink-0 rounded-sm"
        style="background-color: {jsrootSwatchColors?.get(s.colorIndex) ?? s.color}"
        aria-label="{jsrootSwatchColors?.get(s.colorIndex) ?? s.color}, solid line"
      ></span>
      <!-- Clicking the label selects this series for live editing -->
      <button
        type="button"
        class="min-w-0 flex-1 truncate text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={isEditingThis ? `Editing: ${s.label}` : `Edit series: ${s.label}`}
        onclick={() => {
          if (isEditingThis) onDone();
          else onSelectForEdit(s.seriesId);
        }}
      >
        {s.label}
        {#if isEditingThis}
          <span class="ml-1 text-xs text-primary">(editing)</span>
        {/if}
      </button>
      <button
        type="button"
        aria-label={s.visible ? `Hide series ${s.label}` : `Show series ${s.label}`}
        aria-pressed={!s.visible}
        onclick={() => onToggleVisibility(s.seriesId)}
        class="shrink-0 text-muted-foreground hover:text-foreground"
      >👁</button>
      <button
        type="button"
        aria-label="Remove series {s.label}"
        onclick={() => onRemove(s.seriesId)}
        class="shrink-0 text-muted-foreground hover:text-destructive"
      >×</button>
    </div>
  {/each}

  {#if series.length === 0 && !preview}
    <p class="py-2 text-center text-xs text-muted-foreground">
      Click <span class="font-medium">＋ Add</span> to commit the preview as a series.
    </p>
  {/if}
</div>
