<script lang="ts">
  import { cn } from "$lib/utils.js";

  interface Props {
    value: string;
    placeholder?: string;
    onInput: (value: string) => void;
    /** Notified when ↵ pressed with current value. */
    onEnter?: () => void;
    /** Notified when ↑/↓ pressed — host can move list highlight. */
    onArrow?: (direction: "up" | "down") => void;
    /** Notified when the input receives focus — host can expand the panel. */
    onFocus?: () => void;
    /**
     * On mobile (≤ sm), the search field is a tap-target `<button>` that
     * opens the full-screen sheet. This callback fires when tapped on mobile.
     * When omitted, mobile behavior is the same as desktop (real input).
     */
    onMobileTap?: () => void;
    inputRef?: HTMLInputElement | null;
    class?: string;
    "data-testid"?: string;
  }

  let {
    value,
    placeholder = "Search…",
    onInput,
    onEnter,
    onArrow,
    onFocus,
    onMobileTap,
    inputRef = $bindable(null),
    class: className,
    "data-testid": testId,
  }: Props = $props();

  // Detect mobile viewport at mount; re-check on resize.
  let isMobile = $state(false);

  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px)");
    isMobile = mq.matches && onMobileTap !== undefined;
    function handleChange(e: MediaQueryListEvent) {
      isMobile = e.matches && onMobileTap !== undefined;
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  });

  function handleKey(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      onEnter?.();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onArrow?.("down");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onArrow?.("up");
    }
  }
</script>

<div class={cn("flex items-center gap-2", className)}>
  <span class="text-base" aria-hidden="true">🔍</span>
  {#if isMobile}
    <!-- Mobile: tap target styled as input — opens full-screen sheet -->
    <button
      type="button"
      class="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm text-left text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      data-testid={testId ?? "picker-search"}
      onclick={() => onMobileTap?.()}
      aria-label={placeholder}
    >
      {value || placeholder}
    </button>
  {:else}
    <!-- Desktop: real search input -->
    <input
      type="search"
      bind:this={inputRef}
      {value}
      {placeholder}
      class="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      data-testid={testId ?? "picker-search"}
      oninput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      onkeydown={handleKey}
      onfocus={() => onFocus?.()}
    />
  {/if}
  <span class="hidden font-mono text-xs text-muted-foreground sm:inline" aria-hidden="true">
    ↑↓ ↵ /
  </span>
</div>
