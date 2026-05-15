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
    inputRef = $bindable(null),
    class: className,
    "data-testid": testId,
  }: Props = $props();

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
  <input
    type="search"
    bind:this={inputRef}
    value={value}
    {placeholder}
    class="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    data-testid={testId ?? "v8-search-input"}
    oninput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
    onkeydown={handleKey}
  />
  <span class="hidden font-mono text-xs text-muted-foreground sm:inline" aria-hidden="true">
    ↑↓ ↵ /
  </span>
</div>
