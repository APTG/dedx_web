<script lang="ts">
  import { browser } from "$app/environment";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { isAdvancedMode, initAdvancedModeFromUrl } from "$lib/state/advanced-mode.svelte";
  import {
    createEntitySelectionState,
    type EntitySelectionState,
    type AutoSelectProgram,
    WATER_ID,
  } from "$lib/state/entity-selection.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import { createCalculatorState, type CalculatorState } from "$lib/state/calculator.svelte";
  import { createMultiProgramState, type MultiProgramState } from "$lib/state/multi-program.svelte";
  import { createMultiEntityState, type MultiEntityState } from "$lib/state/multi-entity.svelte";
  import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
  import EntitySelection from "$lib/components/entity-selection/entity-selection.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import ResultTable from "$lib/components/result-table.svelte";
  import TableBasic from "$lib/components/results/table-basic.svelte";
  import EnergyUnitSelector from "$lib/components/energy-unit-selector.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { getService } from "$lib/wasm/loader";
  import { getAvailableEnergyUnits } from "$lib/utils/available-units";
  import {
    customMaterialElementsForWasm,
    customMaterialUrlFields,
    isCustomMaterial,
  } from "$lib/utils/custom-compound-material";
  import { customCompounds, type StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";
  import { page } from "$app/state";
  import { replaceState } from "$app/navigation";
  import { untrack } from "svelte";
  import {
    decodeCalculatorUrl,
    calculatorUrlQueryString,
    decodeInverseModeFromUrl,
    type InverseModeUrlState,
  } from "$lib/utils/calculator-url";
  import { decodeMultiProgramUrl } from "$lib/state/multi-program.svelte";
  import { initExportState } from "$lib/state/export.svelte";
  import {
    advancedOptions,
    loadAdvancedOptionsFromStorage,
    persistAdvancedOptions,
  } from "$lib/state/advanced-options.svelte";
  import {
    createInverseLookupState,
    type InverseLookupState,
  } from "$lib/state/inverse-lookups.svelte";
  import { LibdedxError, type InverseCsdaResult } from "$lib/wasm/types";
  import { negotiateVersion } from "$lib/utils/url-version.js";
  import UrlVersionWarningBanner from "$lib/components/url-version-warning-banner.svelte";
  import ExternalSourcesPanel from "$lib/components/entity-selection/external-sources-panel.svelte";
  import LoadExternalModal from "$lib/components/entity-selection/load-external-modal.svelte";
  import { goto } from "$app/navigation";
  import { externalDataService } from "$lib/external-data/service";
  import type { ExternalDataError } from "$lib/external-data/errors";
  import { buildExternalCompatibilityContext } from "$lib/state/external-compatibility";
  import type { ExternalCompatibilityContext } from "$lib/state/external-compatibility";
  import type { ExternalSourceDescriptor, EntityId, ExtRef } from "$lib/external-data/types";
  import type { ExternalStoreMetadata } from "$lib/external-data/schema";
  import { parseExtdataParams } from "$lib/external-data/url";
  import type { CompatibilityMatrix } from "$lib/wasm/types";
  import { parseExtRef } from "$lib/external-data/ids";
  import type { CalculationResult } from "$lib/wasm/types";

  let entityState = $state<EntitySelectionState | null>(null);
  let calcState = $state<CalculatorState | null>(null);
  let energyRangeLabel = $state<string>("");
  let urlVersionChecked = $state(false);
  let urlInitialized = $state(false);
  let advancedModeInitializedFromUrl = $state(false);
  let urlVersionMismatch = $state<{ version: number | string } | null>(null);
  let multiProgState = $state<MultiProgramState | null>(null);
  let multiEntityState = $state<MultiEntityState | null>(null);
  let inverseLookupState = $state<InverseLookupState | null>(null);
  let sharedUrlCompound = $state<StoredCompoundInternal | null>(null);
  let sharedUrlWarning = $state<string | null>(null);

  // External data state
  let externalLoading = $state(false);
  let externalError = $state<ExternalDataError | null>(null);
  let loadedExternalSources = $state<ExternalSourceDescriptor[]>([]);
  let compatibilityMatrix = $state<CompatibilityMatrix | null>(null);
  let showLoadExternalModal = $state(false);

  /**
   * After external-source add/remove, reset now-invalid selections to safe fallbacks.
   * Fallback order: Auto-select for program, first available particle, Water (if
   * present) then first available material.
   */
  function reconcileSelectionAfterExternalContextChange(state: EntitySelectionState): void {
    const selectedProgramId = state.selectedProgram.id;
    const availableProgramIds = new Set([
      ...state.availablePrograms.map((program) => program.id),
      ...state.availableExternalPrograms.map((program) => program.id),
    ]);
    if (!availableProgramIds.has(selectedProgramId)) {
      state.selectProgram(-1);
    }

    const selectedParticleId = state.selectedParticle?.id ?? null;
    const availableParticleIds = new Set(state.availableParticles.map((particle) => particle.id));
    if (selectedParticleId !== null && !availableParticleIds.has(selectedParticleId)) {
      state.selectParticle(state.availableParticles[0]?.id ?? null);
    }

    const selectedMaterialId = state.selectedMaterial?.id ?? null;
    const availableMaterialIds = new Set(state.availableMaterials.map((material) => material.id));
    if (selectedMaterialId !== null && !availableMaterialIds.has(selectedMaterialId)) {
      const fallbackMaterial =
        state.availableMaterials.find((material) => material.id === WATER_ID)?.id ??
        state.availableMaterials[0]?.id ??
        null;
      state.selectMaterial(fallbackMaterial);
    }
  }

  function handleRemoveExternalSource(label: string): void {
    loadedExternalSources = loadedExternalSources.filter((s) => s.label !== label);
    // Rebuild external context without the removed source
    if (entityState && compatibilityMatrix) {
      const remaining = loadedExternalSources
        .map((s) => externalDataService.getMetadata(s.label))
        .filter((m): m is ExternalStoreMetadata => m !== undefined);
      const extCtx = buildExternalCompatibilityContext(
        remaining,
        compatibilityMatrix.allParticles,
        compatibilityMatrix.allMaterials,
      );
      entityState.setExternalContext(extCtx);
      reconcileSelectionAfterExternalContextChange(entityState);
    }
  }

  async function handleModalLoad(
    descriptor: ExternalSourceDescriptor,
    metadata: ExternalStoreMetadata,
  ) {
    showLoadExternalModal = false;
    if (!entityState || !compatibilityMatrix) return;

    // Append new source and rebuild the external compatibility context
    loadedExternalSources = [...loadedExternalSources, descriptor];
    const allMetadata = loadedExternalSources
      .map((s) => externalDataService.getMetadata(s.label))
      .filter((m): m is ExternalStoreMetadata => m !== undefined);
    // Ensure the newly loaded metadata is included (it may not be in cache yet if FSDH)
    const merged = allMetadata.some((m) => m.label === metadata.label)
      ? allMetadata
      : [...allMetadata, metadata];
    const extCtx = buildExternalCompatibilityContext(
      merged,
      compatibilityMatrix.allParticles,
      compatibilityMatrix.allMaterials,
    );
    entityState.setExternalContext(extCtx);
    reconcileSelectionAfterExternalContextChange(entityState);
  }

  function restoreCustomCompoundFromUrl(urlState: ReturnType<typeof decodeCalculatorUrl>) {
    sharedUrlWarning = urlState.fromUrlWarning ?? null;
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
    sharedUrlCompound = compound;
    return compound;
  }

  function saveSharedUrlCompound() {
    if (!sharedUrlCompound || !entityState) return;
    const result = customCompounds.create({
      name: sharedUrlCompound.name,
      density: sharedUrlCompound.density,
      iValue: sharedUrlCompound.iValue,
      elements: sharedUrlCompound.elements,
      phase: sharedUrlCompound.phase,
    });
    if (result.success) {
      customCompounds.removeTransient(sharedUrlCompound.id);
      entityState.selectMaterial(result.compound.id);
      sharedUrlCompound = null;
    }
  }

  function dismissSharedUrlCompound() {
    sharedUrlCompound = null;
    sharedUrlWarning = null;
  }

  function handleLoadDefaults() {
    // Navigate to /calculator without params to clear the mismatch URL
    goto("/calculator", { replaceState: true });
    urlVersionMismatch = null;
  }

  $effect(() => {
    // Initialize advanced mode from URL IMMEDIATELY when WASM is ready, before the
    // async getService() callback runs. This ensures the tabs render correctly when
    // the page loads with ?advanced=1 — otherwise the component renders with
    // isAdvancedMode.value = false and there's a reactivity glitch when it later
    // becomes true inside the async callback.
    if (wasmReady.value && !advancedModeInitializedFromUrl) {
      initAdvancedModeFromUrl(page.url.searchParams);
      advancedModeInitializedFromUrl = true;
    }

    // Negotiate URL version IMMEDIATELY (before WASM is ready) — this should show
    // the banner even if WASM fails to load
    if (!urlVersionChecked) {
      const urlvRaw = page.url.searchParams.get("urlv");
      const negotiationResult = negotiateVersion(urlvRaw);
      if (negotiationResult.status === "mismatch") {
        urlVersionMismatch = { version: negotiationResult.version };
      } else {
        urlVersionMismatch = null;
      }
      urlVersionChecked = true;
    }

    if (wasmReady.value && !entityState && !calcState) {
      // Snapshot URL params synchronously before async work (constraint: must snapshot before await)
      const currentSearchParams = page.url.searchParams;
      const extdataResult = parseExtdataParams(currentSearchParams);
      const extSources = extdataResult.sources;
      const urlState = decodeCalculatorUrl(currentSearchParams);
      const hasEnergies = currentSearchParams.has("energies");

      externalLoading = extSources.length > 0;

      Promise.all([
        getService(),
        Promise.all(extSources.map((s) => externalDataService.loadSource(s))),
      ])
        .then(([service, extMetadatas]) => {
          externalLoading = false;
          externalError = null;
          loadedExternalSources = extSources;

          const matrix = buildCompatibilityMatrix(service);
          compatibilityMatrix = matrix;
          const extCtx = buildExternalCompatibilityContext(
            extMetadatas,
            matrix.allParticles,
            matrix.allMaterials,
          );

          entityState = createEntitySelectionState(matrix);
          entityState.setExternalContext(extCtx);
          calcState = createCalculatorState(entityState, service, externalDataService);
          inverseLookupState = createInverseLookupState(entityState);

          // Load advanced options from localStorage first
          loadAdvancedOptionsFromStorage();

          // Restore advanced options from URL (URL takes priority over localStorage)
          const urlAdvOpts = urlState.advancedOptions;
          if (urlAdvOpts) {
            advancedOptions.value = urlAdvOpts;
          }

          // Select particle/material/program FIRST before initializing rows
          if (urlState.particleId !== null) entityState.selectParticle(urlState.particleId);
          const customFromUrl = restoreCustomCompoundFromUrl(urlState);
          if (customFromUrl) {
            entityState.selectMaterial(customFromUrl.id);
          } else if (urlState.materialId !== null) {
            entityState.selectMaterial(urlState.materialId);
          }
          if (urlState.programId !== null) entityState.selectProgram(urlState.programId);
          calcState.setMasterUnit(urlState.masterUnit);
          if (hasEnergies) {
            urlState.rows.forEach((r, i) => {
              const text = r.unitFromSuffix ? `${r.rawInput} ${r.unit}` : r.rawInput;
              if (i === 0) {
                calcState!.updateRowText(0, text);
              } else {
                calcState!.addRow();
                calcState!.updateRowText(i, text);
              }
            });
          }

          // Restore inverse lookup mode from URL (AFTER particle/material selected)
          const inverseMode = decodeInverseModeFromUrl(currentSearchParams);
          if (inverseMode && isAdvancedMode.value) {
            inverseLookupState!.setActiveTab(inverseMode.imode);
            if (inverseMode.lookups && inverseMode.lookups.length > 0) {
              inverseLookupState!.rangeRows.length = 0;
              inverseLookupState!.stpRows.length = 0;

              for (let i = 0; i < inverseMode.lookups.length; i++) {
                const ival = inverseMode.lookups[i]!;
                const text = ival.unitFromSuffix ? `${ival.rawInput} ${ival.unit}` : ival.rawInput;
                if (inverseMode.imode === "csda") {
                  if (i === 0) {
                    inverseLookupState!.addRangeRow();
                    inverseLookupState!.updateRangeRowText(0, text);
                  } else {
                    inverseLookupState!.addRangeRow();
                    inverseLookupState!.updateRangeRowText(i, text);
                  }
                } else if (inverseMode.imode === "stp") {
                  if (i === 0) {
                    inverseLookupState!.addStpRow();
                    inverseLookupState!.updateStpRowText(0, text);
                  } else {
                    inverseLookupState!.addStpRow();
                    inverseLookupState!.updateStpRowText(i, text);
                  }
                }
              }
            }
            // Set master unit for Range (CSDA) mode
            if (inverseMode.imode === "csda" && inverseMode.iunit) {
              const validRangeUnits = ["nm", "um", "mm", "cm", "m"] as const;
              if (validRangeUnits.includes(inverseMode.iunit as (typeof validRangeUnits)[number])) {
                inverseLookupState!.setRangeMasterUnit(
                  inverseMode.iunit as (typeof validRangeUnits)[number],
                );
              }
            }
            // Set master unit for STP mode
            if (inverseMode.imode === "stp" && inverseMode.iunit) {
              const validStpUnits = ["kev-um", "mev-cm", "mev-cm2-g"] as const;
              if (validStpUnits.includes(inverseMode.iunit as (typeof validStpUnits)[number])) {
                inverseLookupState!.setStpMasterUnit(
                  inverseMode.iunit as (typeof validStpUnits)[number],
                );
              }
            }
          }

          urlInitialized = true;
        })
        .catch((err: unknown) => {
          externalLoading = false;
          externalError = err as ExternalDataError;
        });
    }
  });

  // Handle mode switch fallback: custom compound → water when switching to Basic mode
  $effect(() => {
    const mode = isAdvancedMode.value;
    if (!mode && entityState?.selectedMaterial) {
      const matId = entityState.selectedMaterial.id;
      if (typeof matId === "string" && matId.startsWith("cc_")) {
        entityState.selectMaterial(WATER_ID);
      }
    }
  });

  // $derived signal to track nested advancedOptions changes
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

  // Persist advanced options to localStorage whenever they change
  $effect(() => {
    if (!browser) return;
    // Read advOptsKey to track nested changes
    void advOptsKey;
    persistAdvancedOptions();
  });

  // Retrigger single-program calculation when advanced options change (basic mode).
  // Advanced mode uses its own calculation effect below (multi-program calculateMulti).
  $effect(() => {
    // Read advOptsKey to register reactive dep on all advanced option fields.
    const _advOptsKey = advOptsKey;
    void _advOptsKey;
    // Block calculation while URL version mismatch is pending
    if (urlVersionMismatch !== null) return;
    if (!calcState || !entityState?.isComplete || isAdvancedMode.value) return;
    calcState.triggerCalculation();
  });

  $effect(() => {
    // Read advOptsKey to establish reactive dependency on nested changes
    const _advOptsKey = advOptsKey;
    void _advOptsKey;

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
          ivalues: inverseLookupState.rangeRows
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
          ivalues: inverseLookupState.stpRows
            .filter((r) => r.text.trim() !== "")
            .map((r) => ({
              rawInput: r.text.trim(),
              unit: r.unit,
              unitFromSuffix: false, // STP doesn't use inline suffix detection
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
      ...(activeMultiProgramState
        ? {
            isAdvancedMode: true,
            // Emit ALL selected programs in display order (default program first)
            // so the URL is the canonical full list and consumers can reconstruct
            // the complete comparison without needing to infer the default.
            selectedProgramIds: activeMultiProgramState.selectedProgramIds,
            hiddenProgramIds: activeMultiProgramState.selectedProgramIds.filter(
              (id) => activeMultiProgramState.columnVisibility.get(id) === false,
            ),
            quantityFocus: activeMultiProgramState.quantityFocus,
            // Include advanced options when in advanced mode
            advancedOptions: advancedOptions.value,
            materialIsGas: builtinMaterial?.isGasByDefault,
          }
        : {}),
      // Include inverse mode state when active
      ...(inverseModeState || {}),
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

  $effect(() => {
    if (calcState && entityState?.isComplete) {
      const programId = entityState.resolvedProgramId;
      const particleId = entityState.selectedParticle?.id;
      if (programId !== null && particleId !== null) {
        if (typeof programId === "string") {
          // External program: read energy grid from external service metadata
          const parsedProgram = parseExtRef(programId);
          if (!parsedProgram) {
            energyRangeLabel = "";
            return;
          }
          const { label } = parsedProgram;
          const meta = externalDataService.getMetadata(label);
          if (meta) {
            const grid = meta.energyGrid;
            const minE = grid[0] ?? 0;
            const maxE = grid[grid.length - 1] ?? 0;
            energyRangeLabel = `${minE.toLocaleString()} – ${maxE.toLocaleString()} ${meta.energyUnit} (external)`;
          } else {
            energyRangeLabel = "";
          }
          return;
        }

        // Built-in program: query WASM for energy range
        const snapshot = { programId, particleId };
        let cancelled = false;
        getService().then((service) => {
          if (cancelled) return;
          if (
            snapshot.programId !== entityState?.resolvedProgramId ||
            snapshot.particleId !== entityState?.selectedParticle?.id
          ) {
            return;
          }
          const min = service.getMinEnergy(programId as number, particleId as number);
          const max = service.getMaxEnergy(programId as number, particleId as number);
          energyRangeLabel = `${min.toLocaleString()} – ${max.toLocaleString()} MeV/nucl`;
        });
        return () => {
          cancelled = true;
        };
      }
    }
  });

  let programLabel = $derived.by(() => {
    if (!entityState) return "";
    const program = entityState.selectedProgram;
    if (program.id === -1) {
      const resolvedName = (program as AutoSelectProgram).resolvedProgram?.name;
      if (resolvedName) {
        return `Results calculated using ${resolvedName} (auto-selected)`;
      }
    } else if (program.id !== -1) {
      return `Results calculated using ${program.name}`;
    }
    return "";
  });

  // Onboarding hint for advanced mode - show first 2 times, auto-dismiss after 8s
  let showAdvancedHint = $state(false);
  let hintTimeout: ReturnType<typeof setTimeout> | undefined;
  // Tracks whether the user interacted with the program picker in this Advanced session.
  // Reset to false whenever we enter/re-enter Advanced mode so the hint dismissal
  // does not carry over from a previous session.
  $effect(() => {
    // Only run when actively entering Advanced mode with a live state object.
    if (!isAdvancedMode.value || !multiProgState) {
      return;
    }

    // Read the current count once per mode-entry (i.e. when the effect first fires
    // for this multiProgState instance). Using a snapshot prevents the count from
    // being incremented again if multiProgState is recreated while the mode stays on.
    const storageKey = "dedx_adv_hint_count";
    const count = parseInt(localStorage.getItem(storageKey) || "0", 10);

    if (count < 2) {
      showAdvancedHint = true;
      // Increment the count exactly once per actual mode-entry.
      localStorage.setItem(storageKey, (count + 1).toString());

      // Auto-dismiss after 8 seconds
      hintTimeout = setTimeout(() => {
        showAdvancedHint = false;
      }, 8000);
    }

    return () => {
      if (hintTimeout) clearTimeout(hintTimeout);
    };
  });

  function dismissAdvancedHint(): void {
    showAdvancedHint = false;
    if (hintTimeout) clearTimeout(hintTimeout);
  }

  // Column visibility dropdown state
  let showColumnDropdown = $state(false);
  // Single stable reference to the outside-click handler so it can be removed
  // on close without accumulating duplicate listeners.
  let columnOutsideClickHandler: ((e: MouseEvent) => void) | null = null;

  function toggleColumnDropdown(): void {
    showColumnDropdown = !showColumnDropdown;
    if (showColumnDropdown) {
      // Defer by one tick so the current click (which opened the dropdown) does
      // not immediately re-close it.
      setTimeout(() => {
        columnOutsideClickHandler = (e: MouseEvent) => {
          const target = e.target as Node;
          const dropdown = document.getElementById("column-visibility-dropdown");
          const button = document.getElementById("columns-button");
          if (dropdown && !dropdown.contains(target) && button && !button.contains(target)) {
            showColumnDropdown = false;
            // Guard: the button-close path (else branch) may have already set
            // columnOutsideClickHandler to null before this outside-click fires.
            if (columnOutsideClickHandler) {
              document.removeEventListener("click", columnOutsideClickHandler);
              columnOutsideClickHandler = null;
            }
          }
        };
        document.addEventListener("click", columnOutsideClickHandler);
      }, 0);
    } else {
      // Closed via button — remove the outside-click listener if still attached.
      if (columnOutsideClickHandler) {
        document.removeEventListener("click", columnOutsideClickHandler);
        columnOutsideClickHandler = null;
      }
    }
  }

  $effect(() => {
    if (calcState && entityState) {
      initExportState(calcState, entityState);
    }
    // Set the advanced metadata getter callback for PDF export
    import("$lib/state/export.svelte").then((mod) => {
      mod.getCalculatorAdvancedMetadata.value = () => {
        if (!isAdvancedMode.value) return null;
        if (!entityState || !calcState) return null;

        const particle = entityState.selectedParticle;
        const material = entityState.selectedMaterial;
        const program = entityState.selectedProgram;

        if (!particle || !material) return null;

        // Build programs array (single program in basic mode, multiple in advanced)
        const programs = [];
        if ("resolvedProgram" in program && program.resolvedProgram) {
          programs.push({
            name: program.resolvedProgram.name,
            type: "built-in" as const,
          });
        } else {
          programs.push({
            name: program.name,
            type: "built-in" as const,
          });
        }

        const builtinParticle = "massNumber" in particle ? particle : null;
        const builtinPdfMat = "isGasByDefault" in material ? material : null;
        return {
          particle: {
            name: particle.name,
            massNumber: builtinParticle?.massNumber ?? ("A" in particle ? particle.A : 0),
            atomicNumber:
              builtinParticle && typeof builtinParticle.id === "number"
                ? builtinParticle.id
                : "Z" in particle
                  ? particle.Z
                  : 0,
          },
          material: {
            name: material.name,
            density: builtinPdfMat?.density ?? material.density ?? 0,
            densityUnit: "g/cm³",
            phase: builtinPdfMat?.isGasByDefault ? "gas" : "condensed",
          },
          programs,
          advancedOptions: advancedOptions.value,
        };
      };
    });
  });

  // When basic mode is activated while an inverse tab is open, fall back to the Forward tab.
  $effect(() => {
    if (!isAdvancedMode.value && inverseLookupState && inverseLookupState.activeTab !== "forward") {
      inverseLookupState.setActiveTab("forward");
    }
  });

  // Create/destroy multi-program state when advanced mode toggles or entity selection changes.
  //
  // IMPORTANT: All initialization must go through the local `newState` variable. Never read
  // the outer reactive `multiProgState` signal inside this effect after writing to it — doing so
  // creates a self-dependency (the effect reads `multiProgState`, which it also writes, causing
  // it to re-schedule itself on every run → effect_update_depth_exceeded).
  $effect(() => {
    if (!isAdvancedMode.value || !entityState || !calcState) {
      multiProgState = null;
      return;
    }

    // Build the new state entirely through the local variable so the reactive
    // `multiProgState` signal is only written once, at the end.
    const newState = createMultiProgramState();
    newState.setAdvancedMode(true);

    // Read URL params via window.location.search (non-reactive) to avoid
    // registering page.url as a reactive dependency of this effect. If we
    // read page.url.searchParams here, every replaceState call from the URL
    // update effect below would re-trigger this effect, creating an infinite
    // loop (effect_update_depth_exceeded).
    const multiParams = decodeMultiProgramUrl(new URLSearchParams(window.location.search));

    // Initialize with the resolved program as default (built-in or external)
    const defaultProgramId = entityState.resolvedProgramId as EntityId | null;
    if (defaultProgramId !== null && defaultProgramId !== -1) {
      newState.addProgram(defaultProgramId);
    }

    // Restore selected programs from URL (supports both built-in numeric and external ExtRef IDs)
    if (multiParams.mode === "advanced" && multiParams.parsedProgramEntityIds) {
      const availableBuiltinIds = new Set(entityState.availablePrograms.map((p) => p.id));
      const availableExtIds = new Set(entityState.availableExternalPrograms.map((p) => p.id));
      const validProgramIds = multiParams.parsedProgramEntityIds.filter((id) => {
        if (typeof id === "number") return availableBuiltinIds.has(id);
        if (typeof id === "string") return availableExtIds.has(id);
        return false;
      });

      // Add programs from URL (excluding default which is already added)
      for (const programId of validProgramIds) {
        if (programId !== defaultProgramId) {
          newState.addProgram(programId);
        }
      }

      // Restore display order (default must be first)
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

      // Restore hidden programs
      if (multiParams.parsedHiddenEntityIds) {
        for (const hiddenId of multiParams.parsedHiddenEntityIds) {
          const isBuiltin = typeof hiddenId === "number" && availableBuiltinIds.has(hiddenId);
          const isExt = typeof hiddenId === "string" && availableExtIds.has(hiddenId);
          if ((isBuiltin || isExt) && hiddenId !== defaultProgramId) {
            newState.toggleColumnVisibility(hiddenId);
          }
        }
      }

      // Restore quantity focus
      if (
        multiParams.qfocus === "both" ||
        multiParams.qfocus === "stp" ||
        multiParams.qfocus === "csda"
      ) {
        newState.setQuantityFocus(multiParams.qfocus);
      }
    }

    // Write the reactive signal only once, after all initialization is done.
    multiProgState = newState;

    // Seed entityState.multiSelected.program to match the freshly created multiProgState.
    // Done inside untrack so the read of newState.selectedProgramIds (a $state-backed getter)
    // doesn't register as a reactive dependency of THIS effect (which would cause it to
    // re-run on every program toggle and re-create multiProgState from scratch, losing
    // comparison results).
    untrack(() => {
      entityState!.setMultiProgram(newState.selectedProgramIds as (number | string)[]);
    });

    return () => {
      multiProgState = null;
    };
  });

  // Sync entityState.multiSelected.program → multiProgState whenever the user toggles
  // programs in the program tab. The creation effect above handles initial seeding;
  // this effect only handles subsequent changes.
  $effect(() => {
    if (!multiProgState || !entityState) return;

    const desired = entityState.multiSelected.program;
    if (desired.length === 0) return;

    const current = multiProgState.selectedProgramIds;

    // Remove programs no longer desired (cannot remove the first/default)
    for (const id of [...current]) {
      if (!desired.includes(id)) multiProgState.removeProgram(id as EntityId);
    }

    // Add newly desired programs
    for (const id of desired) {
      if (!current.includes(id as EntityId)) multiProgState.addProgram(id as EntityId);
    }
  });

  // Collapse multi-selections to single when leaving Advanced mode.
  // A no-op if the arrays are already empty or have only one item.
  $effect(() => {
    if (!isAdvancedMode.value && entityState) {
      entityState.collapseToSingle();
    }
  });

  // Update default program when resolvedProgramId changes
  $effect(() => {
    if (!multiProgState || !entityState) return;

    const resolvedId = entityState.resolvedProgramId;
    // -1 means "auto" (no explicit program selected) — skip
    if (resolvedId === null || resolvedId === -1) return;
    const defaultProgramId = resolvedId as EntityId;

    // Only update if the default program has changed
    const currentDefault = multiProgState.selectedProgramIds[0];
    if (currentDefault !== defaultProgramId) {
      if (!multiProgState.selectedProgramIds.includes(defaultProgramId)) {
        multiProgState.addProgram(defaultProgramId);
      }
      multiProgState.setDefaultProgram(defaultProgramId);
    }
  });

  /**
   * Format energy with auto-scaling (eV/keV/MeV/GeV).
   * Input is in MeV/nucl. Returns string with unit.
   */
  function formatEnergy(energyMevNucl: number): string {
    const absVal = Math.abs(energyMevNucl);
    let value: number;
    let unit: string;

    if (absVal >= 1000) {
      value = energyMevNucl / 1000;
      unit = "GeV";
    } else if (absVal >= 1) {
      value = energyMevNucl;
      unit = "MeV";
    } else if (absVal >= 0.001) {
      value = energyMevNucl * 1000;
      unit = "keV";
    } else {
      value = energyMevNucl * 1e6;
      unit = "eV";
    }

    // Format with 4 significant figures
    const formatted = value.toPrecision(4);
    return `${formatted} ${unit}`;
  }

  /** Find the local ID of an entity (particle or material) within a specific external source. */
  function resolveExtLocalIdForLabel(
    entityId: number | string,
    label: string,
    refMap: Map<number, string[]> | Map<number | string, string[]>,
  ): string | null {
    if (typeof entityId === "string" && entityId.startsWith("ext:")) {
      const parsed = parseExtRef(entityId);
      return parsed && parsed.label === label ? parsed.localId : null;
    }
    if (typeof entityId === "number") {
      const refs = refMap.get(entityId) ?? [];
      for (const ref of refs) {
        const p = parseExtRef(ref);
        if (p && p.label === label) return p.localId;
      }
    }
    return null;
  }

  // Debounced calculation for multi-program mode
  $effect(() => {
    // Read advOptsKey to establish reactive dependency on all advanced option fields.
    // Without this, changing density/aggregate state etc. would not retrigger this
    // calculation since advancedOptions.value is only read inside the setTimeout
    // callback (async context), which does not register reactive dependencies.
    const _advOptsKey = advOptsKey;
    void _advOptsKey;

    // Block calculation while URL version mismatch is pending
    if (urlVersionMismatch !== null) return;
    if (!multiProgState || !entityState || !calcState || !entityState.isComplete) return;
    if (entityState.across !== "program") return;

    const selectedProgramIds = multiProgState.selectedProgramIds;
    if (selectedProgramIds.length === 0) return;

    const rawParticleId = entityState.selectedParticle?.id;
    // External-only particles have string IDs — multi-program mode only supports built-in particles
    if (typeof rawParticleId !== "number") return;
    const particleId: number = rawParticleId;
    const material = entityState.selectedMaterial;
    // Narrow to built-in material; external-only materials skip WASM multi-program calc
    const builtinMat = material && "isGasByDefault" in material ? material : null;
    const customMaterial = isCustomMaterial(builtinMat) ? builtinMat : null;
    const materialId = material?.id;
    if (materialId === null || materialId === undefined) return;

    const validRows = calcState.rows.filter(
      (r) => r.status === "valid" && r.normalizedMevNucl !== null,
    );

    if (validRows.length === 0) return;

    const energies = validRows.map((r) => r.normalizedMevNucl as number);
    // Snapshot advanced options synchronously (before async) so the timer closure
    // uses the options that were active when the effect fired.
    const advOptsSnapshot = advancedOptions.value;

    // Snapshot external context and particle mass for external program calculations.
    // Clamp to 1 for particles where massNumber/A is 0 (e.g. electrons), to
    // prevent totalMev = energy * 0 = 0 which breaks external interpolation.
    const extCtxSnapshot: ExternalCompatibilityContext = entityState.externalContext;
    const selectedParticle = entityState.selectedParticle;
    const massASnapshot =
      selectedParticle && "massNumber" in selectedParticle
        ? selectedParticle.massNumber || 1
        : selectedParticle && "A" in selectedParticle
          ? selectedParticle.A || 1
          : 1;

    // Capture inputs as snapshot so that a stale `getService()` resolution
    // (race: user changed selection while the async call was in-flight) cannot
    // overwrite the current state with results computed for different inputs.
    const inputSnapshot = {
      selectedProgramIds,
      particleId,
      materialId,
      energies,
      customMaterial,
    };
    let cancelled = false;

    // Debounce the calculation
    const timer = setTimeout(async () => {
      if (cancelled || !multiProgState) return;
      const service = await getService();
      // Check whether the inputs have already changed since the timer fired.
      if (cancelled) return;

      // Split selected programs into built-in (numeric) and external (ExtRef string)
      const builtinProgramIds = inputSnapshot.selectedProgramIds.filter(
        (id): id is number => typeof id === "number",
      );
      const extProgramIds = inputSnapshot.selectedProgramIds.filter(
        (id): id is ExtRef => typeof id === "string",
      );

      const results = new Map<EntityId, CalculationResult | LibdedxError>();

      // --- Built-in program calculations (WASM) ---
      // Range pre-check: skip WASM per program if any submitted energy is outside
      // that program's tabulated range. Some programs (e.g. ICRU 49) hang in
      // _dedx_get_stp_table on out-of-range inputs rather than returning error code 101.
      let safeProgramIds = builtinProgramIds;
      if (!inputSnapshot.customMaterial && typeof inputSnapshot.materialId === "number") {
        safeProgramIds = [];
        for (const programId of builtinProgramIds) {
          const minEnergy = service.getMinEnergy(programId, inputSnapshot.particleId);
          const maxEnergy = service.getMaxEnergy(programId, inputSnapshot.particleId);
          const allEnergiesInRange = inputSnapshot.energies.every(
            (energy) => energy >= minEnergy && energy <= maxEnergy,
          );
          if (allEnergiesInRange) {
            safeProgramIds.push(programId);
          } else {
            results.set(
              programId,
              new LibdedxError(
                101,
                `Energy out of tabulated range (${minEnergy} – ${maxEnergy} MeV/nucl)`,
              ),
            );
          }
        }
      }

      if (safeProgramIds.length > 0) {
        if (inputSnapshot.customMaterial) {
          for (const programId of safeProgramIds) {
            try {
              results.set(
                programId,
                service.calculateCustomCompound({
                  programId,
                  particleId: inputSnapshot.particleId,
                  elements: customMaterialElementsForWasm(inputSnapshot.customMaterial),
                  density: inputSnapshot.customMaterial.density,
                  iValue: inputSnapshot.customMaterial.iValue,
                  energies: inputSnapshot.energies,
                }),
              );
            } catch (e) {
              results.set(
                programId,
                e instanceof LibdedxError
                  ? e
                  : new LibdedxError(-1, e instanceof Error ? e.message : String(e)),
              );
            }
          }
        } else if (typeof inputSnapshot.materialId === "number") {
          const builtInResults = service.calculateMulti({
            programIds: safeProgramIds,
            particleId: inputSnapshot.particleId,
            materialId: inputSnapshot.materialId,
            energies: inputSnapshot.energies,
            options: advOptsSnapshot,
          });
          for (const [programId, result] of builtInResults) {
            results.set(programId, result);
          }
        }
      }

      // --- External program calculations (ExternalDataService) ---
      for (const extProgramId of extProgramIds) {
        const parsed = parseExtRef(extProgramId);
        if (!parsed) {
          results.set(extProgramId, new LibdedxError(-1, "Invalid external program reference"));
          continue;
        }
        const { label, localId: localProgramId } = parsed;

        const particleLocalId = resolveExtLocalIdForLabel(
          inputSnapshot.particleId,
          label,
          extCtxSnapshot.externalRefsForBuiltinParticle,
        );
        const materialLocalId = resolveExtLocalIdForLabel(
          // materialId is number | string at this point (undefined checked above)
          inputSnapshot.materialId as number | string,
          label,
          extCtxSnapshot.externalRefsForBuiltinMaterial,
        );

        if (!particleLocalId || !materialLocalId) {
          results.set(
            extProgramId,
            new LibdedxError(-1, "Particle or material not covered by this external program"),
          );
          continue;
        }

        try {
          const stoppingPowers: number[] = [];
          const csdaValuesGcm2: (number | null)[] = [];
          const validEnergies: number[] = [];

          for (const energy of inputSnapshot.energies) {
            const totalMev = energy * massASnapshot;
            const r = await externalDataService.interpolateAt(
              label,
              localProgramId,
              particleLocalId,
              materialLocalId,
              totalMev,
            );
            if (r.stp !== null) {
              validEnergies.push(energy);
              stoppingPowers.push(r.stp);
              csdaValuesGcm2.push(r.csda);
            }
          }

          if (validEnergies.length === 0) {
            results.set(
              extProgramId,
              new LibdedxError(101, "Energy out of range for this external program"),
            );
          } else {
            // Only include CSDA array when all values are non-null (store has CSDA data)
            const allCsdaAvailable =
              csdaValuesGcm2.length > 0 && csdaValuesGcm2.every((v) => v !== null);
            results.set(extProgramId, {
              energies: validEnergies,
              stoppingPowers,
              csdaRanges: allCsdaAvailable ? (csdaValuesGcm2 as number[]) : [],
            });
          }
        } catch (e) {
          results.set(
            extProgramId,
            e instanceof LibdedxError
              ? e
              : new LibdedxError(-1, e instanceof Error ? e.message : String(e)),
          );
        }
      }

      if (!cancelled) {
        multiProgState.setComparisonResults(results);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  // Create/destroy multi-entity state when the "across" dimension switches to material/particle.
  // Mirrors the multiProgState creation effect above, but without URL encoding for now.
  $effect(() => {
    const across = entityState?.across;
    if (!isAdvancedMode.value || !entityState || (across !== "material" && across !== "particle")) {
      multiEntityState = null;
      return;
    }

    const dim = across; // "material" | "particle"
    const state = createMultiEntityState(dim, (id) => {
      if (dim === "material") {
        const m =
          entityState?.allMaterials.find((x) => x.id === id) ??
          entityState?.externalOnlyMaterials.find((x) => x.id === id);
        return m?.name ?? String(id);
      }
      // particle
      const p = entityState?.allParticles.find((x) => x.id === id);
      return p?.name ?? String(id);
    });
    multiEntityState = state;

    return () => {
      multiEntityState = null;
    };
  });

  // Multi-entity calculation effect: runs when across === "material" or "particle".
  // Computes stopping power for each entity in entityState.multiSelected[dimension].
  $effect(() => {
    const _advOptsKey = advOptsKey;
    void _advOptsKey;

    if (urlVersionMismatch !== null) return;
    if (!multiEntityState || !entityState || !calcState || !entityState.isComplete) return;

    const dim = multiEntityState.dimension;
    const entityIds =
      dim === "material" ? entityState.multiSelected.material : entityState.multiSelected.particle;

    if (entityIds.length === 0) return;

    // Require built-in (numeric) program and particle for WASM multi-entity calculation.
    const rawProgramId = entityState.resolvedProgramId;
    if (typeof rawProgramId !== "number" || rawProgramId === null) return;
    const programId = rawProgramId;

    const rawParticleId = entityState.selectedParticle?.id;
    if (typeof rawParticleId !== "number") return;
    const anchorParticleId = rawParticleId;

    const material = entityState.selectedMaterial;
    const builtinMat = material && "isGasByDefault" in material ? material : null;
    const anchorMaterialId = material?.id;
    if (anchorMaterialId === null || anchorMaterialId === undefined) return;

    const getCustomMaterialById = (id: EntityId) => {
      if (typeof id !== "string" || !id.startsWith("cc_")) return null;
      const compound = customCompounds.getById(id);
      if (!compound) return null;
      return {
        id: compound.id,
        name: compound.name,
        density: compound.density,
        iValue: compound.iValue,
        phase: compound.phase,
        elements: compound.elements,
        isGasByDefault: compound.phase === "gas",
      };
    };

    if (dim === "particle" && typeof anchorMaterialId !== "number") {
      const unsupportedMaterialMessage =
        typeof anchorMaterialId === "string" && anchorMaterialId.startsWith("ext:")
          ? "Multi-particle comparison does not support external-only materials."
          : "Multi-particle comparison does not support custom compounds.";
      const results = new Map<EntityId, CalculationResult | LibdedxError>();
      for (const entityId of entityIds) {
        results.set(entityId, new LibdedxError(-1, unsupportedMaterialMessage));
      }
      multiEntityState.setComparisonResults(results);
      return;
    }

    const validRows = calcState.rows.filter(
      (r) => r.status === "valid" && r.normalizedMevNucl !== null,
    );
    if (validRows.length === 0) return;

    const energies = validRows.map((r) => r.normalizedMevNucl as number);
    const advOptsSnapshot = advancedOptions.value;
    const inputSnapshot = {
      programId,
      anchorParticleId,
      anchorMaterialId,
      entityIds,
      energies,
      dim,
      builtinMat,
    };
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const service = await getService();
      if (cancelled) return;

      const results = new Map<
        EntityId,
        import("$lib/wasm/types").CalculationResult | LibdedxError
      >();

      for (const entityId of inputSnapshot.entityIds) {
        try {
          let result: import("$lib/wasm/types").CalculationResult;
          if (inputSnapshot.dim === "material") {
            const customMaterial =
              getCustomMaterialById(entityId) ??
              (entityId === inputSnapshot.anchorMaterialId &&
              isCustomMaterial(inputSnapshot.builtinMat)
                ? inputSnapshot.builtinMat
                : null);
            if (customMaterial !== null) {
              result = service.calculateCustomCompound({
                programId: inputSnapshot.programId,
                particleId: inputSnapshot.anchorParticleId,
                elements: customMaterialElementsForWasm(customMaterial),
                density: customMaterial.density,
                iValue: customMaterial.iValue,
                energies: inputSnapshot.energies,
              });
            } else if (typeof entityId === "number") {
              result = service.calculate(
                inputSnapshot.programId,
                inputSnapshot.anchorParticleId,
                entityId,
                inputSnapshot.energies,
                advOptsSnapshot,
              );
            } else {
              throw new LibdedxError(
                -1,
                typeof entityId === "string" && entityId.startsWith("ext:")
                  ? "Multi-material comparison does not support external-only materials."
                  : `Unsupported material ID for multi-material comparison: ${entityId}`,
              );
            }
          } else {
            // across === "particle": compute for each particleId, fixed material
            if (typeof entityId !== "number") {
              throw new LibdedxError(
                -1,
                typeof entityId === "string" && entityId.startsWith("ext:")
                  ? "Multi-particle comparison does not support external-only particles."
                  : `Unsupported particle ID for multi-particle comparison: ${entityId}`,
              );
            }
            result = service.calculate(
              inputSnapshot.programId,
              entityId,
              inputSnapshot.anchorMaterialId as number,
              inputSnapshot.energies,
              advOptsSnapshot,
            );
          }
          results.set(entityId, result);
        } catch (e) {
          results.set(
            entityId,
            e instanceof LibdedxError
              ? e
              : new LibdedxError(-1, e instanceof Error ? e.message : String(e)),
          );
        }
      }

      if (!cancelled && multiEntityState) {
        multiEntityState.setComparisonResults(results);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  // Inverse lookup calculation effects - snapshot deps synchronously before async
  $effect(() => {
    // Read advOptsKey and activeTab to establish reactive dependencies
    const _advOptsKey = advOptsKey;
    void _advOptsKey;
    if (!inverseLookupState || !entityState || !calcState || !entityState.isComplete) return;
    const inverseState = inverseLookupState;
    if (inverseState.activeTab !== "csda") return;

    // Snapshot all reactive deps synchronously at the top
    const _rangeMasterUnit = inverseState.rangeMasterUnit;
    void _rangeMasterUnit;
    const advOptsSnapshot = advancedOptions.value;
    const rawParticleId = entityState.selectedParticle?.id;
    // External-only particles/programs do not support inverse CSDA lookup
    if (typeof rawParticleId !== "number") return;
    const particleId: number = rawParticleId;
    const material = entityState.selectedMaterial;
    const builtinRangeMat = material && "isGasByDefault" in material ? material : null;
    const customMaterial = isCustomMaterial(builtinRangeMat) ? builtinRangeMat : null;
    const materialId = material?.id;
    const rawProgramId = entityState.resolvedProgramId;
    if (typeof rawProgramId === "string") return; // external program, no inverse lookup
    const programId = rawProgramId;
    const rowsSnapshot = inverseState.rangeRows.map((r) => ({
      id: r.id,
      text: r.text,
      value: r.value,
      unit: r.unit,
      status: r.status,
    }));

    if (particleId === null || materialId === null || programId === null) return;

    const validRows = rowsSnapshot.filter(
      (r) => r.status === "valid" || r.status === "out-of-range",
    );
    if (validRows.length === 0) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const service = await getService();
      if (cancelled) return;

      const asyncMat = entityState?.selectedMaterial;
      const asyncBuiltinMat = asyncMat && "isGasByDefault" in asyncMat ? asyncMat : null;
      const currentCustomMaterial = isCustomMaterial(asyncBuiltinMat) ? asyncBuiltinMat : null;
      const density =
        (currentCustomMaterial ? undefined : advOptsSnapshot.densityOverride) ??
        asyncMat?.density ??
        1;

      if (density <= 0) {
        // Mark all non-empty rows as invalid due to missing density
        for (const r of inverseState.rangeRows) {
          if (r.text.trim()) {
            r.status = "invalid";
            r.message = "Density not available for this material";
            r.energyMevNucl = null;
          }
        }
        return;
      }

      // Convert to g/cm²
      const rangesGcm2 = validRows.map((r) => {
        const rangeCm = r.value! * getUnitToCmFactor(r.unit);
        return rangeCm * density;
      });

      try {
        const activeCustomMaterial = customMaterial ?? currentCustomMaterial;
        const results: (InverseCsdaResult | Error)[] = activeCustomMaterial
          ? service.getInverseCsdaCustomCompound({
              programId,
              particleId,
              elements: customMaterialElementsForWasm(activeCustomMaterial),
              density,
              iValue: activeCustomMaterial.iValue,
              ranges: rangesGcm2,
            })
          : typeof materialId === "number"
            ? service.getInverseCsda({
                programId,
                particleId,
                materialId,
                ranges: rangesGcm2,
                options: advOptsSnapshot,
              })
            : [];

        let resultIdx = 0;
        for (const r of inverseState.rangeRows) {
          if (r.status === "valid" || r.status === "out-of-range") {
            const result = results[resultIdx++];
            if (result instanceof Error || result === undefined) {
              r.energyMevNucl = null;
            } else {
              r.energyMevNucl = result.energy;
            }
          }
        }
      } catch {
        for (const r of inverseState.rangeRows) {
          if (r.status === "valid" || r.status === "out-of-range") {
            r.status = "error";
            r.message = "Inverse range lookup failed";
            r.energyMevNucl = null;
          }
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  $effect(() => {
    // Read advOptsKey and activeTab to establish reactive dependencies
    const _advOptsKey = advOptsKey;
    void _advOptsKey;
    if (!inverseLookupState || !entityState || !calcState || !entityState.isComplete) return;
    const inverseState = inverseLookupState;
    if (inverseState.activeTab !== "stp") return;

    // Snapshot all reactive deps synchronously at the top
    const _stpMasterUnit = inverseState.stpMasterUnit;
    void _stpMasterUnit;
    const advOptsSnapshot = advancedOptions.value;
    const rawParticleIdStp = entityState.selectedParticle?.id;
    // External-only particles/programs do not support inverse STP lookup
    if (typeof rawParticleIdStp !== "number") return;
    const particleId: number = rawParticleIdStp;
    const material = entityState.selectedMaterial;
    const builtinStpMat = material && "isGasByDefault" in material ? material : null;
    const customMaterial = isCustomMaterial(builtinStpMat) ? builtinStpMat : null;
    const materialId = material?.id;
    const rawProgramIdStp = entityState.resolvedProgramId;
    if (typeof rawProgramIdStp === "string") return; // external program, no inverse lookup
    const programId = rawProgramIdStp;
    const rowsSnapshot = inverseState.stpRows.map((r) => ({
      id: r.id,
      text: r.text,
      value: r.value,
      unit: r.unit,
      status: r.status,
    }));

    if (particleId === null || materialId === null || programId === null) return;

    const validRows = rowsSnapshot.filter(
      (r) => r.status === "valid" || r.status === "no-solution",
    );
    if (validRows.length === 0) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const service = await getService();
      if (cancelled) return;

      const stpAsyncMat = entityState?.selectedMaterial;
      const stpBuiltinMat = stpAsyncMat && "isGasByDefault" in stpAsyncMat ? stpAsyncMat : null;
      const currentCustomMaterial = isCustomMaterial(stpBuiltinMat) ? stpBuiltinMat : null;
      const density =
        (currentCustomMaterial ? undefined : advOptsSnapshot.densityOverride) ??
        stpAsyncMat?.density ??
        1;

      // Convert to MeV·cm²/g
      const stpMevCm2g = validRows.map((r) => stpToMevCm2g(r.value!, r.unit, density));

      try {
        const activeCustomMaterial = customMaterial ?? currentCustomMaterial;
        // Call for low/high branches
        const lowResults = activeCustomMaterial
          ? service.getInverseStpCustomCompound({
              programId,
              particleId,
              elements: customMaterialElementsForWasm(activeCustomMaterial),
              density,
              iValue: activeCustomMaterial.iValue,
              stoppingPowers: stpMevCm2g,
              side: 0,
            })
          : typeof materialId === "number"
            ? service.getInverseStp({
                programId,
                particleId,
                materialId,
                stoppingPowers: stpMevCm2g,
                side: 0,
                options: advOptsSnapshot,
              })
            : [];

        const highResults = activeCustomMaterial
          ? service.getInverseStpCustomCompound({
              programId,
              particleId,
              elements: customMaterialElementsForWasm(activeCustomMaterial),
              density,
              iValue: activeCustomMaterial.iValue,
              stoppingPowers: stpMevCm2g,
              side: 1,
            })
          : typeof materialId === "number"
            ? service.getInverseStp({
                programId,
                particleId,
                materialId,
                stoppingPowers: stpMevCm2g,
                side: 1,
                options: advOptsSnapshot,
              })
            : [];

        let resultIdx = 0;
        for (const r of inverseState.stpRows) {
          if (r.status === "valid" || r.status === "no-solution") {
            const lowResult = lowResults[resultIdx];
            const highResult = highResults[resultIdx];

            if (lowResult instanceof Error && highResult instanceof Error) {
              r.status = "no-solution";
              r.energyLowMevNucl = null;
              r.energyHighMevNucl = null;
            } else {
              r.status = "valid";
              r.energyLowMevNucl =
                lowResult instanceof Error || lowResult === undefined ? null : lowResult.energy;
              r.energyHighMevNucl =
                highResult instanceof Error || highResult === undefined ? null : highResult.energy;
            }

            resultIdx++;
          }
        }
      } catch {
        for (const r of inverseState.stpRows) {
          if (r.status === "valid" || r.status === "no-solution") {
            r.status = "error";
            r.message = "Inverse STP lookup failed";
            r.energyLowMevNucl = null;
            r.energyHighMevNucl = null;
          }
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  // Helper: convert length unit to cm factor
  function getUnitToCmFactor(unit: "nm" | "um" | "mm" | "cm" | "m"): number {
    switch (unit) {
      case "nm":
        return 1e-7;
      case "um":
        return 1e-4;
      case "mm":
        return 0.1;
      case "cm":
        return 1;
      case "m":
        return 100;
    }
  }

  // Helper: STP to MeV·cm²/g conversion
  function stpToMevCm2g(
    value: number,
    unit: "kev-um" | "mev-cm" | "mev-cm2-g",
    density: number,
  ): number {
    switch (unit) {
      case "kev-um":
        // 1 keV/µm = 10 MeV/cm; divide by density
        return (value * 10) / density;
      case "mev-cm":
        return value / density;
      case "mev-cm2-g":
        return value;
    }
  }
</script>

<svelte:head>
  <title>Calculator - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-bold">Calculator</h1>
    {#if calcState}
      <Button
        variant="ghost"
        size="sm"
        onclick={() => calcState?.resetAll()}
        title="Reset particle, material, program, and energy rows"
      >
        Reset all
      </Button>
    {/if}
  </div>
  <p class="text-muted-foreground">
    Select a particle, material, and program to calculate stopping powers and CSDA ranges.
  </p>

  {#if urlVersionMismatch}
    <UrlVersionWarningBanner
      version={urlVersionMismatch.version}
      onLoadDefaults={handleLoadDefaults}
    />
  {/if}

  {#if wasmError.value}
    <div
      class="mx-auto max-w-md rounded-lg border border-destructive bg-destructive/10 p-8 text-center space-y-4"
    >
      <p class="font-semibold text-destructive">Failed to load the calculation engine.</p>
      <p class="text-sm text-muted-foreground">
        Please try refreshing the page or use a different browser.
      </p>
      <Button variant="destructive" size="sm" onclick={() => window.location.reload()}>
        Retry
      </Button>
      <details class="text-left text-xs text-muted-foreground mt-2">
        <summary class="cursor-pointer">Show details</summary>
        <pre class="mt-1 whitespace-pre-wrap">{wasmError.value.message}</pre>
      </details>
    </div>
  {:else if externalError}
    <div
      class="mx-auto max-w-md rounded-lg border border-destructive bg-destructive/10 p-8 text-center space-y-4"
    >
      <p class="font-semibold text-destructive">Failed to load external data source.</p>
      <p class="text-sm text-muted-foreground">{externalError.message}</p>
      <div class="flex justify-center gap-2">
        <Button variant="destructive" size="sm" onclick={() => window.location.reload()}>
          Retry
        </Button>
        <Button
          variant="outline"
          size="sm"
          onclick={() => goto("/calculator", { replaceState: true })}
        >
          Load without external data
        </Button>
      </div>
    </div>
  {:else if !wasmReady.value || !entityState || !calcState}
    <div class="mx-auto max-w-4xl space-y-6" aria-busy="true" aria-label="Loading calculator">
      {#if externalLoading}
        <p class="text-sm text-muted-foreground">Loading external data sources…</p>
      {/if}
      <div class="flex flex-wrap gap-3">
        <Skeleton class="h-10 w-44 rounded-md" />
        <Skeleton class="h-10 w-44 rounded-md" />
        <Skeleton class="h-10 w-36 rounded-md" />
        <Skeleton class="h-10 w-28 rounded-md" />
      </div>
      <div class="rounded-lg border bg-card p-6 space-y-2">
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-3/4" />
      </div>
    </div>
  {:else}
    <div class="mx-auto max-w-4xl space-y-6">
      <SelectionLiveRegion state={entityState} />
      <EntitySelection
        selectionState={entityState}
        onParticleSelect={(particleId) => calcState?.switchParticle(particleId)}
        collapsible={true}
        onLoadExternal={() => (showLoadExternalModal = true)}
      />
      <ExternalSourcesPanel sources={loadedExternalSources} onRemove={handleRemoveExternalSource} />
      <LoadExternalModal
        open={showLoadExternalModal}
        existingLabels={new Set([
          ...loadedExternalSources.map((s) => s.label),
          ...externalDataService.getLoadedLabels(),
        ])}
        onLoad={handleModalLoad}
        onCancel={() => (showLoadExternalModal = false)}
      />
      {#if isAdvancedMode.value && entityState?.across === "program" && multiProgState && entityState}
        <!-- Table toolbar: column visibility + quantity focus -->
        <div class="flex items-center gap-2 pt-2 flex-wrap">
          <!-- Columns... button -->
          <div class="relative" id="column-visibility-dropdown-container">
            <Button
              id="columns-button"
              variant="outline"
              size="sm"
              onclick={toggleColumnDropdown}
              aria-expanded={showColumnDropdown}
              aria-haspopup="dialog"
              title="Show/hide program columns"
            >
              Columns…
            </Button>
            <!-- Column visibility dropdown -->
            {#if showColumnDropdown}
              <div
                id="column-visibility-dropdown"
                class="absolute right-0 z-50 mt-2 min-w-[200px] rounded-md border bg-popover p-3 shadow-lg"
                role="dialog"
                aria-label="Column visibility"
              >
                <div class="space-y-2">
                  {#each multiProgState.selectedProgramIds as programId (programId)}
                    {@const program =
                      entityState.availablePrograms.find((p) => p.id === programId) ??
                      entityState.availableExternalPrograms.find((p) => p.id === programId)}
                    {@const isDefault = programId === multiProgState.selectedProgramIds[0]}
                    {@const isVisible = multiProgState.columnVisibility.get(programId) !== false}
                    <label
                      class="flex items-center gap-2 text-sm cursor-pointer"
                      class:opacity-50={!isVisible}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        disabled={isDefault}
                        onchange={() => multiProgState?.toggleColumnVisibility(programId)}
                        class="h-4 w-4 rounded border-input"
                      />
                      <span>{program?.name ?? `Program ${String(programId)}`}</span>
                      {#if isDefault}
                        <span class="text-xs text-muted-foreground">(default)</span>
                      {/if}
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          <!-- Quantity focus segmented control -->
          <div
            class="inline-flex items-center rounded-md border bg-background p-1"
            role="radiogroup"
            aria-label="Quantity focus"
          >
            <button
              type="button"
              role="radio"
              aria-checked={multiProgState.quantityFocus === "stp"}
              class="px-3 py-1.5 text-sm font-medium rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
              class:bg-accent={multiProgState.quantityFocus === "stp"}
              onclick={() => multiProgState?.setQuantityFocus("stp")}
            >
              STP only
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={multiProgState.quantityFocus === "both"}
              class="px-3 py-1.5 text-sm font-medium rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
              class:bg-accent={multiProgState.quantityFocus === "both"}
              onclick={() => multiProgState?.setQuantityFocus("both")}
            >
              Both
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={multiProgState.quantityFocus === "csda"}
              class="px-3 py-1.5 text-sm font-medium rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
              class:bg-accent={multiProgState.quantityFocus === "csda"}
              onclick={() => multiProgState?.setQuantityFocus("csda")}
            >
              CSDA only
            </button>
          </div>
        </div>
        <!-- Advanced Options Panel -->
        {#if entityState}
          {@const selMatAdv = entityState.selectedMaterial}
          {@const builtinMatAdv = selMatAdv && "isGasByDefault" in selMatAdv ? selMatAdv : null}
          <AdvancedOptionsPanel
            materialIsGas={builtinMatAdv?.isGasByDefault ?? false}
            materialBuiltInDensity={builtinMatAdv?.density}
            materialBuiltInAggregateState={builtinMatAdv
              ? builtinMatAdv.isGasByDefault
                ? "gas"
                : "condensed"
              : undefined}
            isCustomCompoundActive={isCustomMaterial(builtinMatAdv)}
            selectedProgram={"resolvedProgram" in entityState.selectedProgram
              ? (entityState.selectedProgram.resolvedProgram?.name ?? "")
              : entityState.selectedProgram.name}
          />
        {/if}
      {/if}
      <!-- Advanced mode onboarding hint -->
      {#if showAdvancedHint}
        <div
          class="flex items-start justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
          role="status"
          aria-live="polite"
        >
          <div class="flex-1 pr-4">
            <p class="font-medium">Multi-program comparison enabled</p>
            <p class="mt-1 text-blue-700 dark:text-blue-300">
              Select multiple programs to compare results side-by-side. Use the columns button to
              show/hide programs or change the quantity focus.
            </p>
          </div>
          <button
            type="button"
            class="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-lg leading-none"
            aria-label="Dismiss hint"
            onclick={dismissAdvancedHint}
          >
            ×
          </button>
        </div>
      {/if}
      {#if entityState.lastAutoFallbackMessage}
        <div
          class="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <span role="status" aria-live="polite">{entityState.lastAutoFallbackMessage}</span>
          <button
            class="ml-2 text-amber-600 hover:text-amber-800 text-lg leading-none"
            aria-label="Dismiss"
            onclick={() => entityState?.clearAutoFallbackMessage()}
          >
            ×
          </button>
        </div>
      {/if}
      {#if sharedUrlCompound || sharedUrlWarning}
        <div
          class="flex flex-wrap items-center justify-between gap-3 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900"
          data-testid="compound-from-url-banner"
        >
          <span role="status" aria-live="polite">
            {#if sharedUrlCompound}
              Loaded custom compound “{sharedUrlCompound.name}” from shared URL.
            {:else}
              Custom compound URL parameters could not be restored: {sharedUrlWarning}
            {/if}
          </span>
          <div class="flex items-center gap-2">
            {#if sharedUrlCompound}
              <Button size="sm" variant="outline" onclick={saveSharedUrlCompound}>
                Save to library
              </Button>
            {/if}
            <Button size="sm" variant="ghost" onclick={dismissSharedUrlCompound}>Dismiss</Button>
          </div>
        </div>
      {/if}
      {#if isAdvancedMode.value}
        <EnergyUnitSelector
          value={calcState.masterUnit}
          availableUnits={getAvailableEnergyUnits(
            entityState.selectedParticle && "massNumber" in entityState.selectedParticle
              ? entityState.selectedParticle
              : null,
            isAdvancedMode.value,
          )}
          disabled={calcState.isPerRowMode}
          onValueChange={(unit) => calcState?.setMasterUnit(unit)}
        />
      {/if}

      {#if isAdvancedMode.value}
        <!-- Tab switcher for Advanced mode -->
        <div class="border-b">
          <div class="flex gap-2" role="tablist" aria-label="Calculator mode">
            <button
              role="tab"
              aria-selected={inverseLookupState?.activeTab === "forward"}
              class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
              class:border-primary={inverseLookupState?.activeTab === "forward"}
              class:border-transparent={inverseLookupState?.activeTab !== "forward"}
              class:text-foreground={inverseLookupState?.activeTab === "forward"}
              class:text-muted-foreground={inverseLookupState?.activeTab !== "forward"}
              onclick={() => inverseLookupState?.setActiveTab("forward")}
              data-testid="inverse-tab-forward"
            >
              Forward
            </button>
            <button
              role="tab"
              aria-selected={inverseLookupState?.activeTab === "csda"}
              class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
              class:border-primary={inverseLookupState?.activeTab === "csda"}
              class:border-transparent={inverseLookupState?.activeTab !== "csda"}
              class:text-foreground={inverseLookupState?.activeTab === "csda"}
              class:text-muted-foreground={inverseLookupState?.activeTab !== "csda"}
              onclick={() => inverseLookupState?.setActiveTab("csda")}
              data-testid="inverse-tab-range"
            >
              Range
            </button>
            <button
              role="tab"
              aria-selected={inverseLookupState?.activeTab === "stp"}
              class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
              class:border-primary={inverseLookupState?.activeTab === "stp"}
              class:border-transparent={inverseLookupState?.activeTab !== "stp"}
              class:text-foreground={inverseLookupState?.activeTab === "stp"}
              class:text-muted-foreground={inverseLookupState?.activeTab !== "stp"}
              onclick={() => inverseLookupState?.setActiveTab("stp")}
              data-testid="inverse-tab-stp"
            >
              Inverse STP
            </button>
          </div>
        </div>
      {/if}

      <!-- Forward tab content (default) -->
      {#if !inverseLookupState || !isAdvancedMode.value || inverseLookupState.activeTab === "forward"}
        <div class="rounded-lg border bg-card p-3 sm:p-6">
          {#if isAdvancedMode.value && entityState.across === "program" && multiProgState}
            <ResultTable
              {calcState}
              entitySelection={entityState}
              multiProgramState={multiProgState}
              comparisonResults={multiProgState.comparisonResults}
            />
          {:else if isAdvancedMode.value && multiEntityState && (entityState.across === "material" || entityState.across === "particle")}
            <ResultTable
              {calcState}
              entitySelection={entityState}
              {multiEntityState}
              multiEntityIds={entityState.across === "material"
                ? entityState.multiSelected.material
                : entityState.multiSelected.particle}
            />
          {:else if isAdvancedMode.value}
            <ResultTable {calcState} entitySelection={entityState} />
          {:else}
            <TableBasic {calcState} entitySelection={entityState} />
          {/if}
        </div>
      {/if}

      <!-- Range tab content -->
      {#if isAdvancedMode.value && inverseLookupState && inverseLookupState.activeTab === "csda"}
        <div class="rounded-lg border bg-card p-3 sm:p-6">
          <div class="space-y-4">
            <div class="text-sm text-muted-foreground">
              Enter a CSDA range value to find the corresponding particle energy.
            </div>

            <!-- Master unit selector (visible in master mode) -->
            <div class="flex items-center gap-2 text-sm">
              <label for="inverse-range-unit" class="text-muted-foreground">Unit:</label>
              <select
                id="inverse-range-unit"
                data-testid="inverse-range-unit"
                value={inverseLookupState.rangeMasterUnit}
                disabled={inverseLookupState.rangeRows.some((r) => r.unitFromSuffix)}
                onchange={(e) => {
                  const newUnit = e.currentTarget.value as "nm" | "um" | "mm" | "cm" | "m";
                  inverseLookupState?.setRangeMasterUnit(newUnit);
                }}
                class="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="nm">nm</option>
                <option value="um">µm</option>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
              {#if inverseLookupState.rangeRows.some((r) => r.unitFromSuffix)}
                <span class="text-xs text-muted-foreground">(per-row mode active)</span>
              {/if}
            </div>

            <!-- Range table header -->
            <div class="grid grid-cols-3 gap-2 text-sm font-medium mb-2">
              <div>Range</div>
              <div>Unit</div>
              <div>→ Energy</div>
            </div>

            <!-- Range rows -->
            <div class="space-y-2">
              {#each inverseLookupState.rangeRows as row, i (row.id)}
                <div class="grid grid-cols-3 gap-2" data-testid="inverse-range-row-{i}">
                  <input
                    type="text"
                    value={row.text}
                    placeholder="Enter range (e.g., 7.718 cm)"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    oninput={(e) =>
                      inverseLookupState?.updateRangeRowText(i, e.currentTarget.value)}
                    data-testid="inverse-range-input-{i}"
                  />
                  {#if row.unitFromSuffix}
                    <select
                      value={row.unit}
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled
                    >
                      <option value="nm">nm</option>
                      <option value="um">µm</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  {:else}
                    <select
                      value={inverseLookupState.rangeMasterUnit}
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      onchange={(e) => {
                        inverseLookupState?.setRangeMasterUnit(
                          e.currentTarget.value as "nm" | "um" | "mm" | "cm" | "m",
                        );
                      }}
                    >
                      <option value="nm">nm</option>
                      <option value="um">µm</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  {/if}
                  <div class="flex items-center" data-testid="inverse-range-result-{i}">
                    {#if row.status === "valid" && row.energyMevNucl != null}
                      <span class="text-sm font-mono">{formatEnergy(row.energyMevNucl)}</span>
                    {:else if row.status === "invalid" || row.status === "out-of-range" || row.status === "error"}
                      <span class="text-sm text-destructive">{row.message}</span>
                    {:else if row.status === "empty"}
                      <span class="text-sm text-muted-foreground"></span>
                    {:else}
                      <span class="text-sm text-muted-foreground">—</span>
                    {/if}
                  </div>
                </div>
                <!-- Error row display -->
                {#if (row.status === "invalid" || row.status === "out-of-range" || row.status === "error") && row.message}
                  <div data-testid="inverse-range-row-error-{i}" class="text-sm text-destructive">
                    {row.message}
                  </div>
                {/if}
              {/each}
              <!-- Add row button -->
              <button
                type="button"
                class="text-sm text-primary hover:underline mt-2"
                onclick={() => inverseLookupState?.addRangeRow()}
              >
                + Add row
              </button>
            </div>

            <!-- Valid range hint -->
            {#if entityState.isComplete && energyRangeLabel}
              <p class="text-xs text-muted-foreground mt-4">
                Valid range: {energyRangeLabel}
              </p>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Inverse STP tab content -->
      {#if isAdvancedMode.value && inverseLookupState && inverseLookupState.activeTab === "stp"}
        <div class="rounded-lg border bg-card p-3 sm:p-6">
          <div class="space-y-4">
            <div class="text-sm text-muted-foreground">
              Enter a stopping power value to find the corresponding energies (low and high
              branches).
            </div>

            <!-- STP table header -->
            <div class="grid grid-cols-4 gap-2 text-sm font-medium mb-2">
              <div>Stopping Power</div>
              <div>Unit</div>
              <div>E low</div>
              <div>E high</div>
            </div>

            <!-- STP rows -->
            <div class="space-y-2">
              {#each inverseLookupState.stpRows as row, i (row.id)}
                <div class="grid grid-cols-4 gap-2" data-testid="inverse-stp-row-{i}">
                  <input
                    type="text"
                    value={row.text}
                    placeholder="Enter stopping power"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    oninput={(e) => inverseLookupState?.updateStpRowText(i, e.currentTarget.value)}
                    data-testid="inverse-stp-input-{i}"
                  />
                  <select
                    data-testid="inverse-stp-unit"
                    value={row.unit}
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    onchange={(e) => {
                      inverseLookupState?.setStpMasterUnit(
                        e.currentTarget.value as "kev-um" | "mev-cm" | "mev-cm2-g",
                      );
                    }}
                  >
                    <option value="kev-um">keV/µm</option>
                    <option value="mev-cm">MeV/cm</option>
                    <option value="mev-cm2-g">MeV·cm²/g</option>
                  </select>
                  <div class="flex items-center" data-testid="inverse-stp-result-low-{i}">
                    {#if row.status === "valid" && row.energyLowMevNucl !== null}
                      <span class="text-sm font-mono">{formatEnergy(row.energyLowMevNucl)}</span>
                    {:else if row.status === "invalid" || row.status === "no-solution" || row.status === "error"}
                      <span class="text-sm text-destructive">{row.message ?? "—"}</span>
                    {:else if row.status === "empty"}
                      <span class="text-sm text-muted-foreground"></span>
                    {:else}
                      <span class="text-sm text-muted-foreground">—</span>
                    {/if}
                  </div>
                  <div class="flex items-center" data-testid="inverse-stp-result-high-{i}">
                    {#if row.status === "valid" && row.energyHighMevNucl !== null}
                      <span class="text-sm font-mono">{formatEnergy(row.energyHighMevNucl)}</span>
                    {:else if row.status === "invalid" || row.status === "no-solution" || row.status === "error"}
                      <span class="text-sm text-destructive">{row.message ?? "—"}</span>
                    {:else if row.status === "empty"}
                      <span class="text-sm text-muted-foreground"></span>
                    {:else}
                      <span class="text-sm text-muted-foreground">—</span>
                    {/if}
                  </div>
                </div>
                <!-- Error row display -->
                {#if (row.status === "invalid" || row.status === "no-solution" || row.status === "error") && row.message}
                  <div data-testid="inverse-stp-row-error-{i}" class="text-sm text-destructive">
                    {row.message}
                  </div>
                {/if}
              {/each}
              <!-- Add row button -->
              <button
                type="button"
                class="text-sm text-primary hover:underline mt-2"
                onclick={() => inverseLookupState?.addStpRow()}
              >
                + Add row
              </button>
            </div>

            <!-- Valid STP range hint -->
            {#if entityState.isComplete && energyRangeLabel}
              <p class="text-xs text-muted-foreground mt-4">
                Particle/material: {entityState.selectedParticle?.name} in {entityState
                  .selectedMaterial?.name}
              </p>
            {/if}
          </div>
        </div>
      {/if}
      {#if programLabel}
        <p class="text-sm text-muted-foreground -mt-2">{programLabel}</p>
      {/if}
      {#if entityState.isComplete && energyRangeLabel}
        <p class="text-xs text-muted-foreground">
          Valid range: {energyRangeLabel}
          ({entityState.selectedProgram.id === -1
            ? ((entityState.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto")
            : entityState.selectedProgram.name},
          {entityState.selectedParticle?.name ?? ""})
        </p>
      {/if}
      {#if calcState?.hasLargeInput}
        <p class="text-sm text-amber-600" role="status">
          Large input ({calcState.rows.filter((r) => r.status !== "empty").length} values). Calculation
          may be slow.
        </p>
      {/if}
    </div>
  {/if}
</div>
