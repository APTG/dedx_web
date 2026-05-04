<script lang="ts">
  import type { ProgramEntity } from "$lib/wasm/types";
  import type { MultiProgramState } from "$lib/state/multi-program.svelte.ts";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";

  interface Props {
    state: MultiProgramState;
    availablePrograms: ProgramEntity[];
    compatibleIds: Set<number>;
    class?: string;
    onInteraction?: () => void;
  }

  let {
    state: multiState,
    availablePrograms,
    compatibleIds,
    class: className = "",
    onInteraction,
  }: Props = $props();

  let isOpen = $state(false);

  function isSelected(programId: number): boolean {
    return multiState.selectedProgramIds.includes(programId);
  }

  function isDefault(programId: number): boolean {
    return multiState.selectedProgramIds[0] === programId;
  }

  function isIncompatible(programId: number): boolean {
    return !compatibleIds.has(programId);
  }

  function toggleProgram(programId: number): void {
    if (isIncompatible(programId)) {
      return;
    }

    if (isDefault(programId)) {
      // Cannot deselect default
      return;
    }

    if (isSelected(programId)) {
      multiState.removeProgram(programId);
    } else {
      multiState.addProgram(programId);
    }

    // Notify parent of interaction (for onboarding hint dismissal)
    onInteraction?.();
  }

  function toggleDropdown(): void {
    isOpen = !isOpen;
  }

  // Close dropdown when clicking outside
  $effect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-multi-program-picker]")) {
        isOpen = false;
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });

  // Close on escape key
  $effect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        isOpen = false;
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  });
</script>

<div class={cn("relative inline-block text-left", className)} data-multi-program-picker>
  <Button
    variant="outline"
    size="sm"
    onclick={toggleDropdown}
    aria-expanded={isOpen}
    aria-haspopup="listbox"
    class="justify-between"
  >
    <span>Programs ▾</span>
    <span class="ml-2 text-xs">{multiState.selectedProgramIds.length}</span>
    <svg
      class={cn("ml-2 h-4 w-4 transition-transform", isOpen && "rotate-180")}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </Button>

  {#if isOpen}
    <div
      role="listbox"
      aria-multiselectable="true"
      aria-label="Select comparison programs"
      class="absolute z-50 mt-2 w-72 rounded-md border bg-popover p-2 shadow-lg"
    >
      <div class="max-h-64 overflow-y-auto">
        {#if availablePrograms.length === 0}
          <p class="px-3 py-2 text-sm text-muted-foreground">No programs available</p>
        {:else}
          {#each availablePrograms as program (program.id)}
            {@const selected = isSelected(program.id)}
            {@const defaultProg = isDefault(program.id)}
            {@const incompatible = isIncompatible(program.id)}

            <button
              type="button"
              role="option"
              aria-selected={selected}
              tabindex={incompatible ? -1 : 0}
              class={cn(
                "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm",
                selected && "bg-accent",
                incompatible && "text-muted-foreground opacity-60 cursor-not-allowed",
                !incompatible && !selected && "hover:bg-accent/50 focus:bg-accent/50",
              )}
              onclick={() => toggleProgram(program.id)}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleProgram(program.id);
                }
              }}
              title={incompatible ? "Not available for current selection" : ""}
              disabled={incompatible}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={defaultProg || incompatible}
                class="h-4 w-4 rounded border-input pointer-events-none"
                aria-label={program.name}
                aria-hidden="true"
              />
              <span class="flex-1 text-left">
                {program.name}
                {#if defaultProg}
                  <span class="ml-1 text-xs text-muted-foreground">(default)</span>
                {/if}
                {#if incompatible}
                  <span class="ml-1 text-xs text-muted-foreground">(unavailable)</span>
                {/if}
              </span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
