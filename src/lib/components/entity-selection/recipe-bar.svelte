<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { getParticleLabel } from "$lib/utils/particle-label";
  import { pickerMode } from "$lib/state/picker-mode.svelte";
  import type { PickerTab } from "./tab-bar.svelte";

  interface Props {
    selectionState: EntitySelectionState;
    onActivateTab: (tab: PickerTab) => void;
    onReset: () => void;
    /**
     * Wired in PR #2 with the adaptive compatibility overlay. While the
     * overlay is being built the link renders disabled with a "coming soon"
     * tooltip so the recipe-bar layout doesn't shift later.
     */
    onExploreCompat?: () => void;
    class?: string;
  }

  let {
    selectionState,
    onActivateTab,
    onReset,
    onExploreCompat,
    class: className,
  }: Props = $props();

  const particleLabel = $derived.by(() => {
    const p = selectionState.selectedParticle;
    return p ? getParticleLabel(p) : "—";
  });

  const materialLabel = $derived(selectionState.selectedMaterial?.name ?? "—");

  const programLabel = $derived.by(() => {
    const program = selectionState.selectedProgram;
    if (program.id === -1) {
      const resolved =
        "resolvedProgram" in program ? program.resolvedProgram : null;
      return resolved ? `Auto → ${resolved.name}` : "Auto";
    }
    return program.name;
  });

  const compatEnabled = $derived(
    pickerMode.value === "advanced" && typeof onExploreCompat === "function",
  );
</script>

<div
  class={cn(
    "flex flex-wrap items-center gap-2 rounded-t-lg border border-b-0 bg-muted/40 px-3 py-2 text-sm font-mono",
    className,
  )}
  data-testid="picker-recipe-bar"
  aria-label="Selection recipe"
>
  <span class="uppercase tracking-wider text-xs text-muted-foreground">Recipe</span>
  <button
    type="button"
    class="rounded px-2 py-0.5 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    data-testid="picker-recipe-particle"
    onclick={() => onActivateTab("particle")}
  >
    {particleLabel}
  </button>
  <span aria-hidden="true" class="text-muted-foreground">→</span>
  <button
    type="button"
    class="rounded px-2 py-0.5 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    data-testid="picker-recipe-material"
    onclick={() => onActivateTab("material")}
  >
    {materialLabel}
  </button>
  <span aria-hidden="true" class="text-muted-foreground">→</span>
  <button
    type="button"
    class="rounded px-2 py-0.5 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    data-testid="picker-recipe-program"
    onclick={() => onActivateTab("program")}
  >
    {programLabel}
  </button>

  <div class="ml-auto flex items-center gap-3 text-xs">
    <button
      type="button"
      class="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring rounded"
      data-testid="picker-recipe-reset"
      onclick={onReset}
      title="Restore defaults (proton / Water / Auto)"
    >
      reset
    </button>
    {#if pickerMode.value === "advanced"}
      <button
        type="button"
        class={cn(
          "text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring rounded",
          !compatEnabled && "opacity-50 cursor-not-allowed",
        )}
        data-testid="picker-recipe-compat"
        disabled={!compatEnabled}
        title={compatEnabled
          ? "Explore compatibility matrix"
          : "Compatibility overlay coming soon (PR #2)"}
        onclick={() => onExploreCompat?.()}
      >
        ⊞ explore compat
      </button>
    {/if}
  </div>
</div>
