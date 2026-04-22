<script lang="ts" generic="T extends { id: number; name: string }">
  import { cn } from "$lib/utils";

  interface SectionHeader {
    type: 'section';
    label: string;
  }

  interface EntityItem<T> {
    entity: T;
    available: boolean;
    label: string;
    description?: string;
  }

  type ComboboxEntry<T> = EntityItem<T> | SectionHeader;

  interface Props<T extends { id: number; name: string }> {
    label: string;
    items: ComboboxEntry<T>[];
    selectedId: number | null;
    placeholder?: string;
    disabled?: boolean;
    onItemSelect: (entity: T) => void;
    onClear?: () => void;
    class?: string;
  }

  let { label, items, selectedId, placeholder, disabled = false, onItemSelect, class: className }: Props<T> = $props();

  function isSection(item: ComboboxEntry<T>): item is SectionHeader {
    return (item as SectionHeader).type === 'section';
  }

  let open = $state(false);
  let searchTerm = $state("");
  let rootEl = $state<HTMLElement | null>(null);

  const selectedItem = $derived.by(() => {
    if (selectedId === null) return undefined;
    for (const item of items) {
      if (!isSection(item) && item.entity.id === selectedId) return item;
    }
    return undefined;
  });

  const filteredItems = $derived.by(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return items;
    return items.filter((item) => {
      if (isSection(item)) return false;
      return item.label.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term);
    });
  });

  function handleTriggerClick(e: MouseEvent) {
    if (!disabled) {
      e.stopPropagation();
      open = !open;
      if (!open) searchTerm = "";
    }
  }

  function handleItemClick(e: MouseEvent, item: EntityItem<T>) {
    e.stopPropagation();
    if (item.available) {
      onItemSelect(item.entity);
      open = false;
      searchTerm = "";
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (rootEl && !rootEl.contains(e.target as Node)) {
      open = false;
      searchTerm = "";
    }
  }

  $effect(() => {
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  });
</script>

<div bind:this={rootEl} class={cn("relative", className)}>
  <button
    type="button"
    aria-label={label}
    aria-haspopup="listbox"
    aria-expanded={open}
    {disabled}
    onclick={handleTriggerClick}
    class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span class="truncate">
      {#if selectedItem}
        {selectedItem.label}
      {:else}
        <span class="text-muted-foreground">{placeholder ?? label}</span>
      {/if}
    </span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="ml-2 shrink-0 opacity-50"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </button>

  <!--
    Content is always mounted (not conditional on open) so getByText finds items
    without needing the async click to resolve first. hidden hides it visually.
  -->
  <div
    role="listbox"
    hidden={!open}
    class="absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
  >
    <input
      class="flex h-10 w-full border-b border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      placeholder="Search..."
      bind:value={searchTerm}
      onclick={(e) => e.stopPropagation()}
    />
    <div class="p-1 max-h-[300px] overflow-y-auto">
      {#if filteredItems.length === 0}
        <div class="px-3 py-2 text-sm text-muted-foreground">No results</div>
      {:else}
        {#each filteredItems as item (isSection(item) ? `section:${item.label}` : item.entity.id)}
          {#if isSection(item)}
            <div class="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {item.label}
            </div>
          {:else}
            <div
              role="option"
              aria-selected={item.entity.id === selectedId}
              data-disabled={!item.available ? "" : undefined}
              onclick={(e) => handleItemClick(e, item)}
              class={cn(
                "relative cursor-default select-none rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                !item.available && "pointer-events-none opacity-50"
              )}
            >
              {item.label}
              {#if item.description}
                <span class="ml-2 text-xs text-muted-foreground">{item.description}</span>
              {/if}
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  </div>
</div>
