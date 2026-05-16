<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { ParticleEntity } from "$lib/wasm/types";
  import type { ExternalOnlyParticle } from "$lib/state/external-compatibility";
  import { ELECTRON_ID } from "$lib/state/entity-selection.svelte";
  import { getParticleListLabel, getParticleSearchText } from "$lib/utils/particle-label";
  import SelectedPill from "./selected-pill.svelte";

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

  const COMMON_IDS = new Set([1, 2]);
  const COMMON_ORDER = [1, 2];

  const commonParticles = $derived(
    allBuiltin
      .filter((p) => COMMON_IDS.has(p.id as number))
      .sort((a, b) => COMMON_ORDER.indexOf(a.id) - COMMON_ORDER.indexOf(b.id)),
  );

  const ionParticles = $derived.by(() => {
    const builtin = allBuiltin
      .filter((p) => !COMMON_IDS.has(p.id as number))
      .sort((a, b) => (a.id as number) - (b.id as number));
    // External-only particles inline by Z (spec: no separate "External" group).
    const ext = [...selectionState.externalOnlyParticles].sort((a, b) => a.Z - b.Z);
    return [...builtin, ...ext] as Particle[];
  });

  const filteredCommon = $derived(commonParticles.filter((p) => matches(p, query)));
  const filteredIons = $derived(ionParticles.filter((p) => matches(p, query)));
  const filteredFlat = $derived([...filteredCommon, ...filteredIons]);

  function isAvailable(p: Particle): boolean {
    return selectionState.availableParticles.some((q) => q.id === p.id);
  }

  $effect(() => {
    // Reset highlight when filter changes; default to first available.
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

  // Multi-select mode: active when the picker is comparing across particles.
  const isMultiMode = $derived(selectionState.across === "particle");
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
</script>

<div class="space-y-3" data-testid="picker-particle-tab">
  {#if isMultiMode}
    {#if multiIds.length > 0}
      <div class="flex flex-wrap gap-1.5" aria-label="Selected particles for comparison" data-testid="picker-particle-multi-selected">
        {#each multiIds as id (id)}
          {@const p = filteredFlat.find((x) => x.id === id) ?? ionParticles.find((x) => x.id === id) ?? commonParticles.find((x) => x.id === id)}
          {#if p}
            {@const anchor = multiIds[0] === id}
            {@const ext = isExternal(p)}
            {@const z = ext ? p.Z : (p.id as number)}
            <span
              class={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                anchor
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-muted bg-muted text-muted-foreground",
              )}
            >
              {getParticleListLabel(p, z)}
              {#if !anchor}
                <button
                  type="button"
                  aria-label="Remove {getParticleListLabel(p, z)} from comparison"
                  class="ml-0.5 rounded-full hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  onclick={() => handleMultiToggle(p)}
                >×</button>
              {/if}
            </span>
          {/if}
        {/each}
      </div>
    {/if}
  {:else if selected}
    {@const atomicNumber = isExternal(selected) ? selected.Z : (selected.id as number)}
    <SelectedPill
      label={getParticleListLabel(selected, atomicNumber)}
      glyph={isExternal(selected) ? "🔗" : undefined}
      {onClear}
      data-testid="picker-particle-selected"
    />
  {/if}

  <div data-testid="picker-particle-list" class="space-y-3">
    {#if filteredCommon.length > 0}
      <div>
        <div class="px-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
          Common particles
        </div>
        <ul role="listbox" aria-label="Common particles" aria-multiselectable={isMultiMode} class="space-y-0.5">
          {#each filteredCommon as p (p.id)}
            {@const available = isAvailable(p)}
            {@const inMulti = isMultiSelected(p)}
            {@const anchor = isAnchor(p)}
            {@const isSingleSelected = !isMultiMode && selected?.id === p.id}
            {@const isHighlighted = highlightedId === p.id}
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isMultiMode ? inMulti : isSingleSelected}
                aria-disabled={!available || (isMultiMode && anchor)}
                data-testid="picker-particle-item-{p.id}"
                tabindex={-1}
                disabled={!available}
                class={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left",
                  available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                  (isMultiMode ? inMulti : isSingleSelected) && "bg-primary/15 font-semibold",
                  isHighlighted && available && !(isMultiMode ? inMulti : isSingleSelected) && "bg-accent",
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
                {#if isMultiMode}
                  <span aria-hidden="true" class="w-3 text-center text-xs">{inMulti ? "✓" : ""}</span>
                {/if}
                <span>{getParticleListLabel(p)}</span>
                {#if isMultiMode && anchor}
                  <span class="ml-auto text-xs text-muted-foreground">(anchor)</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if filteredIons.length > 0}
      <div>
        <div class="px-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">Ions</div>
        <ul
          role="listbox"
          aria-label="Ions"
          aria-multiselectable={isMultiMode}
          tabindex="0"
          class="max-h-52 overflow-auto space-y-0.5"
        >
          {#each filteredIons as p (p.id)}
            {@const available = isAvailable(p)}
            {@const inMulti = isMultiSelected(p)}
            {@const anchor = isAnchor(p)}
            {@const isSingleSelected = !isMultiMode && selected?.id === p.id}
            {@const isHighlighted = highlightedId === p.id}
            {@const external = isExternal(p)}
            {@const atomicNumber = external ? p.Z : (p.id as number)}
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isMultiMode ? inMulti : isSingleSelected}
                aria-disabled={!available || (isMultiMode && anchor)}
                data-testid="picker-particle-item-{p.id}"
                tabindex={-1}
                disabled={!available}
                class={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left",
                  available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                  (isMultiMode ? inMulti : isSingleSelected) && "bg-primary/15 font-semibold",
                  isHighlighted && available && !(isMultiMode ? inMulti : isSingleSelected) && "bg-accent",
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
                {#if isMultiMode}
                  <span aria-hidden="true" class="w-3 text-center text-xs">{inMulti ? "✓" : ""}</span>
                {/if}
                {#if external}<span aria-hidden="true">🔗</span>{/if}
                <span>{getParticleListLabel(p, atomicNumber)}</span>
                {#if isMultiMode && anchor}
                  <span class="ml-auto text-xs text-muted-foreground">(anchor)</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if filteredFlat.length === 0}
      <p class="px-2 py-4 text-center text-sm text-muted-foreground">No particles match.</p>
    {/if}
  </div>
</div>
