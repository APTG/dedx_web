<script lang="ts" module>
  export type PickerTab = "particle" | "material" | "program";
  export const PICKER_TAB_ORDER: readonly PickerTab[] = ["particle", "material", "program"];
</script>

<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { getParticleLabel } from "$lib/utils/particle-label";

  interface Props {
    activeTab: PickerTab;
    selectionState: EntitySelectionState;
    onActivate: (tab: PickerTab) => void;
    panelOpen?: boolean;
    /**
     * The "active target" tab — gets the coral underline. Typically equal to
     * `activeTab` but is kept independent because the picker spec lets the
     * underline persist on the just-completed tab while a different tab is
     * focused via keyboard.
     */
    activeTarget?: PickerTab;
    class?: string;
  }

  let {
    activeTab,
    selectionState,
    onActivate,
    panelOpen = true,
    activeTarget = activeTab,
    class: className,
  }: Props = $props();

  const particleValue = $derived.by(() => {
    const p = selectionState.selectedParticle;
    return p ? getParticleLabel(p) : "— pick one —";
  });

  const materialValue = $derived(selectionState.selectedMaterial?.name ?? "— pick one —");

  const programValue = $derived.by(() => {
    const program = selectionState.selectedProgram;
    if (program.id === -1) {
      const resolved = "resolvedProgram" in program ? program.resolvedProgram : null;
      return resolved ? `Auto → ${resolved.name}` : "Auto";
    }
    return program.name;
  });

  const particleEmpty = $derived(selectionState.selectedParticle === null);
  const materialEmpty = $derived(selectionState.selectedMaterial === null);
  // Program "empty" = Auto-select unresolved (no compatible program).
  const programEmpty = $derived.by(() => {
    const p = selectionState.selectedProgram;
    if (p.id === -1) {
      return !("resolvedProgram" in p && p.resolvedProgram);
    }
    return false;
  });

  function handleKeyDown(event: KeyboardEvent, current: PickerTab): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const idx = PICKER_TAB_ORDER.indexOf(current);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next =
      PICKER_TAB_ORDER[(idx + delta + PICKER_TAB_ORDER.length) % PICKER_TAB_ORDER.length];
    if (next) onActivate(next);
  }

  type Spec = {
    id: PickerTab;
    numeral: string;
    title: string;
    value: string;
    empty: boolean;
  };
  const tabs = $derived<readonly Spec[]>([
    { id: "particle", numeral: "①", title: "Particle", value: particleValue, empty: particleEmpty },
    { id: "material", numeral: "②", title: "Material", value: materialValue, empty: materialEmpty },
    { id: "program", numeral: "③", title: "Program", value: programValue, empty: programEmpty },
  ]);
</script>

<div
  class={cn("flex flex-wrap gap-1 border-x bg-card px-1 pt-1", className)}
  role="tablist"
  aria-label="Entity selection tabs"
  data-testid="picker-tab-bar"
>
  {#each tabs as tab (tab.id)}
    {@const isActive = tab.id === activeTab}
    {@const isTarget = tab.id === activeTarget}
    <button
      type="button"
      role="tab"
      id="picker-tab-{tab.id}"
      data-testid="picker-tab-{tab.id}"
      data-active-target={isTarget ? "true" : undefined}
      aria-selected={isActive}
      aria-controls={panelOpen && isActive ? `picker-panel-${tab.id}` : undefined}
      tabindex={isActive ? 0 : -1}
      class={cn(
        "relative flex items-start sm:items-baseline gap-1 rounded-t-md px-2 sm:px-3 py-1.5 text-sm border border-b-0 transition-colors",
        isActive
          ? "bg-background border-border font-semibold"
          : "bg-muted/40 border-transparent text-muted-foreground hover:bg-accent",
        tab.empty && "border-dashed border-2 border-red-500 text-red-700",
      )}
      onclick={() => onActivate(tab.id)}
      onkeydown={(e) => handleKeyDown(e, tab.id)}
    >
      <span class="text-xs text-muted-foreground leading-none mt-0.5" aria-hidden="true"
        >{tab.numeral}</span
      >
      <span class="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-1">
        <span class="leading-tight">{tab.title}<span class="hidden sm:inline">:</span></span>
        <span
          class={cn(
            "truncate max-w-[12ch] text-xs font-normal text-muted-foreground sm:text-inherit sm:font-[inherit] sm:max-w-[16ch]",
            tab.empty && "text-red-600 italic",
          )}>{tab.value}</span
        >
      </span>
      {#if isTarget}
        <span
          class="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full"
          style="background-color: #f97316;"
          aria-hidden="true"
        ></span>
      {/if}
      {#if tab.empty}
        <span
          class="absolute -top-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white"
          data-testid="picker-tab-{tab.id}-empty"
          aria-label="{tab.title} selection is empty"
          title="{tab.title} selection is empty"
        >
          !
        </span>
      {/if}
    </button>
  {/each}
</div>
