<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { ELECTRON_ID } from "$lib/state/entity-selection.svelte";
  import { getParticleListLabel, getParticleSearchText } from "$lib/utils/particle-label";
  import PickerSummaryBar from "./picker-summary-bar.svelte";
  import ParticleListView from "./particle-list-view.svelte";
  import ParticleGridView from "./particle-grid-view.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import { atomicNumber, isExternal, type Particle } from "./particle-tab-helpers";

  interface Props {
    selectionState: EntitySelectionState;
    onSelect: (particle: Particle) => void;
    onClear: () => void;
    /** Shared search query owned by `<EntitySelection>` (picker-level row). */
    query?: string;
    /**
     * Handlers the picker-level search row calls when ↑/↓/↵ are pressed
     * while focused. The parent binds these so `<EntitySelection>` can
     * forward keystrokes to the particle list when this tab is active.
     */
    onArrowKey?: ((direction: "up" | "down") => void) | undefined;
    onEnterKey?: (() => void) | undefined;
  }

  let {
    selectionState,
    onSelect,
    onClear,
    query = "",
    // `$bindable()` defaults are immediately overwritten by the parent
    // `<EntitySelection>`'s `$effect` (which registers `handleArrow` /
    // `handleEnter` for the lifted picker-level search input). The
    // `no-useless-assignment` rule flags the unused undefined default
    // even though it's required to make the prop bindable.
    /* eslint-disable no-useless-assignment */
    onArrowKey = $bindable(),
    onEnterKey = $bindable(),
    /* eslint-enable no-useless-assignment */
  }: Props = $props();

  let highlightedId = $state<number | string | null>(null);
  let showOnlySelected = $state(false);

  function searchText(p: Particle): string {
    if (isExternal(p)) {
      return `${p.localId} ${p.name} ${p.symbol} ${p.label} ext external`;
    }
    return getParticleSearchText(p);
  }

  /**
   * Match the query against a particle's searchable text.
   * Supports plain substring + numeric Z operators (advanced syntax):
   *   z=N   exact atomic-number match
   *   z>N   z>=N   z<N   z<=N   inequality range
   */
  function matches(p: Particle, q: string): boolean {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return true;
    const z = atomicNumber(p);
    const zEq = trimmed.match(/^z\s*=\s*(\d+)$/);
    if (zEq) return z === Number(zEq[1]);
    const zCmp = trimmed.match(/^z\s*(>=|<=|>|<)\s*(\d+)$/);
    if (zCmp) {
      const n = Number(zCmp[2]);
      if (zCmp[1] === ">=") return z >= n;
      if (zCmp[1] === "<=") return z <= n;
      if (zCmp[1] === ">") return z > n;
      if (zCmp[1] === "<") return z < n;
    }
    return searchText(p).toLowerCase().includes(trimmed);
  }

  // spec: drop electron entirely until ESTAR ships.
  const allBuiltin = $derived(selectionState.allParticles.filter((p) => p.id !== ELECTRON_ID));

  const flatList = $derived.by<Particle[]>(() => {
    return [...allBuiltin, ...selectionState.externalOnlyParticles].sort(
      (a, b) => atomicNumber(a) - atomicNumber(b),
    ) as Particle[];
  });

  const filteredFlat = $derived(
    flatList.filter((p) => {
      if (!matches(p, query)) return false;
      if (showOnlySelected) {
        return isMultiMode ? isMultiSelected(p) : selected?.id === p.id;
      }
      return true;
    }),
  );

  function isAvailable(p: Particle): boolean {
    return selectionState.availableParticles.some((q) => q.id === p.id);
  }

  $effect(() => {
    // Prefer the currently selected (or multi-anchor) particle as the
    // keyboard-navigation starting point so opening the list doesn't move
    // the focus highlight away from the active selection. Fall back to the
    // first available particle only when the preferred one has been filtered
    // out by the search query.
    const available = filteredFlat.filter(isAvailable);
    if (available.length === 0) {
      highlightedId = null;
      return;
    }
    const preferredId = isMultiMode ? (multiIds[0] ?? null) : (selected?.id ?? null);
    const preferred =
      preferredId !== null ? available.find((p) => p.id === preferredId) : undefined;
    highlightedId = (preferred ?? available[0]!).id;
  });

  function handleArrow(direction: "up" | "down") {
    const items = filteredFlat.filter(isAvailable);
    if (items.length === 0) return;
    const idx = items.findIndex((p) => p.id === highlightedId);
    const delta = direction === "down" ? 1 : -1;
    const nextIdx = (idx === -1 ? 0 : idx + delta + items.length) % items.length;
    highlightedId = items[nextIdx]!.id;
  }

  function handleEnter() {
    const items = filteredFlat.filter(isAvailable);
    const hit = items.find((p) => p.id === highlightedId) ?? items[0];
    if (hit) onSelect(hit);
  }

  // Register keyboard handlers on the parent-owned search input so ↑/↓/↵
  // keep working with the lifted picker-level search row.
  $effect(() => {
    onArrowKey = handleArrow;
    onEnterKey = handleEnter;
    return () => {
      onArrowKey = undefined;
      onEnterKey = undefined;
    };
  });

  const selected = $derived(selectionState.selectedParticle);

  // Multi-select mode: only active when advanced mode is on AND across=particle.
  // Without the isAdvancedMode gate, `across` lingers as "particle" after switching
  // back to basic mode and ghost ○ circles / anchor labels would appear.
  const isMultiMode = $derived(isAdvancedMode.value && selectionState.across === "particle");
  const multiIds = $derived(selectionState.multiSelected.particle);

  function isMultiSelected(p: Particle): boolean {
    return multiIds.includes(p.id);
  }

  function handleMultiToggle(p: Particle): void {
    selectionState.toggleMulti("particle", p.id);
  }

  function clearAllMulti(): void {
    // Toggle each non-anchor id (anchor cannot be removed)
    const [, ...rest] = multiIds;
    for (const id of rest) selectionState.toggleMulti("particle", id);
  }

  // Summary bar derived values
  const summaryCount = $derived(isMultiMode ? multiIds.length : selected ? 1 : 0);
  const summaryLabels = $derived(
    isMultiMode
      ? multiIds.map((id) => {
          const p = flatList.find((x) => x.id === id);
          return p ? getParticleListLabel(p, atomicNumber(p)) : String(id);
        })
      : selected
        ? [getParticleListLabel(selected, atomicNumber(selected))]
        : [],
  );

  // View mode: list (default) or grid (advanced only).
  // Persist user choice for the session so switching tabs preserves the picked view.
  type View = "list" | "grid";
  let view = $state<View>("list");

  // Toggle is only visible in Advanced mode (per spec § Particle / acceptance
  // criterion: "Advanced mode renders the periodic-grid scan view").
  const showViewToggle = $derived(isAdvancedMode.value);

  // Force list view when the user drops out of advanced mode.
  $effect(() => {
    if (!isAdvancedMode.value && view === "grid") view = "list";
  });

  const filteredBuiltin = $derived(
    filteredFlat.filter((p): p is (typeof allBuiltin)[number] => !isExternal(p)),
  );

  const filteredExternal = $derived(
    selectionState.externalOnlyParticles
      .filter((p) => matches(p, query))
      .filter((p) =>
        showOnlySelected ? (isMultiMode ? isMultiSelected(p) : selected?.id === p.id) : true,
      )
      .sort((a, b) => a.Z - b.Z),
  );
</script>

<div class="space-y-2" data-testid="picker-particle-tab" data-view={view}>
  <!-- Compact sticky summary bar (replaces old badge + multi-pills) -->
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
    testId="picker-particle-selected"
  />

  {#if showViewToggle}
    <div
      class="flex justify-end"
      role="group"
      aria-label="Particle view mode"
      data-testid="picker-particle-view-toggle"
    >
      <div class="inline-flex rounded-md border bg-background text-xs">
        <button
          type="button"
          aria-pressed={view === "list"}
          aria-label="List view"
          title="List view"
          data-testid="picker-particle-view-list"
          class={cn(
            "px-2 py-1 rounded-l-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
            view === "list" ? "bg-accent font-semibold" : "text-muted-foreground hover:bg-accent",
          )}
          onclick={() => (view = "list")}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <button
          type="button"
          aria-pressed={view === "grid"}
          aria-label="Grid view"
          title="Grid view"
          data-testid="picker-particle-view-grid"
          class={cn(
            "px-2 py-1 rounded-r-md border-l focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
            view === "grid" ? "bg-accent font-semibold" : "text-muted-foreground hover:bg-accent",
          )}
          onclick={() => (view = "grid")}
        >
          <span aria-hidden="true">▦</span>
        </button>
      </div>
    </div>
  {/if}

  {#if view === "grid"}
    <ParticleGridView
      {allBuiltin}
      {filteredBuiltin}
      {filteredExternal}
      {selected}
      {multiIds}
      {isMultiMode}
      {highlightedId}
      {isAvailable}
      onSelect={(p) => onSelect(p)}
      onMultiToggle={handleMultiToggle}
    />
  {:else}
    <ParticleListView
      items={filteredFlat}
      {selected}
      {multiIds}
      {isMultiMode}
      {highlightedId}
      {isAvailable}
      onSelect={(p) => onSelect(p)}
      onMultiToggle={handleMultiToggle}
    />
  {/if}
</div>
