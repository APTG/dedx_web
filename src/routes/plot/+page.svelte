<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Button } from "$lib/components/ui/button";
  import {
    createEntitySelectionState,
    type EntitySelectionState,
  } from "$lib/state/entity-selection.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import EntitySelectionPanels from "$lib/components/entity-selection-panels.svelte";
  import JsrootPlot from "$lib/components/jsroot-plot.svelte";
  import { createPlotState } from "$lib/state/plot.svelte";
  import { computeAxisRanges, getJsrootSwatchColors } from "$lib/utils/plot-utils";
  import { encodePlotUrl, decodePlotUrl } from "$lib/utils/plot-url";
  import { getParticleLabel } from "$lib/utils/particle-label";
  import { getService } from "$lib/wasm/loader";
  import { initPlotExportState, canExport } from "$lib/state/export.svelte";
  import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import {
    advancedOptions,
    loadAdvancedOptionsFromStorage,
    persistAdvancedOptions,
  } from "$lib/state/advanced-options.svelte";

  const plotState = createPlotState();
  let entityState = $state<EntitySelectionState | null>(null);
  let materialIsGas = $state<boolean | undefined>(undefined);

  $effect(() => {
    if (wasmReady.value && !entityState) {
      getService().then((service) => {
        const matrix = buildCompatibilityMatrix(service);
        entityState = createEntitySelectionState(matrix);
      });
    }
  });

  // Initialize advanced options from localStorage on mount (runs once; browser is a constant)
  $effect(() => {
    if (!browser) return;
    loadAdvancedOptionsFromStorage();
  });

  // Track material changes to determine gas/condensed state for the panel
  $effect(() => {
    if (!entityState?.selectedMaterial) {
      materialIsGas = undefined;
      return;
    }
    const resolvedId = entityState.resolvedProgramId;
    const matId = entityState.selectedMaterial.id;
    if (resolvedId === null) {
      materialIsGas = undefined;
      return;
    }
    let cancelled = false;
    getService().then((service) => {
      if (cancelled) return;
      const materials = service.getMaterials(resolvedId);
      const mat = materials.find((m) => m.id === matId);
      if (cancelled) return;
      materialIsGas = mat?.isGasByDefault;
    });
    return () => {
      cancelled = true;
    };
  });

  // Persist advanced options to localStorage whenever they change
  $effect(() => {
    if (!browser) return;
    persistAdvancedOptions();
  });

  let urlInitialized = $state(false);

  $effect(() => {
    if (!browser || !wasmReady.value || !entityState || urlInitialized) return;
    // Mark in-flight so the URL-write effect cannot run while we are
    // restoring (it would otherwise wipe `series=...` from the address bar).
    const state = entityState;
    const params = new URLSearchParams(window.location.search);
    const decoded = decodePlotUrl(params);

    if (decoded.particleId !== null) {
      state.selectParticle(decoded.particleId);
    }
    if (decoded.materialId !== null) {
      state.selectMaterial(decoded.materialId);
    }
    if (decoded.programId !== -1) {
      state.selectProgram(decoded.programId);
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
    const params = encodePlotUrl({
      particleId: entityState.selectedParticle?.id ?? null,
      materialId: entityState.selectedMaterial?.id ?? null,
      programId: entityState.selectedProgram.id,
      series: plotState.series.map((s) => ({
        programId: s.programId,
        particleId: s.particleId,
        materialId: s.materialId,
      })),
      stpUnit: plotState.stpUnit,
      xLog: plotState.xLog,
      yLog: plotState.yLog,
      advancedOptions: advancedOptions.value,
    });
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    replaceState(newUrl, page.state);
  });

  // ── Preview series: auto-calculated whenever entity selection OR advanced options change ──
  $effect(() => {
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

    // Snapshot advanced options synchronously BEFORE the async call.
    // This registers advancedOptions.value as a reactive dependency so the effect
    // re-runs (and re-draws the preview) whenever any option changes.  The snapshot
    // is also passed to getPlotData so the closure uses the options that were active
    // when the effect fired, not potentially stale ones resolved later.
    const advOptsSnapshot = advancedOptions.value;

    // Snapshot the current selection so a slower in-flight getPlotData
    // for an outdated selection cannot clobber a fresher preview (race
    // when the user changes particle/material/program quickly).
    const snapshot = {
      programId: resolvedProgramId,
      particleId: selectedParticle.id,
      materialId: selectedMaterial.id,
    };
    let cancelled = false;

    getService().then((service) => {
      if (cancelled) return;
      try {
        const result = service.getPlotData(
          snapshot.programId,
          snapshot.particleId,
          snapshot.materialId,
          500,
          true,
          advOptsSnapshot,
        );
        if (cancelled) return;
        plotState.setPreview({
          programId: snapshot.programId,
          particleId: snapshot.particleId,
          materialId: snapshot.materialId,
          programName,
          particleName: getParticleLabel(selectedParticle),
          materialName: selectedMaterial.name,
          // Use the density override (only in Advanced mode) for correct unit conversion
          density:
            (isAdvancedMode.value ? advOptsSnapshot.densityOverride : undefined) ??
            selectedMaterial.density,
          result,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Preview series error:", err);
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

    const added = plotState.addSeries({
      programId: resolvedProgramId,
      particleId: selectedParticle.id,
      materialId: selectedMaterial.id,
      programName: p.programName,
      particleName: getParticleLabel(selectedParticle),
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
{:else if !wasmReady.value || !entityState}
  <div class="space-y-6">
    <h1 class="text-3xl font-bold">Plot</h1>
    <div class="mx-auto max-w-4xl space-y-6" aria-busy="true" aria-label="Loading plot page">
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
    <!-- Desktop: sidebar + main grid -->
    <div class="grid gap-4 lg:grid-cols-[minmax(520px,5fr)_7fr]">
      <!-- ── SIDEBAR ── -->
      <aside class="flex flex-col gap-4">
        <EntitySelectionPanels state={entityState} />

        <!-- Add Series button -->
        <button
          disabled={!entityState.isComplete}
          aria-disabled={!entityState.isComplete}
          onclick={handleAddSeries}
          class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          ＋ Add Series
        </button>

        {#if plotState.series.length >= 10}
          <p class="text-sm text-muted-foreground">
            10 series displayed. Adding more may reduce readability.
          </p>
        {/if}

        <button
          class="text-sm text-muted-foreground underline hover:no-underline"
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
                  class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
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
                  class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
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
                  class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
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
                  role="menuitem"
                  onclick={downloadSvg}
                  class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  SVG vector
                </button>
              </div>
            {/if}
          </div>
        </div>

        <!-- JSROOT canvas -->
        <div style="width: 100%; height: min(60vh, 600px); min-height: 400px;">
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
        {#if plotState.series.length > 0 || plotState.preview}
          <div role="list" aria-label="Plot series" class="flex flex-col gap-1">
            {#if plotState.preview}
              <div
                role="listitem"
                class="flex items-center gap-2 text-sm italic text-muted-foreground"
              >
                <span
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
          <AdvancedOptionsPanel
            materialIsGas={materialIsGas ?? false}
            materialBuiltInDensity={entityState.selectedMaterial.density}
            materialBuiltInAggregateState={materialIsGas ? "gas" : "condensed"}
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
