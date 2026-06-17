<script lang="ts">
  import { browser } from "$app/environment";
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
  import PickerSheet from "./picker-sheet.svelte";
  import { fly } from "svelte/transition";
  import { quintOut, quadIn } from "svelte/easing";

  interface Props {
    selectionState: EntitySelectionState;
    onParticleSelect?: (particleId: number | string) => void;
    class?: string;
    /**
     * When true (Calculator page), the tab panel auto-collapses once all
     * three selections are complete, reclaiming vertical space. Plot page
     * keeps panels always open.
     */
    collapsible?: boolean;
    /**
     * Whether to render the Advanced-mode toolbar (Load external, Reset).
     * Defaults to `collapsible`; a host page can override (e.g. Plot passes
     * it explicitly so the toolbar shows in Advanced mode on any viewport).
     */
    showAdvancedToolbar?: boolean;
    /**
     * Called when the user clicks "Load external" in the Advanced toolbar.
     * When provided, the toolbar button is enabled.
     */
    onLoadExternal?: () => void;
  }

  let {
    selectionState,
    onParticleSelect,
    class: className,
    collapsible = false,
    showAdvancedToolbar = collapsible,
    onLoadExternal,
  }: Props = $props();

  // Initial expand/collapse rule (spec § Active target + expand/collapse, rule B):
  // - Calculator (collapsible=true): expanded = !isComplete on first mount.
  // - Plot (collapsible=false): expanded = true always.
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
    for (let i = 0; i <= PICKER_TAB_ORDER.indexOf(after); i++) {
      const tab = PICKER_TAB_ORDER[i]!;
      if (tab === "particle" && !selectionState.selectedParticle) return tab;
      if (tab === "material" && !selectionState.selectedMaterial) return tab;
    }
    return null;
  }

  function afterSelection(current: PickerTab): void {
    const nextEmpty = nextEmptyTab(current);
    if (nextEmpty !== null) {
      selectionState.setActiveTarget(nextEmpty);
      selectionState.setExpanded(true);
      return;
    }
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
    if (collapsible) {
      selectionState.setExpanded(false);
    }
  }

  function handleGlobalKey(event: KeyboardEvent) {
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
    if (event.key === "/" && !isMobile && document.activeElement !== searchInputRef) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("[contenteditable]") ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      if (!panelOpen) selectionState.setExpanded(true);
      searchInputRef?.focus();
    }
    // Arrow keys switch tabs when the picker panel is open and focus is not
    // inside a text input or on a tab button (tab-bar handles those natively).
    // Cold-load path: document.body has focus (nothing clicked yet).
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && panelOpen) {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }
      // Skip: tab buttons own ArrowLeft/ArrowRight via their onkeydown handler.
      if (active instanceof HTMLElement && active.getAttribute("role") === "tab") return;
      const pickerRoot = document.querySelector("[data-testid='picker-entity-selection']");
      const inPicker = pickerRoot?.contains(active);
      if (active === null || active === document.body || inPicker) {
        event.preventDefault();
        const idx = PICKER_TAB_ORDER.indexOf(activeTab);
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next =
          PICKER_TAB_ORDER[(idx + delta + PICKER_TAB_ORDER.length) % PICKER_TAB_ORDER.length];
        if (next) activateTab(next);
      }
    }
  }

  const activeTab = $derived(selectionState.activeTarget as PickerTab);
  const panelOpen = $derived(selectionState.expanded);
  const sheetOpen = $derived(selectionState.sheetOpen);
  // Detect mobile viewport (guarded for jsdom where matchMedia is absent).
  let isMobile = $state(false);
  let prefersReducedMotion = $state(false);

  // Animate only in a real browser — jsdom tests have no WAAPI support.
  const sheetAnimDuration = $derived(browser && !prefersReducedMotion ? 200 : 0);
  const sheetAnimDurationOut = $derived(browser && !prefersReducedMotion ? 150 : 0);
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px)");
    isMobile = mq.matches;
    function onChange(e: MediaQueryListEvent) {
      isMobile = e.matches;
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mq.matches;
    function onChange(e: MediaQueryListEvent) {
      prefersReducedMotion = e.matches;
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  // Shared picker-level search query. Cleared on tab change.
  let query = $state("");
  let searchInputRef: HTMLInputElement | null = $state(null);
  let particleArrowKey = $state<((d: "up" | "down") => void) | undefined>(undefined);
  let particleEnterKey = $state<(() => void) | undefined>(undefined);

  let lastTab: PickerTab | null = null;
  $effect(() => {
    const current = activeTab;
    if (lastTab === null) {
      lastTab = current;
      return;
    }
    if (lastTab !== current) {
      lastTab = current;
      query = "";
      // Only autofocus the search input on desktop (not mobile — would invoke keyboard).
      if (panelOpen && !isMobile) searchInputRef?.focus();
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

  function openSheet(): void {
    selectionState.setSheetOpen(true);
  }

  function closeSheet(): void {
    selectionState.setSheetOpen(false);
  }
</script>

<svelte:window onkeydown={handleGlobalKey} />

{#if sheetOpen}
  <div
    class="fixed inset-0 z-50"
    in:fly={{ y: 600, duration: sheetAnimDuration, easing: quintOut }}
    out:fly={{ y: 600, duration: sheetAnimDurationOut, easing: quadIn }}
  >
    <PickerSheet
      {selectionState}
      {activeTab}
      onClose={closeSheet}
      onParticleSelect={handleParticleSelect}
      onMaterialSelect={handleMaterialSelect}
      onProgramSelect={handleProgramSelect}
    />
  </div>
{/if}

<div class={cn("rounded-lg", className)} data-testid="picker-entity-selection">
  {#if isAdvancedMode.value && showAdvancedToolbar}
    <AdvancedToolbar
      onReset={handleReset}
      {...onLoadExternal !== undefined ? { onLoadExternal } : {}}
    />
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
      onMobileTap={openSheet}
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
          onOpenSheet={openSheet}
          onClear={() => {
            selectionState.clearMaterial();
            selectionState.setActiveTarget("material");
            selectionState.setExpanded(true);
          }}
        />
      {:else if activeTab === "program"}
        <ProgramTab
          {selectionState}
          {query}
          onSelect={handleProgramSelect}
          showAdvancedToolbar={showAdvancedToolbar && isAdvancedMode.value}
        />
      {/if}
    </div>
  {/if}
</div>
