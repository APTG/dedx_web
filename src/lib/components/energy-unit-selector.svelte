<script lang="ts">
  import { cn } from "$lib/utils";
  import type { EnergyUnit } from "$lib/wasm/types";

  interface Props {
    value: EnergyUnit;
    availableUnits: EnergyUnit[];
    disabled?: boolean;
    onValueChange: (unit: EnergyUnit) => void;
    class?: string;
  }

  let { value, availableUnits, disabled = false, onValueChange, class: className }: Props = $props();

  let buttonRefs = $state<HTMLButtonElement[]>([]);
  let focusedIndex = $state(0);

  $effect(() => {
    focusedIndex = availableUnits.indexOf(value);
    if (focusedIndex === -1) {
      focusedIndex = 0;
    }
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (focusedIndex + 1) % availableUnits.length;
      focusButton(nextIndex);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = (focusedIndex - 1 + availableUnits.length) % availableUnits.length;
      focusButton(prevIndex);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (availableUnits[focusedIndex]) {
        handleChange(availableUnits[focusedIndex]);
      }
    }
  }

  function focusButton(index: number) {
    if (buttonRefs[index]) {
      buttonRefs[index].focus();
      focusedIndex = index;
    }
  }

  function handleChange(unit: EnergyUnit) {
    if (disabled) return;
    if (unit !== value) {
      onValueChange(unit);
    }
  }
</script>

<div
  role="radiogroup"
  class={cn(
    "inline-flex items-center rounded-md border border-input bg-background p-1",
    disabled && "opacity-50",
    className
  )}
  aria-label="Energy unit selection"
>
  {#each availableUnits as unit, index (unit)}
    <button
      type="button"
      bind:this={buttonRefs[index]}
      role="radio"
      aria-checked={value === unit}
      aria-disabled={disabled ? "true" : "false"}
      aria-label={unit}
      tabindex={disabled ? -1 : 0}
      disabled={disabled}
      class={cn(
        "inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        value === unit
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled && "pointer-events-none"
      )}
      onclick={() => handleChange(unit)}
      onkeydown={handleKeyDown}
    >
      {unit}
    </button>
  {/each}
</div>
