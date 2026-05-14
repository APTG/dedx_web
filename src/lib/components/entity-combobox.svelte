<script lang="ts" generics="T extends { id: number | string; name: string }">
  import { tick, untrack } from "svelte";
  import { Combobox } from "bits-ui";
  import { cn } from "$lib/utils.js";
  import { ELECTRON_UNSUPPORTED_TITLE } from "$lib/config/libdedx-version";

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
    actions?: Array<{ label: string; icon?: "edit" | "delete" | "trash"; onClick: () => void }>;
  }

  interface AddButton {
    type: "add-button";
    label?: string;
    onClick: () => void;
  }

  type ComboboxEntry<T> = EntityItem<T> | SectionHeader | AddButton;

  interface Props<T extends { id: number | string; name: string }> {
    label: string;
    items: ComboboxEntry<T>[];
    selectedId: number | string | null;
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
  const instanceId = `${untrack(() => label)}-${Math.random().toString(36).slice(2)}`;
  const openEventName = "dedx:entity-combobox-open";

  function getSearchPlaceholder(): string {
    if (label === "Particle") return "Name, symbol, Z...";
    if (label === "Material") return "Name or ID...";
    return "Search...";
  }

  function isSection(item: ComboboxEntry<T>): item is SectionHeader {
    return (item as SectionHeader).type === "section";
  }

  function isAddButton(item: ComboboxEntry<T>): item is AddButton {
    return (item as AddButton).type === "add-button";
  }

  let open = $state(false);
  let inputValue = $state("");
  let inputRef = $state<HTMLInputElement | null>(null);
  // untrack: Svelte would warn that this captures the initial prop value; the
  // $effect below handles subsequent changes, so the snapshot is intentional.
  // eslint-disable-next-line svelte/prefer-writable-derived
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(openEventName, { detail: instanceId }));
      }
      inputValue = "";
      tick().then(() => inputRef?.focus());
    }
  });

  // Only one entity combobox should be open at a time. The dropdowns are
  // portalled/floating; leaving multiple open makes adjacent selectors overlap
  // visually and was reported in PR #476 follow-up testing.
  $effect(() => {
    if (typeof window === "undefined") return;

    const handleOtherOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== instanceId) {
        open = false;
      }
    };

    window.addEventListener(openEventName, handleOtherOpen);
    return () => window.removeEventListener(openEventName, handleOtherOpen);
  });

  const selectedItem = $derived.by(() => {
    if (selectedId === null) return undefined;
    for (const item of items) {
      if (isSection(item) || isAddButton(item)) continue;
      const entityItem = item as EntityItem<T>;
      if (entityItem.entity.id === selectedId) {
        return entityItem;
      }
    }
    return undefined;
  });

  // Flat item list for Bits UI keyboard navigation and label resolution
  const bitsItems = $derived.by(() =>
    items
      .filter((item) => !isSection(item) && !isAddButton(item))
      .map((item) => ({
        value: String((item as EntityItem<T>).entity.id),
        label: (item as EntityItem<T>).label,
        disabled: !(item as EntityItem<T>).available,
      })),
  );

  // Items grouped by preceding section header, filtered by current search term.
  // `searchText` lets callers inject domain-specific keywords (aliases/symbols/IDs)
  const filteredGroups = $derived.by(() => {
    const term = inputValue.toLowerCase().trim();
    const groups: Array<{ label: string; items: (EntityItem<T> | AddButton)[] }> = [];
    let current: { label: string; items: (EntityItem<T> | AddButton)[] } | null = null;

    for (const raw of items) {
      if (isSection(raw)) {
        current = { label: raw.label, items: [] };
        groups.push(current);
      } else if (isAddButton(raw)) {
        // Always include add button, don't filter by search term
        if (!current) {
          current = { label: "", items: [] };
          groups.push(current);
        }
        current.items.push(raw);
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

    const result = groups.filter((g) => g.items.length > 0);
    return result;
  });

  const totalMatchCount = $derived(filteredGroups.flatMap((g) => g.items).length);

  function handleValueChange(newValue: string) {
    for (const item of items) {
      if (isSection(item) || isAddButton(item)) continue;
      const ei = item as EntityItem<T>;
      if (String(ei.entity.id) === newValue) {
        onItemSelect(ei.entity);
        return;
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
          "flex min-h-[44px] w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
      open. The PopperLayer handles open/close visibility, so we don't need {#if open}.
      
      NOTE: The PopperLayer already handles positioning, so we don't use absolute
      positioning here. The wrapper div just provides styling.
    -->
    <Combobox.ContentStatic forceMount={true} aria-label={`${label} options`}>
      <div
        class="w-full min-w-[8rem] max-w-[calc(100vw-2rem)] overflow-hidden overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
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
          <div data-match-count class="px-3 py-2 text-xs text-muted-foreground">
            {totalMatchCount}
            {totalMatchCount === 1 ? "result" : "results"}
          </div>
        {/if}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- WCAG 2.4.3 / axe scrollable-region-focusable: keyboard users must be
             able to scroll this container; tabindex="0" is the recommended fix. -->
        <div
          data-testid="dropdown-scroll-container"
          class="max-h-[300px] overflow-y-auto p-1"
          style="mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent 100%);"
          tabindex="0"
          aria-label={`${label} options scroll area`}
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
                {#each group.items as item, itemIndex (isAddButton(item) ? "add" : item.entity.id)}
                  {#if isAddButton(item)}
                    <button
                      type="button"
                      class="relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary outline-none hover:bg-accent hover:text-accent-foreground"
                      onclick={(e) => {
                        e.stopPropagation();
                        item.onClick();
                      }}
                      data-testid="add-compound-button"
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
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      {item.label ?? "+ Add compound"}
                    </button>
                  {:else}
                    {#if item.isElectron}
                      {#if itemIndex > 0}
                        <Combobox.Separator class="my-1 border-t border-muted" />
                      {/if}
                    {/if}
                    <Combobox.Item
                      value={String(item.entity.id)}
                      disabled={!item.available}
                      aria-disabled={!item.available ? true : undefined}
                      label={item.label}
                      title={item.isElectron ? ELECTRON_UNSUPPORTED_TITLE : undefined}
                      class={cn(
                        "relative flex cursor-default select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                        !item.available && "cursor-not-allowed opacity-50",
                      )}
                      data-disabled={!item.available ? "" : undefined}
                    >
                      <span class="flex items-center gap-2">
                        {item.label}
                        {#if item.description}
                          <span class="text-xs text-muted-foreground" data-testid="item-description"
                            >{item.description}</span
                          >
                        {/if}
                      </span>
                      <div class="flex items-center gap-1">
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
                            class="shrink-0 text-primary"
                            aria-label="Selected"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        {/if}
                        {#if item.actions}
                          {#each item.actions as action (`${action.icon ?? "action"}-${action.label}`)}
                            <button
                              type="button"
                              class="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                              title={action.label}
                              onclick={(e) => {
                                e.stopPropagation();
                                open = false;
                                action.onClick();
                              }}
                            >
                              {#if action.icon === "edit" || action.icon === "delete"}
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                >
                                  <path
                                    d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                                  />
                                </svg>
                              {:else}
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                  />
                                </svg>
                              {/if}
                            </button>
                          {/each}
                        {/if}
                      </div>
                    </Combobox.Item>
                  {/if}
                {/each}
              </Combobox.Group>
            {/each}
          {/if}
        </div>
      </div>
    </Combobox.ContentStatic>
  </Combobox.Root>
</div>
