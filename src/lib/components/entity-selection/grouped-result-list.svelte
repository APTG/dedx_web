<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { MaterialEntity } from "$lib/wasm/types";
  import type { ExternalOnlyMaterial } from "$lib/state/external-compatibility";
  import type { StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";

  type Material = MaterialEntity | ExternalOnlyMaterial;
  type CustomItem = {
    id: string;
    name: string;
    density: number;
    phase: string;
    elements: { atomicNumber: number; atomCount: number }[];
    iValue?: number;
    isGasByDefault: boolean;
    source: StoredCompoundInternal;
  };

  interface Props {
    compounds: Material[];
    elements: Material[];
    customItems: CustomItem[];
    selectedId: number | string | null;
    isMultiMode: boolean;
    multiIds: (number | string)[];
    onSelect: (m: Material | CustomItem) => void;
    onToggleMulti: (m: Material | CustomItem) => void;
    formatDensity: (m: Material | CustomItem) => string | undefined;
    isAvailable: (m: Material) => boolean;
  }

  let {
    compounds,
    elements,
    customItems,
    selectedId,
    isMultiMode,
    multiIds,
    onSelect,
    onToggleMulti,
    formatDensity,
    isAvailable,
  }: Props = $props();

  function isExternal(m: Material): boolean {
    return typeof m.id === "string" && (m.id as string).startsWith("ext:");
  }

  function isGas(m: Material): boolean {
    return !isExternal(m) && (m as MaterialEntity).isGasByDefault;
  }

  function inMulti(id: number | string): boolean {
    return multiIds.includes(id);
  }

  function isAnchor(id: number | string): boolean {
    return multiIds[0] === id;
  }

  type AnyItem = Material | CustomItem;

  function isCustomItem(item: AnyItem): item is CustomItem {
    return typeof item.id === "string" && (item.id as string).startsWith("cc_");
  }
</script>

{#snippet groupHeader(label: string, count: number)}
  <li
    class="sticky top-0 bg-background/95 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm"
    aria-hidden="true"
  >
    {label} · {count}
  </li>
{/snippet}

{#snippet listItem(item: AnyItem)}
  {@const id = item.id}
  {@const isSingleSelected = !isMultiMode && selectedId === id}
  {@const itemInMulti = inMulti(id)}
  {@const anchor = isAnchor(id)}
  {@const dens = formatDensity(item as Material)}
  {@const available = isCustomItem(item) ? true : isAvailable(item as Material)}
  {@const external = !isCustomItem(item) && isExternal(item as Material)}
  {@const gas = !isCustomItem(item) && isGas(item as Material)}
  {@const isChecked = isMultiMode ? itemInMulti : isSingleSelected}
  <li role="presentation">
    <button
      type="button"
      role="option"
      aria-selected={isMultiMode ? itemInMulti : isSingleSelected}
      aria-disabled={!available || (isMultiMode && anchor)}
      data-testid="picker-material-item-{id}"
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
          if (!anchor) onToggleMulti(item);
        } else {
          onSelect(item);
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
        {#if external}<span aria-hidden="true">🔗</span>{/if}
        <span class="truncate">
          {item.name}
          {#if dens}
            <span class="ml-1 text-xs text-muted-foreground">(ρ={dens} g/cm³)</span>
          {/if}
        </span>
        {#if gas}<span aria-hidden="true" title="Gas at standard conditions">(≋)</span>{/if}
      </span>
    </button>
  </li>
{/snippet}

<ul
  role="listbox"
  aria-label="Material search results"
  aria-multiselectable={isMultiMode}
  class="space-y-0.5"
  data-testid="picker-sheet-material-results"
>
  {@render groupHeader("Compounds", compounds.length)}
  {#each compounds as m (m.id)}
    {@render listItem(m)}
  {/each}
  {#if compounds.length === 0}
    <li class="px-2 py-2 text-sm text-muted-foreground italic">No compounds match</li>
  {/if}

  {@render groupHeader("Elements", elements.length)}
  {#each elements as m (m.id)}
    {@render listItem(m)}
  {/each}
  {#if elements.length === 0}
    <li class="px-2 py-2 text-sm text-muted-foreground italic">No elements match</li>
  {/if}

  {@render groupHeader("Custom", customItems.length)}
  {#each customItems as m (m.id)}
    {@render listItem(m)}
  {/each}
  {#if customItems.length === 0}
    <li class="px-2 py-2 text-sm text-muted-foreground italic">No custom compounds match</li>
  {/if}
</ul>
