<script lang="ts">
  import { browser } from "$app/environment";
  import { wasmReady, entityState } from "$lib/state/ui.svelte";
  import EntitySelectionPanels from "$lib/components/entity-selection-panels.svelte";
  import JsrootPlot from "$lib/components/jsroot-plot.svelte";
  import { createPlotState } from "$lib/state/plot.svelte";
  import { computeAxisRanges } from "$lib/utils/plot-utils";
  import { encodePlotUrl, decodePlotUrl } from "$lib/utils/plot-url";
  import { libdedx } from "$lib/wasm/libdedx";
  import type { StpUnit } from "$lib/wasm/types";
  import { Button } from "$lib/components/ui/button";

  const plotState = createPlotState();

  let urlInitialized = $state(false);

  $effect(() => {
    if (!browser || !wasmReady.value || urlInitialized) return;
    const params = new URLSearchParams(window.location.search);
    const decoded = decodePlotUrl(params);

    if (decoded.particleId !== null) {
      entityState.selectParticle(decoded.particleId);
    }
    if (decoded.materialId !== null) {
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

    const service = libdedx.service;
    if (!service) return;

    for (const s of decoded.series) {
      try {
        const result = service.getPlotData(s.programId, s.particleId, s.materialId, 500, true);
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
          particleName: part.name,
          materialName: mat.name,
          density: mat.density,
          result,
        });
      } catch {
        // Invalid triplet — silently skip per spec
      }
    }
    urlInitialized = true;
  });

  $effect(() => {
    if (!browser || !urlInitialized) return;
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
    });
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.replaceState({}, "", newUrl);
  });

  // ── Preview series: auto-calculated whenever entity selection changes ──
  $effect(() => {
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete } = entityState;
    if (!isComplete || resolvedProgramId === null || !selectedParticle || !selectedMaterial) {
      plotState.clearPreview();
      return;
    }
    const service = libdedx.service;
    if (!service) return;

    try {
      const result = service.getPlotData(
        resolvedProgramId,
        selectedParticle.id,
        selectedMaterial.id,
        500,
        true,
      );
      plotState.setPreview({
        programId: resolvedProgramId,
        particleId: selectedParticle.id,
        materialId: selectedMaterial.id,
        programName: entityState.selectedProgram.id === -1
          ? (entityState.selectedProgram.resolvedProgram?.name ?? "Auto")
          : entityState.selectedProgram.name,
        particleName: selectedParticle.name,
        materialName: selectedMaterial.name,
        density: selectedMaterial.density,
        result,
      });
    } catch (err) {
      console.error("Preview series error:", err);
      plotState.clearPreview();
    }
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
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete } = entityState;
    if (!isComplete || resolvedProgramId === null || !selectedParticle || !selectedMaterial) return;
    const service = libdedx.service;
    if (!service) return;
    if (!plotState.preview) return;

    const added = plotState.addSeries({
      programId: resolvedProgramId,
      particleId: selectedParticle.id,
      materialId: selectedMaterial.id,
      programName: plotState.preview.programName,
      particleName: selectedParticle.name,
      materialName: selectedMaterial.name,
      density: selectedMaterial.density,
      result: plotState.preview.result,
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
    entityState.resetAll();
    showResetConfirm = false;
  }
</script>

<svelte:head>
  <title>Plot - webdedx</title>
</svelte:head>

{#if !wasmReady.value}
  <div class="flex h-64 items-center justify-center rounded-lg border bg-card p-6">
    <p class="text-muted-foreground">Loading WASM module…</p>
  </div>
{:else}
  <!-- Desktop: sidebar + main grid -->
  <div class="grid gap-4 lg:grid-cols-[minmax(360px,3fr)_7fr]">

    <!-- ── SIDEBAR ── -->
    <aside class="flex flex-col gap-4">
      <EntitySelectionPanels state={entityState} />

      <!-- Add Series button -->
      <Button
        variant="default"
        disabled={!entityState.isComplete}
        aria-disabled={!entityState.isComplete}
        onclick={handleAddSeries}
        class="w-full"
      >
        ＋ Add Series
      </Button>

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

      <!-- Controls bar: stp unit + axis scale -->
      <div class="flex flex-wrap items-center gap-4">
        <!-- Stopping power unit segmented control -->
        <div role="radiogroup" aria-label="Stopping power unit" class="flex gap-1">
          {#each (["keV/µm", "MeV/cm", "MeV·cm²/g"] as const) as unit}
            <label class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
              {plotState.stpUnit === unit ? 'bg-primary text-primary-foreground' : 'bg-background'}">
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
          {#each [["Log", true], ["Lin", false]] as [label, isLog]}
            <label class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
              {plotState.xLog === isLog ? 'bg-primary text-primary-foreground' : 'bg-background'}">
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
          {#each [["Log", true], ["Lin", false]] as [label, isLog]}
            <label class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
              {plotState.yLog === isLog ? 'bg-primary text-primary-foreground' : 'bg-background'}">
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

      <!-- JSROOT canvas -->
      <div style="width: 100%; height: min(60vh, 600px); min-height: 400px;">
        <JsrootPlot
          series={plotState.series}
          preview={plotState.preview}
          stpUnit={plotState.stpUnit}
          xLog={plotState.xLog}
          yLog={plotState.yLog}
          {axisRanges}
        />
      </div>

      <!-- Series list (legend) -->
      {#if plotState.series.length > 0 || plotState.preview}
        <div role="list" aria-label="Plot series" class="flex flex-col gap-1">
          {#if plotState.preview}
            <div role="listitem" class="flex items-center gap-2 text-sm italic text-muted-foreground">
              <span
                class="inline-block h-4 w-4 rounded-sm border border-dashed"
                style="background-color: #000; opacity: 0.5"
                aria-label="Black, dashed line (preview)"
              ></span>
              <span>Preview — {plotState.preview.particleName} in {plotState.preview.materialName}</span>
              <button
                aria-label="Toggle preview visibility"
                onclick={() => plotState.togglePreviewVisibility()}
                class="ml-auto text-muted-foreground hover:text-foreground"
              >👁</button>
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
                style="background-color: {s.color}"
                aria-label="{s.color}, solid line"
              ></span>
              <span>{s.label}</span>
              <button
                aria-label={s.visible ? `Hide series ${s.label}` : `Show series ${s.label}`}
                aria-pressed={!s.visible}
                onclick={() => plotState.toggleVisibility(s.seriesId)}
                class="ml-auto text-muted-foreground hover:text-foreground"
              >👁</button>
              <button
                aria-label="Remove series {s.label}"
                onclick={() => plotState.removeSeries(s.seriesId)}
                class="text-muted-foreground hover:text-destructive"
              >×</button>
            </div>
          {/each}
        </div>
      {/if}

    </div>
  </div>

  <!-- Reset confirmation dialog -->
  {#if showResetConfirm}
    <div role="dialog" aria-modal="true" aria-label="Confirm reset"
         class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="rounded-lg border bg-card p-6 shadow-lg">
        <p class="mb-4">Remove all {plotState.series.length} series and reset selections?</p>
        <div class="flex justify-end gap-2">
          <Button variant="outline" onclick={() => (showResetConfirm = false)}>Cancel</Button>
          <Button variant="destructive" onclick={doReset}>Reset</Button>
        </div>
      </div>
    </div>
  {/if}
{/if}
