<script lang="ts">
  import type { ProgramEntity } from "$lib/wasm/types";
  import type { MultiProgramState } from "$lib/state/multi-program.svelte";
  import type { ExternalProgramEntity } from "$lib/state/external-compatibility";
  import type { EntityId } from "$lib/external-data/types";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";

  interface Props {
    state: MultiProgramState;
    availablePrograms: ProgramEntity[];
    availableExternalPrograms?: ExternalProgramEntity[];
    compatibleIds: Set<EntityId>;
    class?: string;
    onInteraction?: () => void;
  }

  let {
    state: multiState,
    availablePrograms,
    availableExternalPrograms = [],
    compatibleIds,
    class: className = "",
    onInteraction,
  }: Props = $props();

  let isOpen = $state(false);

  // Drag-and-drop state (mouse)
  let draggingId = $state<EntityId | null>(null);
  let dragOverId = $state<EntityId | null>(null);

  // Touch drag state
  let touchDragId = $state<EntityId | null>(null);
  let touchDragOverAttr = $state<string | null>(null);

  // Aria-live announcement
  let announcement = $state<string>("");

  function isSelected(programId: EntityId): boolean {
    return multiState.selectedProgramIds.includes(programId);
  }

  function isDefault(programId: EntityId): boolean {
    return multiState.selectedProgramIds[0] === programId;
  }

  function isIncompatible(programId: EntityId): boolean {
    return !compatibleIds.has(programId);
  }

  function getProgramName(programId: EntityId): string {
    const builtin = availablePrograms.find((p) => p.id === programId);
    if (builtin) return builtin.name;
    const external = availableExternalPrograms.find((p) => p.id === programId);
    if (external) return external.name;
    return String(programId);
  }

  function toggleProgram(programId: EntityId): void {
    if (isIncompatible(programId)) return;
    if (isDefault(programId)) return;

    if (isSelected(programId)) {
      multiState.removeProgram(programId);
    } else {
      multiState.addProgram(programId);
    }

    onInteraction?.();
  }

  function toggleDropdown(): void {
    isOpen = !isOpen;
  }

  // Reorder and announce the new position.
  function reorderAndAnnounce(programId: EntityId, newIndex: number): void {
    multiState.reorderPrograms(programId, newIndex);
    const order = multiState.programDisplayOrder;
    const pos = order.indexOf(programId) + 1;
    announcement = `Moved ${getProgramName(programId)} to position ${pos} of ${order.length}.`;
  }

  // --- Mouse drag handlers ---

  function handleDragStart(programId: EntityId, event: DragEvent): void {
    if (!event.dataTransfer || isDefault(programId)) return;
    draggingId = programId;
    event.dataTransfer.setData("text/plain", String(programId));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(programId: EntityId, event: DragEvent): void {
    if (
      draggingId === null ||
      draggingId === programId ||
      isDefault(programId) ||
      !isSelected(programId)
    ) {
      return;
    }
    event.preventDefault();
    dragOverId = programId;
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave(): void {
    dragOverId = null;
  }

  function handleDrop(programId: EntityId, event: DragEvent): void {
    event.preventDefault();
    const draggedId = draggingId;
    dragOverId = null;
    draggingId = null;
    if (draggedId === null || draggedId === programId || isDefault(programId)) return;
    const targetIndex = multiState.programDisplayOrder.indexOf(programId);
    if (targetIndex !== -1) {
      reorderAndAnnounce(draggedId, targetIndex);
    }
  }

  function handleDragEnd(): void {
    draggingId = null;
    dragOverId = null;
  }

  // --- Keyboard reorder (Alt+ArrowUp / Alt+ArrowDown on drag handle) ---

  function handleHandleKeydown(programId: EntityId, event: KeyboardEvent): void {
    if (!event.altKey) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();

    const defaultProgramId = multiState.selectedProgramIds[0];
    if (programId === defaultProgramId) return;

    const order = multiState.programDisplayOrder;
    const currentIndex = order.indexOf(programId);
    if (currentIndex === -1) return;
    const minimumIndex = order[0] === defaultProgramId ? 1 : 0;

    if (event.key === "ArrowUp" && currentIndex > minimumIndex) {
      reorderAndAnnounce(programId, currentIndex - 1);
    } else if (event.key === "ArrowDown" && currentIndex < order.length - 1) {
      reorderAndAnnounce(programId, currentIndex + 1);
    }
  }

  // --- Touch drag handlers ---

  function handleTouchStart(programId: EntityId, event: TouchEvent): void {
    if (isDefault(programId)) return;
    event.preventDefault();
    touchDragId = programId;
    touchDragOverAttr = null;
  }

  function handleTouchMove(event: TouchEvent): void {
    if (touchDragId === null) return;
    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el?.closest("[data-program-id]");
    touchDragOverAttr = row?.getAttribute("data-program-id") ?? null;
  }

  function handleTouchEnd(): void {
    const draggedId = touchDragId;
    const overAttr = touchDragOverAttr;
    touchDragId = null;
    touchDragOverAttr = null;

    if (draggedId === null || overAttr === null) return;
    if (String(draggedId) === overAttr) return;

    const targetId = multiState.programDisplayOrder.find((id) => String(id) === overAttr);
    if (targetId === undefined || isDefault(targetId)) return;

    const targetIndex = multiState.programDisplayOrder.indexOf(targetId);
    if (targetIndex !== -1) {
      reorderAndAnnounce(draggedId, targetIndex);
    }
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
  <!-- Always-present aria-live region for reorder announcements -->
  <div aria-live="polite" aria-atomic="true" class="sr-only">{announcement}</div>

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
        {#if availablePrograms.length === 0 && availableExternalPrograms.length === 0}
          <p class="px-3 py-2 text-sm text-muted-foreground">No programs available</p>
        {:else}
          {#if availablePrograms.length > 0}
            {#each availablePrograms as program (program.id)}
              {@const selected = isSelected(program.id)}
              {@const defaultProg = isDefault(program.id)}
              {@const incompatible = isIncompatible(program.id)}
              {@const isDragging = draggingId === program.id}
              {@const isDragOver = dragOverId === program.id}
              {@const isTouchOver =
                touchDragOverAttr === String(program.id) && selected && !defaultProg}

              <div
                role="presentation"
                class={cn(
                  "flex items-center",
                  (isDragOver || isTouchOver) && "border-l-2 border-primary pl-0",
                )}
                data-program-id={String(program.id)}
                ondragover={(e) => handleDragOver(program.id, e)}
                ondrop={(e) => handleDrop(program.id, e)}
                ondragleave={handleDragLeave}
              >
                {#if selected && !defaultProg}
                  <!-- Drag handle: focusable, supports keyboard and touch reorder -->
                  <button
                    type="button"
                    class="flex-none cursor-grab touch-none select-none border-0 bg-transparent px-1 py-2 text-sm leading-none text-muted-foreground hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    draggable="true"
                    aria-label="Drag to reorder {program.name}"
                    aria-describedby="multi-picker-reorder-hint"
                    ondragstart={(e) => handleDragStart(program.id, e)}
                    ondragend={handleDragEnd}
                    onkeydown={(e) => handleHandleKeydown(program.id, e)}
                    ontouchstart={(e) => handleTouchStart(program.id, e)}
                    ontouchmove={handleTouchMove}
                    ontouchend={handleTouchEnd}
                  >⋮⋮</button>
                {:else}
                  <span class="flex-none w-5 px-1"></span>
                {/if}

                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabindex={incompatible ? -1 : 0}
                  class={cn(
                    "flex flex-1 items-center gap-2 rounded-sm px-3 py-2 text-sm",
                    selected && !isDragging && "bg-accent",
                    isDragging && "opacity-40",
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
              </div>
            {/each}
          {/if}

          {#if availableExternalPrograms.length > 0}
            <div role="group" aria-label="External">
              <p
                class="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide"
                role="presentation"
                aria-hidden="true"
              >
                External
              </p>
              {#each availableExternalPrograms as program (program.id)}
                {@const extId = program.id as EntityId}
                {@const selected = isSelected(extId)}
                {@const defaultProg = isDefault(extId)}
                {@const incompatible = isIncompatible(extId)}
                {@const isDragging = draggingId === extId}
                {@const isDragOver = dragOverId === extId}
                {@const isTouchOver =
                  touchDragOverAttr === String(extId) && selected && !defaultProg}

                  <div
                    role="presentation"
                    class={cn(
                      "flex items-center",
                      (isDragOver || isTouchOver) && "border-l-2 border-primary pl-0",
                    )}
                    data-program-id={String(extId)}
                    ondragover={(e) => handleDragOver(extId, e)}
                    ondrop={(e) => handleDrop(extId, e)}
                    ondragleave={handleDragLeave}
                  >
                    {#if selected && !defaultProg}
                      <!-- Drag handle for external programs -->
                      <button
                        type="button"
                        class="flex-none cursor-grab touch-none select-none border-0 bg-transparent px-1 py-2 text-sm leading-none text-muted-foreground hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        draggable="true"
                        aria-label="Drag to reorder {program.name}"
                        aria-describedby="multi-picker-reorder-hint"
                        ondragstart={(e) => handleDragStart(extId, e)}
                        ondragend={handleDragEnd}
                        onkeydown={(e) => handleHandleKeydown(extId, e)}
                        ontouchstart={(e) => handleTouchStart(extId, e)}
                        ontouchmove={handleTouchMove}
                        ontouchend={handleTouchEnd}
                      >⋮⋮</button>
                    {:else}
                      <span class="flex-none w-5 px-1"></span>
                    {/if}

                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabindex={incompatible ? -1 : 0}
                    class={cn(
                      "flex flex-1 items-center gap-2 rounded-sm px-3 py-2 text-sm",
                      selected && !isDragging && "bg-accent",
                      isDragging && "opacity-40",
                      incompatible && "text-muted-foreground opacity-60 cursor-not-allowed",
                      !incompatible && !selected && "hover:bg-accent/50 focus:bg-accent/50",
                    )}
                    onclick={() => toggleProgram(extId)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleProgram(extId);
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
                      🔗 {program.name}
                      {#if defaultProg}
                        <span class="ml-1 text-xs text-muted-foreground">(default)</span>
                      {/if}
                      {#if incompatible}
                        <span class="ml-1 text-xs text-muted-foreground">(unavailable)</span>
                      {/if}
                    </span>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <p id="multi-picker-reorder-hint" class="sr-only">
        Use Alt+ArrowUp and Alt+ArrowDown to reorder selected programs. Drag and drop also
        supported.
      </p>
    </div>
  {/if}
</div>
