import { replaceState } from "$app/navigation";
import { page } from "$app/state";
import { untrack } from "svelte";
import { calculatorUrlQueryString, type InverseModeUrlState } from "$lib/utils/calculator-url";
import { customMaterialUrlFields, isCustomMaterial } from "$lib/utils/custom-compound-material";
import { advancedOptions } from "$lib/state/advanced-options.svelte";
import type { CalculatorState } from "$lib/state/calculator.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { InverseLookupState } from "$lib/state/inverse-lookups.svelte";
import type { MultiProgramState } from "$lib/state/multi-program.svelte";
import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
import type { ExternalSourceDescriptor, EntityId } from "$lib/external-data/types";

/**
 * Headless Svelte 5 state module for synchronizing Calculator state to the URL.
 * Extracted from +page.svelte to decouple state management from the UI component
 * and cleanly resolve complex Svelte 5 `$effect` dependency tracking issues.
 */
export function setupCalculatorUrlSync(
  getCalcState: () => CalculatorState | null,
  getEntityState: () => EntitySelectionState | null,
  getInverseLookupState: () => InverseLookupState | null,
  getMultiProgState: () => MultiProgramState | null,
  getUrlInitialized: () => boolean,
  getLoadedExternalSources: () => ExternalSourceDescriptor[],
  getAdvOptsKey: () => string,
) {
  $effect(() => {
    // Read advOptsKey to establish reactive dependency on nested changes
    const _advOptsKey = getAdvOptsKey();
    void _advOptsKey;

    const urlInitialized = getUrlInitialized();
    const calcState = getCalcState();
    const entityState = getEntityState();
    const multiProgState = getMultiProgState();
    const inverseLookupState = getInverseLookupState();
    const loadedExternalSources = getLoadedExternalSources();

    if (!urlInitialized || !calcState || !entityState) return;
    // In advanced mode, wait for multiProgState to be initialized so the URL update
    // does not overwrite the reloaded URL (which may contain programs= from a previous
    // session) before the multiProgState effect has had a chance to read it.
    if (isAdvancedMode.value && multiProgState === null) return;

    // Build inverse mode state for URL encoding
    let inverseModeState: InverseModeUrlState | undefined;
    if (inverseLookupState && isAdvancedMode.value) {
      if (inverseLookupState.activeTab === "csda") {
        inverseModeState = {
          imode: "csda",
          lookups: inverseLookupState.rangeRows
            .filter((r) => r.text.trim() !== "")
            .map((r) => {
              const trimmed = r.text.trim();
              const numeric = trimmed.match(/^([\d.eE+-]+)/)?.[1] ?? trimmed;
              return {
                rawInput: r.unitFromSuffix ? numeric : trimmed,
                unit: r.unit,
                unitFromSuffix: r.unitFromSuffix,
              };
            }),
          iunit: inverseLookupState.rangeMasterUnit,
        };
      } else if (inverseLookupState.activeTab === "stp") {
        inverseModeState = {
          imode: "stp",
          lookups: inverseLookupState.stpRows
            .filter((r) => r.text.trim() !== "")
            .map((r) => ({
              rawInput: r.text.trim(),
              unit: r.unit,
              unitFromSuffix: false,
            })),
          iunit: inverseLookupState.stpMasterUnit,
        };
      }
    }

    const selectedMaterial = entityState.selectedMaterial;
    // Narrow to built-in MaterialEntity; ExternalOnlyMaterial lacks isGasByDefault
    const builtinMaterial =
      selectedMaterial && "isGasByDefault" in selectedMaterial ? selectedMaterial : null;
    const customUrlFields = isCustomMaterial(builtinMaterial)
      ? customMaterialUrlFields(builtinMaterial)
      : {};

    const selectedParticleId = entityState.selectedParticle?.id;
    const activeMultiProgramState = isAdvancedMode.value ? multiProgState : null;

    // Encode across= and particles= when advanced multi-particle comparison is active.
    const acrossDim = isAdvancedMode.value ? entityState.across : "single";
    const multiParticleIds =
      isAdvancedMode.value && acrossDim === "particle"
        ? (entityState.multiSelected.particle.filter((id) => typeof id === "number") as number[])
        : undefined;
    const multiMaterialIds =
      isAdvancedMode.value && acrossDim === "material"
        ? (entityState.multiSelected.material.filter(
            (id) => typeof id === "number" || (typeof id === "string" && id.startsWith("ext:")),
          ) as EntityId[])
        : undefined;

    const urlState = {
      particleId: typeof selectedParticleId === "number" ? selectedParticleId : null,
      materialId:
        builtinMaterial && typeof builtinMaterial.id === "number" ? builtinMaterial.id : null,
      // External program IDs are not yet URL-encoded in programId; null means auto-select
      programId:
        typeof entityState.resolvedProgramId === "number" ? entityState.resolvedProgramId : null,
      rows: calcState.rows,
      masterUnit: calcState.masterUnit,
      externalSources: loadedExternalSources,
      ...customUrlFields,
      // Include advanced mode state when active
      ...(isAdvancedMode.value
        ? {
            isAdvancedMode: true,
            advancedOptions: advancedOptions.value,
            materialIsGas: builtinMaterial?.isGasByDefault,
          }
        : {}),
      ...(activeMultiProgramState
        ? {
            // Emit ALL selected programs in display order (default program first)
            selectedProgramIds: activeMultiProgramState.selectedProgramIds,
            quantityFocus: activeMultiProgramState.quantityFocus,
          }
        : {}),
      // Emit across= only when the matching comparison list is present.
      ...(acrossDim === "particle" && multiParticleIds && multiParticleIds.length > 0
        ? { across: "particle" as const }
        : {}),
      ...(acrossDim === "material" && multiMaterialIds && multiMaterialIds.length > 0
        ? { across: "material" as const }
        : {}),
      ...(multiParticleIds && multiParticleIds.length > 0
        ? { selectedParticleIds: multiParticleIds }
        : {}),
      ...(multiMaterialIds && multiMaterialIds.length > 0
        ? { selectedMaterialIds: multiMaterialIds }
        : {}),
      // Include inverse mode state when active
      ...(inverseModeState || {}),
      // Encode istpbranch when STP column visibility is "both"
      ...(inverseModeState?.imode === "stp" && inverseLookupState?.stpBranchState === "both"
        ? { istpBranchState: "both" as const }
        : {}),
    };
    // Use calculatorUrlQueryString so `:` and `,` are written literally
    // (RFC 3986 §3.4 permits them unencoded in the query component).
    // This matches the format the browser stores in window.location.search
    // and keeps URLs human-readable (e.g. `energies=100,500:keV`).
    //
    // Build from `window.location.pathname` rather than `page.url.pathname`
    // so reading `page.url` does not register a reactive dependency on the
    // very URL we are about to rewrite — otherwise this effect re-runs on
    // every `replaceState` and forms a (silent) replaceState loop.
    const queryString = calculatorUrlQueryString(urlState);
    const next = `${window.location.pathname}?${queryString}`;
    if (next === `${window.location.pathname}${window.location.search}`) return;
    // Use untrack so reading page.state does not register a reactive dependency.
    // Without this, replaceState updates the SvelteKit page store (new object
    // reference for page.state) which re-triggers this effect on every call.
    untrack(() => replaceState(next, page.state));
  });
}
