<script lang="ts" module>
  export type V8Tab = "particle" | "material" | "program";
  export const V8_TAB_ORDER: readonly V8Tab[] = ["particle", "material", "program"];
</script>

<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { getParticleLabel } from "$lib/utils/particle-label";

  interface Props {
    activeTab: V8Tab;
    selectionState: EntitySelectionState;
    onActivate: (tab: V8Tab) => void;
    panelOpen?: boolean;
    class?: string;
  }

  let { activeTab, selectionState, onActivate, panelOpen = true, class: className }: Props = $props();

  const particleValue = $derived.by(() => {
    const p = selectionState.selectedParticle;
    return p ? getParticleLabel(p) : "—";
  });

  const materialValue = $derived(selectionState.selectedMaterial?.name ?? "—");

  const programValue = $derived.by(() => {
    const program = selectionState.selectedProgram;
    if (program.id === -1) {
      const resolved =
        "resolvedProgram" in program ? program.resolvedProgram : null;
      return resolved ? `Auto → ${resolved.name}` : "Auto";
    }
    return program.name;
  });

  function handleKeyDown(event: KeyboardEvent, current: V8Tab): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const idx = V8_TAB_ORDER.indexOf(current);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = V8_TAB_ORDER[(idx + delta + V8_TAB_ORDER.length) % V8_TAB_ORDER.length];
    if (next) onActivate(next);
  }

  type Spec = { id: V8Tab; numeral: string; title: string; value: string };
  const tabs = $derived<readonly Spec[]>([
    { id: "particle", numeral: "①", title: "Particle", value: particleValue },
    { id: "material", numeral: "②", title: "Material", value: materialValue },
    { id: "program", numeral: "③", title: "Program", value: programValue },
  ]);
</script>

<div
  class={cn("flex flex-wrap gap-1 border-x bg-card px-1 pt-1", className)}
  role="tablist"
  aria-label="Entity selection tabs"
  data-testid="v8-tab-bar"
>
  {#each tabs as tab (tab.id)}
    {@const isActive = tab.id === activeTab}
    <button
      type="button"
      role="tab"
      id="v8-tab-{tab.id}"
      data-testid="v8-tab-{tab.id}"
      aria-selected={isActive}
      aria-controls={panelOpen && isActive ? `v8-tab-panel-${tab.id}` : undefined}
      tabindex={isActive ? 0 : -1}
      class={cn(
        "flex items-start sm:items-baseline gap-1 rounded-t-md px-2 sm:px-3 py-1.5 text-sm border border-b-0 transition-colors",
        isActive
          ? "bg-background border-border font-semibold"
          : "bg-muted/40 border-transparent text-muted-foreground hover:bg-accent",
      )}
      onclick={() => onActivate(tab.id)}
      onkeydown={(e) => handleKeyDown(e, tab.id)}
    >
      <span class="text-xs text-muted-foreground leading-none mt-0.5" aria-hidden="true">{tab.numeral}</span>
      <span class="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-1">
        <span class="leading-tight">{tab.title}<span class="hidden sm:inline">:</span></span>
        <span class="truncate max-w-[12ch] text-xs font-normal text-muted-foreground sm:text-inherit sm:font-[inherit] sm:max-w-[16ch]">{tab.value}</span>
      </span>
    </button>
  {/each}
</div>
