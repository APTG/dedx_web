<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import { cn } from "$lib/utils.js";
  import { IconButton } from "$lib/components/ui/icon-button";
  import type { PlotSeries } from "$lib/state/plot.svelte";

  interface Props {
    series: PlotSeries[];
    preview: PlotSeries | null;
    editingSeriesId: number | null;
    jsrootSwatchColors: Map<number, string> | null;
    previewError?: string | null;
    onRemove: (seriesId: number) => void;
    onToggleVisibility: (seriesId: number) => void;
    onTogglePreview: () => void;
    onSelectForEdit: (seriesId: number) => void;
    onDone: () => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
  }

  let {
    series,
    preview,
    editingSeriesId,
    jsrootSwatchColors,
    previewError = null,
    onRemove,
    onToggleVisibility,
    onTogglePreview,
    onSelectForEdit,
    onDone,
    onReorder,
  }: Props = $props();

  const swatchColor = (s: PlotSeries): string => jsrootSwatchColors?.get(s.colorIndex) ?? s.color;

  // External-data series are drawn dashed on the plot (see jsroot-plot); mirror
  // that in the swatch so the strip reads as the legend it is.
  const isExternal = (s: PlotSeries): boolean => typeof s.programId === "string";

  // ── Drag-to-reorder ──
  // The drag handle initiates an HTML5 drag; rows accept the drop. Keyboard
  // users reorder with ArrowUp/ArrowDown on the focused handle.
  let dragIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

  function handleDrop(toIndex: number) {
    if (dragIndex !== null && dragIndex !== toIndex) onReorder(dragIndex, toIndex);
    dragIndex = null;
    dragOverIndex = null;
  }

  function handleHandleKeydown(event: KeyboardEvent, idx: number) {
    if (event.key === "ArrowUp" && idx > 0) {
      event.preventDefault();
      onReorder(idx, idx - 1);
    } else if (event.key === "ArrowDown" && idx < series.length - 1) {
      event.preventDefault();
      onReorder(idx, idx + 1);
    }
  }
</script>

<div data-testid="plot-series-strip" class="space-y-1.5">
  <!-- Header: count + a muted hint pointing at the single (sidebar) add entry. -->
  <div data-testid="plot-series-header" class="flex items-center justify-between gap-2 py-1">
    <span data-testid="plot-series-count" class="text-sm font-medium text-muted-foreground">
      {series.length} series
    </span>
    {#if series.length === 0}
      <span class="text-xs text-muted-foreground">add from the sidebar →</span>
    {/if}
  </div>

  {#if previewError}
    <p class="text-xs text-destructive" role="alert">Preview failed: {previewError}</p>
  {/if}

  <div role="list" aria-label="Plot series" class="space-y-1.5">
    <!-- Preview row — an ephemeral, dashed entry committed via the sidebar. -->
    {#if preview}
      <div
        role="listitem"
        data-testid="preview-series"
        data-density={preview.density}
        class={cn(
          "flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-2 py-1.5 text-sm italic text-muted-foreground",
          !preview.visible && "opacity-40",
        )}
      >
        <!-- Decorative swatch; the preview label text conveys the meaning. -->
        <svg class="h-4 w-7 shrink-0" viewBox="0 0 28 16" aria-hidden="true">
          <path
            d="M1 14 C 8 14, 9 2, 14 2 S 20 14, 27 14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-dasharray="3 2"
          />
        </svg>
        <span class="min-w-0 flex-1 truncate">
          Preview — {preview.particleName} in {preview.materialName}
        </span>
        <IconButton
          label={preview.visible ? "Hide preview" : "Show preview"}
          pressed={preview.visible}
          onclick={onTogglePreview}
        >
          {#if preview.visible}
            <Eye class="h-4 w-4" aria-hidden="true" />
          {:else}
            <EyeOff class="h-4 w-4" aria-hidden="true" />
          {/if}
        </IconButton>
      </div>
    {/if}

    <!-- Committed series rows — each a bordered card. -->
    {#each series as s, idx (s.seriesId)}
      {@const isEditingThis = editingSeriesId === s.seriesId}
      {@const color = swatchColor(s)}
      <div
        role="listitem"
        data-testid="plot-series-row-{idx}"
        data-series-id={s.seriesId}
        draggable={dragIndex === idx}
        ondragover={(e) => {
          e.preventDefault();
          dragOverIndex = idx;
        }}
        ondragleave={() => {
          if (dragOverIndex === idx) dragOverIndex = null;
        }}
        ondrop={(e) => {
          e.preventDefault();
          handleDrop(idx);
        }}
        class={cn(
          "flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-1.5 text-sm transition-colors",
          isEditingThis && "ring-2 ring-primary",
          dragOverIndex === idx && dragIndex !== null && "border-primary bg-accent",
          !s.visible && "opacity-40",
        )}
      >
        <!-- Drag handle: mouse drag + ArrowUp/Down keyboard reorder. -->
        <button
          type="button"
          data-testid="plot-series-drag-{idx}"
          aria-label="Reorder series {s.label} (drag, or use arrow keys)"
          title="Drag to reorder"
          class="flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing sm:h-9"
          draggable="true"
          ondragstart={(e) => {
            dragIndex = idx;
            e.dataTransfer?.setData("text/plain", String(idx));
          }}
          ondragend={() => {
            dragIndex = null;
            dragOverIndex = null;
          }}
          onkeydown={(e) => handleHandleKeydown(e, idx)}
        >
          <GripVertical class="h-4 w-4" aria-hidden="true" />
        </button>

        <!-- Line-swatch: a short curve stroke in the series colour — reads as
             "a curve", matching the plotted legend entry. Decorative: the
             label text already names the series. -->
        <svg class="h-4 w-7 shrink-0" viewBox="0 0 28 16" aria-hidden="true">
          <path
            d="M1 14 C 8 14, 9 2, 14 2 S 20 14, 27 14"
            fill="none"
            stroke={color}
            stroke-width="2.5"
            stroke-dasharray={isExternal(s) ? "3 2" : undefined}
          />
        </svg>

        <!-- Label — clicking selects this series for live editing. -->
        <button
          type="button"
          class={cn(
            "min-w-0 flex-1 truncate text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
            !s.visible && "line-through",
          )}
          aria-label={isEditingThis ? `Editing: ${s.label}` : `Edit series: ${s.label}`}
          onclick={() => {
            if (isEditingThis) onDone();
            else onSelectForEdit(s.seriesId);
          }}
        >
          {s.label}
          {#if isEditingThis}
            <span class="ml-1 text-xs not-italic text-primary">(editing)</span>
          {/if}
        </button>

        <IconButton
          testid="plot-series-hide-{idx}"
          label={s.visible ? `Hide series ${s.label}` : `Show series ${s.label}`}
          pressed={s.visible}
          onclick={() => onToggleVisibility(s.seriesId)}
        >
          {#if s.visible}
            <Eye class="h-4 w-4" aria-hidden="true" />
          {:else}
            <EyeOff class="h-4 w-4" aria-hidden="true" />
          {/if}
        </IconButton>
        <IconButton
          testid="plot-series-remove-{idx}"
          label="Remove series {s.label}"
          variant="danger"
          onclick={() => onRemove(s.seriesId)}
        >
          <Trash2 class="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>
    {/each}
  </div>

  {#if series.length === 0 && !preview}
    <p class="py-2 text-center text-xs text-muted-foreground">
      Select a program, particle, and material, then
      <span class="font-medium">＋ Add Series</span> from the sidebar.
    </p>
  {/if}
</div>
