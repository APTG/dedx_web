<script lang="ts">
  import { cn } from "$lib/utils.js";

  interface Props {
    label: string;
    /** Right-aligned metadata, e.g. density tag or Z badge. */
    meta?: string | undefined;
    /** Optional inline glyph (e.g. ≋ for gas, 🔗 for external). */
    glyph?: string | undefined;
    onClear: () => void;
    "data-testid"?: string;
    class?: string;
  }

  let { label, meta, glyph, onClear, "data-testid": testId, class: className }: Props = $props();
</script>

<button
  type="button"
  class={cn(
    "flex w-full items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/15",
    className,
  )}
  data-testid={testId ?? "picker-selected-pill"}
  aria-label="Selected: {label}. Click to clear."
  onclick={onClear}
>
  {#if glyph}
    <span aria-hidden="true">{glyph}</span>
  {/if}
  <span class="font-medium">{label}</span>
  {#if meta}
    <span class="font-mono text-xs text-muted-foreground">{meta}</span>
  {/if}
  <span
    class="ml-auto rounded border border-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
    aria-hidden="true">× clear</span
  >
</button>
