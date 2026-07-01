<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import X from "@lucide/svelte/icons/x";

  // Transient confirmation toast shown after Add Series (#812). Driven by a
  // `{ text, token }` signal from the parent: a fresh object (new token) re-arms
  // the toast even when the text repeats. It is its own `role="status"` live
  // region, so screen readers announce the text when it appears.
  let {
    feedback,
    onDismiss,
    durationMs = 4000,
  }: {
    feedback: { text: string; token: number } | null;
    onDismiss: () => void;
    durationMs?: number;
  } = $props();

  let visibleText = $state<string | null>(null);

  $effect(() => {
    if (!feedback) return;
    // Read token so an identical-text re-announcement still re-runs the effect.
    void feedback.token;
    visibleText = feedback.text;
    const id = setTimeout(() => {
      visibleText = null;
      onDismiss();
    }, durationMs);
    return () => clearTimeout(id);
  });

  function dismiss(): void {
    visibleText = null;
    onDismiss();
  }
</script>

{#if visibleText}
  <div
    class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    data-testid="plot-toast"
  >
    <div
      role="status"
      aria-live="polite"
      class="pointer-events-auto flex max-w-[min(90vw,26rem)] items-center gap-2 rounded-md border border-primary/30 bg-card px-3 py-2 text-sm shadow-lg"
    >
      <CircleCheck class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate">{visibleText}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        class="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        onclick={dismiss}
      >
        <X class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
{/if}
