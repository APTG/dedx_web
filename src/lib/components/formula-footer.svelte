<script lang="ts">
  import { computeBraggIValue, getElementSymbol } from "$lib/utils/element-data";
  import type { CompoundElementEntry } from "$lib/state/custom-compounds.svelte";

  interface Props {
    elements: CompoundElementEntry[];
    iValueOverride?: string;
  }

  let { elements, iValueOverride }: Props = $props();

  let formulaString = $derived.by(() => {
    if (!elements || elements.length === 0) return "";
    return elements
      .map((e) => {
        const sym = getElementSymbol(e.atomicNumber) || `Z${e.atomicNumber}`;
        const count = e.atomCount;
        if (count === 1) return sym;
        // Format decimal atom counts
        return `${sym}${Number.isInteger(count) ? count : count.toFixed(2)}`;
      })
      .join("");
  });

  let braggIValue = $derived(computeBraggIValue(elements));
  let overrideVal = $derived(parseFloat(iValueOverride || ""));
</script>

<div class="mt-4 flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
  <div class="flex items-center gap-2">
    <span class="font-medium">Derived Formula:</span>
    <span class="font-mono">{formulaString || "—"}</span>
  </div>

  {#if overrideVal > 0}
    <div class="flex items-center gap-2">
      <span class="font-medium">I-value override:</span>
      <span>{overrideVal} eV</span>
      <span class="text-muted-foreground italic">(built-in Bragg additivity bypassed)</span>
    </div>
  {:else if braggIValue !== undefined}
    <div class="flex items-center gap-2">
      <span class="font-medium">Bragg I-value:</span>
      <span>{braggIValue.toFixed(2)} eV</span>
    </div>
  {:else}
    <div class="flex items-center gap-2">
      <span class="font-medium text-destructive">Bragg I-value:</span>
      <span class="text-muted-foreground italic"
        >Cannot be computed (missing elemental I-values)</span
      >
    </div>
  {/if}
</div>
