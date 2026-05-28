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

  constructor() {
    this.plotState = createPlotState();
    this.setupEffects();
  }

  setupEffects() {
    // Removed this alias

    $effect(() => {
      if (wasmReady.value && !appInit.isInitializing && !appInit.entityState && !appInit.error) {
        appInit.initialize(page.url.searchParams);
      }
    });

    $effect(() => {
      if (!browser) return;
      loadAdvancedOptionsFromStorage();
    });

    $effect(() => {
      if (wasmReady.value && !this.advancedModeInitializedFromUrl) {
        initAdvancedModeFromUrl(page.url.searchParams);
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

    $effect(() => {
      if (!browser || this.urlVersionChecked) return;
      const params = new URLSearchParams(window.location.search);
      const urlvRaw = params.get("urlv");
      const negotiationResult = negotiateVersion(urlvRaw);
      if (negotiationResult.status === "mismatch") {
        this.urlVersionMismatch = { version: negotiationResult.version };
      } else {
        this.urlVersionMismatch = null;
      }
      this.urlVersionChecked = true;
    });

    setupPlotUrlRestore(
      () => this.plotState,
      () => appInit.entityState,
      () => this.urlInitialized,
      () => {
        this.urlInitialized = true;
      },
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

    if (!added) {
      console.warn("Duplicate series — not added.");
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
        if (!added) {
          hadFailures = true;
        }
      } catch (err) {
        hadFailures = true;
        console.warn("Failed to add one of the multi-selected series.", err);
      }
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
