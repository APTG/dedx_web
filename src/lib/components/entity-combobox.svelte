<script lang="ts" generics="T extends { id: number; name: string }">
  import { tick, untrack } from "svelte";
  import { Combobox } from "bits-ui";
  import { cn } from "$lib/utils";

  interface SectionHeader {
    type: "section";
    label: string;
  }

  interface EntityItem<T> {
    entity: T;
    available: boolean;
    label: string;
    description?: string;
    searchText?: string;
    isElectron?: boolean;
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

  let {
    label,
    items,
    selectedId,
    placeholder,
    disabled = false,
    onItemSelect,
    onClear,
    class: className,
  }: Props<T> = $props();

  const labelId = $derived(`label-${label.toLowerCase().replace(/\s+/g, "-")}`);
  const triggerId = $derived(`trigger-${label.toLowerCase().replace(/\s+/g, "-")}`);

  function getSearchPlaceholder(): string {
    if (label === "Particle") return "Name, symbol, Z...";
    if (label === "Material") return "Name or ID...";
    return "Search...";
  }

  function isSection(item: ComboboxEntry<T>): item is SectionHeader {
    return (item as SectionHeader).type === "section";
  }

  let open = $state(false);
  let inputValue = $state("");
  let inputRef = $state<HTMLInputElement | null>(null);
  // untrack: Svelte would warn that this captures the initial prop value; the
  // $effect below handles subsequent changes, so the snapshot is intentional.
  let valueStr = $state(untrack(() => (selectedId !== null ? String(selectedId) : "")));

  // Keep valueStr in sync when selectedId changes externally (e.g., resetAll)
  $effect(() => {
    valueStr = selectedId !== null ? String(selectedId) : "";
  });

  // Reset the search term and focus the input whenever the dropdown opens.
  // Note: bind:inputValue on Combobox.Root does not propagate typed values back
  // (bits-ui's inputValue prop is not $bindable), so we track the typed text via
  // an oninput handler on Combobox.Input directly.
  $effect(() => {
    if (open) {
      inputValue = "";
      tick().then(() => inputRef?.focus());
    }
  });

  const selectedItem = $derived.by(() => {
    if (selectedId === null) return undefined;
    for (const item of items) {
      if (!isSection(item) && (item as EntityItem<T>).entity.id === selectedId) {
        return item as EntityItem<T>;
      }
    }
    return undefined;
  });

  // Flat item list for Bits UI keyboard navigation and label resolution
  const bitsItems = $derived.by(() =>
    items
      .filter((item) => !isSection(item))
      .map((item) => ({
        value: String((item as EntityItem<T>).entity.id),
        label: (item as EntityItem<T>).label,
        disabled: !(item as EntityItem<T>).available,
      })),
  );

  // Items grouped by preceding section header, filtered by current search term.
  // `searchText` lets callers inject domain-specific keywords (aliases/symbols/IDs)
  // without polluting the visible label shown in the trigger/list.
  const filteredGroups = $derived.by(() => {
    const term = inputValue.toLowerCase().trim();
    const groups: Array<{ label: string; items: EntityItem<T>[] }> = [];
    let current: { label: string; items: EntityItem<T>[] } | null = null;

    for (const raw of items) {
      if (isSection(raw)) {
        current = { label: raw.label, items: [] };
        groups.push(current);
      } else {
        const ei = raw as EntityItem<T>;
        const searchableText =
          `${ei.label} ${ei.description ?? ""} ${ei.searchText ?? ""}`.toLowerCase();
        if (!term || searchableText.includes(term)) {
          if (!current) {
            current = { label: "", items: [] };
            groups.push(current);
          }
          current.items.push(ei);
        }
      }
    }

    return groups.filter((g) => g.items.length > 0);
  });

  const totalMatchCount = $derived(
    filteredGroups.flatMap((g) => g.items).length,
  );

  function handleValueChange(newValue: string) {
    const numId = Number(newValue);
    for (const item of items) {
      if (!isSection(item)) {
        const ei = item as EntityItem<T>;
        if (ei.entity.id === numId) {
          onItemSelect(ei.entity);
          return;
        }
      }
    }
  }
</script>

<div class={cn("relative", className)}>
  <label for={triggerId} id={labelId} class="mb-2 block text-sm font-medium">
    {label}
  </label>
  <Combobox.Root
    type="single"
    bind:value={valueStr}
    onValueChange={handleValueChange}
    items={bitsItems}
    bind:open
    allowDeselect={false}
    {disabled}
  >
    <div class="relative">
      <Combobox.Trigger
        id={triggerId}
        aria-labelledby={labelId}
        aria-label={label}
        class={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          selectedId !== null && onClear && "pr-8",
        )}
      >
        <span class="truncate">
          {#if selectedItem}
            <span class="flex flex-col text-left">
              <span>{selectedItem.label}</span>
              {#if selectedItem.description}
                <span class="text-xs text-muted-foreground">{selectedItem.description}</span>
              {/if}
            </span>
          {:else}
            <span class="text-muted-foreground">{placeholder ?? label}</span>
          {/if}
        </span>
        {#if !(selectedId !== null && onClear)}
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
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        {/if}
      </Combobox.Trigger>
      {#if selectedId !== null && onClear}
        <button
          type="button"
          aria-label={`Clear ${label}`}
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          onclick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
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
            class="h-4 w-4"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      {/if}
    </div>

    <!--
      ContentStatic with forceMount keeps the listbox element in the DOM at all
      times so EscapeLayer / DismissibleLayer remain active even before the first
      open. {#if open} inside means items are only rendered when the dropdown is
      actually visible, keeping the DOM lean when closed.
    -->
    <Combobox.ContentStatic forceMount={true}>
      {#if open}
        <div
          class="absolute z-50 mt-1 w-full min-w-[8rem] max-w-[calc(100vw-2rem)] overflow-hidden overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <Combobox.Input
            bind:ref={inputRef}
            class="flex h-10 w-full border-b border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={getSearchPlaceholder()}
            oninput={(e: Event) => {
              inputValue = (e.currentTarget as HTMLInputElement).value;
            }}
          />
          {#if inputValue.toLowerCase().trim()}
            <div
              data-match-count
              class="px-3 py-2 text-xs text-muted-foreground"
            >
              {totalMatchCount} {totalMatchCount === 1 ? "result" : "results"}
            </div>
          {/if}
          <div
            data-testid="dropdown-scroll-container"
            class="max-h-[300px] overflow-y-auto p-1"
            style="mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent 100%);"
          >
            {#if filteredGroups.length === 0}
              <div class="px-3 py-2 text-sm text-muted-foreground">No results</div>
            {:else}
              {#each filteredGroups as group (group.label)}
                <Combobox.Group>
                  {#if group.label}
                    <Combobox.GroupHeading
                      class="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {group.label}
                    </Combobox.GroupHeading>
                  {/if}
                    {#each group.items as item, itemIndex (item.entity.id)}
                      {#if item.isElectron}
                        {#if itemIndex > 0}
                          <Combobox.Separator class="my-1 border-t border-muted" />
                        {/if}
                      {/if}
                      <Combobox.Item
                        value={String(item.entity.id)}
                        disabled={!item.available}
                        label={item.label}
                        title={item.isElectron ? "Electrons not supported in libdedx v1.4.0" : undefined}
                        class={cn(
                          "relative flex cursor-default select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                          !item.available && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {item.label}
                        {#if item.description}
                          <span class="ml-2 text-xs text-muted-foreground">{item.description}</span>
                        {/if}
                        {#if item.entity.id === selectedId}
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
                            class="ml-2 shrink-0 text-primary"
                            aria-label="Selected"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        {/if}
                      </Combobox.Item>
                    {/each}
                </Combobox.Group>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </Combobox.ContentStatic>
  </Combobox.Root>
</div>
