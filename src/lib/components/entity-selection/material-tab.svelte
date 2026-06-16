<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { MaterialEntity } from "$lib/wasm/types";
  import type { ExternalOnlyMaterial } from "$lib/state/external-compatibility";
  import { customCompounds, type StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import {
    isElementId,
    isExternalMaterial,
    inElements,
    inCompounds,
    compareElements,
    compareByName,
  } from "$lib/utils/material-filters";
  import CompoundEditorModal from "$lib/components/compound-editor-modal.svelte";
  import PickerSummaryBar from "./picker-summary-bar.svelte";

  type Material = MaterialEntity | ExternalOnlyMaterial;
  type SubTab = "compounds" | "elements" | "custom";

  interface Props {
    selectionState: EntitySelectionState;
    onSelect: (material: Material) => void;
    onClear: () => void;
    /** Shared search query owned by `<EntitySelection>` (picker-level row). */
    query?: string;
  }

  let { selectionState, onSelect, onClear, query = "" }: Props = $props();

  let compoundModalOpen = $state(false);
  let editingCompound = $state<StoredCompoundInternal | null>(null);

  // Sub-tab state — persisted to localStorage, default = compounds.
  const STORAGE_KEY = "webdedx.materialSubtab";

  function loadSubTab(): SubTab {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "elements" || stored === "custom") return stored;
    } catch {
      // localStorage unavailable (SSR, private mode)
    }
    return "compounds";
  }

  function saveSubTab(tab: SubTab) {
    try {
      localStorage.setItem(STORAGE_KEY, tab);
    } catch {
      // ignore
    }
  }

  let activeSubTab = $state<SubTab>(loadSubTab());

  function setSubTab(tab: SubTab) {
    activeSubTab = tab;
    saveSubTab(tab);
  }

  // Scroll position memory per sub-tab.
  let scrollPositions = $state<Record<SubTab, number>>({ compounds: 0, elements: 0, custom: 0 });
  let listEl = $state<HTMLUListElement | null>(null);
  let showBottomFade = $state(false);

  function shouldShowBottomFade(el: HTMLElement | null): boolean {
    if (!el) return false;
    const maxScrollTop = el.scrollHeight - el.clientHeight;
    if (maxScrollTop <= 1) return false;
    return el.scrollTop < maxScrollTop - 1;
  }

  function updateFade() {
    showBottomFade = shouldShowBottomFade(listEl);
  }

  // Save + restore scroll position when sub-tab switches.
  let previousSubTab: SubTab | null = null;
  $effect(() => {
    const current = activeSubTab;
    if (previousSubTab !== null && previousSubTab !== current && listEl) {
      scrollPositions[previousSubTab] = listEl.scrollTop;
    }
    previousSubTab = current;
    // Restore scroll on next tick after DOM update.
    if (listEl) {
      queueMicrotask(() => {
        if (listEl) {
          listEl.scrollTop = scrollPositions[current];
          updateFade();
        }
      });
    }
  });

  $effect(() => {
    // Re-evaluate fade when filtered list changes.
    void filteredActive;
    queueMicrotask(updateFade);
  });

  function isGas(m: Material): boolean {
    return !isExternalMaterial(m) && m.isGasByDefault;
  }

  function searchText(m: Material): string {
    if (isExternalMaterial(m)) {
      return `${m.localId} ${m.name} ${m.label} ext external`;
    }
    return `${m.id} ${m.name} ${m.rawName ?? ""}`;
  }

  /**
   * Match the query against a material's searchable text.
   * Supports plain substring + density operators (advanced syntax):
   *   ρ>N   ρ>=N   ρ<N   ρ<=N   ρ=N   (also accepts ASCII alias `rho`)
   */
  function matches(m: Material, q: string): boolean {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return true;
    const rhoOp = trimmed.match(/^(?:ρ|rho)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/);
    if (rhoOp) {
      const density = m.density;
      if (density === undefined) return false;
      const n = Number(rhoOp[2]);
      if (rhoOp[1] === ">=") return density >= n;
      if (rhoOp[1] === "<=") return density <= n;
      if (rhoOp[1] === ">") return density > n;
      if (rhoOp[1] === "<") return density < n;
      if (rhoOp[1] === "=") return Math.abs(density - n) < 0.0001;
    }
    return searchText(m).toLowerCase().includes(trimmed);
  }

  const allMaterials = $derived<Material[]>([
    ...selectionState.allMaterials,
    ...selectionState.externalOnlyMaterials,
  ]);

  const elements = $derived(allMaterials.filter(inElements).sort(compareElements));

  const compounds = $derived(allMaterials.filter(inCompounds).sort(compareByName));

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
  const hasQuery = $derived(query.trim().length > 0);

  let showOnlySelected = $state(false);

  const filteredActive = $derived.by<Material[]>(() => {
    let base: Material[];
    if (activeSubTab === "elements") base = filteredElements;
    else if (activeSubTab === "custom") base = filteredCustom as Material[];
    else base = filteredCompounds;
    if (!showOnlySelected) return base;
    return base.filter((m) => (isMultiMode ? isMultiSelected(m) : selected?.id === m.id));
  });

  function isAvailable(m: Material): boolean {
    return selectionState.availableMaterials.some((q) => q.id === m.id);
  }

  function formatDensity(m: Material): string | undefined {
    if (isExternalMaterial(m)) return m.density !== undefined ? m.density.toFixed(4) : undefined;
    return m.density.toFixed(m.density < 0.1 ? 4 : 2);
  }

  const selected = $derived(selectionState.selectedMaterial);

  // Multi-select mode: only active when advanced mode is on AND across=material.
  const isMultiMode = $derived(isAdvancedMode.value && selectionState.across === "material");
  const multiIds = $derived(selectionState.multiSelected.material);

  function isMultiSelected(m: Material): boolean {
    return multiIds.includes(m.id);
  }

  function isAnchor(m: Material): boolean {
    return multiIds[0] === m.id;
  }

  function handleMultiToggle(m: Material): void {
    selectionState.toggleMulti("material", m.id);
  }

  function clearAllMulti(): void {
    const [, ...rest] = multiIds;
    for (const id of rest) selectionState.toggleMulti("material", id);
  }

  // Summary bar derived values
  const summaryCount = $derived(isMultiMode ? multiIds.length : selected ? 1 : 0);
  const summaryLabels = $derived(
    isMultiMode
      ? multiIds.map((id) => {
          const m = resolveMaterialById(id);
          if (!m) return String(id);
          const dens = formatDensity(m);
          return dens ? `${m.name} (ρ=${dens})` : m.name;
        })
      : selected
        ? [
            formatDensity(selected)
              ? `${selected.name} (ρ=${formatDensity(selected)} g/cm³)`
              : selected.name,
          ]
        : [],
  );

  function resolveMaterialById(id: number | string): Material | null {
    return (
      allMaterials.find((m) => m.id === id) ??
      (customItems.find((m) => m.id === id) as Material | undefined) ??
      null
    );
  }

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

  // If a selection lands in a different sub-tab than the active one, silently switch.
  $effect(() => {
    const sel = selectionState.selectedMaterial;
    if (!sel) return;
    if (inElements(sel) && activeSubTab !== "elements") {
      const id = (sel as MaterialEntity).id;
      if (typeof id === "number" && isElementId(id)) {
        setSubTab("elements");
      }
    } else if (
      typeof sel.id === "string" &&
      sel.id.startsWith("cc_") &&
      activeSubTab !== "custom"
    ) {
      setSubTab("custom");
    }
  });
</script>

{#snippet materialListItems(items: typeof filteredElements)}
  {#each items as m (m.id)}
    {@const available = isAvailable(m)}
    {@const inMulti = isMultiSelected(m)}
    {@const anchor = isAnchor(m)}
    {@const isSingleSelected = !isMultiMode && selected?.id === m.id}
    {@const isChecked = isMultiMode ? inMulti : isSingleSelected}
    {@const dens = formatDensity(m)}
    <li role="presentation">
      <button
        type="button"
        role="option"
        aria-selected={isMultiMode ? inMulti : isSingleSelected}
        aria-disabled={!available || (isMultiMode && anchor)}
        data-testid="picker-material-item-{m.id}"
        tabindex={-1}
        disabled={!available || (isMultiMode && anchor)}
        class={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left",
          available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
          isChecked && "ring-1 ring-inset ring-orange-400 bg-orange-50/60 font-semibold",
        )}
        onclick={() => {
          if (!available) return;
          if (isMultiMode) {
            if (!anchor) handleMultiToggle(m);
          } else {
            onSelect(m);
          }
        }}
      >
        <span
          aria-hidden="true"
          class="w-4 shrink-0 text-center text-xs {isChecked
            ? 'font-bold text-orange-700'
            : 'text-muted-foreground'}">{isChecked ? "✓" : isMultiMode ? "○" : ""}</span
        >
        <span class="flex min-w-0 flex-1 items-center gap-2">
          {#if isExternalMaterial(m)}<span aria-hidden="true">🔗</span>{/if}
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
  {#if items.length === 0}
    <li class="px-2 py-4 text-center text-sm text-muted-foreground">No materials match.</li>
  {/if}
{/snippet}

{#snippet customListItems(items: typeof filteredCustom)}
  {#each items as m (m.id)}
    {@const inMulti = isMultiSelected(m)}
    {@const anchor = isAnchor(m)}
    {@const isSingleSelected = !isMultiMode && selected?.id === m.id}
    {@const isChecked = isMultiMode ? inMulti : isSingleSelected}
    {@const dens = formatDensity(m)}
    <li role="presentation">
      <div class="flex items-center gap-1">
        <button
          type="button"
          role="option"
          aria-selected={isMultiMode ? inMulti : isSingleSelected}
          aria-disabled={isMultiMode && anchor}
          data-testid="picker-material-item-{m.id}"
          tabindex={-1}
          disabled={isMultiMode && anchor}
          class={cn(
            "min-w-0 flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
            isChecked && "ring-1 ring-inset ring-orange-400 bg-orange-50/60 font-semibold",
          )}
          onclick={() => {
            if (isMultiMode) {
              if (!anchor) handleMultiToggle(m);
            } else {
              onSelect(m);
            }
          }}
        >
          <span class="flex items-center gap-1">
            <span
              aria-hidden="true"
              class="w-4 shrink-0 text-center text-xs {isChecked
                ? 'font-bold text-orange-700'
                : 'text-muted-foreground'}">{isChecked ? "✓" : isMultiMode ? "○" : ""}</span
            >
            <span class="truncate">
              {m.name}
              {#if dens}
                <span class="ml-1 text-xs text-muted-foreground">(ρ={dens} g/cm³)</span>
              {/if}
            </span>
            {#if isGas(m)}<span aria-hidden="true" title="Gas at standard conditions">(≋)</span
              >{/if}
          </span>
        </button>
        {#if !isMultiMode}
          <button
            type="button"
            class="rounded p-1 text-xs text-muted-foreground hover:text-foreground"
            title="Edit compound"
            aria-label="Edit compound {m.name}"
            data-testid="picker-material-edit-compound-{m.id}"
            onclick={() => handleEditCompound(m.source)}
          >
            ✎
          </button>
        {/if}
      </div>
    </li>
  {/each}
  {#if items.length === 0}
    <li class="px-2 py-4 text-center text-sm text-muted-foreground">No custom compounds yet.</li>
  {/if}
{/snippet}

<div class="space-y-2" data-testid="picker-material-tab">
  <!-- Compact sticky summary bar -->
  <PickerSummaryBar
    count={summaryCount}
    {summaryLabels}
    onClear={isMultiMode ? clearAllMulti : onClear}
    onlySelected={showOnlySelected}
    onToggleOnlySelected={isMultiMode
      ? () => {
          showOnlySelected = !showOnlySelected;
        }
      : undefined}
    testId="picker-material-selected"
  />

  <!-- Sub-tab pills: fixed order Compounds · Elements · Custom -->
  <div
    class="flex gap-1"
    role="tablist"
    aria-label="Material sub-tabs"
    data-testid="picker-material-subtabs"
  >
    <button
      type="button"
      role="tab"
      aria-selected={activeSubTab === "compounds"}
      data-testid="material-subtab-compounds"
      class={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        activeSubTab === "compounds"
          ? "border-primary bg-primary/15 text-primary"
          : "border-muted bg-muted/40 text-muted-foreground hover:bg-accent",
      )}
      onclick={() => setSubTab("compounds")}
    >
      Compounds {hasQuery ? filteredCompounds.length : compounds.length}
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={activeSubTab === "elements"}
      data-testid="material-subtab-elements"
      class={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        activeSubTab === "elements"
          ? "border-primary bg-primary/15 text-primary"
          : "border-muted bg-muted/40 text-muted-foreground hover:bg-accent",
      )}
      onclick={() => setSubTab("elements")}
    >
      Elements {hasQuery ? filteredElements.length : elements.length}
    </button>
    {#if isAdvancedMode.value}
      <button
        type="button"
        role="tab"
        aria-selected={activeSubTab === "custom"}
        data-testid="material-subtab-custom"
        class={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          activeSubTab === "custom"
            ? "border-primary bg-primary/15 text-primary"
            : "border-muted bg-muted/40 text-muted-foreground hover:bg-accent",
        )}
        onclick={() => setSubTab("custom")}
      >
        Custom {hasQuery ? filteredCustom.length : customItems.length}
      </button>
    {/if}
  </div>

  <!-- Active sub-tab list with bounded scroll -->
  <div class="relative">
    <ul
      role="listbox"
      aria-label={activeSubTab === "elements"
        ? "Elements"
        : activeSubTab === "custom"
          ? "Custom compounds"
          : "Compounds"}
      aria-multiselectable={isMultiMode}
      tabindex="0"
      class="max-h-52 overflow-auto overscroll-y-contain space-y-0.5"
      bind:this={listEl}
      onscroll={updateFade}
      data-testid="picker-material-list-{activeSubTab}"
    >
      {#if activeSubTab === "elements"}
        {@render materialListItems(filteredElements)}
      {:else if activeSubTab === "custom"}
        {@render customListItems(filteredCustom)}
      {:else}
        {@render materialListItems(filteredCompounds)}
      {/if}
    </ul>
    {#if showBottomFade}
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent rounded-b"
        aria-hidden="true"
        data-testid="picker-material-fade"
      ></div>
    {/if}
  </div>

  <!-- + New custom material pill always visible (Advanced mode) -->
  {#if isAdvancedMode.value}
    <button
      type="button"
      class="flex w-full items-center justify-center gap-1 rounded-full border-2 border-orange-500 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50"
      data-testid="picker-material-add-compound"
      onclick={handleAddCompound}
    >
      + New custom material
    </button>
  {/if}
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
