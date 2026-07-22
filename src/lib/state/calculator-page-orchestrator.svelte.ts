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
  advancedOptionsSnapshot,
  loadAdvancedOptionsFromStorage,
  persistAdvancedOptions,
} from "$lib/state/advanced-options.svelte";
import { isAdvancedMode, initAdvancedModeFromUrl } from "$lib/state/advanced-mode.svelte";
import { stpOutputUnit } from "$lib/state/stp-unit.svelte";
import { tokenToStpUnit } from "$lib/utils/stp-unit-codec";
import { wasmReady } from "$lib/state/ui.svelte";
import { WATER_ID } from "$lib/state/entity-selection.svelte";
import { customCompounds } from "$lib/state/custom-compounds.svelte";
import { decodeCalculatorUrl, decodeInverseModeFromUrl } from "$lib/utils/calculator-url";
import { decodeMultiProgramUrl } from "$lib/state/multi-program.svelte";
import {
  createSharedCompoundFromUrl,
  type SharedCompoundFromUrl,
} from "$lib/state/shared-compound-from-url.svelte";
import { externalDataService } from "$lib/external-data/service";
import { setupCalculatorUrlSync } from "$lib/state/calculator-url-sync.svelte";
import { setupMultiProgramCalculation } from "$lib/state/multi-program-calc.svelte";
import { setupMultiEntityCalculation } from "$lib/state/multi-entity-calc.svelte";
import { setupInverseRangeCalculation } from "$lib/state/inverse-range-calc.svelte";
import { setupInverseStpCalculation } from "$lib/state/inverse-stp-calc.svelte";
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

  // Shared-compound-from-URL flow (banner + recovery editor, issue #648) lives in
  // its own module (issue #763). The orchestrator holds an instance and exposes
  // its surface via getters/delegating methods so the calculator page consumes it
  // unchanged through this orchestrator.
  sharedCompound: SharedCompoundFromUrl = createSharedCompoundFromUrl();

  // Structured, deep reactive view of all advanced options. Reading it registers
  // a dependency on EVERY option field (including nested + future ones) via
  // `$state.snapshot`'s deep traversal, replacing the old hand-maintained
  // `JSON.stringify([...])` change key. Threaded into the delegated calc/sync
  // effects so they recompute on any advanced-option change.
  advancedOptionsDep = $derived(advancedOptionsSnapshot());

  constructor() {
    this.setupEffects();
  }

  // --- Shared-compound-from-URL surface (delegated to `this.sharedCompound`) ---
  // Kept on the orchestrator so `calculator/+page.svelte` consumes it unchanged.
  // The flow itself lives in `shared-compound-from-url.svelte.ts` (issue #763).

  get sharedUrlCompound() {
    return this.sharedCompound.sharedUrlCompound;
  }
  get sharedUrlWarning() {
    return this.sharedCompound.sharedUrlWarning;
  }
  get sharedUrlPartial() {
    return this.sharedCompound.sharedUrlPartial;
  }
  get sharedUrlFromTransient() {
    return this.sharedCompound.sharedUrlFromTransient;
  }
  get compoundEditorOpen() {
    return this.sharedCompound.compoundEditorOpen;
  }
  get compoundEditorPrefill() {
    return this.sharedCompound.compoundEditorPrefill;
  }
  get compoundEditorWarning() {
    return this.sharedCompound.compoundEditorWarning;
  }

  restoreCustomCompoundFromUrl(urlState: ReturnType<typeof decodeCalculatorUrl>) {
    return this.sharedCompound.restoreCustomCompoundFromUrl(urlState);
  }
  openSharedCompoundEditor() {
    this.sharedCompound.openSharedCompoundEditor();
  }
  saveSharedCompoundCopy(data: Parameters<SharedCompoundFromUrl["saveSharedCompoundCopy"]>[0]) {
    this.sharedCompound.saveSharedCompoundCopy(data);
  }
  closeSharedCompoundEditor() {
    this.sharedCompound.closeSharedCompoundEditor();
  }
  saveSharedToLibrary() {
    this.sharedCompound.saveSharedToLibrary();
  }
  dismissSharedCompound() {
    this.sharedCompound.dismissSharedCompound();
  }

  setupEffects() {
    // The phases below are ordered. The only HARD ordering requirement is
    // Phase 1 → Phase 2: version negotiation sets `urlVersionMismatch`, which
    // Phase 2 reads to decide whether to hydrate from the URL or from defaults,
    // and Phase 1's `appInit.initialize()` produces the entityState/service that
    // Phase 2 waits for. The remaining phases are independent reactive guards
    // that converge to the same state regardless of declaration order.
    this.setupAppBootstrap();
    this.setupUrlHydration();
    this.setupAdvancedOptionsPersistence();
    this.setupAutoSelectEnergyHint();
    this.setupSingleEntityCalculation();
    this.setupDelegatedCalculations();
    this.setupModeFallbacks();
    this.setupEnergyRangeLabel();
    this.setupMultiProgramState();
    this.setupMultiEntityState();
  }

  /**
   * Phase 1 — bootstrap. Negotiate the URL version first so the result
   * (`urlVersionMismatch`) can gate hydration, then initialise advanced mode and
   * kick off `appInit` once WASM is ready.
   */
  private setupAppBootstrap() {
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
  }

  /**
   * Phase 2 — hydration. Once `appInit` has produced entityState + service, build
   * the calculator/inverse state from the URL (or from defaults when Phase 1
   * flagged an unsupported `urlVersionMismatch`).
   */
  private setupUrlHydration() {
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
            const validIds = urlState.selectedMaterialIds.filter((id) => available.has(id)) as (
              number | string
            )[];
            if (customFromUrl) {
              // The custom compound was stripped from the plural URL param; restore it as the primary/first item
              validIds.unshift(customFromUrl.id);
            }
            if (validIds.length > 0) {
              appInit.entityState.setAcross(urlState.across);
              appInit.entityState.setMultiMaterial(validIds);
            }
          } else if (urlState.across === "program") {
            appInit.entityState.setAcross(urlState.across);
          }
        }

        this.calcState.setMasterUnit(urlState.masterUnit);

        // Restore the stopping-power output unit from the URL (`sunit=`).
        // An explicit but invalid token falls back to the default; an absent
        // parameter leaves the shared override unset so the aggregate-state default wins.
        if (currentSearchParams.has("sunit")) {
          stpOutputUnit.set(tokenToStpUnit(urlState.sunit ?? ""));
        } else {
          stpOutputUnit.set(null);
        }

        if (hasEnergies) {
          // Pass autoAdd=false so a single-energy link restores exactly one row
          // (the Basic hero layout) instead of appending a trailing empty row
          // that would flip it into the multi-row table (#823 feedback).
          // In Basic mode, Add Row is unavailable (#840) — only row 0 is
          // restored and any extra values in the link are dropped.
          urlState.rows.forEach((r, i) => {
            if (i > 0 && !isAdvancedMode.value) return;
            const text = r.unitFromSuffix ? `${r.rawInput} ${r.unit}` : r.rawInput;
            if (i === 0) {
              this.calcState!.updateRowText(0, text, false);
            } else {
              this.calcState!.addRow();
              this.calcState!.updateRowText(i, text, false);
            }
          });
        }

        // The active Energy→/Range→/STP→ tab and its row(s) are shared between
        // Basic and Advanced (#840) — restored regardless of mode.
        const inverseMode = decodeInverseModeFromUrl(currentSearchParams);
        if (inverseMode) {
          this.inverseLookupState!.setActiveTab(inverseMode.imode);
          if (inverseMode.lookups && inverseMode.lookups.length > 0) {
            // Only clear the array for the active imode — the other tab's
            // array keeps its default single empty row. (Clearing both
            // unconditionally left the inactive tab with zero rows and no
            // way to recover in Basic mode, which has no Add Row button.)
            if (inverseMode.imode === "csda") {
              this.inverseLookupState!.rangeRows.length = 0;
            } else {
              this.inverseLookupState!.stpRows.length = 0;
            }

            // Basic mode has no Add Row (#840) — only the first lookup value
            // is restored, extras are dropped.
            const lookupCount = isAdvancedMode.value ? inverseMode.lookups.length : 1;
            for (let i = 0; i < lookupCount; i++) {
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
  }

  /**
   * Phase 3a — persist advanced options on any change.
   *
   * Reading the deep snapshot registers a dependency on every option field
   * (including nested + future ones), so persistence fires for any change with no
   * hand-maintained field list and no `void advOptsKey` boilerplate.
   */
  private setupAdvancedOptionsPersistence() {
    $effect(() => {
      if (!browser) return;
      advancedOptionsSnapshot();
      persistAdvancedOptions();
    });
  }

  /**
   * Feed Auto-select the first row's parsed energy so it can skip chain
   * candidates whose tabulated range excludes it (issue #871) instead of
   * committing to a program before any energy is known. Reads
   * `calcState.rows[0]` directly (parsed from raw text, independent of the
   * resolved program) rather than `resolvedProgramId`, avoiding a cycle.
   */
  private setupAutoSelectEnergyHint() {
    $effect(() => {
      if (!appInit.entityState || !this.calcState) return;
      const firstRow = this.calcState.rows[0];
      const energy =
        typeof firstRow?.normalizedMevNucl === "number" ? firstRow.normalizedMevNucl : null;
      appInit.entityState.setAutoSelectEnergyHint(energy);
    });
  }

  /**
   * Phase 3b — recompute the single-entity result. Skipped while a multi-program
   * or multi-entity comparison is active (those have their own delegated effects).
   */
  private setupSingleEntityCalculation() {
    $effect(() => {
      // Re-run on any advanced-option change (deep reactive read).
      advancedOptionsSnapshot();
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
  }

  /**
   * Delegated per-feature calculation + URL-sync effects (extracted helpers).
   * Each receives `() => this.advancedOptionsDep` so it recomputes on any
   * advanced-option change without re-enumerating fields.
   */
  private setupDelegatedCalculations() {
    setupCalculatorUrlSync(
      () => this.calcState,
      () => appInit.entityState,
      () => this.inverseLookupState,
      () => this.multiProgState,
      () => this.urlInitialized,
      () => appInit.loadedExternalSources,
      () => this.advancedOptionsDep,
    );

    setupMultiProgramCalculation(
      () => this.calcState,
      () => appInit.entityState,
      () => this.multiProgState,
      () => this.urlVersionMismatch,
      () => this.advancedOptionsDep,
    );

    setupMultiEntityCalculation(
      () => this.calcState,
      () => appInit.entityState,
      () => this.multiEntityState,
      () => this.urlVersionMismatch,
      () => this.advancedOptionsDep,
    );

    setupInverseRangeCalculation(
      () => this.calcState,
      () => appInit.entityState,
      () => this.inverseLookupState,
      () => this.urlVersionMismatch,
      () => this.advancedOptionsDep,
    );

    setupInverseStpCalculation(
      () => this.calcState,
      () => appInit.entityState,
      () => this.inverseLookupState,
      () => this.urlVersionMismatch,
      () => this.advancedOptionsDep,
    );
  }

  /**
   * Mode-dependent fallbacks. Leaving advanced mode must: drop custom-compound
   * material selections (advanced-only), collapse any multi-entity selection
   * back to a single entity, and reset the program to Auto-select (Basic mode
   * always auto-selects, #816). The active Energy→/Range→/STP→ tab is shared
   * between Basic and Advanced (#840) and is deliberately not reset here.
   */
  private setupModeFallbacks() {
    $effect(() => {
      const mode = isAdvancedMode.value;
      if (!mode && appInit.entityState?.selectedMaterial) {
        const matId = appInit.entityState.selectedMaterial.id;
        if (typeof matId === "string" && matId.startsWith("cc_")) {
          appInit.entityState.selectMaterial(WATER_ID);
        }
      }
    });

    // Basic mode has no program selector — it always uses Auto-select (#816).
    // Discard any program the user pinned in Advanced mode so a
    // Basic → Advanced → Basic round-trip returns to auto rather than silently
    // keeping a hidden explicit choice. Tracks only the mode + state identity,
    // so it fires on the mode switch (and first load), not on every selection.
    $effect(() => {
      if (!isAdvancedMode.value) {
        appInit.entityState?.selectProgram(-1); // -1 = Auto-select
      }
    });

    $effect(() => {
      if (!isAdvancedMode.value && appInit.entityState) {
        appInit.entityState.collapseToSingle();
      }
    });
  }

  /**
   * Energy-range label for the active program/particle. Built-in programs read
   * the WASM min/max energy asynchronously; external programs use store metadata.
   */
  private setupEnergyRangeLabel() {
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
  }

  /**
   * Multi-program comparison state lifecycle: create/dispose `multiProgState`
   * with advanced mode + the program dimension, hydrate it from the URL, and keep
   * it in sync with the entity-selection's multi-program list and default program.
   */
  private setupMultiProgramState() {
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
          if (typeof id === "string") {
            // Keep syntactically valid external IDs from URL even before external
            // compatibility availability finishes populating after reload.
            return availableExtIds.has(id) || parseExtRef(id) !== null;
          }
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
  }

  /**
   * Multi-entity comparison state lifecycle: create/dispose `multiEntityState`
   * for the active material/particle dimension while in advanced mode.
   */
  private setupMultiEntityState() {
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
