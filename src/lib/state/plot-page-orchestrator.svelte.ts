import { browser } from "$app/environment";
import { page } from "$app/state";
import { wasmReady } from "$lib/state/ui.svelte";
import { createPlotState, type PlotState } from "$lib/state/plot.svelte";
import { WATER_ID } from "$lib/state/entity-selection.svelte";
import { getJsrootSwatchColors } from "$lib/utils/plot-utils";
import { setupPlotUrlSync } from "$lib/state/plot-url-sync.svelte";
import { setupPlotUrlRestore } from "$lib/state/plot-url-restore.svelte";
import { setupPlotPreviewCalculation } from "$lib/state/plot-preview-calc.svelte";
import { getParticleLabel } from "$lib/utils/particle-label";
import { isCustomMaterial } from "$lib/utils/custom-compound-material";
import { getService } from "$lib/wasm/loader";
import {
  advancedOptions,
  loadAdvancedOptionsFromStorage,
  persistAdvancedOptions,
} from "$lib/state/advanced-options.svelte";
import { isAdvancedMode, initAdvancedModeFromUrl } from "$lib/state/advanced-mode.svelte";
import { negotiateVersion } from "$lib/utils/url-version.js";
import { appInit } from "$lib/state/app-init.svelte";
import { goto } from "$app/navigation";

export const MAX_PLOT_SERIES = 20;

export class PlotPageOrchestrator {
  plotState: PlotState;

  materialIsGas = $state<boolean | undefined>(undefined);
  urlVersionMismatch = $state<{ version: number | string } | null>(null);
  advancedModeInitializedFromUrl = $state(false);
  previewError = $state<string | null>(null);

  urlVersionChecked = $state(false);
  urlInitialized = $state(false);

  jsrootSwatchColors = $state<Map<number, string> | null>(null);
  editingSeriesId = $state<number | null>(null);
  showResetConfirm = $state(false);

  // Transient confirmation shown after Add Series so the user sees the curve
  // landed on the plot (#812). The token makes each announcement distinct, so
  // adding two identical-label series in a row still re-triggers the toast.
  seriesFeedback = $state<{ text: string; token: number } | null>(null);
  #feedbackToken = 0;

  announceSeriesFeedback(text: string): void {
    this.#feedbackToken += 1;
    this.seriesFeedback = { text, token: this.#feedbackToken };
  }

  constructor() {
    this.plotState = createPlotState();
    this.setupEffects();
  }

  setupEffects() {
    // Negotiate the URL version synchronously, before any effect runs, so the
    // result can gate hydration. $effect callbacks fire after construction, so
    // setting this here guarantees it is resolved before init/restore.
    if (browser && !this.urlVersionChecked) {
      const urlvRaw = new URLSearchParams(window.location.search).get("urlv");
      const negotiationResult = negotiateVersion(urlvRaw);
      this.urlVersionMismatch =
        negotiationResult.status === "mismatch" ? { version: negotiationResult.version } : null;
      this.urlVersionChecked = true;
    }

    $effect(() => {
      if (wasmReady.value && !appInit.isInitializing && !appInit.entityState && !appInit.error) {
        // Unsupported link → initialize from defaults (empty params).
        const sourceParams = this.urlVersionMismatch
          ? new URLSearchParams()
          : page.url.searchParams;
        appInit.initialize(sourceParams);
      }
    });

    $effect(() => {
      if (!browser) return;
      loadAdvancedOptionsFromStorage();
    });

    $effect(() => {
      if (wasmReady.value && !this.advancedModeInitializedFromUrl) {
        const sourceParams = this.urlVersionMismatch
          ? new URLSearchParams()
          : page.url.searchParams;
        initAdvancedModeFromUrl(sourceParams);
        this.advancedModeInitializedFromUrl = true;
      }
    });

    $effect(() => {
      const mode = isAdvancedMode.value;
      if (!mode && appInit.entityState?.selectedMaterial) {
        const matId = appInit.entityState.selectedMaterial.id;
        if (typeof matId === "string" && matId.startsWith("cc_")) {
          appInit.entityState.selectMaterial(WATER_ID);
        }
      }
      if (!mode) {
        for (const series of [...this.plotState.series]) {
          if (typeof series.materialId === "string" && series.materialId.startsWith("cc_")) {
            this.plotState.removeSeries(series.seriesId);
          }
        }
      }
    });

    // Basic mode has no program selector — it always uses Auto-select (#816).
    // Discard any program the user pinned in Advanced mode so a
    // Basic → Advanced → Basic round-trip returns to auto. A dedicated effect
    // keyed only on the mode + state identity so it fires on the mode switch
    // (and first load), not on every material/series change — which keeps
    // per-series editing (`selectProgram(series.programId)`) unaffected.
    $effect(() => {
      if (!isAdvancedMode.value) {
        appInit.entityState?.selectProgram(-1); // -1 = Auto-select
      }
    });

    $effect(() => {
      if (!appInit.entityState?.selectedMaterial) {
        this.materialIsGas = undefined;
        return;
      }
      const resolvedId = appInit.entityState.resolvedProgramId;
      const selMat = appInit.entityState.selectedMaterial;
      const builtinMat = "isGasByDefault" in selMat ? selMat : null;
      const matId = selMat.id;
      if (isCustomMaterial(builtinMat)) {
        this.materialIsGas = builtinMat.isGasByDefault;
        return;
      }
      if (resolvedId === null || typeof resolvedId !== "number") {
        this.materialIsGas = undefined;
        return;
      }
      let cancelled = false;
      const numericResolvedId = resolvedId;
      getService().then((service) => {
        if (cancelled) return;
        const materials = service.getMaterials(numericResolvedId);
        const mat = materials.find((m) => m.id === matId);
        if (cancelled) return;
        this.materialIsGas = mat?.isGasByDefault;
      });
      return () => {
        cancelled = true;
      };
    });

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

    $effect(() => {
      if (!browser) return;
      const _advOptsKey = advOptsKey;
      void _advOptsKey;
      persistAdvancedOptions();
    });

    setupPlotUrlRestore(
      () => this.plotState,
      () => appInit.entityState,
      () => this.urlInitialized,
      () => {
        this.urlInitialized = true;
      },
      () => this.urlVersionMismatch,
    );

    setupPlotUrlSync(
      () => this.plotState,
      () => appInit.entityState,
      () => this.urlInitialized,
      () => appInit.loadedExternalSources,
      () => advOptsKey,
    );

    setupPlotPreviewCalculation(
      () => this.plotState,
      () => appInit.entityState,
      () => this.urlVersionMismatch,
      () => advOptsKey,
      (msg) => {
        this.previewError = msg;
      },
    );

    $effect(() => {
      if (!browser || this.jsrootSwatchColors) return;
      getJsrootSwatchColors().then((m) => (this.jsrootSwatchColors = m));
    });

    // Live-update editing series
    $effect(() => {
      if (this.editingSeriesId === null || !this.plotState.preview) return;
      const p = this.plotState.preview;
      const current = this.plotState.series.find((s) => s.seriesId === this.editingSeriesId);
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
      this.plotState.updateSeries(this.editingSeriesId, {
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
  }

  handleSelectSeriesForEdit(seriesId: number): void {
    if (!appInit.entityState) return;
    const s = this.plotState.series.find((x) => x.seriesId === seriesId);
    if (!s) return;
    this.editingSeriesId = seriesId;
    appInit.entityState.selectParticle(s.particleId);
    appInit.entityState.selectMaterial(s.materialId);
    appInit.entityState.selectProgram(s.programId as number | string);
    appInit.entityState.setExpanded(true);
  }

  handleDoneEditing(): void {
    this.editingSeriesId = null;
  }

  handleAddSeries() {
    if (!appInit.entityState) return;
    if (this.plotState.series.length >= MAX_PLOT_SERIES) return;
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete } =
      appInit.entityState;
    if (!isComplete || resolvedProgramId === null || !selectedParticle || !selectedMaterial) return;
    if (!this.plotState.preview) return;

    const p = this.plotState.preview;
    if (
      p.programId !== resolvedProgramId ||
      p.particleId !== selectedParticle.id ||
      p.materialId !== selectedMaterial.id
    ) {
      return;
    }

    const added = this.plotState.addSeries({
      programId: resolvedProgramId,
      particleId: selectedParticle.id,
      materialId: selectedMaterial.id,
      programName: p.programName,
      particleName: getParticleLabel(selectedParticle),
      materialName: selectedMaterial.name,
      particleMassNumber: p.particleMassNumber,
      density: p.density,
      result: p.result,
    });

    if (added) {
      const label = this.plotState.series.at(-1)?.label ?? "series";
      this.announceSeriesFeedback(`Added ${label} to the plot`);
    } else {
      this.announceSeriesFeedback("That series is already on the plot");
    }
  }

  async handleAddMultiSeries(
    across: "particle" | "material" | "program",
    ids: (number | string)[],
  ): Promise<void> {
    if (!appInit.entityState) return;
    const service = await getService();
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete } =
      appInit.entityState;
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
      this.previewError = "Cannot add selected series: one or more base IDs are invalid.";
      return;
    }

    let hadFailures = false;
    let addedCount = 0;
    let duplicateCount = 0;
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
        const added = this.plotState.addSeries({
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
        if (added) {
          addedCount += 1;
        } else {
          // addSeries returns false only for an already-present series (see
          // plot.svelte.ts) — a duplicate, not a failure. Count it separately
          // so it never surfaces the "could not be added" error below.
          duplicateCount += 1;
        }
      } catch (err) {
        hadFailures = true;
        console.warn("Failed to add one of the multi-selected series.", err);
      }
    }
    if (addedCount > 0) {
      this.announceSeriesFeedback(`Added ${addedCount} series to the plot`);
    } else if (duplicateCount > 0 && !hadFailures) {
      // Nothing new was added and there were no real failures — every selected
      // series was already on the plot. Mirror the single-add duplicate notice.
      this.announceSeriesFeedback(
        duplicateCount === 1
          ? "That series is already on the plot"
          : "Those series are already on the plot",
      );
    }
    if (hadFailures) {
      this.previewError = "Some selected series could not be added.";
    }
  }

  async handleAddOrMulti(): Promise<void> {
    if (!appInit.entityState) return;
    if (this.editingSeriesId === null && this.plotState.series.length >= MAX_PLOT_SERIES) return;
    if (this.editingSeriesId !== null) {
      this.handleDoneEditing();
      return;
    }
    const across = appInit.entityState.across;
    if (isAdvancedMode.value && across !== null && across !== "single") {
      const ids = appInit.entityState.multiSelected[across];
      if (ids.length > 1) {
        await this.handleAddMultiSeries(across, ids);
        return;
      }
    }
    this.handleAddSeries();
  }

  handleResetAll() {
    if (this.plotState.series.length >= 2) {
      this.showResetConfirm = true;
    } else {
      this.doReset();
    }
  }

  doReset() {
    this.plotState.resetAll();
    appInit.entityState?.resetAll();
    this.showResetConfirm = false;
  }

  handleLoadDefaults() {
    goto("/plot", { replaceState: true });
    this.urlVersionMismatch = null;
  }
}

export function createPlotPageOrchestrator() {
  return new PlotPageOrchestrator();
}
