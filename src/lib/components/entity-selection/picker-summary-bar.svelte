<script lang="ts">
  interface Props {
    /** Number of currently selected items (0 = nothing selected → bar is hidden). */
    count: number;
    /** Short display labels for selected items, in selection order. */
    summaryLabels: string[];
    /**
     * Raw IDs in selection order. When provided alongside `onReorder`, the bar
     * switches from the truncated-text display to individual draggable chips with
     * Alt+ArrowUp/Down keyboard support and drag-and-drop reordering.
     */
    ids?: (number | string)[];
    /** Called when the user clicks Clear. */
    onClear: () => void;
    /**
     * When true, the list is filtered to show only selected items.
     * Pass undefined to hide the toggle entirely (e.g. single-select mode).
     */
    onlySelected?: boolean;
    /** Toggle handler — omit to hide the All/Selected toggle button. */
    onToggleOnlySelected?: (() => void) | undefined;
    /**
     * When provided alongside `ids`, the bar renders individual chips with
     * drag-and-drop and Alt+ArrowUp/Down reorder controls.
     * Called with (id, newIndex) — the caller owns the state mutation.
     */
    onReorder?: (id: number | string, newIndex: number) => void;
    testId?: string;
  }

  const MAX_SHOWN = 3;

  let {
    count,
    summaryLabels,
    ids,
    onClear,
    onlySelected = false,
    onToggleOnlySelected,
    onReorder,
    testId = "picker-summary-bar",
  }: Props = $props();

  // ── Compact text display (non-reorder mode) ──────────────────────────────
  const summaryText = $derived.by(() => {
    if (count === 0) return "";
    const shown = summaryLabels.slice(0, MAX_SHOWN);
    const extra = count - shown.length;
    return shown.join(", ") + (extra > 0 ? ` +${extra}` : "");
  });

  // ── Reorder chip mode ────────────────────────────────────────────────────
  const isReorderMode = $derived(!!onReorder && !!ids && ids.length > 0);

  let dragSourceIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);
  let announcement = $state("");

  function moveItem(fromIndex: number, toIndex: number): void {
    if (!ids || !onReorder || fromIndex === 0) return;
    const clamped = Math.max(1, Math.min(toIndex, ids.length - 1));
    if (fromIndex === clamped) return;
    const id = ids[fromIndex]!;
    onReorder(id, clamped);
    announcement = `${summaryLabels[fromIndex] ?? String(id)} moved to position ${clamped + 1} of ${ids.length}.`;
  }

  function handleKeyDown(event: KeyboardEvent, index: number): void {
    if (!event.altKey || index === 0 || !ids) return;
    if (event.key === "ArrowUp" && index > 1) {
      event.preventDefault();
      moveItem(index, index - 1);
    } else if (event.key === "ArrowDown" && index < ids.length - 1) {
      event.preventDefault();
      moveItem(index, index + 1);
    }
  }

  function handleDragStart(event: DragEvent, index: number): void {
    if (index === 0 || !event.dataTransfer) return;
    dragSourceIndex = index;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(event: DragEvent, index: number): void {
    if (dragSourceIndex === null || index === 0 || index === dragSourceIndex) return;
    event.preventDefault();
    dragOverIndex = index;
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave(): void {
    dragOverIndex = null;
  }

  function handleDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    const src = dragSourceIndex;
    dragSourceIndex = null;
    dragOverIndex = null;
    if (src !== null && targetIndex !== 0 && targetIndex !== src) {
      moveItem(src, targetIndex);
    }
  }

  function handleDragEnd(): void {
    dragSourceIndex = null;
    dragOverIndex = null;
  }
</script>

{#if count > 0}
  <div
    class="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5"
    data-testid={testId}
    aria-label="Selection summary: {count} selected"
    role="status"
  >
    <!-- Count badge -->
    <span
      class="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-orange-700 px-1 text-[11px] font-bold leading-none text-white"
      aria-hidden="true">{count}</span
    >

    {#if isReorderMode && ids}
      <!-- Chip reorder mode: individual draggable chips with ▲▼ buttons -->
      <div
        class="flex min-w-0 flex-1 gap-1 overflow-x-auto"
        role="list"
        aria-label="Selected items in order (drag or Alt+Arrow to reorder)"
        data-testid="{testId}-chips"
      >
        {#each ids as id, i (id)}
          {@const label = summaryLabels[i] ?? String(id)}
          {@const isAnchor = i === 0}
          {@const isDragging = dragSourceIndex === i}
          {@const isDragOver = dragOverIndex === i}
          <div
            role="listitem"
            class="flex shrink-0 cursor-default items-center gap-0.5 rounded border bg-white px-1.5 py-0.5 text-xs select-none
              {isAnchor ? 'border-orange-300 text-orange-800' : 'border-orange-200 text-foreground'}
              {isDragging ? 'opacity-40' : ''}
              {isDragOver ? 'ring-1 ring-orange-400' : ''}"
            data-testid="{testId}-chip-{i}"
          >
            {#if isAnchor}
              <span class="mr-0.5 text-[10px] text-orange-400" aria-hidden="true">⚓</span>
            {:else}
              <button
                type="button"
                draggable="true"
                class="mr-0.5 cursor-grab text-[10px] text-muted-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring"
                aria-label="Drag to reorder {label}; Alt+↑/↓ to move by keyboard"
                data-testid="{testId}-chip-{i}-handle"
                ondragstart={(e) => handleDragStart(e, i)}
                ondragover={(e) => handleDragOver(e, i)}
                ondragleave={handleDragLeave}
                ondrop={(e) => handleDrop(e, i)}
                ondragend={handleDragEnd}
                onkeydown={(e) => handleKeyDown(e, i)}>⠿</button
              >
            {/if}
            <span class="max-w-[10ch] truncate">{label}</span>
            {#if !isAnchor}
              <button
                type="button"
                disabled={i <= 1}
                aria-label="Move {label} up (Alt+↑)"
                title="Move up (Alt+↑)"
                class="ml-0.5 text-[10px] text-muted-foreground hover:text-orange-700 disabled:opacity-30"
                data-testid="{testId}-chip-{i}-up"
                onclick={() => moveItem(i, i - 1)}>▲</button
              >
              <button
                type="button"
                disabled={i >= ids.length - 1}
                aria-label="Move {label} down (Alt+↓)"
                title="Move down (Alt+↓)"
                class="text-[10px] text-muted-foreground hover:text-orange-700 disabled:opacity-30"
                data-testid="{testId}-chip-{i}-down"
                onclick={() => moveItem(i, i + 1)}>▼</button
              >
            {/if}
          </div>
        {/each}
      </div>
      <!-- Dedicated live region for reorder announcements -->
      <span role="status" aria-live="polite" aria-atomic="true" class="sr-only">{announcement}</span
      >
    {:else}
      <!-- Normal mode: truncated summary text -->
      <span class="min-w-0 flex-1 truncate text-xs text-foreground">{summaryText}</span>
    {/if}

    <!-- Toggle: All shown / Selected only (multi-select only) -->
    {#if onToggleOnlySelected !== undefined}
      <button
        type="button"
        class="shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors {onlySelected
          ? 'border-orange-400 bg-orange-100 text-orange-800'
          : 'border-orange-200 text-orange-800 hover:bg-orange-100'}"
        aria-pressed={onlySelected}
        onclick={onToggleOnlySelected}>{onlySelected ? "Sel. only" : "All shown"}</button
      >
    {/if}

    <!-- Clear -->
    <button
      type="button"
      class="shrink-0 rounded border border-orange-200 px-1.5 py-0.5 text-xs text-orange-800 transition-colors hover:border-orange-300 hover:bg-orange-100"
      aria-label="Clear selection"
      onclick={onClear}>Clear</button
    >
  </div>
{/if}
