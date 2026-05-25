<script lang="ts">
  import type { AcrossDimension } from "$lib/state/entity-selection.svelte";
  import { cn } from "$lib/utils.js";

  interface Props {
    value: AcrossDimension;
    onChange: (v: AcrossDimension) => void;
    class?: string;
  }

  let { value, onChange, class: className }: Props = $props();

  const OPTIONS: Array<{ value: AcrossDimension; label: string; short: string }> = [
    { value: "single", label: "single", short: "1×" },
    { value: "program", label: "programs", short: "prgs" },
    { value: "material", label: "materials", short: "mats" },
    { value: "particle", label: "particles", short: "parts" },
  ];

  let containerRef = $state<HTMLElement | null>(null);
  let focusedIndex = $state(0);

  $effect(() => {
    const idx = OPTIONS.findIndex((o) => o.value === value);
    focusedIndex = idx >= 0 ? idx : 0;
  });

  function focusButton(index: number) {
    const buttons = containerRef?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const btn = buttons?.[index];
    if (btn) {
      btn.focus();
      focusedIndex = index;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (OPTIONS.length === 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusButton((focusedIndex + 1) % OPTIONS.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusButton((focusedIndex - 1 + OPTIONS.length) % OPTIONS.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const opt = OPTIONS[focusedIndex];
      if (opt) onChange(opt.value);
    }
  }
</script>

<div
  bind:this={containerRef}
  class={cn("inline-flex items-center gap-1 rounded-md p-1", className)}
  role="radiogroup"
  aria-label="Compare across"
  data-testid="compare-across-strip"
>
  {#each OPTIONS as opt, index (opt.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === opt.value}
      tabindex={focusedIndex === index ? 0 : -1}
      class="rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      class:bg-foreground={value === opt.value}
      class:text-background={value === opt.value}
      class:border={value !== opt.value}
      class:border-input={value !== opt.value}
      class:hover:bg-accent={value !== opt.value}
      onclick={() => onChange(opt.value)}
      onkeydown={handleKeyDown}
      data-testid={`across-${opt.value}`}
    >
      <span class="hidden min-[380px]:inline">{opt.label}</span>
      <span class="inline min-[380px]:hidden">{opt.short}</span>
    </button>
  {/each}
</div>
