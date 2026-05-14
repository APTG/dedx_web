<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { untrack } from "svelte";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Button } from "$lib/components/ui/button";
  import {
    createEntitySelectionState,
    type EntitySelectionState,
    WATER_ID,
  } from "$lib/state/entity-selection.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import EntitySelectionPanels from "$lib/components/entity-selection-panels.svelte";
  import JsrootPlot from "$lib/components/jsroot-plot.svelte";
  import { createPlotState } from "$lib/state/plot.svelte";
  import { computeAxisRanges, getJsrootSwatchColors } from "$lib/utils/plot-utils";
  import { encodePlotUrl, decodePlotUrl } from "$lib/utils/plot-url";
  import { getParticleLabel } from "$lib/utils/particle-label";
  import {
    customMaterialElementsForWasm,
    customMaterialUrlFields,
    isCustomMaterial,
  } from "$lib/utils/custom-compound-material";
  import { customCompounds } from "$lib/state/custom-compounds.svelte";
  import { getService } from "$lib/wasm/loader";
  import { initPlotExportState, canExport } from "$lib/state/export.svelte";
  import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
  import { isAdvancedMode, initAdvancedModeFromUrl } from "$lib/state/advanced-mode.svelte";
  import { negotiateVersion } from "$lib/utils/url-version.js";
  import UrlVersionWarningBanner from "$lib/components/url-version-warning-banner.svelte";
  import ExternalSourcesBadge from "$lib/components/external-sources-badge.svelte";
  import { goto } from "$app/navigation";
  import { externalDataService } from "$lib/external-data/service";
  import type { ExternalDataError } from "$lib/external-data/errors";
  import { buildExternalCompatibilityContext } from "$lib/state/external-compatibility";
  import type { ExternalSourceDescriptor } from "$lib/external-data/types";
  import { parseExtdataParams } from "$lib/external-data/url";
  import {
    advancedOptions,
    loadAdvancedOptionsFromStorage,
    persistAdvancedOptions,
  } from "$lib/state/advanced-options.svelte";

  const plotState = createPlotState();
  let entityState = $state<EntitySelectionState | null>(null);
  let materialIsGas = $state<boolean | undefined>(undefined);
  let urlVersionMismatch = $state<{ version: number | string } | null>(null);
  let advancedModeInitializedFromUrl = $state(false);
  let externalLoading = $state(false);
  let externalError = $state<ExternalDataError | null>(null);
  let loadedExternalSources = $state<ExternalSourceDescriptor[]>([]);

  // Mobile responsive: track viewport width to collapse entity panels on small screens
  let isMobile = $state(false);
  let entityPanelsOpen = $state(false);
  let previewError = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    const mq = window.matchMedia("(max-width: 599px)");
    isMobile = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
      if (!e.matches) entityPanelsOpen = false;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  function restorePlotCustomCompoundFromUrl(decoded: ReturnType<typeof decodePlotUrl>) {
    if (
      !decoded.materialIsCustom ||
      !decoded.matName ||
      decoded.matDensity === undefined ||
      !decoded.matElements?.length
    ) {
      return null;
    }
    return customCompounds.addTransient({
      name: decoded.matName,
      density: decoded.matDensity,
      iValue: decoded.matIval,
      elements: decoded.matElements,
      phase: decoded.matPhase ?? "condensed",
    });
  }

  $effect(() => {
    if (!wasmReady.value || entityState) return;
    const currentSearchParams = page.url.searchParams;
    const extdataResult = parseExtdataParams(currentSearchParams);
    const extSources = extdataResult.sources;
    externalLoading = extSources.length > 0;

    Promise.all([
      getService(),
      Promise.all(extSources.map((s) => externalDataService.loadSource(s))),
    ])
      .then(([service, extMetadatas]) => {
        externalLoading = false;
        externalError = null;
        loadedExternalSources = extSources;

        const matrix = buildCompatibilityMatrix(service);
        const extCtx = buildExternalCompatibilityContext(
          extMetadatas,
          matrix.allParticles,
          matrix.allMaterials,
        );
        entityState = createEntitySelectionState(matrix);
        entityState.setExternalContext(extCtx);
      })
      .catch((err) => {
        externalLoading = false;
        externalError = err as ExternalDataError;
      });
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

  $effect(() => {
    if (!browser || !wasmReady.value || !entityState || urlInitialized) return;
    // Mark in-flight so the URL-write effect cannot run while we are
    // restoring (it would otherwise wipe `series=...` from the address bar).
    const params = new URLSearchParams(window.location.search);

    const decoded = decodePlotUrl(params);

    if (decoded.particleId !== null) {
      entityState.selectParticle(decoded.particleId);
    }
    const customFromUrl = restorePlotCustomCompoundFromUrl(decoded);
    if (customFromUrl) {
      entityState.selectMaterial(customFromUrl.id);
    } else if (decoded.materialId !== null) {
      entityState.selectMaterial(decoded.materialId);
    }
    if (decoded.programId !== -1) {
      entityState.selectProgram(decoded.programId);
    }

    if (decoded.stpUnit) {
      plotState.setStpUnit(decoded.stpUnit);
    }
    plotState.setAxisScale("x", decoded.xLog);
    plotState.setAxisScale("y", decoded.yLog);

    // Apply advanced options from URL (URL takes precedence over localStorage)
    if (Object.keys(decoded.advancedOptions).length > 0) {
      advancedOptions.value = decoded.advancedOptions;
    }

    getService()
      .then((service) => {
        for (const s of decoded.series) {
          // External-source triplets are not yet dispatched to WASM — Slice 3/4.
          if (
            typeof s.programId !== "number" ||
            typeof s.particleId !== "number" ||
            typeof s.materialId !== "number"
          )
            continue;
          try {
            const result = service.getPlotData(
              s.programId,
              s.particleId,
              s.materialId,
              500,
              true,
              advancedOptions.value,
            );
            const programs = service.getPrograms();
            const particles = service.getParticles(s.programId);
            const materials = service.getMaterials(s.programId);
            const prog = programs.find((p) => p.id === s.programId);
            const part = particles.find((p) => p.id === s.particleId);
            const mat = materials.find((m) => m.id === s.materialId);
            if (!prog || !part || !mat) continue;
            plotState.addSeries({
              programId: s.programId,
              particleId: s.particleId,
              materialId: s.materialId,
              programName: prog.name,
              particleName: getParticleLabel(part),
              materialName: mat.name,
              density: mat.density,
              result,
            });
          } catch {
            // Invalid triplet — silently skip per spec
          }
        }
      })
      .finally(() => {
        // Only allow URL-writes after every restored series has been added,
        // otherwise a write running mid-restore would overwrite `series=...`.
        urlInitialized = true;
      });
  });

  $effect(() => {
    if (!browser || !entityState || !urlInitialized) return;
    const selectedMaterial = entityState.selectedMaterial;
    const builtinUrlMat =
      selectedMaterial && "isGasByDefault" in selectedMaterial ? selectedMaterial : null;
    const customUrlFields = isCustomMaterial(builtinUrlMat)
      ? customMaterialUrlFields(builtinUrlMat)
      : {};
    const selectedParticleId = entityState.selectedParticle?.id;
    const selectedProgramId = entityState.selectedProgram.id;
    const params = encodePlotUrl({
      particleId: typeof selectedParticleId === "number" ? selectedParticleId : null,
      materialId: builtinUrlMat && typeof builtinUrlMat.id === "number" ? builtinUrlMat.id : null,
      programId: typeof selectedProgramId === "number" ? selectedProgramId : -1,
      series: plotState.series
        .map((s) => ({
          programId: s.programId,
          particleId: s.particleId,
          materialId: s.materialId,
        }))
        .filter(
          (s): s is { programId: number; particleId: number; materialId: number } =>
            typeof s.materialId === "number",
        ),
      stpUnit: plotState.stpUnit,
      xLog: plotState.xLog,
      yLog: plotState.yLog,
      advancedOptions: advancedOptions.value,
      externalSources: loadedExternalSources,
      ...customUrlFields,
    });
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    untrack(() => replaceState(newUrl, page.state));
  });

  // ── Preview series: auto-calculated whenever entity selection OR advanced options change ──
  $effect(() => {
    // Read advOptsKey synchronously to register reactive deps on ALL nested
    // advancedOptions properties (density, aggregateState, interpolation, etc.).
    // Without this, mutating advancedOptions.value.densityOverride does not
    // re-run the effect because Svelte's fine-grained tracker only records the
    // read of advancedOptions.value (the object reference) when we do
    // `const advOptsSnapshot = advancedOptions.value` below, but not the
    // reads of nested properties that happen inside the async .then() callback.
    const _advOptsKey = advOptsKey;
    void _advOptsKey;

    // Also read isAdvancedMode synchronously so switching modes triggers a
    // re-render (the density formula depends on it, but it was previously only
    // accessed inside the async callback which is not tracked).
    const advancedModeActive = isAdvancedMode.value;

    previewError = null;

    // Block preview calculation when URL version mismatch is pending
    if (urlVersionMismatch !== null) {
      plotState.clearPreview();
      return;
    }

    if (!entityState) {
      plotState.clearPreview();
      return;
    }
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete, selectedProgram } =
      entityState;
    if (!isComplete || resolvedProgramId === null || !selectedParticle || !selectedMaterial) {
      plotState.clearPreview();
      return;
    }
    const programName =
      "resolvedProgram" in selectedProgram
        ? (selectedProgram.resolvedProgram?.name ?? "Auto")
        : selectedProgram.name;

    // Snapshot advanced options synchronously BEFORE the async call so the
    // closure uses the options that were active when the effect fired (not
    // potentially stale ones resolved later after a rapid selection change).
    const advOptsSnapshot = advancedOptions.value;

    // Skip preview for external programs — they don't expose getPlotData
    if (typeof resolvedProgramId === "string") {
      plotState.clearPreview();
      return;
    }
    const numericProgramId: number = resolvedProgramId;

    // Narrow particle to built-in type for WASM calls
    const builtinPreviewParticle = "massNumber" in selectedParticle ? selectedParticle : null;
    if (!builtinPreviewParticle) {
      plotState.clearPreview();
      return;
    }

    const builtinPreviewMat = "isGasByDefault" in selectedMaterial ? selectedMaterial : null;

    // Snapshot the current selection so a slower in-flight getPlotData
    // for an outdated selection cannot clobber a fresher preview (race
    // when the user changes particle/material/program quickly).
    const snapshot = {
      programId: numericProgramId,
      particleId: builtinPreviewParticle.id as number,
      materialId: selectedMaterial.id,
      customMaterial: isCustomMaterial(builtinPreviewMat) ? builtinPreviewMat : null,
    };
    let cancelled = false;

    getService().then((service) => {
      if (cancelled) return;
      try {
        const result = snapshot.customMaterial
          ? service.getPlotDataCustomCompound({
              programId: snapshot.programId,
              particleId: snapshot.particleId,
              elements: customMaterialElementsForWasm(snapshot.customMaterial),
              density: snapshot.customMaterial.density,
              iValue: snapshot.customMaterial.iValue,
              numPoints: 500,
              logScale: true,
            })
          : typeof snapshot.materialId === "number"
            ? service.getPlotData(
                snapshot.programId,
                snapshot.particleId,
                snapshot.materialId,
                500,
                true,
                advOptsSnapshot,
              )
            : null;
        if (!result) {
          plotState.clearPreview();
          return;
        }
        if (cancelled) return;
        plotState.setPreview({
          programId: snapshot.programId,
          particleId: snapshot.particleId,
          materialId: snapshot.materialId,
          programName,
          particleName: getParticleLabel(builtinPreviewParticle),
          materialName: selectedMaterial.name,
          // Use the density override (only in Advanced mode) for correct unit conversion.
          // advancedModeActive is snapshotted synchronously at the top of this effect.
          density:
            (advancedModeActive && !snapshot.customMaterial
              ? advOptsSnapshot.densityOverride
              : undefined) ??
            builtinPreviewMat?.density ??
            selectedMaterial.density ??
            1,
          result,
        });
      } catch (err) {
        if (cancelled) return;
        previewError = err instanceof Error ? err.message : String(err);
        plotState.clearPreview();
      }
    });

    return () => {
      cancelled = true;
    };
  });

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

  // Summary shown in the mobile collapsed entity-panel header
  const selectionSummary = $derived.by(() => {
    if (!entityState) return "";
    const particlePart = entityState.selectedParticle
      ? getParticleLabel(entityState.selectedParticle)
      : "—";
    const materialPart = entityState.selectedMaterial?.name ?? "—";
    const programPart =
      "resolvedProgram" in entityState.selectedProgram
        ? (entityState.selectedProgram.resolvedProgram?.name ?? "Auto")
        : entityState.selectedProgram.name;
    return `${particlePart} / ${materialPart} / ${programPart}`;
  });

  // ── Add Series ──
  function handleAddSeries() {
    if (!entityState) return;
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

    const builtinAddParticle = "massNumber" in selectedParticle ? selectedParticle : null;
    if (!builtinAddParticle || typeof resolvedProgramId === "string") return;
    const added = plotState.addSeries({
      programId: resolvedProgramId,
      particleId: builtinAddParticle.id as number,
      materialId: selectedMaterial.id,
      programName: p.programName,
      particleName: getParticleLabel(builtinAddParticle),
      materialName: selectedMaterial.name,
      // Preserve the density that was active when the preview was computed
      // so committed series display the same values as the preview did.
      density: p.density,
      result: p.result,
    });

    if (!added) {
      console.warn("Duplicate series — not added.");
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

  async function downloadSvg() {
    if (!getSvg) return;
    const svgString = await getSvg();
    if (!svgString) return;

    // Create blob and trigger download
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dedx_plot.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showExportMenu = false;
  }

  async function downloadPng() {
    if (!getSvg) return;
    const svgString = await getSvg();
    if (!svgString) return;

    // Import svgToPng helper and convert
    const { svgToPng } = await import("$lib/export/pdf.js");
    const pngDataUrl = await svgToPng(svgString, 210, 148); // A5 landscape approx
    if (!pngDataUrl) {
      console.error("Failed to convert SVG to PNG");
      return;
    }

    // Create download link
    const a = document.createElement("a");
    a.href = pngDataUrl;
    a.download = "dedx_plot.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showExportMenu = false;
  }

  function toggleExportMenu() {
    if (!getSvg) return;
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

    <ExternalSourcesBadge sources={loadedExternalSources} />

    <!-- Sidebar + main grid; stacks vertically below 900px, side-by-side at desktop: (≥900px) -->
    <div class="grid gap-4 desktop:grid-cols-[minmax(520px,5fr)_7fr]">
      <!-- ── SIDEBAR ── -->
      <aside class="flex flex-col gap-4">
        {#if isMobile}
          <!-- Mobile: collapsed disclosure button showing current selection -->
          <button
            type="button"
            aria-expanded={entityPanelsOpen}
            onclick={() => (entityPanelsOpen = !entityPanelsOpen)}
            class="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium min-h-[44px]"
          >
            <span>{entityPanelsOpen ? "▼" : "▶"} Select Entities</span>
            <span class="ml-2 truncate text-xs text-muted-foreground">{selectionSummary}</span>
          </button>
        {/if}

        {#if !isMobile || entityPanelsOpen}
          <EntitySelectionPanels state={entityState} />
        {/if}

        <!-- Add Series button -->
        <button
          disabled={!entityState.isComplete}
          aria-disabled={!entityState.isComplete}
          onclick={handleAddSeries}
          class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 min-h-[44px]"
        >
          ＋ Add Series
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
      <div class="flex flex-col gap-4">
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
              disabled={getSvg === null}
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
                  onclick={downloadSvg}
                  class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  SVG vector
                </button>
                {#if isAdvancedMode.value}
                  <button
                    data-testid="export-image-png"
                    role="menuitem"
                    onclick={downloadPng}
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

        <!-- Series list (legend) -->
        {#if previewError}
          <p class="text-xs text-destructive" role="alert">Preview failed: {previewError}</p>
        {/if}
        {#if plotState.series.length > 0 || plotState.preview}
          <div role="list" aria-label="Plot series" class="flex flex-col gap-1">
            {#if plotState.preview}
              <div
                role="listitem"
                data-testid="preview-series"
                data-density={plotState.preview.density}
                class="flex items-center gap-2 text-sm italic text-muted-foreground"
              >
                <span
                  role="img"
                  class="inline-block h-4 w-4 rounded-sm border border-dashed"
                  style="background-color: #000; opacity: 0.5"
                  aria-label="Black, dashed line (preview)"
                ></span>
                <span
                  >Preview — {plotState.preview.particleName} in {plotState.preview
                    .materialName}</span
                >
                <button
                  aria-label="Toggle preview visibility"
                  onclick={() => plotState.togglePreviewVisibility()}
                  class="ml-auto text-muted-foreground hover:text-foreground">👁</button
                >
              </div>
            {/if}

            {#each plotState.series as s (s.seriesId)}
              <div
                role="listitem"
                class="flex items-center gap-2 text-sm"
                style={s.visible ? "" : "opacity: 0.4"}
              >
                <span
                  class="inline-block h-4 w-4 rounded-sm"
                  style="background-color: {jsrootSwatchColors?.get(s.colorIndex) ?? s.color}"
                  aria-label="{jsrootSwatchColors?.get(s.colorIndex) ?? s.color}, solid line"
                ></span>
                <span>{s.label}</span>
                <button
                  aria-label={s.visible ? `Hide series ${s.label}` : `Show series ${s.label}`}
                  aria-pressed={!s.visible}
                  onclick={() => plotState.toggleVisibility(s.seriesId)}
                  class="ml-auto text-muted-foreground hover:text-foreground">👁</button
                >
                <button
                  aria-label="Remove series {s.label}"
                  onclick={() => plotState.removeSeries(s.seriesId)}
                  class="text-muted-foreground hover:text-destructive">×</button
                >
              </div>
            {/each}
          </div>
        {/if}

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
