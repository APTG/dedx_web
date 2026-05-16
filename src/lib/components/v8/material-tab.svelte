<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { MaterialEntity } from "$lib/wasm/types";
  import type { ExternalOnlyMaterial } from "$lib/state/external-compatibility";
  import {
    customCompounds,
    type StoredCompoundInternal,
  } from "$lib/state/custom-compounds.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import CompoundEditorModal from "$lib/components/compound-editor-modal.svelte";
  import SelectedPill from "./selected-pill.svelte";
  import SearchInput from "./search-input.svelte";

  type Material = MaterialEntity | ExternalOnlyMaterial;

  interface Props {
    selectionState: EntitySelectionState;
    onSelect: (material: Material) => void;
    onClear: () => void;
  }

  let { selectionState, onSelect, onClear }: Props = $props();

  let query = $state("");
  let inputRef: HTMLInputElement | null = $state(null);
  let compoundModalOpen = $state(false);
  let editingCompound = $state<StoredCompoundInternal | null>(null);

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

  const customItems = $derived.by(() => {
    if (!isAdvancedMode.value) return [];
    return [...customCompounds.compounds]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((compound) => ({
        id: compound.id,
        name: compound.name,
        density: compound.density,
        phase: compound.phase,
        elements: compound.elements,
        iValue: compound.iValue,
        isGasByDefault: compound.phase === "gas",
        source: compound,
      }));
  });

  const filteredElements = $derived(elements.filter((m) => matches(m, query)));
  const filteredCompounds = $derived(compounds.filter((m) => matches(m, query)));
  const filteredCustom = $derived(customItems.filter((m) => matches(m, query)));

  function isAvailable(m: Material): boolean {
    return selectionState.availableMaterials.some((q) => q.id === m.id);
  }

  function formatDensity(m: Material): string | undefined {
    if (isExternal(m)) return m.density !== undefined ? m.density.toFixed(4) : undefined;
    return m.density.toFixed(m.density < 0.1 ? 4 : 2);
  }

  const selected = $derived(selectionState.selectedMaterial);

  function handleAddCompound() {
    editingCompound = null;
    compoundModalOpen = true;
  }

  function handleEditCompound(compound: StoredCompoundInternal) {
    editingCompound = compound;
    compoundModalOpen = true;
  }

  function handleSaveCompound(data: {
    name: string;
    density: number;
    iValue?: number;
    elements: Array<{ atomicNumber: number; atomCount: number }>;
    phase: "gas" | "condensed";
  }) {
    if (editingCompound) {
      customCompounds.update(editingCompound.id, data);
    } else {
      customCompounds.create(data);
    }
    compoundModalOpen = false;
  }

  function handleDeleteCompound() {
    if (!editingCompound) return;
    customCompounds.delete(editingCompound.id);
    compoundModalOpen = false;
    editingCompound = null;
  }
</script>

<div class="space-y-3" data-testid="v8-material-tab">
  {#if selected}
    {@const dens = formatDensity(selected)}
    <SelectedPill
      label={dens ? `${selected.name} (ρ=${dens} g/cm³)` : selected.name}
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

  <div
    class={cn(
      "grid gap-3",
      isAdvancedMode.value
        ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2",
    )}
    data-testid="v8-material-columns"
  >
    <section class="min-w-0" data-testid="v8-material-col-elements">
      <h4 class="mb-1 px-2 text-xs uppercase tracking-wider text-muted-foreground">Elements</h4>
      <ul
        role="listbox"
        aria-label="Elements"
        tabindex="0"
        class="max-h-52 overflow-auto space-y-0.5"
        data-testid="v8-material-list-elements"
      >
        {#each filteredElements as m (m.id)}
          {@const available = isAvailable(m)}
          {@const isSelected = selected?.id === m.id}
          {@const dens = formatDensity(m)}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-disabled={!available}
              data-testid="v8-material-item-{m.id}"
              tabindex={-1}
              disabled={!available}
              class={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left",
                available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                isSelected && "bg-primary/15 font-semibold",
              )}
              onclick={() => available && onSelect(m)}
            >
              <span class="flex min-w-0 items-center gap-2">
                {#if isExternal(m)}<span aria-hidden="true">🔗</span>{/if}
                <span class="truncate">
                  {m.name}
                  {#if dens}
                    <span class="ml-1 text-xs text-muted-foreground">(ρ={dens} g/cm³)</span>
                  {/if}
                </span>
                {#if isGas(m)}<span aria-hidden="true" title="Gas at standard conditions">(≋)</span>{/if}
              </span>
            </button>
          </li>
        {/each}
        {#if filteredElements.length === 0}
          <li class="px-2 py-4 text-center text-sm text-muted-foreground">No materials match.</li>
        {/if}
      </ul>
    </section>

    <section class="min-w-0" data-testid="v8-material-col-compounds">
      <h4 class="mb-1 px-2 text-xs uppercase tracking-wider text-muted-foreground">Compounds</h4>
      <ul
        role="listbox"
        aria-label="Compounds"
        tabindex="0"
        class="max-h-52 overflow-auto space-y-0.5"
        data-testid="v8-material-list-compounds"
      >
        {#each filteredCompounds as m (m.id)}
          {@const available = isAvailable(m)}
          {@const isSelected = selected?.id === m.id}
          {@const dens = formatDensity(m)}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-disabled={!available}
              data-testid="v8-material-item-{m.id}"
              tabindex={-1}
              disabled={!available}
              class={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left",
                available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                isSelected && "bg-primary/15 font-semibold",
              )}
              onclick={() => available && onSelect(m)}
            >
              <span class="flex min-w-0 items-center gap-2">
                {#if isExternal(m)}<span aria-hidden="true">🔗</span>{/if}
                <span class="truncate">
                  {m.name}
                  {#if dens}
                    <span class="ml-1 text-xs text-muted-foreground">(ρ={dens} g/cm³)</span>
                  {/if}
                </span>
                {#if isGas(m)}<span aria-hidden="true" title="Gas at standard conditions">(≋)</span>{/if}
              </span>
            </button>
          </li>
        {/each}
        {#if filteredCompounds.length === 0}
          <li class="px-2 py-4 text-center text-sm text-muted-foreground">No materials match.</li>
        {/if}
      </ul>
    </section>

    {#if isAdvancedMode.value}
      <section class="min-w-0" data-testid="v8-material-col-custom">
        <div class="mb-1 flex items-center justify-between px-2">
          <h4 class="text-xs uppercase tracking-wider text-muted-foreground">Custom</h4>
          <button
            type="button"
            class="rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
            data-testid="v8-material-add-compound"
            onclick={handleAddCompound}
          >
            + Add compound
          </button>
        </div>
        <ul
          role="listbox"
          aria-label="Custom compounds"
          tabindex="0"
          class="max-h-52 overflow-auto space-y-0.5"
          data-testid="v8-material-list-custom"
        >
          {#each filteredCustom as m (m.id)}
            {@const isSelected = selected?.id === m.id}
            {@const dens = formatDensity(m)}
            <li role="presentation">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-testid="v8-material-item-{m.id}"
                  tabindex={-1}
                  class={cn(
                    "min-w-0 flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                    isSelected && "bg-primary/15 font-semibold",
                  )}
                  onclick={() => onSelect(m)}
                >
                  <span class="truncate">
                    {m.name}
                    {#if dens}
                      <span class="ml-1 text-xs text-muted-foreground">(ρ={dens} g/cm³)</span>
                    {/if}
                  </span>
                  {#if isGas(m)}<span aria-hidden="true" title="Gas at standard conditions"> (≋)</span>{/if}
                </button>
                <button
                  type="button"
                  class="rounded p-1 text-xs text-muted-foreground hover:text-foreground"
                  title="Edit compound"
                  aria-label="Edit compound {m.name}"
                  data-testid="v8-material-edit-compound-{m.id}"
                  onclick={() => handleEditCompound(m.source)}
                >
                  ✎
                </button>
              </div>
            </li>
          {/each}
          {#if filteredCustom.length === 0}
            <li class="px-2 py-4 text-center text-sm text-muted-foreground">
              No custom compounds yet.
            </li>
          {/if}
        </ul>
      </section>
    {/if}
  </div>
</div>

<CompoundEditorModal
  open={compoundModalOpen}
  compound={editingCompound}
  onOpenChange={(open) => {
    compoundModalOpen = open;
    if (!open) editingCompound = null;
  }}
  onSave={handleSaveCompound}
  onDelete={handleDeleteCompound}
/>
