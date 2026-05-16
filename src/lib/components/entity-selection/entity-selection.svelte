<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState, SelectedProgram } from "$lib/state/entity-selection.svelte";
  import type { ParticleEntity, MaterialEntity, ProgramEntity } from "$lib/wasm/types";
  import type {
    ExternalOnlyParticle,
    ExternalOnlyMaterial,
    ExternalProgramEntity,
  } from "$lib/state/external-compatibility";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import TabBar, { type PickerTab, PICKER_TAB_ORDER } from "./tab-bar.svelte";
  import ParticleTab from "./particle-tab.svelte";
  import MaterialTab from "./material-tab.svelte";
  import ProgramTab from "./program-tab.svelte";
  import AdvancedToolbar from "./advanced-toolbar.svelte";
  import SearchInput from "./search-input.svelte";

  interface Props {
    selectionState: EntitySelectionState;
    onParticleSelect?: (particleId: number | string) => void;
    class?: string;
    /**
     * When true (Calculator page), the tab panel auto-collapses once all
     * three selections are complete, reclaiming vertical space. Plot page
     * keeps panels always open.
     *
     * Implementation: this gates the *initial* `expanded` state and the
     * post-completion auto-collapse. Once the user explicitly clicks a tab
     * or focuses the search, `state.expanded` takes over (rules B in the
     * entity-selection spec).
     */
    collapsible?: boolean;
    /**
     * Whether to render the Advanced-mode toolbar (Compare-across, Load
     * external, Explore compat, Reset). Default `collapsible` — Calculator
     * shows it, Plot hides it. On Plot the Advanced mode is only used to
     * pick part+mat+program for the next "Add series", so Compare-across
     * and friends are not useful there.
     */
    showAdvancedToolbar?: boolean;
  }

  let {
    selectionState,
    onParticleSelect,
    class: className,
    collapsible = false,
    showAdvancedToolbar = collapsible,
  }: Props = $props();

  // Initial expand/collapse rule (spec § Active target + expand/collapse, rule B):
  // - Calculator (collapsible=true): expanded = !isComplete on first mount.
  // - Plot (collapsible=false): expanded = true always.
  //
  // After mount, `state.expanded` is the source of truth; further updates
  // come from explicit user gestures (tab click, search focus, Esc) or from
  // `afterSelection` advancing to the next empty tab.
  let initialized = false;
  $effect(() => {
    if (initialized) return;
    initialized = true;
    if (collapsible) {
      selectionState.setExpanded(!selectionState.isComplete);
    } else {
      selectionState.setExpanded(true);
    }
  });

  function activateTab(tab: PickerTab): void {
    selectionState.setActiveTarget(tab);
    selectionState.setExpanded(true);
  }

  /**
   * Compute the next empty tab in canonical ①→②→③ order. Returns null if
   * all three are filled.
   */
  function nextEmptyTab(after: PickerTab): PickerTab | null {
    const startIdx = PICKER_TAB_ORDER.indexOf(after) + 1;
    for (let i = startIdx; i < PICKER_TAB_ORDER.length; i++) {
      const tab = PICKER_TAB_ORDER[i]!;
      if (tab === "material" && !selectionState.selectedMaterial) return tab;
      if (tab === "program" && selectionState.selectedProgram.id === -1) {
        const auto = selectionState.selectedProgram;
        const hasResolved = "resolvedProgram" in auto && auto.resolvedProgram;
        if (!hasResolved) return tab;
      }
    }
    // Wrap once if nothing forward — check earlier tabs too.
    for (let i = 0; i <= PICKER_TAB_ORDER.indexOf(after); i++) {
      const tab = PICKER_TAB_ORDER[i]!;
      if (tab === "particle" && !selectionState.selectedParticle) return tab;
      if (tab === "material" && !selectionState.selectedMaterial) return tab;
    }
    return null;
  }

  /**
   * Apply rule A.4: after a selection in the active tab, advance to the
   * next empty tab (keeping expanded), or — if all three filled — stay put
   * and collapse on Calculator. Plot stays expanded.
   */
  function afterSelection(current: PickerTab): void {
    const nextEmpty = nextEmptyTab(current);
    if (nextEmpty !== null) {
      selectionState.setActiveTarget(nextEmpty);
      selectionState.setExpanded(true);
      return;
    }
    // All three filled.
    if (collapsible) {
      selectionState.setExpanded(false);
    }
  }

  function handleParticleSelect(particle: ParticleEntity | ExternalOnlyParticle) {
    if (onParticleSelect) onParticleSelect(particle.id);
    else selectionState.selectParticle(particle.id);
    afterSelection("particle");
  }

  function handleMaterialSelect(material: MaterialEntity | ExternalOnlyMaterial) {
    selectionState.selectMaterial(material.id);
    afterSelection("material");
  }

  function handleProgramSelect(program: SelectedProgram | ProgramEntity | ExternalProgramEntity) {
    selectionState.selectProgram(program.id);
    afterSelection("program");
  }

  function handleReset(): void {
    selectionState.resetAll();
    // Reset restores complete defaults (proton/Water/Auto). On Calculator
    // (collapsible) the panel should collapse to match the post-completion
    // rule. On Plot (!collapsible) the panel stays open.
    if (collapsible) {
      selectionState.setExpanded(false);
    }
  }

  function handleGlobalKey(event: KeyboardEvent) {
    // Esc collapses the panel (rule A.7) without changing activeTarget.
    if (event.key === "Escape") {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.closest("[data-testid='picker-entity-selection']")
      ) {
        active.blur();
        if (collapsible) selectionState.setExpanded(false);
      }
    }
  }

  const activeTab = $derived(selectionState.activeTarget as PickerTab);
  const panelOpen = $derived(selectionState.expanded);

  // Shared picker-level search query. Cleared whenever the active tab
  // changes so each tab starts with an empty filter (matches the
  // previous per-tab `query = $state("")` behaviour).
  let query = $state("");
  let searchInputRef: HTMLInputElement | null = $state(null);
  let particleArrowKey = $state<((d: "up" | "down") => void) | undefined>(undefined);
  let particleEnterKey = $state<(() => void) | undefined>(undefined);

  let lastTab: PickerTab | null = null;
  $effect(() => {
    const current = activeTab;
    if (lastTab === null) {
      // Initial mount — record the starting tab but do not steal focus
      // (callers / tests may want to focus a specific tab button first).
      lastTab = current;
      return;
    }
    if (lastTab !== current) {
      lastTab = current;
      // Reset the shared filter so each tab starts empty (matches the
      // previous per-tab `query = $state("")` behaviour).
      query = "";
      // Refocus the search input on tab change so keyboard users can
      // immediately type into the lifted picker-level search row.
      if (panelOpen) searchInputRef?.focus();
    }
  });

  const placeholder = $derived.by(() => {
    switch (activeTab) {
      case "particle":
        return "Search particles…";
      case "material":
        return "Search materials…";
      case "program":
        return "Search programs…";
    }
  });

  function toggleExpanded(): void {
    selectionState.setExpanded(!panelOpen);
  }

  function handleSearchFocus(): void {
    if (!panelOpen) selectionState.setExpanded(true);
  }
</script>

<svelte:window onkeydown={handleGlobalKey} />

<div class={cn("rounded-lg", className)} data-testid="picker-entity-selection">
  {#if isAdvancedMode.value && showAdvancedToolbar}
    <AdvancedToolbar {selectionState} onReset={handleReset} />
  {/if}

  <TabBar
    {activeTab}
    activeTarget={activeTab}
    {selectionState}
    {panelOpen}
    onActivate={(tab) => activateTab(tab)}
  />

  <div
    class="flex items-center gap-2 border-x bg-card px-3 py-2"
    role="search"
    aria-label="Search picker entities"
    data-testid="picker-search-row"
  >
    <SearchInput
      value={query}
      {placeholder}
      onInput={(v) => (query = v)}
      onArrow={(dir) => particleArrowKey?.(dir)}
      onEnter={() => particleEnterKey?.()}
      onFocus={handleSearchFocus}
      bind:inputRef={searchInputRef}
      class="flex-1"
      data-testid="picker-{activeTab}-search"
    />
    <button
      type="button"
      class="rounded-md border bg-background px-2 py-1 text-sm text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      data-testid="picker-toggle"
      aria-expanded={panelOpen}
      aria-controls="picker-panel-{activeTab}"
      aria-label={panelOpen ? "Collapse picker panel" : "Expand picker panel"}
      title={panelOpen ? "Collapse" : "Expand"}
      onclick={toggleExpanded}
    >
      <span aria-hidden="true">{panelOpen ? "▲" : "▼"}</span>
    </button>
  </div>

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
          {query}
          bind:onArrowKey={particleArrowKey}
          bind:onEnterKey={particleEnterKey}
          onSelect={handleParticleSelect}
          onClear={() => {
            selectionState.clearParticle();
            selectionState.setActiveTarget("particle");
            selectionState.setExpanded(true);
          }}
        />
      {:else if activeTab === "material"}
        <MaterialTab
          {selectionState}
          {query}
          onSelect={handleMaterialSelect}
          onClear={() => {
            selectionState.clearMaterial();
            selectionState.setActiveTarget("material");
            selectionState.setExpanded(true);
          }}
        />
      {:else if activeTab === "program"}
        <ProgramTab {selectionState} {query} onSelect={handleProgramSelect} />
      {/if}
    </div>
  {/if}
</div>
