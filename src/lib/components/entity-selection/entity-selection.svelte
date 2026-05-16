<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type {
    EntitySelectionState,
    SelectedProgram,
  } from "$lib/state/entity-selection.svelte";
  import type {
    ParticleEntity,
    MaterialEntity,
    ProgramEntity,
  } from "$lib/wasm/types";
  import type {
    ExternalOnlyParticle,
    ExternalOnlyMaterial,
    ExternalProgramEntity,
  } from "$lib/state/external-compatibility";
  import RecipeBar from "./recipe-bar.svelte";
  import TabBar, { type PickerTab } from "./tab-bar.svelte";
  import ParticleTab from "./particle-tab.svelte";
  import MaterialTab from "./material-tab.svelte";
  import ProgramTab from "./program-tab.svelte";

  interface Props {
    selectionState: EntitySelectionState;
    onParticleSelect?: (particleId: number | string) => void;
    class?: string;
    /**
     * When true (Calculator page), the tab panel auto-collapses once all
     * three selections are complete, reclaiming vertical space. Clicking any
     * tab or recipe-bar item re-expands it. Plot page keeps panels always open.
     */
    collapsible?: boolean;
  }

  let { selectionState, onParticleSelect, class: className, collapsible = false }: Props = $props();

  let activeTab = $state<PickerTab>("particle");
  let panelOpen = $state(true);

  $effect(() => {
    if (collapsible && selectionState.isComplete) {
      panelOpen = false;
    }
  });

  function openPanel(tab: PickerTab): void {
    activeTab = tab;
    panelOpen = true;
  }

  /**
   * Auto-advance to the next "non-completed" tab after a selection.
   * Particle → Material → Program. Stops at the first tab whose selection
   * is still missing.
   */
  function advanceAfter(current: PickerTab): void {
    const order: PickerTab[] = ["particle", "material", "program"];
    const startIdx = order.indexOf(current) + 1;
    for (let i = startIdx; i < order.length; i++) {
      const tab = order[i]!;
      if (tab === "material" && selectionState.selectedMaterial) continue;
      if (tab === "program" && selectionState.selectedProgram.id !== -1) continue;
      activeTab = tab;
      return;
    }
  }

  function handleParticleSelect(particle: ParticleEntity | ExternalOnlyParticle) {
    if (onParticleSelect) onParticleSelect(particle.id);
    else selectionState.selectParticle(particle.id);
    advanceAfter("particle");
  }

  function handleMaterialSelect(material: MaterialEntity | ExternalOnlyMaterial) {
    selectionState.selectMaterial(material.id);
    advanceAfter("material");
  }

  function handleProgramSelect(program: SelectedProgram | ProgramEntity | ExternalProgramEntity) {
    selectionState.selectProgram(program.id);
  }

  function handleGlobalKey(event: KeyboardEvent) {
    // spec § "Anatomy" lists keyboard behaviour: `Esc blur`. The search
    // input grabs focus on tab change so users need a quick way to exit
    // back to the page chrome without removing the picker entirely.
    if (event.key === "Escape") {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest("[data-testid='picker-entity-selection']")) {
        active.blur();
      }
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKey} />

<div
  class={cn("rounded-lg", className)}
  data-testid="picker-entity-selection"
>
  <RecipeBar
    {selectionState}
    onActivateTab={(tab) => openPanel(tab)}
    onReset={() => {
      selectionState.resetAll();
      activeTab = "particle";
      panelOpen = true;
    }}
  />
  <TabBar
    {activeTab}
    {selectionState}
    {panelOpen}
    onActivate={(tab) => openPanel(tab)}
  />

  {#if panelOpen}
    <div
      id="picker-panel-{activeTab}"
      role="tabpanel"
      aria-labelledby="picker-tab-{activeTab}"
      class="rounded-b-lg border bg-background p-3 min-h-[260px]"
      data-testid="picker-tab-panel"
      data-active-tab={activeTab}
    >
      {#if activeTab === "particle"}
        <ParticleTab
          {selectionState}
          onSelect={handleParticleSelect}
          onClear={() => { selectionState.clearParticle(); panelOpen = true; }}
        />
      {:else if activeTab === "material"}
        <MaterialTab
          {selectionState}
          onSelect={handleMaterialSelect}
          onClear={() => { selectionState.clearMaterial(); panelOpen = true; }}
        />
      {:else if activeTab === "program"}
        <ProgramTab
          {selectionState}
          onSelect={handleProgramSelect}
        />
      {/if}
    </div>
  {/if}
</div>
