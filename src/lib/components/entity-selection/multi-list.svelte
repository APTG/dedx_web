<script lang="ts" module>
  export interface MultiListRow {
    id: number | string;
    label: string;
    meta?: string | undefined;
    glyph?: string | undefined;
    disabled?: boolean | undefined;
  }
</script>

<script lang="ts">
  import { cn } from "$lib/utils.js";

  interface Props {
    /** Filtered list of selectable rows (search + compat already applied). */
    available: MultiListRow[];
    /** Ordered list of currently-selected ids; the first is the "default". */
    selectedIds: (number | string)[];
    onToggle: (id: number | string) => void;
    /**
     * Reorder hook — full drag-and-drop / `Alt+ArrowUp/Down` keyboard
     * reorder ships in a follow-up issue. Not wired yet by default.
     */
    onReorder?: (id: number | string, newIndex: number) => void;
    /** Testid prefix for rows (used by E2E selectors). */
    testIdPrefix?: string;
    "data-testid"?: string;
    class?: string | undefined;
  }

  let {
    available,
    selectedIds,
    onToggle,
    onReorder: _onReorder = undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
    testIdPrefix = "picker-multi-item",
    "data-testid": rootTestId = "picker-multi-list",
    class: className,
  }: Props = $props();

  const byId = $derived(new Map(available.map((r) => [r.id, r])));

  const selectedRows = $derived<MultiListRow[]>(
    selectedIds.map((id) => byId.get(id)).filter((r): r is MultiListRow => r !== undefined),
  );

  const availableRows = $derived(available.filter((r) => !selectedIds.includes(r.id)));
</script>

<div class={cn("space-y-3", className)} data-testid={rootTestId}>
  <section>
    <div class="px-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
      Selected · {selectedRows.length}
    </div>
    <ul
      role="listbox"
      aria-multiselectable="true"
      aria-label="Selected"
      class="space-y-0.5"
      data-testid="{rootTestId}-selected"
    >
      {#each selectedRows as row, idx (row.id)}
        {@const isDefault = idx === 0}
        <li role="presentation">
          <div
            class={cn(
              "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
              isDefault ? "bg-primary/15" : "bg-accent/40",
            )}
            data-testid="{testIdPrefix}-selected-{row.id}"
          >
            <input
              type="checkbox"
              checked={true}
              disabled={isDefault}
              class="h-4 w-4 rounded border-input"
              aria-label="Selected: {row.label}"
              onchange={() => onToggle(row.id)}
            />
            {#if row.glyph}<span aria-hidden="true">{row.glyph}</span>{/if}
            <span class="flex-1 truncate">{row.label}</span>
            {#if row.meta}
              <span class="text-xs text-muted-foreground">{row.meta}</span>
            {/if}
            {#if isDefault}
              <span
                class="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
                data-testid="{testIdPrefix}-default-badge"
              >
                Default
              </span>
            {/if}
          </div>
        </li>
      {/each}
      {#if selectedRows.length === 0}
        <li class="px-2 py-2 text-xs text-muted-foreground">No selection.</li>
      {/if}
    </ul>
  </section>

  <section>
    <div class="px-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">Available</div>
    <ul
      role="listbox"
      aria-multiselectable="true"
      aria-label="Available"
      class="max-h-52 space-y-0.5 overflow-auto"
      data-testid="{rootTestId}-available"
    >
      {#each availableRows as row (row.id)}
        <li role="presentation">
          <button
            type="button"
            role="option"
            aria-selected="false"
            disabled={row.disabled}
            class={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
              row.disabled ? "opacity-40 pointer-events-none" : "hover:bg-accent cursor-pointer",
            )}
            data-testid="{testIdPrefix}-available-{row.id}"
            onclick={() => onToggle(row.id)}
          >
            <input
              type="checkbox"
              checked={false}
              tabindex={-1}
              class="h-4 w-4 rounded border-input pointer-events-none"
              aria-hidden="true"
            />
            {#if row.glyph}<span aria-hidden="true">{row.glyph}</span>{/if}
            <span class="flex-1 truncate">{row.label}</span>
            {#if row.meta}
              <span class="text-xs text-muted-foreground">{row.meta}</span>
            {/if}
          </button>
        </li>
      {/each}
      {#if availableRows.length === 0}
        <li class="px-2 py-2 text-xs text-muted-foreground">No more options.</li>
      {/if}
    </ul>
  </section>
</div>
