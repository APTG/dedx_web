<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import {
    deriveDisplayFormula,
    deriveBraggIValue,
    type CompoundElementEntry,
  } from "$lib/utils/compound-derive";

  interface Props {
    /** Element rows, in list (ascending-Z) order. */
    elements: CompoundElementEntry[];
    /** Raw I-value field text; when a positive number, it overrides the preview. */
    iValueOverride?: string;
  }

  let { elements, iValueOverride = "" }: Props = $props();

  let displayFormula = $derived(deriveDisplayFormula(elements));
  let braggIValue = $derived(deriveBraggIValue(elements));
  let override = $derived.by(() => {
    const parsed = parseFloat(iValueOverride);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });
</script>

<div
  class="mt-1 flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
  data-testid="compound-formula-footer"
>
  <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
    <span class="font-medium text-muted-foreground">Formula</span>
    {#if displayFormula.kind === "exact"}
      <span class="font-mono font-semibold" data-testid="compound-formula-string">
        {displayFormula.unicode || "—"}
      </span>
      <span class="text-muted-foreground" aria-hidden="true">·</span>
      <span data-testid="compound-total-atoms">{displayFormula.totalAtoms} atoms</span>
    {:else if displayFormula.kind === "normalized"}
      <span
        class="font-mono font-semibold"
        title="Nearest simple stoichiometry"
        data-testid="compound-formula-string"
      >
        ≈ {displayFormula.unicode}
        <span class="font-sans text-xs font-normal text-muted-foreground">(normalized)</span>
      </span>
    {:else}
      <span class="text-muted-foreground italic" data-testid="compound-formula-none">
        Defined by mass fraction — no simple formula
      </span>
    {/if}
    <span class="text-muted-foreground" aria-hidden="true">·</span>
    <span data-testid="compound-ivalue">
      {#if override !== null}
        I = {override} eV <span class="text-muted-foreground">(override)</span>
      {:else if braggIValue !== null}
        I ≈ {braggIValue.toFixed(1)} eV <span class="text-muted-foreground">(computed)</span>
      {:else}
        I ≈ — <span class="text-muted-foreground">(needs Z ≤ 92)</span>
      {/if}
    </span>
  </p>

  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="h-7 shrink-0 px-2 text-xs"
    disabled={displayFormula.kind === "none" || !displayFormula.ascii}
    onclick={() => {
      if (displayFormula.kind !== "none" && displayFormula.ascii) {
        void navigator.clipboard?.writeText(displayFormula.ascii);
      }
    }}
    aria-label="Copy formula to clipboard"
    title="Copy formula"
    data-testid="compound-formula-copy"
  >
    Copy
  </Button>
</div>
