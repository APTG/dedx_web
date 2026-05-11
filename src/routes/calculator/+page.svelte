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
  import {
    createMultiProgramState,
    type MultiProgramState,
  } from "$lib/state/multi-program.svelte";
  import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
  import EntitySelectionComboboxes from "$lib/components/entity-selection-comboboxes.svelte";
  import MultiProgramPicker from "$lib/components/multi-program-picker.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import ResultTable from "$lib/components/result-table.svelte";
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
  import type { InverseCsdaResult } from "$lib/wasm/types";

  let entityState = $state<EntitySelectionState | null>(null);
  let calcState = $state<CalculatorState | null>(null);
  let energyRangeLabel = $state<string>("");
  let urlInitialized = $state(false);
  let multiProgState = $state<MultiProgramState | null>(null);
  let inverseLookupState = $state<InverseLookupState | null>(null);
  let sharedUrlCompound = $state<StoredCompoundInternal | null>(null);
  let sharedUrlWarning = $state<string | null>(null);

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

  $effect(() => {
    // Initialize advanced mode from URL IMMEDIATELY when WASM is ready, before the
    // async getService() callback runs. This ensures the tabs render correctly when
    // the page loads with ?advanced=1 — otherwise the component renders with
    // isAdvancedMode.value = false and there's a reactivity glitch when it later
    // becomes true inside the async callback.
    if (wasmReady.value) {
      initAdvancedModeFromUrl(page.url.searchParams);
    }

    if (wasmReady.value && !entityState && !calcState) {
      getService().then((service) => {
        const matrix = buildCompatibilityMatrix(service);
        entityState = createEntitySelectionState(matrix);
        calcState = createCalculatorState(entityState, service);
        inverseLookupState = createInverseLookupState(entityState);

        // Load advanced options from localStorage first
        loadAdvancedOptionsFromStorage();

        const urlState = decodeCalculatorUrl(page.url.searchParams);

        // Restore advanced options from URL (URL takes priority over localStorage which was loaded above)
        const urlAdvOpts = urlState.advancedOptions;
        if (urlAdvOpts) {
          advancedOptions.value = urlAdvOpts;
        }

        // Select particle/material/program FIRST before initializing rows
        // This ensures entitySelection.isComplete is true when validation runs
        if (urlState.particleId !== null) entityState.selectParticle(urlState.particleId);
        const customFromUrl = restoreCustomCompoundFromUrl(urlState);
        if (customFromUrl) {
          entityState.selectMaterial(customFromUrl.id);
        } else if (urlState.materialId !== null) {
          entityState.selectMaterial(urlState.materialId);
        }
        if (urlState.programId !== null) entityState.selectProgram(urlState.programId);
        calcState.setMasterUnit(urlState.masterUnit);
        if (page.url.searchParams.has("energies") && calcState) {
          urlState.rows.forEach((r, i) => {
            const text = r.unitFromSuffix ? `${r.rawInput} ${r.unit}` : r.rawInput;
            if (i === 0) {
              calcState.updateRowText(0, text);
            } else {
              calcState.addRow();
              calcState.updateRowText(i, text);
            }
          });
        }

        // Restore inverse lookup mode from URL (AFTER particle/material selected)
        const inverseMode = decodeInverseModeFromUrl(page.url.searchParams);
        if (inverseMode && isAdvancedMode.value) {
          inverseLookupState.setActiveTab(inverseMode.imode);
          // Initialize inverse rows from URL
          if (inverseMode.ivalues && inverseMode.ivalues.length > 0) {
            // Clear default empty rows
            inverseLookupState.rangeRows.length = 0;
            inverseLookupState.stpRows.length = 0;

            for (let i = 0; i < inverseMode.ivalues.length; i++) {
              const ival = inverseMode.ivalues[i];
              const text = ival.unitFromSuffix ? `${ival.rawInput} ${ival.unit}` : ival.rawInput;
              if (inverseMode.imode === "csda") {
                if (i === 0) {
                  inverseLookupState.addRangeRow();
                  inverseLookupState.updateRangeRowText(0, text);
                } else {
                  inverseLookupState.addRangeRow();
                  inverseLookupState.updateRangeRowText(i, text);
                }
              } else if (inverseMode.imode === "stp") {
                if (i === 0) {
                  inverseLookupState.addStpRow();
                  inverseLookupState.updateStpRowText(0, text);
                } else {
                  inverseLookupState.addStpRow();
                  inverseLookupState.updateStpRowText(i, text);
                }
              }
            }
          }
          // Set master unit for Range (CSDA) mode
          if (inverseMode.imode === "csda" && inverseMode.iunit) {
            const validRangeUnits = ["nm", "um", "mm", "cm", "m"] as const;
            if (validRangeUnits.includes(inverseMode.iunit as any)) {
              inverseLookupState.setRangeMasterUnit(inverseMode.iunit as any);
            }
          }
          // Set master unit for STP mode
          if (inverseMode.imode === "stp" && inverseMode.iunit) {
            const validStpUnits = ["kev-um", "mev-cm", "mev-cm2-g"] as const;
            if (validStpUnits.includes(inverseMode.iunit as any)) {
              inverseLookupState.setStpMasterUnit(inverseMode.iunit as any);
            }
          }
        }

        urlInitialized = true;
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
    if (!calcState || !entityState?.isComplete || isAdvancedMode.value) return;
    calcState.triggerCalculation();
  });

  $effect(() => {
    // Read advOptsKey to establish reactive dependency on nested changes
    const _advOptsKey = advOptsKey;
    void _advOptsKey;

    if (!urlInitialized || !calcState || !entityState) return;

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
    const customUrlFields = isCustomMaterial(selectedMaterial)
      ? customMaterialUrlFields(selectedMaterial)
      : {};

    const urlState = {
      particleId: entityState.selectedParticle?.id ?? null,
      materialId:
        selectedMaterial && typeof selectedMaterial.id === "number" ? selectedMaterial.id : null,
      programId: entityState.resolvedProgramId,
      rows: calcState.rows,
      masterUnit: calcState.masterUnit,
      ...customUrlFields,
      // Include advanced mode state when active
      ...(multiProgState
        ? {
            isAdvancedMode: true,
            // Emit ALL selected programs in display order (default program first)
            // so the URL is the canonical full list and consumers can reconstruct
            // the complete comparison without needing to infer the default.
            selectedProgramIds: multiProgState.selectedProgramIds,
            hiddenProgramIds: multiProgState.selectedProgramIds.filter(
              (id) => multiProgState.columnVisibility.get(id) === false,
            ),
            quantityFocus: multiProgState.quantityFocus,
            // Include advanced options when in advanced mode
            advancedOptions: advancedOptions.value,
            materialIsGas: entityState.selectedMaterial?.isGasByDefault,
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
        // Snapshot the (programId, particleId) we're querying for so a
        // slower in-flight `getService()` resolution cannot overwrite a
        // fresher selection (race when the user changes particle or
        // program quickly).
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
          const min = service.getMinEnergy(programId, particleId);
          const max = service.getMaxEnergy(programId, particleId);
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
  let programPickerInteracted = $state(false);

  $effect(() => {
    // Only run when actively entering Advanced mode with a live state object.
    if (!isAdvancedMode.value || !multiProgState) {
      // Reset per-session interaction flag when leaving Advanced mode.
      programPickerInteracted = false;
      return;
    }

    // Read the current count once per mode-entry (i.e. when the effect first fires
    // for this multiProgState instance). Using a snapshot prevents the count from
    // being incremented again if multiProgState is recreated while the mode stays on.
    const storageKey = "dedx_adv_hint_count";
    const count = parseInt(localStorage.getItem(storageKey) || "0", 10);

    if (count < 2 && !programPickerInteracted) {
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

  function handleProgramPickerInteraction(): void {
    programPickerInteracted = true;
    if (showAdvancedHint) {
      dismissAdvancedHint();
    }
  }

  $effect(() => {
    if (calcState && entityState) {
      initExportState(calcState, entityState);
    }
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

    // Initialize with the resolved program as default
    const defaultProgramId = entityState.resolvedProgramId;
    if (defaultProgramId !== null && defaultProgramId !== -1) {
      newState.addProgram(defaultProgramId);
    }

    // Restore selected programs from URL
    if (multiParams.mode === "advanced" && multiParams.parsedProgramIds) {
      // Filter to only include valid programs (available and compatible)
      const availableIds = new Set(entityState.availablePrograms.map((p) => p.id));
      const validProgramIds = multiParams.parsedProgramIds.filter((id) => availableIds.has(id));

      // Add programs from URL (excluding default which is already added)
      for (const programId of validProgramIds) {
        if (programId !== defaultProgramId) {
          newState.addProgram(programId);
        }
      }

      // Restore display order (default must be first)
      if (validProgramIds.length > 0) {
        const orderedIds = [
          defaultProgramId !== null ? defaultProgramId : validProgramIds[0],
          ...validProgramIds.filter((id) => id !== defaultProgramId),
        ];
        newState.setProgramDisplayOrder(orderedIds);
      }

      // Restore hidden programs
      if (multiParams.parsedHiddenIds) {
        for (const hiddenId of multiParams.parsedHiddenIds) {
          if (availableIds.has(hiddenId) && hiddenId !== defaultProgramId) {
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

    return () => {
      multiProgState = null;
    };
  });

  // Update default program when resolvedProgramId changes
  $effect(() => {
    if (!multiProgState || !entityState) return;

    const defaultProgramId = entityState.resolvedProgramId;
    if (defaultProgramId !== null && defaultProgramId !== -1) {
      // Only update if the default program has changed
      const currentDefault = multiProgState.selectedProgramIds[0];
      if (currentDefault !== defaultProgramId) {
        if (!multiProgState.selectedProgramIds.includes(defaultProgramId)) {
          multiProgState.addProgram(defaultProgramId);
        }
        multiProgState.setDefaultProgram(defaultProgramId);
      }
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

  // Debounced calculation for multi-program mode
  $effect(() => {
    // Read advOptsKey to establish reactive dependency on all advanced option fields.
    // Without this, changing density/aggregate state etc. would not retrigger this
    // calculation since advancedOptions.value is only read inside the setTimeout
    // callback (async context), which does not register reactive dependencies.
    const _advOptsKey = advOptsKey;
    void _advOptsKey;

    if (!multiProgState || !entityState || !calcState || !entityState.isComplete) return;

    const selectedProgramIds = multiProgState.selectedProgramIds;
    if (selectedProgramIds.length === 0) return;

    const particleId = entityState.selectedParticle?.id;
    const material = entityState.selectedMaterial;
    const materialId = material?.id;
    const customMaterial = isCustomMaterial(material) ? material : null;
    if (particleId === null || materialId === null) return;

    const validRows = calcState.rows.filter(
      (r) => r.status === "valid" && r.normalizedMevNucl !== null,
    );

    if (validRows.length === 0) return;

    const energies = validRows.map((r) => r.normalizedMevNucl as number);
    // Snapshot advanced options synchronously (before async) so the timer closure
    // uses the options that were active when the effect fired.
    const advOptsSnapshot = advancedOptions.value;

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
      const results = new Map();
      if (inputSnapshot.customMaterial) {
        for (const programId of inputSnapshot.selectedProgramIds) {
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
            results.set(programId, e instanceof Error ? e : new Error(String(e)));
          }
        }
      } else if (typeof inputSnapshot.materialId === "number") {
        const builtInResults = service.calculateMulti({
          programIds: inputSnapshot.selectedProgramIds,
          particleId: inputSnapshot.particleId,
          materialId: inputSnapshot.materialId,
          energies: inputSnapshot.energies,
          options: advOptsSnapshot,
        });
        for (const [programId, result] of builtInResults) {
          results.set(programId, result);
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

  // Inverse lookup calculation effects - snapshot deps synchronously before async
  $effect(() => {
    // Read advOptsKey and activeTab to establish reactive dependencies
    const _advOptsKey = advOptsKey;
    void _advOptsKey;
    if (!inverseLookupState || !entityState || !calcState || !entityState.isComplete) return;
    if (inverseLookupState.activeTab !== "csda") return;

    // Snapshot all reactive deps synchronously at the top
    const _rangeMasterUnit = inverseLookupState.rangeMasterUnit;
    void _rangeMasterUnit;
    const advOptsSnapshot = advancedOptions.value;
    const particleId = entityState.selectedParticle?.id;
    const material = entityState.selectedMaterial;
    const materialId = material?.id;
    const customMaterial = isCustomMaterial(material) ? material : null;
    const programId = entityState.resolvedProgramId;
    const rowsSnapshot = inverseLookupState.rangeRows.map((r) => ({
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

      const material = entityState?.selectedMaterial;
      const currentCustomMaterial = isCustomMaterial(material) ? material : null;
      const density =
        (currentCustomMaterial ? undefined : advOptsSnapshot.densityOverride) ??
        material?.density ??
        1;

      if (density <= 0) {
        // Mark all non-empty rows as invalid due to missing density
        for (const r of inverseLookupState.rangeRows) {
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
        for (const r of inverseLookupState.rangeRows) {
          if (r.status === "valid" || r.status === "out-of-range") {
            const result = results[resultIdx++];
            if (result instanceof Error) {
              r.energyMevNucl = null;
            } else {
              r.energyMevNucl = result.energy;
            }
          }
        }
      } catch {
        for (const r of inverseLookupState.rangeRows) {
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
    if (inverseLookupState.activeTab !== "stp") return;

    // Snapshot all reactive deps synchronously at the top
    const _stpMasterUnit = inverseLookupState.stpMasterUnit;
    void _stpMasterUnit;
    const advOptsSnapshot = advancedOptions.value;
    const particleId = entityState.selectedParticle?.id;
    const material = entityState.selectedMaterial;
    const materialId = material?.id;
    const customMaterial = isCustomMaterial(material) ? material : null;
    const programId = entityState.resolvedProgramId;
    const rowsSnapshot = inverseLookupState.stpRows.map((r) => ({
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

      const material = entityState?.selectedMaterial;
      const currentCustomMaterial = isCustomMaterial(material) ? material : null;
      const density =
        (currentCustomMaterial ? undefined : advOptsSnapshot.densityOverride) ??
        material?.density ??
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
        for (const r of inverseLookupState.stpRows) {
          if (r.status === "valid" || r.status === "no-solution") {
            const lowResult = lowResults[resultIdx];
            const highResult = highResults[resultIdx];

            if (lowResult instanceof Error && highResult instanceof Error) {
              r.status = "no-solution";
              r.energyLowMevNucl = null;
              r.energyHighMevNucl = null;
            } else {
              r.status = "valid";
              r.energyLowMevNucl = lowResult instanceof Error ? null : lowResult.energy;
              r.energyHighMevNucl = highResult instanceof Error ? null : highResult.energy;
            }

            resultIdx++;
          }
        }
      } catch {
        for (const r of inverseLookupState.stpRows) {
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
        onclick={() => calcState.resetAll()}
        title="Reset particle, material, program, and energy rows"
      >
        Reset all
      </Button>
    {/if}
  </div>
  <p class="text-muted-foreground">
    Select a particle, material, and program to calculate stopping powers and CSDA ranges.
  </p>

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
  {:else if !wasmReady.value || !entityState || !calcState}
    <div class="mx-auto max-w-4xl space-y-6" aria-busy="true" aria-label="Loading calculator">
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
      <EntitySelectionComboboxes
        selectionState={entityState}
        onParticleSelect={(particleId) => calcState.switchParticle(particleId)}
      />
      {#if isAdvancedMode.value && multiProgState && entityState}
        <div class="flex items-center gap-3 pt-2 flex-wrap">
          <MultiProgramPicker
            state={multiProgState}
            availablePrograms={entityState.availablePrograms}
            compatibleIds={new Set(entityState.availablePrograms.map((p) => p.id))}
            onInteraction={handleProgramPickerInteraction}
          />
          <!-- Table toolbar -->
          <div class="flex items-center gap-2">
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
                      {@const program = entityState.availablePrograms.find(
                        (p) => p.id === programId,
                      )}
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
                          onchange={() => multiProgState.toggleColumnVisibility(programId)}
                          class="h-4 w-4 rounded border-input"
                        />
                        <span>{program?.name ?? `Program ${programId}`}</span>
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
                onclick={() => multiProgState.setQuantityFocus("stp")}
              >
                STP only
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={multiProgState.quantityFocus === "both"}
                class="px-3 py-1.5 text-sm font-medium rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
                class:bg-accent={multiProgState.quantityFocus === "both"}
                onclick={() => multiProgState.setQuantityFocus("both")}
              >
                Both
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={multiProgState.quantityFocus === "csda"}
                class="px-3 py-1.5 text-sm font-medium rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
                class:bg-accent={multiProgState.quantityFocus === "csda"}
                onclick={() => multiProgState.setQuantityFocus("csda")}
              >
                CSDA only
              </button>
            </div>
          </div>
        </div>
        <!-- Advanced Options Panel -->
        {#if entityState}
          <AdvancedOptionsPanel
            materialIsGas={entityState.selectedMaterial?.isGasByDefault ?? false}
            materialBuiltInDensity={entityState.selectedMaterial?.density}
            materialBuiltInAggregateState={entityState.selectedMaterial
              ? entityState.selectedMaterial.isGasByDefault
                ? "gas"
                : "condensed"
              : undefined}
            isCustomCompoundActive={isCustomMaterial(entityState.selectedMaterial)}
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
            onclick={() => entityState.clearAutoFallbackMessage()}
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
      <EnergyUnitSelector
        value={calcState.masterUnit}
        availableUnits={getAvailableEnergyUnits(entityState.selectedParticle, isAdvancedMode.value)}
        disabled={calcState.isPerRowMode}
        onValueChange={(unit) => calcState.setMasterUnit(unit)}
      />

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
          <ResultTable
            state={calcState}
            entitySelection={entityState}
            multiProgramState={isAdvancedMode.value ? (multiProgState ?? undefined) : undefined}
            comparisonResults={isAdvancedMode.value ? multiProgState?.comparisonResults : undefined}
          />
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
                  inverseLookupState.setRangeMasterUnit(newUnit);
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
                    oninput={(e) => inverseLookupState.updateRangeRowText(i, e.currentTarget.value)}
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
                        inverseLookupState.setRangeMasterUnit(
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
                onclick={() => inverseLookupState.addRangeRow()}
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
                    oninput={(e) => inverseLookupState.updateStpRowText(i, e.currentTarget.value)}
                    data-testid="inverse-stp-input-{i}"
                  />
                  <select
                    data-testid="inverse-stp-unit"
                    value={row.unit}
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    onchange={(e) => {
                      inverseLookupState.setStpMasterUnit(
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
                onclick={() => inverseLookupState.addStpRow()}
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
