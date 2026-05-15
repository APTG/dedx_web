<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { ParticleEntity } from "$lib/wasm/types";
  import type { ExternalOnlyParticle } from "$lib/state/external-compatibility";
  import { ELECTRON_ID } from "$lib/state/entity-selection.svelte";
  import { getParticleLabel, getParticleSearchText } from "$lib/utils/particle-label";
  import SelectedPill from "./selected-pill.svelte";
  import SearchInput from "./search-input.svelte";

  type Particle = ParticleEntity | ExternalOnlyParticle;

  interface Props {
    selectionState: EntitySelectionState;
    onSelect: (particle: Particle) => void;
    onClear: () => void;
  }

  let { selectionState, onSelect, onClear }: Props = $props();

  let query = $state("");
  let inputRef: HTMLInputElement | null = $state(null);
  let highlightedId = $state<number | string | null>(null);

  $effect(() => {
    inputRef?.focus();
  });

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

  // v8 spec: drop electron entirely until ESTAR ships.
  const allBuiltin = $derived(
    selectionState.allParticles.filter((p) => p.id !== ELECTRON_ID),
  );

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

  const selected = $derived(selectionState.selectedParticle);
</script>

<div class="space-y-3" data-testid="v8-particle-tab">
  {#if selected}
    {@const atomicNumber = isExternal(selected) ? selected.Z : selected.id}
    <SelectedPill
      label={getParticleLabel(selected)}
      meta={atomicNumber !== undefined && atomicNumber !== null ? `Z=${atomicNumber}` : undefined}
      glyph={isExternal(selected) ? "🔗" : undefined}
      onClear={onClear}
      data-testid="v8-particle-selected"
    />
  {/if}

  <SearchInput
    value={query}
    onInput={(v) => (query = v)}
    onArrow={handleArrow}
    onEnter={handleEnter}
    bind:inputRef
    placeholder="Name, symbol, Z…"
    data-testid="v8-particle-search"
  />

  <div role="listbox" aria-label="Particles" data-testid="v8-particle-list" class="space-y-3">
    {#if filteredCommon.length > 0}
      <div>
        <div class="px-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
          Common particles
        </div>
        <ul class="space-y-0.5">
          {#each filteredCommon as p (p.id)}
            {@const available = isAvailable(p)}
            {@const isSelected = selected?.id === p.id}
            {@const isHighlighted = highlightedId === p.id}
            <li>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={!available}
                data-testid="v8-particle-item-{p.id}"
                tabindex={-1}
                disabled={!available}
                class={cn(
                  "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-left",
                  available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                  isSelected && "bg-primary/15 font-semibold",
                  isHighlighted && available && !isSelected && "bg-accent",
                )}
                onclick={() => available && onSelect(p)}
              >
                <span>{getParticleLabel(p)}</span>
                {#if !isExternal(p)}
                  <span class="font-mono text-xs text-muted-foreground">Z={p.id}</span>
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
        <ul class="max-h-52 overflow-auto space-y-0.5">
          {#each filteredIons as p (p.id)}
            {@const available = isAvailable(p)}
            {@const isSelected = selected?.id === p.id}
            {@const isHighlighted = highlightedId === p.id}
            {@const external = isExternal(p)}
            {@const atomicNumber = external ? p.Z : p.id}
            <li>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={!available}
                data-testid="v8-particle-item-{p.id}"
                tabindex={-1}
                disabled={!available}
                class={cn(
                  "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-left",
                  available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                  isSelected && "bg-primary/15 font-semibold",
                  isHighlighted && available && !isSelected && "bg-accent",
                )}
                onclick={() => available && onSelect(p)}
              >
                <span>{external ? `🔗 ${p.name}` : getParticleLabel(p)}</span>
                {#if atomicNumber !== undefined && atomicNumber !== null}
                  <span class="font-mono text-xs text-muted-foreground">Z={atomicNumber}</span>
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
