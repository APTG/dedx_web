import { browser } from "$app/environment";
import { advancedOptions } from "$lib/state/advanced-options.svelte";
import { customCompounds } from "$lib/state/custom-compounds.svelte";
import { externalDataService } from "$lib/external-data/service";
import { parseExtRef, resolveExtLocalIdForLabel } from "$lib/external-data/ids";
import { decodePlotUrl } from "$lib/utils/plot-url";
import { getParticleLabel } from "$lib/utils/particle-label";
import { loadExternalCalculationResult } from "$lib/utils/external-plot-series";
import { getService } from "$lib/wasm/loader";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { PlotState } from "$lib/state/plot.svelte";
import { wasmReady } from "$lib/state/ui.svelte";

function restoreCustomCompoundFromUrl(decoded: ReturnType<typeof decodePlotUrl>) {
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

/**
 * Headless plot URL → state restoration.
 *
 * Reads `window.location.search` once, decodes it, hydrates entity selection
 * + plot state + advanced options, then asynchronously rebuilds every
 * `series=` entry (both built-in WASM series and external-data series).
 * Flips `urlInitialized` to true via `onComplete` once all series have been
 * added, so the URL-sync effect (in `plot-url-sync.svelte.ts`) can start
 * writing without overwriting the restoration in progress.
 */
export function setupPlotUrlRestore(
  getPlotState: () => PlotState,
  getEntityState: () => EntitySelectionState | null,
  getUrlInitialized: () => boolean,
  onComplete: () => void,
  getUrlVersionMismatch: () => { version: number | string } | null = () => null,
) {
  $effect(() => {
    const entityState = getEntityState();
    if (!browser || !wasmReady.value || !entityState || getUrlInitialized()) return;

    // "Rejected, not migrated": an unsupported version hydrates nothing from
    // the link. Skip restoration (leaving plot defaults) but still flip
    // `urlInitialized` so URL-sync can write the canonical default state; the
    // version banner persists until the user picks "Load defaults".
    if (getUrlVersionMismatch() !== null) {
      onComplete();
      return;
    }

    const plotState = getPlotState();
    const params = new URLSearchParams(window.location.search);
    const decoded = decodePlotUrl(params);

    if (decoded.particleId !== null) {
      entityState.selectParticle(decoded.particleId);
    }
    const customFromUrl = restoreCustomCompoundFromUrl(decoded);
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

    if (Object.keys(decoded.advancedOptions).length > 0) {
      advancedOptions.value = decoded.advancedOptions;
    }

    getService()
      .then(async (service) => {
        const externalRestores: Promise<void>[] = [];
        for (const s of decoded.series) {
          if (typeof s.programId === "string") {
            const progParsed = parseExtRef(s.programId);
            if (!progParsed) continue;
            const { label, localId: programLocalId } = progParsed;
            const extCtx = entityState.externalContext;
            const meta = externalDataService.getMetadata(label);
            if (!meta) continue;
            const particleLocalId = resolveExtLocalIdForLabel(
              s.particleId,
              label,
              extCtx.externalRefsForBuiltinParticle,
            );
            const materialLocalId = resolveExtLocalIdForLabel(
              s.materialId,
              label,
              extCtx.externalRefsForBuiltinMaterial,
            );
            if (!particleLocalId || !materialLocalId) continue;
            const extParticle = meta.particles.find((p) => p.id === particleLocalId);
            const extMat = meta.materials.find((m) => m.id === materialLocalId);
            const extProg = meta.programs.find((p) => p.id === programLocalId);
            if (!extParticle || !extMat) continue;
            const particleA = extParticle.A;
            const pId = s.programId;
            const ptId = s.particleId;
            const matId = s.materialId;
            const programName = extProg ? `🔗 ${extProg.name}` : `🔗 ${label}`;
            const particleName = getParticleLabel({
              id: s.particleId,
              name: extParticle.name,
              symbol: extParticle.symbol,
            });
            const materialName = extMat.name;
            const density = extMat.density ?? 1;
            externalRestores.push(
              loadExternalCalculationResult(
                externalDataService,
                label,
                programLocalId,
                particleLocalId,
                materialLocalId,
                particleA,
              )
                .then((result) => {
                  if (!result) return;
                  plotState.addSeries({
                    programId: pId,
                    particleId: ptId,
                    materialId: matId,
                    programName,
                    particleName,
                    materialName,
                    particleMassNumber: particleA,
                    density,
                    result,
                  });
                })
                .catch(() => {
                  // Silently skip failed external series restores.
                }),
            );
            continue;
          }
          // Built-in triplet.
          if (typeof s.particleId !== "number" || typeof s.materialId !== "number") continue;
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
              particleMassNumber: part.massNumber,
              density: mat.density,
              result,
            });
          } catch {
            // Invalid triplet — silently skip per spec.
          }
        }
        await Promise.allSettled(externalRestores);

        // Inverse-STP two-series creation: when navigating from "Plot this row"
        // on a 2-solution STP row, the URL carries inv_stp_branch=both. Add two
        // series — same STP curve labelled " high-E" and " low-E" — so both
        // branches appear in the legend.
        const invStpBranch = decoded.invStpBranch;
        if (
          invStpBranch === "both" &&
          decoded.particleId !== null &&
          typeof decoded.particleId === "number" &&
          decoded.materialId !== null &&
          typeof decoded.materialId === "number" &&
          decoded.programId !== -1
        ) {
          try {
            const stpResult = service.getPlotData(
              decoded.programId,
              decoded.particleId,
              decoded.materialId,
              500,
              true,
              advancedOptions.value,
            );
            const allPrograms = service.getPrograms();
            const allParticles = service.getParticles(decoded.programId);
            const allMaterials = service.getMaterials(decoded.programId);
            const prog = allPrograms.find((p) => p.id === decoded.programId);
            const part = allParticles.find((p) => p.id === decoded.particleId);
            const mat = allMaterials.find((m) => m.id === decoded.materialId);
            if (prog && part && mat) {
              const baseData = {
                programId: decoded.programId,
                particleId: decoded.particleId,
                materialId: decoded.materialId,
                programName: prog.name,
                particleName: getParticleLabel(part),
                materialName: mat.name,
                particleMassNumber: part.massNumber,
                density: mat.density,
                result: stpResult,
              };
              plotState.addSeries({ ...baseData, labelSuffix: " high-E" });
              plotState.addSeries({ ...baseData, labelSuffix: " low-E" });
            }
          } catch {
            // Silently ignore — invalid triplet.
          }
        }
      })
      .finally(() => {
        // Only allow URL writes after every restored series has been added,
        // otherwise a write running mid-restore would overwrite `series=...`.
        onComplete();
      });
  });
}
