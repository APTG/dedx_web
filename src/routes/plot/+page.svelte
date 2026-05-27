<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Button } from "$lib/components/ui/button";
  import { WATER_ID } from "$lib/state/entity-selection.svelte";
  import EntitySelection from "$lib/components/entity-selection/entity-selection.svelte";
  import JsrootPlot from "$lib/components/jsroot-plot.svelte";
  import { createPlotState } from "$lib/state/plot.svelte";
  import { computeAxisRanges, getJsrootSwatchColors } from "$lib/utils/plot-utils";
  import { setupPlotUrlSync } from "$lib/state/plot-url-sync.svelte";
  import { setupPlotUrlRestore } from "$lib/state/plot-url-restore.svelte";
  import { setupPlotPreviewCalculation } from "$lib/state/plot-preview-calc.svelte";
  import { downloadPlotSvg, downloadPlotPng } from "$lib/export/plot-image";
  import { getParticleLabel } from "$lib/utils/particle-label";
  import { isCustomMaterial } from "$lib/utils/custom-compound-material";
  import { getService } from "$lib/wasm/loader";
  import { initPlotExportState, canExport } from "$lib/state/export.svelte";
  import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
  import SeriesStrip from "./series-strip.svelte";
  import { isAdvancedMode, initAdvancedModeFromUrl } from "$lib/state/advanced-mode.svelte";
  import { negotiateVersion } from "$lib/utils/url-version.js";
  import UrlVersionWarningBanner from "$lib/components/url-version-warning-banner.svelte";
  import ExternalSourcesPanel from "$lib/components/entity-selection/external-sources-panel.svelte";
  import { goto } from "$app/navigation";
  import {
    advancedOptions,
    loadAdvancedOptionsFromStorage,
    persistAdvancedOptions,
  } from "$lib/state/advanced-options.svelte";

  const plotState = createPlotState();
  import { appInit } from "$lib/state/app-init.svelte";

  let entityState = $derived(appInit.entityState);
  let loadedExternalSources = $derived(appInit.loadedExternalSources);
  let externalLoading = $derived(appInit.isInitializing && appInit.hasExternalSources);
  let externalError = $derived(appInit.error);

  let materialIsGas = $state<boolean | undefined>(undefined);
  let urlVersionMismatch = $state<{ version: number | string } | null>(null);
  let advancedModeInitializedFromUrl = $state(false);

  function handleRemoveExternalSource(label: string): void {
    appInit.removeExternalSource(label);
  }

  // Mobile responsive: track viewport width to pass collapsible to EntitySelection
  let isMobile = $state(false);
  let previewError = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    const mq = window.matchMedia("(max-width: 599px)");
    isMobile = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  $effect(() => {
    if (wasmReady.value && !appInit.isInitializing && !appInit.entityState && !appInit.error) {
      appInit.initialize(page.url.searchParams);
    }
  });

  // Initialize advanced options from localStorage on mount (runs once; browser is a constant)
  $effect(() => {
    if (!browser) return;
    loadAdvancedOptionsFromStorage();
  });

  // Initialize advanced mode from URL IMMEDIATELY when WASM is ready, before the
  // main URL init effect runs. This ensures the tabs render correctly when
  // the page loads with ?mode=advanced — otherwise the component renders with
  // isAdvancedMode.value = false and there's a reactivity glitch when it later
  // becomes true inside the async callback.
  $effect(() => {
    if (wasmReady.value && !advancedModeInitializedFromUrl) {
      initAdvancedModeFromUrl(page.url.searchParams);
      advancedModeInitializedFromUrl = true;
    }
  });

  // Handle mode switch fallback: custom compound → water when switching to Basic mode
  $effect(() => {
    const mode = isAdvancedMode.value;
    if (!mode && entityState?.selectedMaterial) {
      const matId = entityState.selectedMaterial.id;
      if (typeof matId === "string" && matId.startsWith("cc_")) {
        entityState.selectMaterial(WATER_ID);
      }
    }
    if (!mode) {
      for (const series of [...plotState.series]) {
        if (typeof series.materialId === "string" && series.materialId.startsWith("cc_")) {
          plotState.removeSeries(series.seriesId);
        }
      }
    }
  });

  // Track material changes to determine gas/condensed state for the panel
  $effect(() => {
    if (!entityState?.selectedMaterial) {
      materialIsGas = undefined;
      return;
    }
    const resolvedId = entityState.resolvedProgramId;
    const selMat = entityState.selectedMaterial;
    const builtinMat = "isGasByDefault" in selMat ? selMat : null;
    const matId = selMat.id;
    if (isCustomMaterial(builtinMat)) {
      materialIsGas = builtinMat.isGasByDefault;
      return;
    }
    if (resolvedId === null || typeof resolvedId !== "number") {
      materialIsGas = undefined;
      return;
    }
    let cancelled = false;
    const numericResolvedId = resolvedId;
    getService().then((service) => {
      if (cancelled) return;
      const materials = service.getMaterials(numericResolvedId);
      const mat = materials.find((m) => m.id === matId);
      if (cancelled) return;
      materialIsGas = mat?.isGasByDefault;
    });
    return () => {
      cancelled = true;
    };
  });

  // $derived signal to track nested advancedOptions changes.
  // Svelte 5 fine-grained reactivity only registers a dep when a property
  // is read synchronously.  Reading advancedOptions.value (the proxy object)
  // does NOT register a dep on nested mutations such as
  // `advancedOptions.value.densityOverride = 2`.  By deriving a serialised
  // key from every relevant nested property we force $effects that read
  // advOptsKey to re-run whenever ANY option changes.
  const advOptsKey = $derived(
    JSON.stringify([
      advancedOptions.value.interpolation?.scale,
      advancedOptions.value.interpolation?.method,
      advancedOptions.value.densityOverride,
      advancedOptions.value.iValueOverride,
      advancedOptions.value.aggregateState,
      advancedOptions.value.mstarMode,
    ]),
  );

  // Persist advanced options to localStorage whenever they change
  $effect(() => {
    if (!browser) return;
    // Read advOptsKey to track nested changes (see comment above)
    const _advOptsKey = advOptsKey;
    void _advOptsKey;
    persistAdvancedOptions();
  });

  let urlVersionChecked = $state(false);
  let urlInitialized = $state(false);

  // URL version negotiation runs IMMEDIATELY (before WASM is ready)
  $effect(() => {
    if (!browser || urlVersionChecked) return;
    const params = new URLSearchParams(window.location.search);
    const urlvRaw = params.get("urlv");
    const negotiationResult = negotiateVersion(urlvRaw);
    if (negotiationResult.status === "mismatch") {
      urlVersionMismatch = { version: negotiationResult.version };
    } else {
      urlVersionMismatch = null;
    }
    urlVersionChecked = true;
  });

  setupPlotUrlRestore(
    () => plotState,
    () => entityState,
    () => urlInitialized,
    () => {
      urlInitialized = true;
    },
  );

  setupPlotUrlSync(
    () => plotState,
    () => entityState,
    () => urlInitialized,
    () => loadedExternalSources,
    () => advOptsKey,
  );

  setupPlotPreviewCalculation(
    () => plotState,
    () => entityState,
    () => urlVersionMismatch,
    () => advOptsKey,
    (msg) => {
      previewError = msg;
    },
  );

  // ── Legend swatch colors: derived from JSROOT's actual color list so the
  // swatch hex matches what JSROOT renders for fLineColor = colorIndex + 2. ──
  let jsrootSwatchColors = $state<Map<number, string> | null>(null);
  $effect(() => {
    if (!browser || jsrootSwatchColors) return;
    getJsrootSwatchColors().then((m) => (jsrootSwatchColors = m));
  });

  // ── Derived: axis ranges from visible series ──
  const axisRanges = $derived(
    computeAxisRanges(
      [...plotState.series, ...(plotState.preview ? [plotState.preview] : [])],
      null,
      plotState.stpUnit,
    ),
  );

  // ── Editing series ──
  let editingSeriesId = $state<number | null>(null);

  function handleSelectSeriesForEdit(seriesId: number): void {
    if (!entityState) return;
    const s = plotState.series.find((x) => x.seriesId === seriesId);
    if (!s) return;
    editingSeriesId = seriesId;
    entityState.selectParticle(s.particleId);
    entityState.selectMaterial(s.materialId);
    entityState.selectProgram(s.programId as number | string);
    entityState.setExpanded(true);
  }

  function handleDoneEditing(): void {
    editingSeriesId = null;
  }

  // Live-update the editing series whenever the preview changes.
  $effect(() => {
    if (editingSeriesId === null || !plotState.preview) return;
    const p = plotState.preview;
    const current = plotState.series.find((s) => s.seriesId === editingSeriesId);
    if (
      current &&
      current.programId === p.programId &&
      current.particleId === p.particleId &&
      current.materialId === p.materialId &&
      current.programName === p.programName &&
      current.particleName === p.particleName &&
      current.materialName === p.materialName &&
      current.particleMassNumber === p.particleMassNumber &&
      current.density === p.density &&
      current.result === p.result
    ) {
      return;
    }
    plotState.updateSeries(editingSeriesId, {
      programId: p.programId,
      particleId: p.particleId,
      materialId: p.materialId,
      programName: p.programName,
      particleName: p.particleName,
      materialName: p.materialName,
      particleMassNumber: p.particleMassNumber,
      density: p.density,
      result: p.result,
    });
  });

  // ── Add Series ──
  const MAX_PLOT_SERIES = 20;

  function handleAddSeries() {
    if (!entityState) return;
    if (plotState.series.length >= MAX_PLOT_SERIES) return;
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete } = entityState;
    if (!isComplete || resolvedProgramId === null || !selectedParticle || !selectedMaterial) return;
    if (!plotState.preview) return;

    // Only commit the cached preview result when it matches the *current*
    // selection; otherwise the preview is stale (e.g. from a previous
    // particle/material) and would commit the wrong series.
    const p = plotState.preview;
    if (
      p.programId !== resolvedProgramId ||
      p.particleId !== selectedParticle.id ||
      p.materialId !== selectedMaterial.id
    ) {
      return;
    }

    const added = plotState.addSeries({
      programId: resolvedProgramId,
      particleId: selectedParticle.id,
      materialId: selectedMaterial.id,
      programName: p.programName,
      particleName: getParticleLabel(selectedParticle),
      materialName: selectedMaterial.name,
      particleMassNumber: p.particleMassNumber,
      // Preserve the density that was active when the preview was computed
      // so committed series display the same values as the preview did.
      density: p.density,
      result: p.result,
    });

    if (!added) {
      console.warn("Duplicate series — not added.");
    }
  }

  // ── Handle Add: delegate to multi-create when in advanced multi-select mode ──
  async function handleAddOrMulti(): Promise<void> {
    if (!entityState) return;
    if (editingSeriesId === null && plotState.series.length >= MAX_PLOT_SERIES) return;
    if (editingSeriesId !== null) {
      handleDoneEditing();
      return;
    }
    const across = entityState.across;
    if (isAdvancedMode.value && across !== null && across !== "single") {
      const ids = entityState.multiSelected[across];
      if (ids.length > 1) {
        await handleAddMultiSeries(across, ids);
        return;
      }
    }
    handleAddSeries();
  }

  async function handleAddMultiSeries(
    across: "particle" | "material" | "program",
    ids: (number | string)[],
  ): Promise<void> {
    if (!entityState) return;
    const service = await getService();
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete } = entityState;
    if (!isComplete || resolvedProgramId === null || !selectedParticle || !selectedMaterial) return;
    const programs = service.getPrograms();
    const toNumericId = (value: number | string): number | null => {
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
    };

    const baseProgramId = toNumericId(resolvedProgramId);
    const baseParticleId = toNumericId(selectedParticle.id);
    const baseMaterialId = toNumericId(selectedMaterial.id);
    if (baseProgramId === null || baseParticleId === null || baseMaterialId === null) {
      previewError = "Cannot add selected series: one or more base IDs are invalid.";
      return;
    }

    let hadFailures = false;
    for (const id of ids) {
      try {
        let programId = baseProgramId;
        let particleId = baseParticleId;
        let materialId = baseMaterialId;
        let programName = programs.find((p) => p.id === programId)?.name ?? "";
        let particleName = getParticleLabel(selectedParticle);
        let materialName = selectedMaterial.name;
        let density = selectedMaterial.density ?? 1;
        let particleMassNumber: number | undefined =
          "massNumber" in selectedParticle ? selectedParticle.massNumber : undefined;
        const overrideId = toNumericId(id);
        if (overrideId === null) {
          hadFailures = true;
          continue;
        }

        if (across === "program") {
          programId = overrideId;
          programName = programs.find((p) => p.id === overrideId)?.name ?? String(overrideId);
        } else if (across === "particle") {
          particleId = overrideId;
          const particles = service.getParticles(programId);
          const part = particles.find((p) => p.id === overrideId);
          if (part) {
            particleName = getParticleLabel(part);
            particleMassNumber = part.massNumber;
          }
        } else if (across === "material") {
          materialId = overrideId;
          const materials = service.getMaterials(programId);
          const mat = materials.find((m) => m.id === overrideId);
          if (mat) {
            materialName = mat.name;
            density = mat.density;
          }
        }

        const result = service.getPlotData(
          programId,
          particleId,
          materialId,
          500,
          true,
          advancedOptions.value,
        );
        const added = plotState.addSeries({
          programId,
          particleId,
          materialId,
          programName,
          particleName,
          materialName,
          particleMassNumber,
          density,
          result,
        });
        if (!added) {
          hadFailures = true;
        }
      } catch (err) {
        hadFailures = true;
        console.warn("Failed to add one of the multi-selected series.", err);
      }
    }
    if (hadFailures) {
      previewError = "Some selected series could not be added.";
    }
  }

  // ── Reset All ──
  let showResetConfirm = $state(false);

  function handleResetAll() {
    if (plotState.series.length >= 2) {
      showResetConfirm = true;
    } else {
      doReset();
    }
  }

  function doReset() {
    plotState.resetAll();
    entityState?.resetAll();
    showResetConfirm = false;
  }

  function handleLoadDefaults() {
    // Navigate to /plot without params to clear the mismatch URL
    goto("/plot", { replaceState: true });
    urlVersionMismatch = null;
  }

  // ── SVG Export ──
  // Bound from JsrootPlot requestExportSvg, set by component's $effect
  let getSvg: (() => Promise<string | null>) | null = $state(null);

  // ── Export button state — enables toolbar Export PDF/CSV when series exist
  $effect(() => {
    initPlotExportState(plotState, getSvg ?? (() => Promise.resolve(null)));
    return () => {
      canExport.value = false;
    };
  });

  // Dropdown state
  let showExportMenu = $state(false);
  let exportMenuId = $state("export-menu-" + Math.random().toString(36).slice(2));

  function toggleExportMenu() {
    if (!canExport.value) return;
    showExportMenu = !showExportMenu;
  }

  $effect(() => {
    if (!showExportMenu) return;
    const closeMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(`[aria-controls="${exportMenuId}"]`) &&
        !target.closest(`#${exportMenuId}`)
      ) {
        showExportMenu = false;
      }
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  });

  $effect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        showExportMenu = false;
      }
    };
    if (showExportMenu) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  });
</script>

<svelte:head>
  <title>Plot - webdedx</title>
</svelte:head>

{#if wasmError.value}
  <div class="space-y-6">
    <h1 class="text-3xl font-bold">Plot</h1>
    <div
      class="mx-auto max-w-md rounded-lg border border-destructive bg-destructive/10 p-8 text-center space-y-4"
    >
      <p class="font-semibold text-destructive">Failed to load the calculation engine.</p>
      <p class="text-sm text-muted-foreground">
        Please try refreshing the page or use a different browser.
      </p>
      <Button variant="destructive" size="sm" onclick={() => window.location.reload()}>
        Retry
      </Button>
      <details class="text-left text-xs text-muted-foreground mt-2">
        <summary class="cursor-pointer">Show details</summary>
        <pre class="mt-1 whitespace-pre-wrap">{wasmError.value.message}</pre>
      </details>
    </div>
  </div>
{:else if externalError}
  <div class="space-y-6">
    <h1 class="text-3xl font-bold">Plot</h1>
    <div
      class="mx-auto max-w-md rounded-lg border border-destructive bg-destructive/10 p-8 text-center space-y-4"
    >
      <p class="font-semibold text-destructive">Failed to load external data source.</p>
      <p class="text-sm text-muted-foreground">{externalError.message}</p>
      <div class="flex justify-center gap-2">
        <Button variant="destructive" size="sm" onclick={() => window.location.reload()}>
          Retry
        </Button>
        <Button variant="outline" size="sm" onclick={() => goto("/plot", { replaceState: true })}>
          Load without external data
        </Button>
      </div>
    </div>
  </div>
{:else if !wasmReady.value || !entityState}
  <div class="space-y-6">
    <h1 class="text-3xl font-bold">Plot</h1>
    <div
      class="mx-auto max-w-4xl space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Loading plot page"
    >
      {#if externalLoading}
        <p class="text-sm text-muted-foreground">Loading external data sources…</p>
      {/if}
      <div class="flex flex-wrap gap-3">
        <Skeleton class="h-10 w-44 rounded-md" />
        <Skeleton class="h-10 w-44 rounded-md" />
        <Skeleton class="h-10 w-36 rounded-md" />
      </div>
      <div class="rounded-lg border bg-card p-6 space-y-2">
        <Skeleton class="h-64 w-full" />
      </div>
    </div>
  </div>
{:else}
  <div class="space-y-4">
    <h1 class="text-3xl font-bold">Plot</h1>

    {#if urlVersionMismatch}
      <UrlVersionWarningBanner
        version={urlVersionMismatch.version}
        onLoadDefaults={handleLoadDefaults}
      />
    {/if}

    <ExternalSourcesPanel sources={loadedExternalSources} onRemove={handleRemoveExternalSource} />

    <!-- Sidebar + main grid; stacks vertically below 900px, side-by-side at desktop: (≥900px) -->
    <div class="grid gap-4 desktop:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]">
      <!-- ── SIDEBAR ── -->
      <aside class="flex min-w-0 flex-col gap-4">
        <EntitySelection selectionState={entityState} collapsible={isMobile} />

        <!-- Add Series / Done editing button (sidebar, desktop-primary) -->
        <button
          disabled={(editingSeriesId === null && !entityState.isComplete) ||
            (editingSeriesId === null && plotState.series.length >= MAX_PLOT_SERIES)}
          aria-disabled={(editingSeriesId === null && !entityState.isComplete) ||
            (editingSeriesId === null && plotState.series.length >= MAX_PLOT_SERIES)}
          onclick={handleAddOrMulti}
          class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 min-h-[44px]"
        >
          {editingSeriesId !== null ? "Done editing" : "＋ Add Series"}
        </button>

        {#if plotState.series.length >= 10}
          <p class="text-sm text-muted-foreground">
            10 series displayed. Adding more may reduce readability.
          </p>
        {/if}

        <button
          class="text-sm text-muted-foreground underline hover:no-underline min-h-[44px]"
          onclick={handleResetAll}
        >
          Reset all
        </button>
      </aside>

      <!-- ── MAIN AREA ── -->
      <div class="flex min-w-0 flex-col gap-4">
        <!-- Controls bar: stp unit + axis scale + export -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <!-- Left: stp unit + axis scale controls -->
          <div class="flex flex-wrap items-center gap-4">
            <!-- Stopping power unit segmented control -->
            <div role="radiogroup" aria-label="Stopping power unit" class="flex gap-1">
              {#each ["keV/µm", "MeV/cm", "MeV·cm²/g"] as const as unit (unit)}
                <label
                  class="flex cursor-pointer items-center gap-1 rounded border px-2 py-2.5 text-sm min-h-[44px]
                {plotState.stpUnit === unit
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background'}"
                >
                  <input
                    type="radio"
                    class="sr-only"
                    name="stp-unit"
                    value={unit}
                    checked={plotState.stpUnit === unit}
                    onchange={() => plotState.setStpUnit(unit)}
                  />
                  {unit}
                </label>
              {/each}
            </div>

            <!-- X axis scale -->
            <div role="radiogroup" aria-label="X axis scale" class="flex gap-1">
              {#each [["Log", true], ["Lin", false]] as [label, isLog] (label)}
                <label
                  class="flex cursor-pointer items-center gap-1 rounded border px-2 py-2.5 text-sm min-h-[44px]
                {plotState.xLog === isLog ? 'bg-primary text-primary-foreground' : 'bg-background'}"
                >
                  <input
                    type="radio"
                    class="sr-only"
                    name="x-scale"
                    checked={plotState.xLog === isLog}
                    onchange={() => plotState.setAxisScale("x", isLog as boolean)}
                  />
                  X: {label}
                </label>
              {/each}
            </div>

            <!-- Y axis scale -->
            <div role="radiogroup" aria-label="Y axis scale" class="flex gap-1">
              {#each [["Log", true], ["Lin", false]] as [label, isLog] (label)}
                <label
                  class="flex cursor-pointer items-center gap-1 rounded border px-2 py-2.5 text-sm min-h-[44px]
                {plotState.yLog === isLog ? 'bg-primary text-primary-foreground' : 'bg-background'}"
                >
                  <input
                    type="radio"
                    class="sr-only"
                    name="y-scale"
                    checked={plotState.yLog === isLog}
                    onchange={() => plotState.setAxisScale("y", isLog as boolean)}
                  />
                  Y: {label}
                </label>
              {/each}
            </div>
          </div>

          <!-- Right: Export image dropdown -->
          <div class="relative">
            <button
              data-testid="export-image-btn"
              aria-label="Export plot as image"
              aria-haspopup="true"
              aria-expanded={showExportMenu}
              aria-controls={exportMenuId}
              onclick={toggleExportMenu}
              disabled={!canExport.value}
              class="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              Export image ▾
            </button>

            {#if showExportMenu}
              <div
                id={exportMenuId}
                role="menu"
                aria-label="Export options"
                class="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-md border bg-popover p-1 shadow-md"
              >
                <button
                  data-testid="export-image-svg"
                  role="menuitem"
                  onclick={async () => {
                    await downloadPlotSvg(getSvg);
                    showExportMenu = false;
                  }}
                  class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  SVG vector
                </button>
                {#if isAdvancedMode.value}
                  <button
                    data-testid="export-image-png"
                    role="menuitem"
                    onclick={async () => {
                      await downloadPlotPng(getSvg);
                      showExportMenu = false;
                    }}
                    class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    PNG image
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- JSROOT canvas — 50vh on mobile (<600px), min(60vh,600px) on desktop -->
        <div
          style:width="100%"
          style:height={isMobile ? "50vh" : "min(60vh, 600px)"}
          style:min-height={isMobile ? "300px" : "400px"}
        >
          <JsrootPlot
            series={plotState.series}
            preview={plotState.preview}
            stpUnit={plotState.stpUnit}
            xLog={plotState.xLog}
            yLog={plotState.yLog}
            {axisRanges}
            bind:requestExportSvg={getSvg}
          />
        </div>

        <!-- Series strip (legend + add/edit/remove) -->
        <SeriesStrip
          series={plotState.series}
          preview={plotState.preview}
          {editingSeriesId}
          {jsrootSwatchColors}
          maxSeries={MAX_PLOT_SERIES}
          {previewError}
          onAdd={handleAddOrMulti}
          onRemove={(id) => plotState.removeSeries(id)}
          onToggleVisibility={(id) => plotState.toggleVisibility(id)}
          onTogglePreview={() => plotState.togglePreviewVisibility()}
          onSelectForEdit={handleSelectSeriesForEdit}
          onDone={handleDoneEditing}
        />

        <!-- Advanced Options Panel (visible only in Advanced mode per spec AC-1) -->
        {#if isAdvancedMode.value && entityState.selectedMaterial}
          {@const plotSelMat = entityState.selectedMaterial}
          {@const plotBuiltinMat = "isGasByDefault" in plotSelMat ? plotSelMat : null}
          <AdvancedOptionsPanel
            materialIsGas={materialIsGas ?? false}
            materialBuiltInDensity={plotBuiltinMat?.density}
            materialBuiltInAggregateState={materialIsGas ? "gas" : "condensed"}
            isCustomCompoundActive={isCustomMaterial(plotBuiltinMat)}
            selectedProgram={"resolvedProgram" in entityState.selectedProgram
              ? (entityState.selectedProgram.resolvedProgram?.name ?? "")
              : entityState.selectedProgram.name}
          />
        {/if}
      </div>
    </div>

    <!-- Reset confirmation dialog -->
    {#if showResetConfirm}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm reset"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div class="rounded-lg border bg-card p-6 shadow-lg">
          <p class="mb-4">Remove all {plotState.series.length} series and reset selections?</p>
          <div class="flex justify-end gap-2">
            <button
              onclick={() => (showResetConfirm = false)}
              class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button
            >
            <button
              onclick={doReset}
              class="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >Reset</button
            >
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
