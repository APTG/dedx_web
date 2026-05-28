<script lang="ts">
  import { computeBraggIValue, getElementSymbol } from "$lib/utils/element-data";
  import type { CompoundElementEntry } from "$lib/state/custom-compounds.svelte";
  import { Button } from "$lib/components/ui/button";

  interface Props {
    elements: CompoundElementEntry[];
    iValueOverride?: string;
  }

  let { elements, iValueOverride }: Props = $props();

  let formulaParts = $derived.by(() => {
    if (!elements || elements.length === 0) return [];
    return elements.map((e) => {
      const sym = getElementSymbol(e.atomicNumber) || `Z${e.atomicNumber}`;
      const count = e.atomCount;
      const countStr =
        count === 1 ? "" : Number.isInteger(count) ? String(count) : count.toFixed(2);
      return { sym, countStr };
    });
  });

  let formulaPlain = $derived(formulaParts.map((p) => p.sym + p.countStr).join(""));
  let totalAtoms = $derived(elements.reduce((sum, e) => sum + e.atomCount, 0));

  let braggIValue = $derived(computeBraggIValue(elements));
  let overrideVal = $derived(parseFloat(iValueOverride || ""));
</script>

<div class="mt-4 flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
  <div class="flex items-center justify-between">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-medium">Derived Formula:</span>
      <span class="font-mono">
        {#if formulaParts.length === 0}
          —
        {:else}
          {#each formulaParts as part}
            {part.sym}{#if part.countStr}<sub>{part.countStr}</sub>{/if}
          {/each}
        {/if}
      </span>
      {#if totalAtoms > 0}
        <span class="text-xs text-muted-foreground ml-2">
          (Total atoms: {Number.isInteger(totalAtoms) ? totalAtoms : totalAtoms.toFixed(2)})
        </span>
      {/if}
    </div>
    {#if formulaPlain}
      <Button
        variant="ghost"
        size="sm"
        class="h-6 text-xs px-2"
        onclick={() => navigator.clipboard.writeText(formulaPlain)}
        aria-label="Copy formula"
        title="Copy formula to clipboard"
      >
        Copy
      </Button>
    {/if}
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
