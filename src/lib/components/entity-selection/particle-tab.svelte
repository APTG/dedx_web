<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { ParticleEntity } from "$lib/wasm/types";
  import type { ExternalOnlyParticle } from "$lib/state/external-compatibility";
  import { ELECTRON_ID } from "$lib/state/entity-selection.svelte";
  import { getParticleListLabel, getParticleSearchText } from "$lib/utils/particle-label";
  import PickerSummaryBar from "./picker-summary-bar.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";

  type Particle = ParticleEntity | ExternalOnlyParticle;

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

  function isExternal(p: Particle): p is ExternalOnlyParticle {
    return typeof p.id === "string";
  }

  function searchText(p: Particle): string {
    if (isExternal(p)) {
      return `${p.localId} ${p.name} ${p.symbol} ${p.label} ext external`;
    }
    return getParticleSearchText(p);
  }

  /**
   * Match the query against a particle's searchable text. Supports plain
   * substring + the `z=N` numeric operator (advanced syntax).
   */
  function matches(p: Particle, q: string): boolean {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return true;
    const text = searchText(p).toLowerCase();
    const zEq = trimmed.match(/^z\s*=\s*(\d+)$/);
    if (zEq && !isExternal(p)) {
      return p.id === Number(zEq[1]);
    }
    return text.includes(trimmed);
  }

  // spec: drop electron entirely until ESTAR ships.
  const allBuiltin = $derived(selectionState.allParticles.filter((p) => p.id !== ELECTRON_ID));

  // Named particles (proton Z=1, alpha particle Z=2) sort first by Z, then
  // remaining builtins by Z, then external-only particles by Z.
  const NAMED_IDS = new Set([1, 2]);

  const flatList = $derived.by<Particle[]>(() => {
    const named = allBuiltin
      .filter((p) => NAMED_IDS.has(p.id as number))
      .sort((a, b) => (a.id as number) - (b.id as number));
    const ions = allBuiltin
      .filter((p) => !NAMED_IDS.has(p.id as number))
      .sort((a, b) => (a.id as number) - (b.id as number));
    const ext = [...selectionState.externalOnlyParticles].sort((a, b) => a.Z - b.Z);
    return [...named, ...ions, ...ext] as Particle[];
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
    const firstAvailable = filteredFlat.find(isAvailable);
    highlightedId = firstAvailable?.id ?? null;
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

  function isAnchor(p: Particle): boolean {
    return multiIds[0] === p.id;
  }

  function handleMultiToggle(p: Particle): void {
    selectionState.toggleMulti("particle", p.id);
  }

  function clearAllMulti(): void {
    // Toggle each non-anchor id (anchor cannot be removed)
    const [, ...rest] = multiIds;
    for (const id of rest) selectionState.toggleMulti("particle", id);
  }

  function atomicNumber(p: Particle): number {
    return isExternal(p) ? p.Z : (p.id as number);
  }

  /** Named particles (proton/alpha) get bold emphasis per spec default (b). */
  function isNamed(p: Particle): boolean {
    return !isExternal(p) && NAMED_IDS.has(p.id as number);
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

  /**
   * Map an atomic number to its (row, column) cell in the standard 18-column
   * periodic table. Lanthanides (57-71) and actinides (89-103) live on rows
   * 9 / 10 below the main table; row 8 is an intentional gap.
   */
  function periodicPosition(z: number): { row: number; col: number } | null {
    if (z === 1) return { row: 1, col: 1 };
    if (z === 2) return { row: 1, col: 18 };
    if (z >= 3 && z <= 4) return { row: 2, col: z - 2 };
    if (z >= 5 && z <= 10) return { row: 2, col: z + 8 };
    if (z >= 11 && z <= 12) return { row: 3, col: z - 10 };
    if (z >= 13 && z <= 18) return { row: 3, col: z };
    if (z >= 19 && z <= 36) return { row: 4, col: z - 18 };
    if (z >= 37 && z <= 54) return { row: 5, col: z - 36 };
    if (z === 55) return { row: 6, col: 1 };
    if (z === 56) return { row: 6, col: 2 };
    if (z >= 57 && z <= 71) return { row: 9, col: z - 53 };
    if (z >= 72 && z <= 86) return { row: 6, col: z - 68 };
    if (z === 87) return { row: 7, col: 1 };
    if (z === 88) return { row: 7, col: 2 };
    if (z >= 89 && z <= 103) return { row: 10, col: z - 85 };
    if (z >= 104 && z <= 118) return { row: 7, col: z - 100 };
    return null;
  }

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
    <div class="overflow-x-auto">
      <div
        class="grid gap-[3px]"
        style="grid-template-columns: repeat(18, minmax(0, 1fr)); grid-template-rows: repeat(7, auto) 0.4rem repeat(2, auto); min-width: 760px;"
        role="listbox"
        aria-label="Particles (periodic table)"
        aria-multiselectable={isMultiMode}
        data-testid="picker-particle-grid"
      >
        {#each filteredFlat.filter((p) => !isExternal(p)) as p (p.id)}
          {@const z = atomicNumber(p)}
          {@const pos = periodicPosition(z)}
          {@const available = isAvailable(p)}
          {@const inMulti = isMultiSelected(p)}
          {@const anchor = isAnchor(p)}
          {@const isSingleSelected = !isMultiMode && selected?.id === p.id}
          {@const isChecked = isMultiMode ? inMulti : isSingleSelected}
          {@const isHighlighted = highlightedId === p.id}
          {@const sym = !isExternal(p) ? (p as ParticleEntity).symbol || "?" : "?"}
          {#if pos}
            <button
              type="button"
              role="option"
              aria-selected={isMultiMode ? inMulti : isSingleSelected}
              aria-disabled={!available || (isMultiMode && anchor)}
              aria-label="{getParticleListLabel(p, z)}{available ? '' : ' (unavailable)'}"
              title={getParticleListLabel(p, z)}
              data-testid="picker-particle-tile-{p.id}"
              data-available={available ? "1" : "0"}
              disabled={!available || (isMultiMode && anchor)}
              style="grid-row: {pos.row}; grid-column: {pos.col};"
              class={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-sm border bg-card text-center leading-none transition-colors p-0.5",
                available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                isChecked && "ring-2 ring-inset ring-orange-400 bg-orange-50/60",
                !isChecked && isHighlighted && available && "bg-accent",
              )}
              onclick={() => {
                if (!available) return;
                if (isMultiMode) {
                  if (!anchor) handleMultiToggle(p);
                } else {
                  onSelect(p);
                }
              }}
            >
              <span
                class="absolute left-0.5 top-0.5 font-mono text-[10px] text-muted-foreground leading-none"
                >{z}</span
              >
              <span class="font-mono text-base font-bold leading-none">{sym}</span>
            </button>
          {/if}
        {/each}
        <!-- Indicator cells pointing to the lanthanide / actinide rows below. -->
        <div
          aria-hidden="true"
          class="flex aspect-square items-center justify-center rounded-sm border border-dashed bg-muted/30 text-[10px] text-muted-foreground font-mono"
          style="grid-row: 6; grid-column: 3;"
        >
          57-71
        </div>
        <div
          aria-hidden="true"
          class="flex aspect-square items-center justify-center rounded-sm border border-dashed bg-muted/30 text-[10px] text-muted-foreground font-mono"
          style="grid-row: 7; grid-column: 3;"
        >
          89-103
        </div>
      </div>
    </div>
    {#if filteredFlat.filter((p) => !isExternal(p)).length === 0}
      <div class="px-2 py-4 text-center text-sm text-muted-foreground">No particles match.</div>
    {/if}

    {#if filteredExternal.length > 0}
      <div class="mt-2 border-t pt-2" data-testid="picker-particle-grid-external">
        <div class="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">External</div>
        <div class="flex flex-wrap gap-1">
          {#each filteredExternal as p (p.id)}
            {@const available = isAvailable(p)}
            {@const inMulti = isMultiSelected(p)}
            {@const anchor = isAnchor(p)}
            {@const isSingleSelected = !isMultiMode && selected?.id === p.id}
            {@const isChecked = isMultiMode ? inMulti : isSingleSelected}
            <button
              type="button"
              role="option"
              aria-selected={isMultiMode ? inMulti : isSingleSelected}
              aria-disabled={!available || (isMultiMode && anchor)}
              data-testid="picker-particle-ext-tile-{p.id}"
              data-available={available ? "1" : "0"}
              disabled={!available || (isMultiMode && anchor)}
              class={cn(
                "inline-flex items-center gap-1 rounded-sm border bg-card px-1.5 py-0.5 text-[11px]",
                available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                isChecked && "ring-2 ring-inset ring-orange-400 bg-orange-50/60 font-semibold",
              )}
              onclick={() => {
                if (!available) return;
                if (isMultiMode) {
                  if (!anchor) handleMultiToggle(p);
                } else {
                  onSelect(p);
                }
              }}
            >
              <span aria-hidden="true">🔗</span>
              <span class="font-mono">{p.symbol || p.name}</span>
              <span class="text-[10px] text-muted-foreground font-mono">Z={p.Z}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <ul
      role="listbox"
      aria-label="Particles"
      aria-multiselectable={isMultiMode}
      tabindex="0"
      class="max-h-52 overflow-auto space-y-0.5"
      data-testid="picker-particle-list"
    >
      {#each filteredFlat as p (p.id)}
        {@const available = isAvailable(p)}
        {@const inMulti = isMultiSelected(p)}
        {@const anchor = isAnchor(p)}
        {@const isSingleSelected = !isMultiMode && selected?.id === p.id}
        {@const isChecked = isMultiMode ? inMulti : isSingleSelected}
        {@const isHighlighted = highlightedId === p.id}
        {@const external = isExternal(p)}
        {@const z = atomicNumber(p)}
        {@const named = isNamed(p)}
        <li role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={isMultiMode ? inMulti : isSingleSelected}
            aria-disabled={!available || (isMultiMode && anchor)}
            data-testid="picker-particle-item-{p.id}"
            tabindex={-1}
            disabled={!available || (isMultiMode && anchor)}
            class={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left",
              available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
              isChecked && "ring-1 ring-inset ring-orange-400 bg-orange-50/60 font-semibold",
              !isChecked && isHighlighted && available && "bg-accent",
              !isChecked && named && "font-semibold",
            )}
            onclick={() => {
              if (!available) return;
              if (isMultiMode) {
                if (!anchor) handleMultiToggle(p);
              } else {
                onSelect(p);
              }
            }}
          >
            <!-- Selection indicator: ✓ / ○ / empty -->
            <span
              aria-hidden="true"
              class="w-4 shrink-0 text-center text-xs {isChecked
                ? 'font-bold text-orange-700'
                : 'text-muted-foreground'}">{isChecked ? "✓" : isMultiMode ? "○" : ""}</span
            >
            {#if external}<span aria-hidden="true">🔗</span>{/if}
            {#if named}<span aria-hidden="true" class="mr-0.5">★</span>{/if}
            <span class="flex-1">{getParticleListLabel(p, z)}</span>
          </button>
        </li>
      {/each}
      {#if filteredFlat.length === 0}
        <li class="px-2 py-4 text-center text-sm text-muted-foreground">No particles match.</li>
      {/if}
    </ul>
  {/if}
</div>
