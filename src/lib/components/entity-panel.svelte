<script lang="ts" generics="T extends { id: number; name: string }">
  import { cn } from "$lib/utils";

  interface EntityItem<T> {
    entity: T;
    available: boolean;
    label: string;
    description?: string;
    badge?: string;
  }

  interface GroupedItems<T> {
    groupName: string;
    items: EntityItem<T>[];
  }

  interface Props<T extends { id: number; name: string }> {
    label: string;
    items: EntityItem<T>[];
    selectedId: number | null;
    grouped?: boolean;
    groups?: GroupedItems<T>[];
    placeholder?: string;
    disabled?: boolean;
    onItemSelect: (entity: T) => void;
    onClear?: () => void;
    class?: string;
    maxHeight?: string;
  }

  let {
    label,
    items,
    selectedId,
    grouped = false,
    groups = [],
    disabled = false,
    onItemSelect,
    onClear,
    class: className,
    maxHeight = "400px",
  }: Props<T> = $props();

  let searchTerm = $state("");

  const filteredItems = $derived.by(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      if (grouped && groups.length > 0) {
        return groups.map((group) => ({
          groupName: group.groupName,
          items: group.items,
        }));
      }
      return [{ groupName: "", items }];
    }

    const filtered = items.filter(
      (item) =>
        item.label.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term),
    );

    if (grouped && groups.length > 0) {
      const groupedFiltered = groups
        .map((group) => ({
          groupName: group.groupName,
          items: group.items.filter(
            (item) =>
              item.label.toLowerCase().includes(term) ||
              item.description?.toLowerCase().includes(term),
          ),
        }))
        .filter((group) => group.items.length > 0);
      return groupedFiltered;
    }

    return [{ groupName: "", items: filtered }];
  });

  const filteredAvailable = $derived(
    filteredItems.flatMap((g) => g.items).filter((i) => i.available).length,
  );
  const filteredTotal = $derived(filteredItems.flatMap((g) => g.items).length);
</script>

<div
  class={cn("rounded-lg border bg-card p-4", className)}
  role="group"
  aria-label={label}
  aria-disabled={disabled}
>
  <div class="mb-3 flex items-center justify-between">
    <h3 class="text-sm font-semibold">{label}</h3>
    {#if onClear && selectedId !== null}
      <button
        type="button"
        onclick={onClear}
        class="text-xs text-muted-foreground hover:text-foreground"
        aria-label="Clear {label}"
      >
        Clear
      </button>
    {/if}
  </div>

  <input
    type="text"
    role="searchbox"
    aria-label="Filter {label}"
    class="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    placeholder="Search..."
    bind:value={searchTerm}
  />

  <div class="text-xs text-muted-foreground mb-2">
    {filteredAvailable} of {filteredTotal} available
  </div>

  <div
    class="space-y-4 overflow-y-auto"
    style="max-height: {maxHeight};"
    aria-label={label}
  >
    {#each filteredItems as group (group.groupName)}
      <div>
        {#if group.groupName}
          <div
            class="sticky top-0 mb-2 bg-card py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            {group.groupName}
          </div>
        {/if}

        <div class="space-y-1">
          {#each group.items as item (item.entity.id)}
            <button
              type="button"
              disabled={!item.available}
              aria-pressed={item.entity.id === selectedId}
              class={cn(
                "flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors",
                item.entity.id === selectedId
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50",
                !item.available && "cursor-not-allowed opacity-40",
              )}
              onclick={() => {
                if (item.available) {
                  onItemSelect(item.entity);
                }
              }}
            >
              <div class="flex-1 truncate">
                <span class="font-medium">{item.label}</span>
                {#if item.description}
                  <span class="ml-2 text-xs text-muted-foreground">{item.description}</span>
                {/if}
              </div>
              {#if item.badge}
                <span class="ml-auto rounded bg-secondary px-2 py-0.5 text-xs">{item.badge}</span>
              {/if}
            </button>
          {/each}

          {#if group.items.length === 0}
            <div class="px-3 py-2 text-sm text-muted-foreground">No results</div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
