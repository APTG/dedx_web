import { browser } from "$app/environment";
import { page } from "$app/state";
import { untrack } from "svelte";
import { createCalculatorState, type CalculatorState } from "$lib/state/calculator.svelte";
import {
  createInverseLookupState,
  type InverseLookupState,
} from "$lib/state/inverse-lookups.svelte";
import { createMultiProgramState, type MultiProgramState } from "$lib/state/multi-program.svelte";
import { createMultiEntityState, type MultiEntityState } from "$lib/state/multi-entity.svelte";
import {
  advancedOptions,
  loadAdvancedOptionsFromStorage,
  persistAdvancedOptions,
} from "$lib/state/advanced-options.svelte";
import { isAdvancedMode, initAdvancedModeFromUrl } from "$lib/state/advanced-mode.svelte";
import { wasmReady } from "$lib/state/ui.svelte";
import { WATER_ID } from "$lib/state/entity-selection.svelte";
import { customCompounds, type StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";
import { decodeCalculatorUrl, decodeInverseModeFromUrl } from "$lib/utils/calculator-url";
import { decodeMultiProgramUrl } from "$lib/state/multi-program.svelte";
import { externalDataService } from "$lib/external-data/service";
import { setupCalculatorUrlSync } from "$lib/state/calculator-url-sync.svelte";
import { setupMultiProgramCalculation } from "$lib/state/multi-program-calc.svelte";
import { setupMultiEntityCalculation } from "$lib/state/multi-entity-calc.svelte";
import {
  setupInverseRangeCalculation,
  setupInverseStpCalculation,
} from "$lib/state/inverse-calc.svelte";
import { negotiateVersion } from "$lib/utils/url-version.js";
import { appInit } from "$lib/state/app-init.svelte";
import type { EntityId } from "$lib/external-data/types";
import { getService } from "$lib/wasm/loader";
import { parseExtRef } from "$lib/external-data/ids";

export class CalculatorPageOrchestrator {
  calcState = $state<CalculatorState | null>(null);
  energyRangeLabel = $state<string>("");
  urlVersionChecked = $state(false);
  urlInitialized = $state(false);
  advancedModeInitializedFromUrl = $state(false);
  urlVersionMismatch = $state<{ version: number | string } | null>(null);
  multiProgState = $state<MultiProgramState | null>(null);
  multiEntityState = $state<MultiEntityState | null>(null);
  inverseLookupState = $state<InverseLookupState | null>(null);
  sharedUrlCompound = $state<StoredCompoundInternal | null>(null);
  sharedUrlWarning = $state<string | null>(null);

  constructor() {
    this.setupEffects();
  }

  restoreCustomCompoundFromUrl(urlState: ReturnType<typeof decodeCalculatorUrl>) {
    this.sharedUrlWarning = urlState.fromUrlWarning ?? null;
    if (
      !urlState.materialIsCustom ||
      !urlState.matName ||
      urlState.matDensity === undefined ||
      !urlState.matElements?.length
    ) {
      return null;
    }

    const compound = customCompounds.addTransient({
      name: urlState.matName,
      density: urlState.matDensity,
      iValue: urlState.matIval,
      elements: urlState.matElements,
      phase: urlState.matPhase ?? "condensed",
    });
    this.sharedUrlCompound = compound;
    return compound;
  }

  setupEffects() {
    const orchestrator = this;

    // 1. Initial version negotiation & advanced mode check
    $effect(() => {
      if (wasmReady.value && !orchestrator.advancedModeInitializedFromUrl) {
        initAdvancedModeFromUrl(page.url.searchParams);
        orchestrator.advancedModeInitializedFromUrl = true;
      }

      if (!orchestrator.urlVersionChecked) {
        const urlvRaw = page.url.searchParams.get("urlv");
        const negotiationResult = negotiateVersion(urlvRaw);
        if (negotiationResult.status === "mismatch") {
          orchestrator.urlVersionMismatch = { version: negotiationResult.version };
        } else {
          orchestrator.urlVersionMismatch = null;
        }
        orchestrator.urlVersionChecked = true;
      }

      if (wasmReady.value && !appInit.isInitializing && !appInit.entityState && !appInit.error) {
        appInit.initialize(page.url.searchParams);
      }
    });

    // 2. Setup state from URL once appInit is ready
    $effect(() => {
      if (appInit.entityState && appInit.service && !orchestrator.calcState) {
        const currentSearchParams = page.url.searchParams;
        const urlState = decodeCalculatorUrl(currentSearchParams);
        const hasEnergies = currentSearchParams.has("energies");

        orchestrator.calcState = createCalculatorState(
          appInit.entityState,
          appInit.service,
          externalDataService,
        );
        orchestrator.inverseLookupState = createInverseLookupState(appInit.entityState);

        loadAdvancedOptionsFromStorage();

        const urlAdvOpts = urlState.advancedOptions;
        if (urlAdvOpts) {
          advancedOptions.value = urlAdvOpts;
        }

        if (urlState.particleId !== null) appInit.entityState.selectParticle(urlState.particleId);
        const customFromUrl = orchestrator.restoreCustomCompoundFromUrl(urlState);
        if (customFromUrl) {
          appInit.entityState.selectMaterial(customFromUrl.id);
        } else if (urlState.materialId !== null) {
          appInit.entityState.selectMaterial(urlState.materialId);
        }
        if (urlState.programId !== null) appInit.entityState.selectProgram(urlState.programId);

        if (urlState.isAdvancedMode && urlState.across) {
          if (urlState.across === "particle") {
            appInit.entityState.setAcross(urlState.across);
            if (urlState.selectedParticleIds) {
              const available = new Set(appInit.entityState.availableParticles.map((p) => p.id));
              const validIds = urlState.selectedParticleIds.filter((id) => available.has(id));
              if (validIds.length > 0) {
                appInit.entityState.setMultiParticle(validIds);
              }
            }
          } else if (urlState.across === "material" && urlState.selectedMaterialIds) {
            const available = new Set(appInit.entityState.availableMaterials.map((p) => p.id));
            const validIds = urlState.selectedMaterialIds.filter((id) => available.has(id));
            if (validIds.length > 0) {
              appInit.entityState.setAcross(urlState.across);
              appInit.entityState.setMultiMaterial(validIds);
            }
          }
        }

        orchestrator.calcState.setMasterUnit(urlState.masterUnit);

        if (hasEnergies) {
          urlState.rows.forEach((r, i) => {
            const text = r.unitFromSuffix ? `${r.rawInput} ${r.unit}` : r.rawInput;
            if (i === 0) {
              orchestrator.calcState!.updateRowText(0, text);
            } else {
              orchestrator.calcState!.addRow();
              orchestrator.calcState!.updateRowText(i, text);
            }
          });
        }

        const inverseMode = decodeInverseModeFromUrl(currentSearchParams);
        if (inverseMode && isAdvancedMode.value) {
          orchestrator.inverseLookupState!.setActiveTab(inverseMode.imode);
          if (inverseMode.lookups && inverseMode.lookups.length > 0) {
            orchestrator.inverseLookupState!.rangeRows.length = 0;
            orchestrator.inverseLookupState!.stpRows.length = 0;

            for (let i = 0; i < inverseMode.lookups.length; i++) {
              const ival = inverseMode.lookups[i]!;
              const text = ival.unitFromSuffix ? `${ival.rawInput} ${ival.unit}` : ival.rawInput;
              if (inverseMode.imode === "csda") {
                if (i === 0) {
                  orchestrator.inverseLookupState!.addRangeRow();
                  orchestrator.inverseLookupState!.updateRangeRowText(0, text);
                } else {
                  orchestrator.inverseLookupState!.addRangeRow();
                  orchestrator.inverseLookupState!.updateRangeRowText(i, text);
                }
              } else if (inverseMode.imode === "stp") {
                if (i === 0) {
                  orchestrator.inverseLookupState!.addStpRow();
                  orchestrator.inverseLookupState!.updateStpRowText(0, text);
                } else {
                  orchestrator.inverseLookupState!.addStpRow();
                  orchestrator.inverseLookupState!.updateStpRowText(i, text);
                }
              }
            }
          }
          if (inverseMode.imode === "csda" && inverseMode.iunit) {
            const validRangeUnits = ["nm", "um", "mm", "cm", "m"] as const;
            if (validRangeUnits.includes(inverseMode.iunit as any)) {
              orchestrator.inverseLookupState!.setRangeMasterUnit(inverseMode.iunit as any);
            }
          }
          if (inverseMode.imode === "stp" && inverseMode.iunit) {
            const validStpUnits = ["kev-um", "mev-cm", "mev-cm2-g"] as const;
            if (validStpUnits.includes(inverseMode.iunit as any)) {
              orchestrator.inverseLookupState!.setStpMasterUnit(inverseMode.iunit as any);
            }
          }
          if (inverseMode.imode === "stp" && urlState.istpBranchState) {
            orchestrator.inverseLookupState!.setStpBranchState(urlState.istpBranchState);
          }
        }

        orchestrator.urlInitialized = true;
      }
    });

    // 3. Handle mode switch fallback
    $effect(() => {
      const mode = isAdvancedMode.value;
      if (!mode && appInit.entityState?.selectedMaterial) {
        const matId = appInit.entityState.selectedMaterial.id;
        if (typeof matId === "string" && matId.startsWith("cc_")) {
          appInit.entityState.selectMaterial(WATER_ID);
        }
      }
    });

    // 4. Track advancedOptions nested changes
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
      void advOptsKey;
      persistAdvancedOptions();
    });

    $effect(() => {
      const _advOptsKey = advOptsKey;
      void _advOptsKey;
      if (orchestrator.urlVersionMismatch !== null) return;
      if (!orchestrator.calcState || !appInit.entityState?.isComplete) return;
      const isMultiProgramCompare =
        isAdvancedMode.value &&
        appInit.entityState.across === "program" &&
        (orchestrator.multiProgState?.selectedProgramIds.length ?? 0) > 1;
      const isMultiEntityCompare =
        isAdvancedMode.value &&
        (appInit.entityState.across === "material" || appInit.entityState.across === "particle");
      if (isMultiProgramCompare || isMultiEntityCompare) return;
      orchestrator.calcState.triggerCalculation();
    });

    // Delegated state synchronizations
    setupCalculatorUrlSync(
      () => orchestrator.calcState,
      () => appInit.entityState,
      () => orchestrator.inverseLookupState,
      () => orchestrator.multiProgState,
      () => orchestrator.urlInitialized,
      () => appInit.loadedExternalSources,
      () => advOptsKey,
    );

    setupMultiProgramCalculation(
      () => orchestrator.calcState,
      () => appInit.entityState,
      () => orchestrator.multiProgState,
      () => orchestrator.urlVersionMismatch,
      () => advOptsKey,
    );

    setupMultiEntityCalculation(
      () => orchestrator.calcState,
      () => appInit.entityState,
      () => orchestrator.multiEntityState,
      () => orchestrator.urlVersionMismatch,
      () => advOptsKey,
    );

    setupInverseRangeCalculation(
      () => orchestrator.calcState,
      () => appInit.entityState,
      () => orchestrator.inverseLookupState,
      () => orchestrator.urlVersionMismatch,
      () => advOptsKey,
    );

    setupInverseStpCalculation(
      () => orchestrator.calcState,
      () => appInit.entityState,
      () => orchestrator.inverseLookupState,
      () => orchestrator.urlVersionMismatch,
      () => advOptsKey,
    );

    // Energy range label
    $effect(() => {
      if (orchestrator.calcState && appInit.entityState?.isComplete) {
        const programId = appInit.entityState.resolvedProgramId;
        const particleId = appInit.entityState.selectedParticle?.id;
        if (programId !== null && particleId !== null) {
          if (typeof programId === "string") {
            const parsedProgram = parseExtRef(programId);
            if (!parsedProgram) {
              orchestrator.energyRangeLabel = "";
              return;
            }
            const { label } = parsedProgram;
            const meta = externalDataService.getMetadata(label);
            if (meta) {
              const grid = meta.energyGrid;
              const minE = grid[0] ?? 0;
              const maxE = grid[grid.length - 1] ?? 0;
              orchestrator.energyRangeLabel = `${minE.toLocaleString()} – ${maxE.toLocaleString()} ${meta.energyUnit} (external)`;
            } else {
              orchestrator.energyRangeLabel = "";
            }
            return;
          }

          const snapshot = { programId, particleId };
          let cancelled = false;
          getService().then((service) => {
            if (cancelled) return;
            if (
              snapshot.programId !== appInit.entityState?.resolvedProgramId ||
              snapshot.particleId !== appInit.entityState?.selectedParticle?.id
            ) {
              return;
            }
            const min = service.getMinEnergy(programId as number, particleId as number);
            const max = service.getMaxEnergy(programId as number, particleId as number);
            orchestrator.energyRangeLabel = `${min.toLocaleString()} – ${max.toLocaleString()} MeV/nucl`;
          });
          return () => {
            cancelled = true;
          };
        }
      }
    });

    // Tab fallback
    $effect(() => {
      if (
        !isAdvancedMode.value &&
        orchestrator.inverseLookupState &&
        orchestrator.inverseLookupState.activeTab !== "forward"
      ) {
        orchestrator.inverseLookupState.setActiveTab("forward");
      }
    });

    // Multi-program state sync
    $effect(() => {
      if (!isAdvancedMode.value || !appInit.entityState || !orchestrator.calcState) {
        orchestrator.multiProgState = null;
        return;
      }

      const newState = createMultiProgramState();
      newState.setAdvancedMode(true);

      const multiParams = decodeMultiProgramUrl(new URLSearchParams(window.location.search));

      const defaultProgramId = appInit.entityState.resolvedProgramId as EntityId | null;
      if (defaultProgramId !== null && defaultProgramId !== -1) {
        newState.addProgram(defaultProgramId);
      }

      if (multiParams.mode === "advanced" && multiParams.parsedProgramEntityIds) {
        const availableBuiltinIds = new Set(appInit.entityState.availablePrograms.map((p) => p.id));
        const availableExtIds = new Set(
          appInit.entityState.availableExternalPrograms.map((p) => p.id),
        );
        const validProgramIds = multiParams.parsedProgramEntityIds.filter((id) => {
          if (typeof id === "number") return availableBuiltinIds.has(id);
          if (typeof id === "string") return availableExtIds.has(id);
          return false;
        });

        for (const programId of validProgramIds) {
          if (programId !== defaultProgramId) {
            newState.addProgram(programId);
          }
        }

        if (validProgramIds.length > 0) {
          const defaultFirst =
            defaultProgramId !== null && defaultProgramId !== -1
              ? defaultProgramId
              : validProgramIds[0]!;
          const orderedIds: EntityId[] = [
            defaultFirst,
            ...validProgramIds.filter((id) => id !== defaultFirst),
          ];
          newState.setProgramDisplayOrder(orderedIds);
        }

        if (multiParams.qshow === "stp" || multiParams.qshow === "range") {
          newState.setQuantityFocus(multiParams.qshow);
        }
      }

      orchestrator.multiProgState = newState;

      untrack(() => {
        appInit.entityState!.setMultiProgram(newState.selectedProgramIds as (number | string)[]);
      });

      return () => {
        orchestrator.multiProgState = null;
      };
    });

    $effect(() => {
      if (!orchestrator.multiProgState || !appInit.entityState) return;

      const desired = appInit.entityState.multiSelected.program;
      if (desired.length === 0) return;

      const current = orchestrator.multiProgState.selectedProgramIds;

      for (const id of [...current]) {
        if (!desired.includes(id)) orchestrator.multiProgState.removeProgram(id as EntityId);
      }

      for (const id of desired) {
        if (!current.includes(id as EntityId))
          orchestrator.multiProgState.addProgram(id as EntityId);
      }
    });

    $effect(() => {
      if (!isAdvancedMode.value && appInit.entityState) {
        appInit.entityState.collapseToSingle();
      }
    });

    $effect(() => {
      if (!orchestrator.multiProgState || !appInit.entityState) return;

      const resolvedId = appInit.entityState.resolvedProgramId;
      if (resolvedId === null || resolvedId === -1) return;
      const defaultProgramId = resolvedId as EntityId;

      const currentDefault = orchestrator.multiProgState.selectedProgramIds[0];
      if (currentDefault !== defaultProgramId) {
        if (!orchestrator.multiProgState.selectedProgramIds.includes(defaultProgramId)) {
          orchestrator.multiProgState.addProgram(defaultProgramId);
        }
        orchestrator.multiProgState.setDefaultProgram(defaultProgramId);
      }
    });

    // Multi-entity state
    $effect(() => {
      const across = appInit.entityState?.across;
      if (
        !isAdvancedMode.value ||
        !appInit.entityState ||
        (across !== "material" && across !== "particle")
      ) {
        orchestrator.multiEntityState = null;
        return;
      }

      const dim = across;
      const state = createMultiEntityState(dim, (id) => {
        if (dim === "material") {
          const m =
            appInit.entityState?.allMaterials.find((x) => x.id === id) ??
            appInit.entityState?.externalOnlyMaterials.find((x) => x.id === id);
          return m?.name ?? String(id);
        }
        const p = appInit.entityState?.allParticles.find((x) => x.id === id);
        return p?.name ?? String(id);
      });
      orchestrator.multiEntityState = state;

      return () => {
        orchestrator.multiEntityState = null;
      };
    });
  }
}

export function createCalculatorPageOrchestrator() {
  return new CalculatorPageOrchestrator();
}
