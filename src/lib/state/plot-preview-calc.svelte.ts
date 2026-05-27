import { advancedOptions } from "$lib/state/advanced-options.svelte";
import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
import { externalDataService } from "$lib/external-data/service";
import { parseExtRef, resolveExtLocalIdForLabel } from "$lib/external-data/ids";
import {
  customMaterialElementsForWasm,
  isCustomMaterial,
} from "$lib/utils/custom-compound-material";
import { getParticleLabel } from "$lib/utils/particle-label";
import { loadExternalCalculationResult } from "$lib/utils/external-plot-series";
import { getService } from "$lib/wasm/loader";
import type { EntityId } from "$lib/external-data/types";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { PlotState } from "$lib/state/plot.svelte";

/**
 * Headless plot preview-series orchestrator.
 *
 * Recomputes the preview series whenever entity selection or advanced options
 * change. Routes to the external data service for external programs and to
 * the WASM service for built-in ones. The caller exposes a `setPreviewError`
 * sink so errors surface in the page UI.
 */
export function setupPlotPreviewCalculation(
  getPlotState: () => PlotState,
  getEntityState: () => EntitySelectionState | null,
  getUrlVersionMismatch: () => unknown,
  getAdvOptsKey: () => string,
  setPreviewError: (msg: string | null) => void,
) {
  $effect(() => {
    // Register reactive deps on every nested advanced option.
    const _advOptsKey = getAdvOptsKey();
    void _advOptsKey;

    // Read isAdvancedMode synchronously so switching modes re-runs the effect
    // (density formula depends on it).
    const advancedModeActive = isAdvancedMode.value;

    const plotState = getPlotState();
    const entityState = getEntityState();

    setPreviewError(null);

    if (getUrlVersionMismatch() !== null) {
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

    // Snapshot advanced options before the async call so the closure uses
    // the options that were active when the effect fired.
    const advOptsSnapshot = advancedOptions.value;

    // External program: fetch preview from ExternalDataService.
    if (typeof resolvedProgramId === "string") {
      const extProgRef = parseExtRef(resolvedProgramId);
      if (!extProgRef) {
        plotState.clearPreview();
        return;
      }
      const { label, localId: programLocalId } = extProgRef;
      const extCtx = entityState.externalContext;
      const particleLocalId = resolveExtLocalIdForLabel(
        selectedParticle.id,
        label,
        extCtx.externalRefsForBuiltinParticle,
      );
      const materialLocalId = resolveExtLocalIdForLabel(
        selectedMaterial.id,
        label,
        extCtx.externalRefsForBuiltinMaterial,
      );
      if (!particleLocalId || !materialLocalId) {
        plotState.clearPreview();
        return;
      }
      const particleA =
        "massNumber" in selectedParticle
          ? selectedParticle.massNumber
          : "A" in selectedParticle
            ? (selectedParticle as { A: number }).A
            : 1;
      const extProgramName = `🔗 ${programName}`;
      const snapshot = {
        programId: resolvedProgramId as EntityId,
        particleId: selectedParticle.id as EntityId,
        materialId: selectedMaterial.id as EntityId,
      };
      let extCancelled = false;
      loadExternalCalculationResult(
        externalDataService,
        label,
        programLocalId,
        particleLocalId,
        materialLocalId,
        particleA,
      )
        .then((result) => {
          if (extCancelled) return;
          if (!result) {
            plotState.clearPreview();
            return;
          }
          plotState.setPreview({
            programId: snapshot.programId,
            particleId: snapshot.particleId,
            materialId: snapshot.materialId,
            programName: extProgramName,
            particleName: getParticleLabel(selectedParticle),
            materialName: selectedMaterial.name,
            particleMassNumber: particleA,
            density: selectedMaterial.density ?? 1,
            result,
          });
        })
        .catch((err) => {
          if (extCancelled) return;
          setPreviewError(err instanceof Error ? err.message : String(err));
          plotState.clearPreview();
        });
      return () => {
        extCancelled = true;
      };
    }
    const numericProgramId: number = resolvedProgramId;

    const builtinPreviewParticle = "massNumber" in selectedParticle ? selectedParticle : null;
    if (!builtinPreviewParticle) {
      plotState.clearPreview();
      return;
    }

    const builtinPreviewMat = "isGasByDefault" in selectedMaterial ? selectedMaterial : null;

    // Snapshot selection so a slower in-flight getPlotData for an outdated
    // selection cannot clobber a fresher preview.
    const snapshot = {
      programId: numericProgramId,
      particleId: builtinPreviewParticle.id as number,
      materialId: selectedMaterial.id as EntityId,
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
          particleMassNumber: builtinPreviewParticle.massNumber,
          // Use the density override (Advanced mode only) for correct unit conversion.
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
        setPreviewError(err instanceof Error ? err.message : String(err));
        plotState.clearPreview();
      }
    });

    return () => {
      cancelled = true;
    };
  });
}
