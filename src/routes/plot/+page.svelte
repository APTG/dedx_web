<script lang="ts">
  import { browser } from "$app/environment";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Button } from "$lib/components/ui/button";
  import EntitySelection from "$lib/components/entity-selection/entity-selection.svelte";
  import JsrootPlot from "$lib/components/jsroot-plot.svelte";
  import PlotToolbar from "$lib/components/plot-toolbar.svelte";
  import PlotToast from "$lib/components/plot-toast.svelte";
  import { computeAxisRanges } from "$lib/utils/plot-utils";
  import { isCustomMaterial } from "$lib/utils/custom-compound-material";
  import { initPlotExportState, canExport } from "$lib/state/export.svelte";
  import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
  import ProgramAnnotation from "$lib/components/program-annotation.svelte";
  import SeriesStrip from "./series-strip.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import UrlVersionWarningBanner from "$lib/components/url-version-warning-banner.svelte";
  import ExternalSourcesPanel from "$lib/components/entity-selection/external-sources-panel.svelte";
  import LoadExternalModal from "$lib/components/entity-selection/load-external-modal.svelte";
  import { externalDataService } from "$lib/external-data/service";
  import type { ExternalSourceDescriptor } from "$lib/external-data/types";
  import type { ExternalStoreMetadata } from "$lib/external-data/schema";
  import { goto } from "$app/navigation";
  import { appInit } from "$lib/state/app-init.svelte";
  import {
    createPlotPageOrchestrator,
    MAX_PLOT_SERIES,
  } from "$lib/state/plot-page-orchestrator.svelte";

  const orchestrator = createPlotPageOrchestrator();
  const plotState = $derived(orchestrator.plotState);

  // "Calculated with <program>" annotation for Basic mode (#816): the program
  // selector is hidden, so surface the distinct program(s) that produced the
  // plotted series. Unlike the Calculator, this does NOT append
  // "(auto-selected)": the plot aggregates a committed *set* of series that can
  // mix auto-selected curves with explicitly-chosen ones (added in Advanced
  // mode or restored from a shared URL), so it just names the program(s) rather
  // than claim they were all auto-selected (PR #821 review). Advanced mode is
  // unchanged (no annotation — series carry their own program in the legend
  // when programs differ).
  const plotProgramNames = $derived([
    ...new Set(plotState.series.map((s) => s.programName).filter(Boolean)),
  ]);

  let entityState = $derived(appInit.entityState);
  let loadedExternalSources = $derived(appInit.loadedExternalSources);
  let externalLoading = $derived(appInit.isInitializing && appInit.hasExternalSources);
  let externalError = $derived(appInit.error);

  let showLoadExternalModal = $state(false);

  function handleRemoveExternalSource(label: string): void {
    appInit.removeExternalSource(label);
  }

  async function handleModalLoad(
    descriptor: ExternalSourceDescriptor,
    metadata: ExternalStoreMetadata,
  ) {
    showLoadExternalModal = false;
    appInit.addExternalSource(descriptor, metadata);
  }

  // Mobile responsive: track viewport width to pass collapsible to EntitySelection
  let isMobile = $state(false);

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

  // ── Derived: axis ranges from visible series ──
  // Linear-Y uses a "nice ceiling" so the curve fills the plot; log-Y keeps
  // power-of-ten rounding.
  const axisRanges = $derived(
    computeAxisRanges(plotState.series, plotState.preview, plotState.stpUnit, {
      yLog: plotState.yLog,
    }),
  );

  // localStorage key persisting the Advanced-options disclosure open state (#798).
  const ADVANCED_OPEN_KEY = "webdedx.plot.advancedOpen.v1";

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

  // ── Plot toolbar zoom controls (#794) ──
  // Imperative handlers bound from JsrootPlot; the toolbar calls them.
  let resetZoom: (() => void) | null = $state(null);
  let zoomIn: (() => void) | null = $state(null);
  let zoomOut: (() => void) | null = $state(null);
  // Tracks whether the plot is currently zoomed in, so the toolbar can disable
  // Reset zoom and Zoom out when there is nothing to reset/zoom out to (#812).
  let plotZoomed = $state(false);
</script>

<svelte:head>
  <title>Plot - webdedx</title>
</svelte:head>

<h1 class="sr-only">Plot</h1>

{#if wasmError.value}
  <div class="space-y-6">
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
    {#if orchestrator.urlVersionMismatch}
      <UrlVersionWarningBanner
        version={orchestrator.urlVersionMismatch.version}
        onLoadDefaults={() => orchestrator.handleLoadDefaults()}
      />
    {/if}

    <ExternalSourcesPanel sources={loadedExternalSources} onRemove={handleRemoveExternalSource} />

    <!-- Sidebar + main grid; stacks vertically below 900px, side-by-side at desktop: (≥900px) -->
    <div class="grid gap-4 desktop:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]">
      <!-- ── SIDEBAR ── -->
      <aside class="flex min-w-0 flex-col gap-4">
        <EntitySelection
          selectionState={entityState}
          collapsible={isMobile}
          showAdvancedToolbar
          onLoadExternal={() => (showLoadExternalModal = true)}
        />

        <LoadExternalModal
          open={showLoadExternalModal}
          existingLabels={new Set([
            ...loadedExternalSources.map((s) => s.label),
            ...externalDataService.getLoadedLabels(),
          ])}
          onCancel={() => (showLoadExternalModal = false)}
          onLoad={handleModalLoad}
        />

        <!-- Add Series / Done editing button — the single add entry point (#793). -->
        <button
          data-testid="plot-add-series"
          disabled={(orchestrator.editingSeriesId === null && !entityState.isComplete) ||
            (orchestrator.editingSeriesId === null && plotState.series.length >= MAX_PLOT_SERIES)}
          aria-disabled={(orchestrator.editingSeriesId === null && !entityState.isComplete) ||
            (orchestrator.editingSeriesId === null && plotState.series.length >= MAX_PLOT_SERIES)}
          onclick={() => orchestrator.handleAddOrMulti()}
          class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 min-h-[44px]"
        >
          {orchestrator.editingSeriesId !== null ? "Done editing" : "＋ Add Series"}
        </button>

        {#if plotState.series.length >= 10}
          <p class="text-sm text-muted-foreground">
            10 series displayed. Adding more may reduce readability.
          </p>
        {/if}

        <button
          class="text-sm text-muted-foreground underline hover:no-underline min-h-[44px]"
          onclick={() => orchestrator.handleResetAll()}
        >
          Reset all
        </button>
      </aside>

      <!-- ── MAIN AREA ── -->
      <div class="flex min-w-0 flex-col gap-4">
        <!-- Controls bar: stp unit + axis scale -->
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
        </div>

        <!-- Advanced options disclosure (#798): collapsed by default, mounted
             directly above the plot. Visible only in Advanced mode (per AC-1);
             open/closed state persists across reloads. -->
        {#if isAdvancedMode.value && entityState.selectedMaterial}
          {@const plotSelMat = entityState.selectedMaterial}
          {@const plotBuiltinMat = "isGasByDefault" in plotSelMat ? plotSelMat : null}
          <AdvancedOptionsPanel
            materialIsGas={orchestrator.materialIsGas ?? false}
            materialBuiltInDensity={plotBuiltinMat?.density}
            materialBuiltInAggregateState={orchestrator.materialIsGas ? "gas" : "condensed"}
            isCustomCompoundActive={isCustomMaterial(plotBuiltinMat)}
            selectedProgram={"resolvedProgram" in entityState.selectedProgram
              ? (entityState.selectedProgram.resolvedProgram?.name ?? "")
              : entityState.selectedProgram.name}
            persistKey={ADVANCED_OPEN_KEY}
          />
        {/if}

        <!-- App toolbar (#794): − / + / Reset zoom / Export, mounted directly
             above the canvas in place of JSROOT's native on-canvas chrome. -->
        <PlotToolbar
          onZoomIn={() => zoomIn?.()}
          onZoomOut={() => zoomOut?.()}
          onResetZoom={() => resetZoom?.()}
          canReset={plotZoomed}
          canZoomOut={plotZoomed}
          {getSvg}
        />

        <!-- JSROOT canvas — 50vh on mobile (<600px), min(60vh,600px) on desktop. -->
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
            bind:resetZoom
            bind:zoomIn
            bind:zoomOut
            bind:isZoomed={plotZoomed}
          />
        </div>

        <!-- Series strip (legend + add/edit/remove) -->
        <SeriesStrip
          series={plotState.series}
          preview={plotState.preview}
          editingSeriesId={orchestrator.editingSeriesId}
          jsrootSwatchColors={orchestrator.jsrootSwatchColors}
          previewError={orchestrator.previewError}
          onRemove={(id) => plotState.removeSeries(id)}
          onToggleVisibility={(id) => plotState.toggleVisibility(id)}
          onTogglePreview={() => plotState.togglePreviewVisibility()}
          onSelectForEdit={(id) => orchestrator.handleSelectSeriesForEdit(id)}
          onDone={() => orchestrator.handleDoneEditing()}
          onReorder={(from, to) => plotState.reorderSeries(from, to)}
        />

        {#if !isAdvancedMode.value && plotProgramNames.length > 0}
          <ProgramAnnotation programName={plotProgramNames.join(", ")} />
        {/if}
      </div>
    </div>

    <!-- Reset confirmation dialog -->
    {#if orchestrator.showResetConfirm}
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
              onclick={() => (orchestrator.showResetConfirm = false)}
              class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button
            >
            <button
              onclick={() => orchestrator.doReset()}
              class="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >Reset</button
            >
          </div>
        </div>
      </div>
    {/if}

    <!-- Add-series confirmation toast (#812). -->
    <PlotToast
      feedback={orchestrator.seriesFeedback}
      onDismiss={() => (orchestrator.seriesFeedback = null)}
    />
  </div>
{/if}
