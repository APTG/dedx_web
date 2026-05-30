<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { ELEMENTS } from "$lib/utils/element-data";
  import { periodicPosition } from "$lib/utils/periodic-position";

  interface Props {
    mode: "ADD" | "EDIT";
    /** Set of atomic numbers currently in the compound (used to dim/disable in ADD mode) */
    usedZ: Set<number>;
    /** The atomic number of the row being edited (used to highlight in EDIT mode) */
    currentZ?: number | null;
    /** A pending selection to highlight regardless of mode (mobile Add flow). */
    highlightZ?: number | null;
    onSelect: (z: number) => void;
  }

  let { mode, usedZ, currentZ = null, highlightZ = null, onSelect }: Props = $props();
</script>

<div class="overflow-x-auto overflow-y-hidden pb-1">
  <div
    class="grid gap-[2px]"
    style="grid-template-columns: repeat(18, minmax(0, 1fr)); grid-template-rows: repeat(7, auto) 0.35rem repeat(2, auto); min-width: 360px;"
    role="grid"
    aria-label="Periodic Table"
    data-testid="picker-element-grid"
  >
    {#each ELEMENTS as el (el.atomicNumber)}
      {@const z = el.atomicNumber}
      {@const pos = periodicPosition(z)}
      {@const isUsed = usedZ.has(z)}
      {@const isCurrent = (mode === "EDIT" && currentZ === z) || highlightZ === z}
      {@const isDisabled = mode === "ADD" && isUsed}

      {#if pos}
        <button
          type="button"
          role="gridcell"
          aria-selected={isCurrent}
          aria-disabled={isDisabled}
          aria-label="{el.name} (Z={z})"
          title="{el.name} (Z={z})"
          data-testid="picker-grid-tile-{z}"
          disabled={isDisabled}
          style="grid-row: {pos.row}; grid-column: {pos.col};"
          class={cn(
            "relative flex h-8 sm:h-10 flex-col items-center justify-center rounded-sm border bg-card p-0 text-center leading-none transition-colors overflow-hidden",
            !isDisabled ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
            isCurrent && "ring-2 ring-inset ring-orange-400 bg-orange-50/60",
          )}
          onclick={() => {
            if (!isDisabled) {
              onSelect(z);
            }
          }}
        >
          <span
            class="absolute left-[1px] top-[1px] font-mono text-[min(0.5rem,1.5vw)] leading-none text-muted-foreground opacity-70"
          >
            {z}
          </span>
          <span class="font-mono text-[clamp(11px,1.5vw,18px)] font-bold leading-none">
            {el.symbol}
          </span>
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
