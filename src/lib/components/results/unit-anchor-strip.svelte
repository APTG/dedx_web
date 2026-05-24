<script lang="ts">
  import { cn } from "$lib/utils.js";
  import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
  } from "$lib/components/ui/tooltip";
  import type { HTMLAttributes } from "svelte/elements";

  interface Option {
    value: string;
    label: string;
    sub?: string;
    tooltip?: string;
  }

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
    options: Option[];
    selected: string;
    onSelect: (value: string) => void;
    disabled?: boolean;
  }

  let {
    options,
    selected,
    onSelect,
    disabled = false,
    class: className,
    ...restProps
  }: Props = $props();

  let containerRef = $state<HTMLElement | null>(null);
  let focusedIndex = $state(0);

  $effect(() => {
    const idx = options.findIndex((o) => o.value === selected);
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
    if (disabled || options.length === 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusButton((focusedIndex + 1) % options.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusButton((focusedIndex - 1 + options.length) % options.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const opt = options[focusedIndex];
      if (opt) handleSelect(opt.value);
    }
  }

  function handleSelect(value: string) {
    if (disabled) return;
    if (value !== selected) onSelect(value);
  }
</script>

<TooltipProvider>
  <div
    bind:this={containerRef}
    role="radiogroup"
    aria-label="Unit selection"
    {...restProps}
    class={cn(
      "inline-flex items-center gap-1 rounded-md border border-input bg-background p-1",
      disabled && "opacity-50",
      className,
    )}
  >
    {#each options as option, index (option.value)}
      <Tooltip>
        <TooltipTrigger
          role="radio"
          aria-checked={option.value === selected}
          aria-disabled={disabled ? "true" : "false"}
          tabindex={disabled ? -1 : focusedIndex === index ? 0 : -1}
          disabled={disabled}
          class={cn(
            "inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            option.value === selected
              ? "border-2 border-orange-400 bg-amber-50 text-foreground shadow-sm dark:bg-amber-900/20"
              : "border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            disabled && "pointer-events-none",
          )}
          onclick={() => handleSelect(option.value)}
          onkeydown={handleKeyDown}
        >
          {option.label}{#if option.sub}<span class="ml-1 text-xs text-muted-foreground">{option.sub}</span>{/if}
        </TooltipTrigger>
        {#if option.tooltip}
          <TooltipContent>
            <p class="text-xs">{option.tooltip}</p>
          </TooltipContent>
        {/if}
      </Tooltip>
    {/each}
  </div>
</TooltipProvider>
