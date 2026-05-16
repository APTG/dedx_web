<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState, AcrossDimension } from "$lib/state/entity-selection.svelte";

  interface Props {
    selectionState: EntitySelectionState;
    onReset: () => void;
    /**
     * Wired in a later PR (compatibility overlay). Renders disabled with a
     * "coming soon" tooltip until then.
     */
    onExploreCompat?: () => void;
    /**
     * Wired in a follow-up PR (load-external modal). Renders disabled with a
     * "coming soon" tooltip until then.
     */
    onLoadExternal?: () => void;
    class?: string;
  }

  let {
    selectionState,
    onReset,
    onExploreCompat,
    onLoadExternal,
    class: className,
  }: Props = $props();

  const ACROSS_OPTIONS: Array<{
    value: AcrossDimension;
    label: string;
    disabled: boolean;
    title: string;
  }> = [
    {
      value: "program",
      label: "Programs",
      disabled: false,
      title: "Compare across multiple stopping-power programs",
    },
    {
      value: "material",
      label: "Materials",
      disabled: false,
      title: "Compare stopping power across multiple materials",
    },
    {
      value: "particle",
      label: "Particles",
      disabled: false,
      title: "Compare stopping power across multiple particles",
    },
  ];

  function handleAcrossChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value as AcrossDimension;
    if (value === selectionState.across) return;
    selectionState.setAcross(value);
  }
</script>

<div
  class={cn(
    "flex flex-wrap items-center gap-3 rounded-t-lg border border-b-0 bg-muted/40 px-3 py-2 text-xs",
    className,
  )}
  data-testid="picker-advanced-toolbar"
  aria-label="Advanced picker toolbar"
>
  <span class="font-semibold uppercase tracking-wider text-muted-foreground">Advanced</span>

  <label class="flex items-center gap-2">
    <span class="text-muted-foreground">Compare across:</span>
    <select
      class="rounded border bg-background px-2 py-0.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      data-testid="picker-compare-across"
      value={selectionState.across}
      onchange={handleAcrossChange}
    >
      {#each ACROSS_OPTIONS as opt (opt.value)}
        <option value={opt.value} disabled={opt.disabled} title={opt.title}>
          {opt.label}
        </option>
      {/each}
    </select>
  </label>

  <button
    type="button"
    class={cn(
      "rounded px-2 py-0.5 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
      !onLoadExternal && "opacity-50 cursor-not-allowed",
    )}
    data-testid="picker-load-external"
    disabled={!onLoadExternal}
    title={onLoadExternal
      ? "Load an external .webdedx data source"
      : "Load external modal ships in a follow-up PR"}
    onclick={() => onLoadExternal?.()}
  >
    🔗 Load external
  </button>

  <button
    type="button"
    class={cn(
      "rounded px-2 py-0.5 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
      !onExploreCompat && "opacity-50 cursor-not-allowed",
    )}
    data-testid="picker-explore-compat"
    disabled={!onExploreCompat}
    title={onExploreCompat ? "Explore compatibility matrix" : "Compatibility overlay coming soon"}
    onclick={() => onExploreCompat?.()}
  >
    ⊞ Explore compat
  </button>

  <button
    type="button"
    class="ml-auto rounded px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    data-testid="picker-reset"
    title="Restore defaults (proton / Water / Auto)"
    onclick={onReset}
    aria-label="Reset selection to defaults"
  >
    ↺
  </button>
</div>
