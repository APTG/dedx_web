<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { getParticleListLabel } from "$lib/utils/particle-label";
  import { atomicNumber, isExternal, isNamed, type Particle } from "./particle-tab-helpers";

  interface Props {
    items: Particle[];
    selected: Particle | null | undefined;
    multiIds: ReadonlyArray<number | string>;
    isMultiMode: boolean;
    highlightedId: number | string | null;
    isAvailable: (p: Particle) => boolean;
    onSelect: (p: Particle) => void;
    onMultiToggle: (p: Particle) => void;
  }

  let {
    items,
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

<ul
  role="listbox"
  aria-label="Particles"
  aria-multiselectable={isMultiMode}
  tabindex="0"
  class="max-h-52 overflow-auto space-y-0.5"
  data-testid="picker-particle-list"
>
  {#each items as p (p.id)}
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
            if (!anchor) onMultiToggle(p);
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
  {#if items.length === 0}
    <li class="px-2 py-4 text-center text-sm text-muted-foreground">No particles match.</li>
  {/if}
</ul>
