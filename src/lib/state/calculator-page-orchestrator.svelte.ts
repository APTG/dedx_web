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
    // Removed this alias

    // 1. Initial version negotiation & advanced mode check
    $effect(() => {
      // Negotiate the URL version first so the result can gate hydration below.
      if (!this.urlVersionChecked) {
        const urlvRaw = page.url.searchParams.get("urlv");
        const negotiationResult = negotiateVersion(urlvRaw);
        if (negotiationResult.status === "mismatch") {
          this.urlVersionMismatch = { version: negotiationResult.version };
        } else {
          this.urlVersionMismatch = null;
        }
        this.urlVersionChecked = true;
      }

      // "Rejected, not migrated": an unsupported version hydrates nothing from
      // the link. Initialize from defaults (empty params) and show the banner;
      // "Load defaults" then clears the mismatch and the calc proceeds.
      const sourceParams = this.urlVersionMismatch ? new URLSearchParams() : page.url.searchParams;

      if (wasmReady.value && !this.advancedModeInitializedFromUrl) {
        initAdvancedModeFromUrl(sourceParams);
        this.advancedModeInitializedFromUrl = true;
      }

      if (wasmReady.value && !appInit.isInitializing && !appInit.entityState && !appInit.error) {
        appInit.initialize(sourceParams);
      }
    });

    // 2. Setup state from URL once appInit is ready
    $effect(() => {
      if (appInit.entityState && appInit.service && !this.calcState) {
        // Gate hydration on the version negotiation: an unsupported link
        // decodes nothing, leaving the calculator at its defaults.
        const currentSearchParams = this.urlVersionMismatch
          ? new URLSearchParams()
          : page.url.searchParams;
        const urlState = decodeCalculatorUrl(currentSearchParams);
        const hasEnergies = currentSearchParams.has("energies");

        this.calcState = createCalculatorState(
          appInit.entityState,
          appInit.service,
          externalDataService,
        );
        this.inverseLookupState = createInverseLookupState(appInit.entityState);

        loadAdvancedOptionsFromStorage();

        const urlAdvOpts = urlState.advancedOptions;
        if (urlAdvOpts) {
          advancedOptions.value = urlAdvOpts;
        }

        if (urlState.particleId !== null) appInit.entityState.selectParticle(urlState.particleId);
        const customFromUrl = this.restoreCustomCompoundFromUrl(urlState);
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

        this.calcState.setMasterUnit(urlState.masterUnit);

        if (hasEnergies) {
          urlState.rows.forEach((r, i) => {
            const text = r.unitFromSuffix ? `${r.rawInput} ${r.unit}` : r.rawInput;
            if (i === 0) {
              this.calcState!.updateRowText(0, text);
            } else {
              this.calcState!.addRow();
              this.calcState!.updateRowText(i, text);
            }
          });
        }

        const inverseMode = decodeInverseModeFromUrl(currentSearchParams);
        if (inverseMode && isAdvancedMode.value) {
          this.inverseLookupState!.setActiveTab(inverseMode.imode);
          if (inverseMode.lookups && inverseMode.lookups.length > 0) {
            this.inverseLookupState!.rangeRows.length = 0;
            this.inverseLookupState!.stpRows.length = 0;

            for (let i = 0; i < inverseMode.lookups.length; i++) {
              const ival = inverseMode.lookups[i]!;
              const text = ival.unitFromSuffix ? `${ival.rawInput} ${ival.unit}` : ival.rawInput;
              if (inverseMode.imode === "csda") {
                if (i === 0) {
                  this.inverseLookupState!.addRangeRow();
                  this.inverseLookupState!.updateRangeRowText(0, text);
                } else {
                  this.inverseLookupState!.addRangeRow();
                  this.inverseLookupState!.updateRangeRowText(i, text);
                }
              } else if (inverseMode.imode === "stp") {
                if (i === 0) {
                  this.inverseLookupState!.addStpRow();
                  this.inverseLookupState!.updateStpRowText(0, text);
                } else {
                  this.inverseLookupState!.addStpRow();
                  this.inverseLookupState!.updateStpRowText(i, text);
                }
              }
            }
          }
          if (inverseMode.imode === "csda" && inverseMode.iunit) {
            const validRangeUnits = ["nm", "um", "mm", "cm", "m"] as const;
            if (validRangeUnits.includes(inverseMode.iunit as any)) {
              this.inverseLookupState!.setRangeMasterUnit(inverseMode.iunit as any);
            }
          }
          if (inverseMode.imode === "stp" && inverseMode.iunit) {
            const validStpUnits = ["kev-um", "mev-cm", "mev-cm2-g"] as const;
            if (validStpUnits.includes(inverseMode.iunit as any)) {
              this.inverseLookupState!.setStpMasterUnit(inverseMode.iunit as any);
            }
          }
          if (inverseMode.imode === "stp" && urlState.istpBranchState) {
            this.inverseLookupState!.setStpBranchState(urlState.istpBranchState);
          }
        }

        this.urlInitialized = true;
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
      if (this.urlVersionMismatch !== null) return;
      if (!this.calcState || !appInit.entityState?.isComplete) return;
      const isMultiProgramCompare =
        isAdvancedMode.value &&
        appInit.entityState.across === "program" &&
        (this.multiProgState?.selectedProgramIds.length ?? 0) > 1;
      const isMultiEntityCompare =
        isAdvancedMode.value &&
        (appInit.entityState.across === "material" || appInit.entityState.across === "particle");
      if (isMultiProgramCompare || isMultiEntityCompare) return;
      this.calcState.triggerCalculation();
    });

    // Delegated state synchronizations
    setupCalculatorUrlSync(
      () => this.calcState,
      () => appInit.entityState,
      () => this.inverseLookupState,
      () => this.multiProgState,
      () => this.urlInitialized,
      () => appInit.loadedExternalSources,
      () => advOptsKey,
    );

    setupMultiProgramCalculation(
      () => this.calcState,
      () => appInit.entityState,
      () => this.multiProgState,
      () => this.urlVersionMismatch,
      () => advOptsKey,
    );

    setupMultiEntityCalculation(
      () => this.calcState,
      () => appInit.entityState,
      () => this.multiEntityState,
      () => this.urlVersionMismatch,
      () => advOptsKey,
    );

    setupInverseRangeCalculation(
      () => this.calcState,
      () => appInit.entityState,
      () => this.inverseLookupState,
      () => this.urlVersionMismatch,
      () => advOptsKey,
    );

    setupInverseStpCalculation(
      () => this.calcState,
      () => appInit.entityState,
      () => this.inverseLookupState,
      () => this.urlVersionMismatch,
      () => advOptsKey,
    );

    // Energy range label
    $effect(() => {
      if (this.calcState && appInit.entityState?.isComplete) {
        const programId = appInit.entityState.resolvedProgramId;
        const particleId = appInit.entityState.selectedParticle?.id;
        if (programId !== null && particleId !== null) {
          if (typeof programId === "string") {
            const parsedProgram = parseExtRef(programId);
            if (!parsedProgram) {
              this.energyRangeLabel = "";
              return;
            }
            const { label } = parsedProgram;
            const meta = externalDataService.getMetadata(label);
            if (meta) {
              const grid = meta.energyGrid;
              const minE = grid[0] ?? 0;
              const maxE = grid[grid.length - 1] ?? 0;
              this.energyRangeLabel = `${minE.toLocaleString()} – ${maxE.toLocaleString()} ${meta.energyUnit} (external)`;
            } else {
              this.energyRangeLabel = "";
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
            this.energyRangeLabel = `${min.toLocaleString()} – ${max.toLocaleString()} MeV/nucl`;
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
        this.inverseLookupState &&
        this.inverseLookupState.activeTab !== "forward"
      ) {
        this.inverseLookupState.setActiveTab("forward");
      }
    });

    // Multi-program state sync
    $effect(() => {
      if (!isAdvancedMode.value || !appInit.entityState || !this.calcState) {
        this.multiProgState = null;
        return;
      }

      const newState = createMultiProgramState();
      newState.setAdvancedMode(true);

      // Advanced mode can be active via the persisted preference even on an
      // unsupported link, so gate this decode too — hydrate nothing from it.
      const multiParams = decodeMultiProgramUrl(
        this.urlVersionMismatch
          ? new URLSearchParams()
          : new URLSearchParams(window.location.search),
      );

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

      this.multiProgState = newState;

      untrack(() => {
        appInit.entityState!.setMultiProgram(newState.selectedProgramIds as (number | string)[]);
      });

      return () => {
        this.multiProgState = null;
      };
    });

    $effect(() => {
      if (!this.multiProgState || !appInit.entityState) return;

      const desired = appInit.entityState.multiSelected.program;
      if (desired.length === 0) return;

      const current = this.multiProgState.selectedProgramIds;

      for (const id of [...current]) {
        if (!desired.includes(id)) this.multiProgState.removeProgram(id as EntityId);
      }

      for (const id of desired) {
        if (!current.includes(id as EntityId)) this.multiProgState.addProgram(id as EntityId);
      }
    });

    $effect(() => {
      if (!isAdvancedMode.value && appInit.entityState) {
        appInit.entityState.collapseToSingle();
      }
    });

    $effect(() => {
      if (!this.multiProgState || !appInit.entityState) return;

      const resolvedId = appInit.entityState.resolvedProgramId;
      if (resolvedId === null || resolvedId === -1) return;
      const defaultProgramId = resolvedId as EntityId;

      const currentDefault = this.multiProgState.selectedProgramIds[0];
      if (currentDefault !== defaultProgramId) {
        if (!this.multiProgState.selectedProgramIds.includes(defaultProgramId)) {
          this.multiProgState.addProgram(defaultProgramId);
        }
        this.multiProgState.setDefaultProgram(defaultProgramId);
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
        this.multiEntityState = null;
        return;
      }

      const dim = across;
      const state = createMultiEntityState(dim, (id) => {
        if (dim === "material") {
          const m =
            appInit.entityState?.allMaterials.find((x) => x.id === id) ??
            appInit.entityState?.externalOnlyMaterials.find((x) => x.id === id);
          if (m) return m.name;
          const cc = customCompounds.getById(String(id));
          if (cc) return cc.name;
          return String(id);
        }
        const p = appInit.entityState?.allParticles.find((x) => x.id === id);
        return p?.name ?? String(id);
      });
      this.multiEntityState = state;

      return () => {
        this.multiEntityState = null;
      };
    });
  }
}

export function createCalculatorPageOrchestrator() {
  return new CalculatorPageOrchestrator();
}
