<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { COMPOUND_PRESETS, type CompoundPreset } from "$lib/data/compound-presets";
  import { parseFormula, type ParsedElement } from "$lib/utils/formula-parser";
  import { getElementSymbol } from "$lib/utils/element-data";
  import { cn } from "$lib/utils.js";

  interface Props {
    isEmpty: boolean;
    onPasteFormula: (elements: ParsedElement[]) => void;
    onApplyPreset: (preset: CompoundPreset) => void;
  }

  let { isEmpty, onPasteFormula, onApplyPreset }: Props = $props();

  let formulaInput = $state("");
  let isExpanded = $state(true);

  // When isEmpty becomes true, automatically expand.
  $effect(() => {
    if (isEmpty) {
      isExpanded = true;
    } else {
      isExpanded = false;
    }
  });

  let parsed = $derived(
    formulaInput.trim() ? parseFormula(formulaInput) : { elements: undefined, error: undefined },
  );

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (parsed.elements) {
        onPasteFormula(parsed.elements);
        formulaInput = "";
      }
    }
  }

  function formatParsed(elements: ParsedElement[]) {
    return elements
      .map((e) => `${e.atomCount} ${getElementSymbol(e.atomicNumber) || `Z=${e.atomicNumber}`}`)
      .join(" · ");
  }
</script>

{#if isExpanded}
  <div
    class="mb-6 overflow-hidden rounded-[10px] border border-[#ffd9c7] bg-gradient-to-b from-[#fff5f0] to-white dark:from-accent/10 dark:to-background shadow-sm"
    data-testid="quick-start-panel"
  >
    <div class="p-4">
      <h3 class="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
        <span class="text-xl leading-none">🚀</span> Quick Start
      </h3>
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Card 1: Paste formula -->
        <div class="flex flex-col gap-2 rounded-lg border bg-card/50 p-3 shadow-sm">
          <label for="qs-formula" class="text-xs font-medium text-muted-foreground"
            >Paste a formula</label
          >
          <Input
            id="qs-formula"
            bind:value={formulaInput}
            onkeydown={handleKeyDown}
            placeholder="e.g., C6H12O6"
            class={cn(
              "bg-background",
              parsed.error && formulaInput.trim() ? "border-destructive" : "",
            )}
          />
          <div class="min-h-[20px]">
            {#if formulaInput.trim()}
              {#if parsed.error}
                <p class="text-xs text-destructive">{parsed.error}</p>
              {:else if parsed.elements}
                <p class="text-xs text-muted-foreground">
                  → {formatParsed(parsed.elements)}
                  <span class="ml-1 text-[10px] opacity-70">(press Enter to apply)</span>
                </p>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Card 2: Presets -->
        <div class="flex flex-col gap-2 rounded-lg border bg-card/50 p-3 shadow-sm">
          <span class="text-xs font-medium text-muted-foreground">Start from preset</span>
          <div class="flex flex-wrap gap-2">
            {#each COMPOUND_PRESETS as preset (preset.shortName)}
              <Button
                variant="secondary"
                size="sm"
                class="h-7 text-xs rounded-full bg-background border hover:bg-accent hover:text-accent-foreground"
                onclick={() => onApplyPreset(preset)}
                data-testid={`preset-btn-${preset.shortName}`}
              >
                {preset.shortName}
              </Button>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- Collapsed state -->
  <div
    class="mb-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
    data-testid="quick-start-collapsed"
  >
    <button
      type="button"
      class="hover:text-foreground hover:underline"
      onclick={() => (isExpanded = true)}
    >
      Paste formula…
    </button>
    <span>·</span>
    <button
      type="button"
      class="hover:text-foreground hover:underline"
      onclick={() => (isExpanded = true)}
    >
      Presets ▾
    </button>
  </div>
{/if}
