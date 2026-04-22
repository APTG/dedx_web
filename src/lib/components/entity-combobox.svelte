<script lang="ts" generic="T extends { id: number; name: string }">
  import { Combobox } from "bits-ui";
  import { cn } from "$lib/utils";

  interface EntityItem<T> {
    entity: T;
    available: boolean;
    label: string;
    description?: string;
  }

  interface EntityItem<T> {
    entity: T;
    available: boolean;
    label: string;
    description?: string;
  }

  interface Props<T extends { id: number; name: string }> {
    label: string;
    items: EntityItem<T>[];
    selectedId: number | null;
    placeholder?: string;
    disabled?: boolean;
    onItemSelect: (entity: T) => void;
    onClear?: () => void;
    class?: string;
  }

  let { label, items, selectedId, placeholder, disabled = false, onItemSelect, onClear, class: className }: Props<T> = $props();

  let open = $state(false);
  let searchTerm = $state("");
  let selectedValue = $derived.by(() => {
    if (selectedId === null) return "";
    const selectedItem = items.find((item) => item.entity.id === selectedId);
    return selectedItem ? selectedItem.label : "";
  });

  $effect(() => {
    if (!open) {
      searchTerm = "";
    }
  });

  const filteredItems = $derived.by(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return items;
    return items.filter((item) => item.label.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term));
  });

  const selectedItem = $derived.by(() => {
    return items.find((item) => item.entity.id === selectedId);
  });
</script>

<Combobox.Root
  {open}
  {disabled}
  selected={selectedId}
  onValueChange={(value) => {
    const id = Number(value);
    if (!Number.isNaN(id)) {
      const item = items.find((i) => i.entity.id === id);
      if (item && item.available) {
        onItemSelect(item.entity);
      }
    }
  }}
  onOpenChange={(isOpen) => {
    open = isOpen;
    if (!isOpen) searchTerm = "";
  }}
  class={cn("relative", className)}
>
  <Combobox.Trigger
    class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    aria-label={label}
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
      class="ml-2 opacity-50"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </Combobox.Trigger>

  <Combobox.Content class="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80">
    <Combobox.Input
      class="flex h-10 w-full rounded-md border-b border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      placeholder="Search..."
      bind:value={searchTerm}
    />
    <Combobox.Viewport class="p-1 max-h-[300px] overflow-y-auto">
      {#if filteredItems.length === 0}
        <div class="px-3 py-2 text-sm text-muted-foreground">No results</div>
      {:else}
        {#each filteredItems as item (item.entity.id)}
          <Combobox.Item
            value={String(item.entity.id)}
            disabled={!item.available}
            class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            <span class="truncate">{item.label}</span>
            {#if item.description}
              <span class="ml-auto text-xs text-muted-foreground">{item.description}</span>
            {/if}
          </Combobox.Item>
        {/each}
      {/if}
    </Combobox.Viewport>
  </Combobox.Content>
</Combobox.Root>
