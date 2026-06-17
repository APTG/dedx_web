<script lang="ts">
  import { cn } from "$lib/utils.js";

  interface Props {
    onReset: () => void;
    /**
     * Opens the load-external modal. When omitted the button renders disabled.
     */
    onLoadExternal?: () => void;
    class?: string;
  }

  let { onReset, onLoadExternal, class: className }: Props = $props();
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
      : "Load external is unavailable on this page"}
    onclick={() => onLoadExternal?.()}
  >
    🔗 Load external
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
