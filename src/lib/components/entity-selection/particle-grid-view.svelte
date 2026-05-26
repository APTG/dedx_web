<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { ParticleEntity } from "$lib/wasm/types";
  import type { ExternalOnlyParticle } from "$lib/state/external-compatibility";
  import { getParticleListLabel } from "$lib/utils/particle-label";
  import {
    atomicNumber,
    isExternal,
    periodicPosition,
    type Particle,
  } from "./particle-tab-helpers";

  interface Props {
    allBuiltin: Particle[];
    filteredBuiltin: Particle[];
    filteredExternal: ExternalOnlyParticle[];
    selected: Particle | null | undefined;
    multiIds: ReadonlyArray<number | string>;
    isMultiMode: boolean;
    highlightedId: number | string | null;
    isAvailable: (p: Particle) => boolean;
    onSelect: (p: Particle) => void;
    onMultiToggle: (p: Particle) => void;
  }

  let {
    allBuiltin,
    filteredBuiltin,
    filteredExternal,
    selected,
    multiIds,
    isMultiMode,
    highlightedId,
    isAvailable,
    onSelect,
    onMultiToggle,
  }: Props = $props();

  function isMultiSelected(p: Particle): boolean {
    return multiIds.includes(p.id);
  }

  function isAnchor(p: Particle): boolean {
    return multiIds[0] === p.id;
  }
</script>

<div class="overflow-x-auto">
  <div
    class="grid gap-[2px]"
    style="grid-template-columns: repeat(18, minmax(0, 1fr)); grid-template-rows: repeat(7, auto) 0.35rem repeat(2, auto); min-width: 360px;"
    role="listbox"
    aria-label="Particles (periodic table)"
    aria-multiselectable={isMultiMode}
    data-testid="picker-particle-grid"
  >
    {#each allBuiltin as p (p.id)}
      {@const z = atomicNumber(p)}
      {@const pos = periodicPosition(z)}
      {@const isMatched = filteredBuiltin.includes(p)}
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
          aria-disabled={!available || !isMatched || (isMultiMode && anchor)}
          aria-label="{getParticleListLabel(p, z)}{available ? '' : ' (unavailable)'}"
          title={getParticleListLabel(p, z)}
          data-testid="picker-particle-tile-{p.id}"
          data-available={available ? "1" : "0"}
          disabled={!available || !isMatched || (isMultiMode && anchor)}
          style="grid-row: {pos.row}; grid-column: {pos.col};"
          class={cn(
            "relative flex aspect-square flex-col items-center justify-center rounded-sm border bg-card p-0 text-center leading-none transition-colors overflow-hidden",
            available && isMatched ? "hover:bg-accent cursor-pointer" : "pointer-events-none",
            !available ? "opacity-40" : !isMatched ? "opacity-30" : null,
            isChecked && "ring-2 ring-inset ring-orange-400 bg-orange-50/60",
            !isChecked && isHighlighted && available && isMatched && "bg-accent",
          )}
          onclick={() => {
            if (!available || !isMatched) return;
            if (isMultiMode) {
              if (!anchor) onMultiToggle(p);
            } else {
              onSelect(p);
            }
          }}
        >
          <span
            class={cn(
              "absolute left-[1px] top-[1px] font-mono text-[min(0.5rem,1.5vw)] leading-none transition-opacity",
              isMatched ? "text-muted-foreground opacity-70" : "opacity-10 text-muted-foreground",
            )}>{z}</span
          >
          <span
            class={cn(
              "font-mono text-[clamp(11px,1.5vw,18px)] font-bold leading-none transition-opacity",
              !isMatched && "opacity-10",
            )}>{sym}</span
          >
        </button>
      {/if}
    {/each}
    <!-- Indicator cells pointing to the lanthanide / actinide rows below. -->
    <div
      aria-hidden="true"
      class="flex aspect-square items-center justify-center rounded-sm border border-dashed bg-muted/30 text-[7px] text-muted-foreground font-mono"
      style="grid-row: 6; grid-column: 3;"
    >
      57-71
    </div>
    <div
      aria-hidden="true"
      class="flex aspect-square items-center justify-center rounded-sm border border-dashed bg-muted/30 text-[7px] text-muted-foreground font-mono"
      style="grid-row: 7; grid-column: 3;"
    >
      89-103
    </div>
  </div>
</div>
{#if filteredBuiltin.length === 0 && filteredExternal.length === 0}
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
              if (!anchor) onMultiToggle(p);
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
