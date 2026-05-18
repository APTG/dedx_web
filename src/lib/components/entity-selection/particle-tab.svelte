<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { ParticleEntity } from "$lib/wasm/types";
  import type { ExternalOnlyParticle } from "$lib/state/external-compatibility";
  import { ELECTRON_ID } from "$lib/state/entity-selection.svelte";
  import { getParticleLabel, getParticleListLabel, getParticleSearchText } from "$lib/utils/particle-label";

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

  const filteredFlat = $derived(flatList.filter((p) => matches(p, query)));

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

  function atomicNumber(p: Particle): number {
    return isExternal(p) ? p.Z : (p.id as number);
  }

  /** Named particles (proton/alpha) get bold emphasis per spec default (b). */
  function isNamed(p: Particle): boolean {
    return !isExternal(p) && NAMED_IDS.has(p.id as number);
  }
</script>

<div class="space-y-3" data-testid="picker-particle-tab">
  {#if isMultiMode}
    {#if multiIds.length > 0}
      <div class="flex flex-wrap gap-1.5" aria-label="Selected particles for comparison" data-testid="picker-particle-multi-selected">
        {#each multiIds as id (id)}
          {@const p = flatList.find((x) => x.id === id)}
          {#if p}
            {@const anchor = multiIds[0] === id}
            {@const z = atomicNumber(p)}
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
                  aria-label="Remove {getParticleLabel(p)} from comparison"
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
    {@const z = atomicNumber(selected)}
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/15"
      data-testid="picker-particle-selected"
      aria-label="Selected: {getParticleListLabel(selected, z)}. Click to clear."
      onclick={onClear}
    >
      {#if isExternal(selected)}
        <span aria-hidden="true">🔗</span>
      {/if}
      <span class="font-medium">{getParticleListLabel(selected, z)}</span>
      <span
        class="ml-auto rounded border border-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        aria-hidden="true"
      >× clear</span>
    </button>
  {/if}

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
            (isMultiMode ? inMulti : isSingleSelected) && "bg-primary/15 font-semibold",
            isHighlighted && available && !(isMultiMode ? inMulti : isSingleSelected) && "bg-accent",
            named && !(isMultiMode ? inMulti : isSingleSelected) && "font-semibold",
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
          {#if named}<span aria-hidden="true" class="mr-0.5">★</span>{/if}
          <span class="flex-1">{getParticleListLabel(p, z)}</span>
          {#if isMultiMode && anchor}
            <span class="text-xs text-muted-foreground">(anchor)</span>
          {/if}
        </button>
      </li>
    {/each}
    {#if filteredFlat.length === 0}
      <li class="px-2 py-4 text-center text-sm text-muted-foreground">No particles match.</li>
    {/if}
  </ul>
</div>
