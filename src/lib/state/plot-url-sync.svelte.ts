import { browser } from "$app/environment";
import { replaceState } from "$app/navigation";
import { page } from "$app/state";
import { untrack } from "svelte";
import { plotUrlQueryString } from "$lib/utils/plot-url";
import { customMaterialUrlFields, isCustomMaterial } from "$lib/utils/custom-compound-material";
import { advancedOptions } from "$lib/state/advanced-options.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { ExternalSourceDescriptor } from "$lib/external-data/types";
import type { PlotState } from "$lib/state/plot.svelte";

/**
 * Headless Svelte 5 state module for synchronizing Plotting state to the URL.
 * Extracted from +page.svelte to decouple state management from the UI component
 * and cleanly resolve complex Svelte 5 `$effect` dependency tracking issues.
 */
export function setupPlotUrlSync(
  getPlotState: () => PlotState,
  getEntityState: () => EntitySelectionState | null,
  getUrlInitialized: () => boolean,
  getLoadedExternalSources: () => ExternalSourceDescriptor[],
  getAdvOptsKey: () => string,
) {
  $effect(() => {
    const _advOptsKey = getAdvOptsKey();
    void _advOptsKey;

    const entityState = getEntityState();
    const urlInitialized = getUrlInitialized();
    const plotState = getPlotState();
    const loadedExternalSources = getLoadedExternalSources();

    if (!browser || !entityState || !urlInitialized) return;

    const selectedMaterial = entityState.selectedMaterial;
    const builtinUrlMat =
      selectedMaterial && "isGasByDefault" in selectedMaterial ? selectedMaterial : null;
    const customUrlFields = isCustomMaterial(builtinUrlMat)
      ? customMaterialUrlFields(builtinUrlMat)
      : {};

    const selectedParticleId = entityState.selectedParticle?.id;
    const selectedProgramId = entityState.selectedProgram.id;
    const hasInverseStpPair =
      plotState.series.some((s) => s.labelSuffix === " high-E") &&
      plotState.series.some((s) => s.labelSuffix === " low-E");

    // Use plotUrlQueryString (not encodePlotUrl().toString()) so the URL bar gets
    // the canonical form: `urlv` version signal, literal `:` and `~` list
    // separators (readable + linkifier-safe, issue #672), and ordered extdata.
    const query = plotUrlQueryString({
      particleId: typeof selectedParticleId === "number" ? selectedParticleId : null,
      materialId: builtinUrlMat && typeof builtinUrlMat.id === "number" ? builtinUrlMat.id : null,
      programId: typeof selectedProgramId === "number" ? selectedProgramId : -1,
      series: plotState.series.map((s) => ({
        programId: s.programId,
        particleId: s.particleId,
        materialId: s.materialId,
      })),
      stpUnit: plotState.stpUnit,
      xLog: plotState.xLog,
      yLog: plotState.yLog,
      ...(hasInverseStpPair ? { invStpBranch: "both" as const } : {}),
      advancedOptions: advancedOptions.value,
      externalSources: loadedExternalSources,
      ...customUrlFields,
    });
    const newUrl =
      query.length > 0 ? `${window.location.pathname}?${query}` : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (newUrl === currentUrl) return;
    untrack(() => replaceState(newUrl, page.state));
  });
}
