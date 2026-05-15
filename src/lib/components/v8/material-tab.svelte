<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { MaterialEntity } from "$lib/wasm/types";
  import type { ExternalOnlyMaterial } from "$lib/state/external-compatibility";
  import SelectedPill from "./selected-pill.svelte";
  import SearchInput from "./search-input.svelte";

  type Material = MaterialEntity | ExternalOnlyMaterial;
  type SubTab = "elements" | "compounds";

  interface Props {
    selectionState: EntitySelectionState;
    onSelect: (material: Material) => void;
    onClear: () => void;
  }

  let { selectionState, onSelect, onClear }: Props = $props();

  let subTab = $state<SubTab>("elements");
  let query = $state("");
  let inputRef: HTMLInputElement | null = $state(null);

  $effect(() => {
    inputRef?.focus();
  });

  function isExternal(m: Material): m is ExternalOnlyMaterial {
    return typeof m.id === "string";
  }

  function isGas(m: Material): boolean {
    return !isExternal(m) && m.isGasByDefault;
  }

  function searchText(m: Material): string {
    if (isExternal(m)) {
      return `${m.localId} ${m.name} ${m.label} ext external`;
    }
    return `${m.id} ${m.name} ${m.rawName ?? ""}`;
  }

  function matches(m: Material, q: string): boolean {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return true;
    return searchText(m).toLowerCase().includes(trimmed);
  }

  function isElementId(id: number): boolean {
    return id >= 1 && id <= 98;
  }

  /**
   * Inline external materials into Elements / Compounds sub-tabs based on
   * `atomicNumber`. External materials without atomicNumber go into Compounds
   * (best-effort heuristic; matches v7's `id > 98 || id === 906` rule).
   */
  function inElements(m: Material): boolean {
    if (!isExternal(m)) return isElementId(m.id as number);
    return m.atomicNumber !== undefined && isElementId(m.atomicNumber);
  }

  function inCompounds(m: Material): boolean {
    if (!isExternal(m)) return (m.id as number) > 98 || m.id === 906;
    return !(m.atomicNumber !== undefined && isElementId(m.atomicNumber));
  }
  const allMaterials = $derived<Material[]>([
    ...selectionState.allMaterials,
    ...selectionState.externalOnlyMaterials,
  ]);

  const elements = $derived(
    allMaterials
      .filter(inElements)
      .sort((a, b) => {
        const ai = isExternal(a) ? (a.atomicNumber ?? 999) : (a.id as number);
        const bi = isExternal(b) ? (b.atomicNumber ?? 999) : (b.id as number);
        return ai - bi;
      }),
  );

  const compounds = $derived(
    allMaterials
      .filter(inCompounds)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const filteredElements = $derived(elements.filter((m) => matches(m, query)));
  const filteredCompounds = $derived(compounds.filter((m) => matches(m, query)));

  const elementsExtCount = $derived(elements.filter(isExternal).length);
  const compoundsExtCount = $derived(compounds.filter(isExternal).length);
  const elementsBuiltinCount = $derived(elements.length - elementsExtCount);
  const compoundsBuiltinCount = $derived(compounds.length - compoundsExtCount);

  function isAvailable(m: Material): boolean {
    return selectionState.availableMaterials.some((q) => q.id === m.id);
  }

  function formatDensity(m: Material): string | undefined {
    if (isExternal(m)) return m.density !== undefined ? m.density.toFixed(4) : undefined;
    return m.density.toFixed(m.density < 0.1 ? 4 : 2);
  }

  const selected = $derived(selectionState.selectedMaterial);
  const activeItems = $derived(subTab === "elements" ? filteredElements : filteredCompounds);
</script>

<div class="space-y-3" data-testid="v8-material-tab">
  {#if selected}
    {@const dens = formatDensity(selected)}
    <SelectedPill
      label={selected.name}
      meta={dens ? `ρ=${dens} g/cm³` : undefined}
      glyph={isGas(selected) ? "≋" : isExternal(selected) ? "🔗" : undefined}
      onClear={onClear}
      data-testid="v8-material-selected"
    />
  {/if}

  <SearchInput
    value={query}
    onInput={(v) => (query = v)}
    bind:inputRef
    placeholder="Name or ID…"
    data-testid="v8-material-search"
  />

  <div role="tablist" aria-label="Material sub-tabs" class="flex gap-1 border-b">
    <button
      type="button"
      role="tab"
      aria-selected={subTab === "elements"}
      data-testid="v8-material-subtab-elements"
      class={cn(
        "px-3 py-1 text-sm rounded-t",
        subTab === "elements"
          ? "border border-b-0 bg-background font-medium"
          : "text-muted-foreground hover:text-foreground",
      )}
      onclick={() => (subTab = "elements")}
    >
      Elements ({elementsBuiltinCount}{elementsExtCount > 0 ? ` + ${elementsExtCount}🔗` : ""})
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={subTab === "compounds"}
      data-testid="v8-material-subtab-compounds"
      class={cn(
        "px-3 py-1 text-sm rounded-t",
        subTab === "compounds"
          ? "border border-b-0 bg-background font-medium"
          : "text-muted-foreground hover:text-foreground",
      )}
      onclick={() => (subTab = "compounds")}
    >
      Compounds ({compoundsBuiltinCount}{compoundsExtCount > 0 ? ` + ${compoundsExtCount}🔗` : ""})
    </button>
  </div>

  <ul
    role="listbox"
    aria-label={subTab === "elements" ? "Elements" : "Compounds"}
    class="max-h-80 overflow-auto space-y-0.5"
    data-testid="v8-material-list"
  >
    {#each activeItems as m (m.id)}
      {@const available = isAvailable(m)}
      {@const isSelected = selected?.id === m.id}
      {@const dens = formatDensity(m)}
      <li>
        <button
          type="button"
          role="option"
          aria-selected={isSelected}
          aria-disabled={!available}
          data-testid="v8-material-item-{m.id}"
          tabindex={-1}
          disabled={!available}
          class={cn(
            "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-left",
            available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
            isSelected && "bg-primary/15 font-semibold",
          )}
          onclick={() => available && onSelect(m)}
        >
          <span class="flex items-center gap-2">
            {#if isExternal(m)}<span aria-hidden="true">🔗</span>{/if}
            <span>{m.name}</span>
            {#if isGas(m)}<span aria-hidden="true" title="Gas at standard conditions">(≋)</span>{/if}
          </span>
          {#if dens}
            <span class="font-mono text-xs text-muted-foreground">{dens}</span>
          {/if}
        </button>
      </li>
    {/each}
    {#if activeItems.length === 0}
      <li class="px-2 py-4 text-center text-sm text-muted-foreground">No materials match.</li>
    {/if}
  </ul>
</div>
