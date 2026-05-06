<script lang="ts">
  import { browser } from "$app/environment";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { isAdvancedMode, initAdvancedModeFromUrl } from "$lib/state/advanced-mode.svelte";
  import {
    createEntitySelectionState,
    type EntitySelectionState,
    type AutoSelectProgram,
  } from "$lib/state/entity-selection.svelte";
  import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
  import { createCalculatorState, type CalculatorState } from "$lib/state/calculator.svelte";
  import {
    createMultiProgramState,
    type MultiProgramState,
  } from "$lib/state/multi-program.svelte.ts";
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
  import { page } from "$app/state";
  import { replaceState } from "$app/navigation";
  import { untrack } from "svelte";
  import { decodeCalculatorUrl, calculatorUrlQueryString } from "$lib/utils/calculator-url";
  import { decodeMultiProgramUrl } from "$lib/state/multi-program.svelte.ts";
  import { initExportState } from "$lib/state/export.svelte";
  import {
    advancedOptions,
    loadAdvancedOptionsFromStorage,
    persistAdvancedOptions,
  } from "$lib/state/advanced-options.svelte.ts";

  let state = $state<EntitySelectionState | null>(null);
  let calcState = $state<CalculatorState | null>(null);
  let energyRangeLabel = $state<string>("");
  let urlInitialized = $state(false);
  let multiProgState = $state<MultiProgramState | null>(null);

  $effect(() => {
    if (wasmReady.value && !state && !calcState) {
      getService().then((service) => {
        const matrix = buildCompatibilityMatrix(service);
        state = createEntitySelectionState(matrix);
        calcState = createCalculatorState(state, service);

        // Load advanced options from localStorage first, then URL will override if present
        loadAdvancedOptionsFromStorage();

        const urlState = decodeCalculatorUrl(page.url.searchParams);
        // Restore advanced mode from URL (URL param overrides localStorage if present).
        initAdvancedModeFromUrl(page.url.searchParams);

        // Restore advanced options from URL (URL takes priority over localStorage which was loaded above)
        const urlAdvOpts = urlState.advancedOptions;
        if (urlAdvOpts) {
          advancedOptions.value = urlAdvOpts;
        }

        if (urlState.particleId !== null) state.selectParticle(urlState.particleId);
        if (urlState.materialId !== null) state.selectMaterial(urlState.materialId);
        if (urlState.programId !== null) state.selectProgram(urlState.programId);
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
        urlInitialized = true;
      });
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
    const _key = advOptsKey;
    persistAdvancedOptions();
  });

  $effect(() => {
    // Read advOptsKey to establish reactive dependency on nested changes
    const _key = advOptsKey;

    if (!urlInitialized || !calcState || !state) return;

    const urlState = {
      particleId: state.selectedParticle?.id ?? null,
      materialId: state.selectedMaterial?.id ?? null,
      programId: state.resolvedProgramId,
      rows: calcState.rows,
      masterUnit: calcState.masterUnit,
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
            materialIsGas: state.selectedMaterial?.isGasByDefault,
          }
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

  $effect(() => {
    if (calcState && state?.isComplete) {
      const programId = state.resolvedProgramId;
      const particleId = state.selectedParticle?.id;
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
            snapshot.programId !== state?.resolvedProgramId ||
            snapshot.particleId !== state?.selectedParticle?.id
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
    if (!state) return "";
    const program = state.selectedProgram;
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
    if (calcState && state) {
      initExportState(calcState, state);
    }
  });

  // Create/destroy multi-program state when advanced mode toggles or entity selection changes.
  //
  // IMPORTANT: All initialization must go through the local `newState` variable. Never read
  // the outer reactive `multiProgState` signal inside this effect after writing to it — doing so
  // creates a self-dependency (the effect reads `multiProgState`, which it also writes, causing
  // it to re-schedule itself on every run → effect_update_depth_exceeded).
  $effect(() => {
    if (!isAdvancedMode.value || !state || !calcState) {
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
    const defaultProgramId = state.resolvedProgramId;
    if (defaultProgramId !== null && defaultProgramId !== -1) {
      newState.addProgram(defaultProgramId);
    }

    // Restore selected programs from URL
    if (multiParams.mode === "advanced" && multiParams.parsedProgramIds) {
      // Filter to only include valid programs (available and compatible)
      const availableIds = new Set(state.availablePrograms.map((p) => p.id));
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
    if (!multiProgState || !state) return;

    const defaultProgramId = state.resolvedProgramId;
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

  // Debounced calculation for multi-program mode
  $effect(() => {
    if (!multiProgState || !state || !calcState || !state.isComplete) return;

    const selectedProgramIds = multiProgState.selectedProgramIds;
    if (selectedProgramIds.length === 0) return;

    const particleId = state.selectedParticle?.id;
    const materialId = state.selectedMaterial?.id;
    if (particleId === null || materialId === null) return;

    const validRows = calcState.rows.filter(
      (r) => r.status === "valid" && r.normalizedMevNucl !== null,
    );

    if (validRows.length === 0) return;

    const energies = validRows.map((r) => r.normalizedMevNucl as number);

    // Capture inputs as snapshot so that a stale `getService()` resolution
    // (race: user changed selection while the async call was in-flight) cannot
    // overwrite the current state with results computed for different inputs.
    const inputSnapshot = { selectedProgramIds, particleId, materialId, energies };
    let cancelled = false;

    // Debounce the calculation
    const timer = setTimeout(async () => {
      if (cancelled || !multiProgState) return;
      const service = await getService();
      // Check whether the inputs have already changed since the timer fired.
      if (cancelled) return;
      const results = service.calculateMulti({
        programIds: inputSnapshot.selectedProgramIds,
        particleId: inputSnapshot.particleId,
        materialId: inputSnapshot.materialId,
        energies: inputSnapshot.energies,
        options: advancedOptions.value,
      });

      if (!cancelled) {
        multiProgState.setComparisonResults(results);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });
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
  {:else if !wasmReady.value || !state || !calcState}
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
      <SelectionLiveRegion {state} />
      <EntitySelectionComboboxes
        {state}
        onParticleSelect={(particleId) => calcState.switchParticle(particleId)}
      />
      {#if isAdvancedMode.value && multiProgState && state}
        <div class="flex items-center gap-3 pt-2 flex-wrap">
          <MultiProgramPicker
            state={multiProgState}
            availablePrograms={state.availablePrograms}
            compatibleIds={new Set(state.availablePrograms.map((p) => p.id))}
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
                      {@const program = state.availablePrograms.find((p) => p.id === programId)}
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
        {#if state}
          <AdvancedOptionsPanel
            materialIsGas={state.selectedMaterial?.isGasByDefault ?? false}
            materialBuiltInDensity={state.selectedMaterial?.density}
            materialBuiltInAggregateState={state.selectedMaterial
              ? state.selectedMaterial.isGasByDefault
                ? "gas"
                : "condensed"
              : undefined}
            selectedProgram={"resolvedProgram" in state.selectedProgram
              ? (state.selectedProgram.resolvedProgram?.name ?? "")
              : state.selectedProgram.name}
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
      {#if state.lastAutoFallbackMessage}
        <div
          class="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <span role="status" aria-live="polite">{state.lastAutoFallbackMessage}</span>
          <button
            class="ml-2 text-amber-600 hover:text-amber-800 text-lg leading-none"
            aria-label="Dismiss"
            onclick={() => state.clearAutoFallbackMessage()}
          >
            ×
          </button>
        </div>
      {/if}
      <EnergyUnitSelector
        value={calcState.masterUnit}
        availableUnits={getAvailableEnergyUnits(state.selectedParticle, isAdvancedMode.value)}
        disabled={calcState.isPerRowMode}
        onValueChange={(unit) => calcState.setMasterUnit(unit)}
      />
      <div class="rounded-lg border bg-card p-3 sm:p-6">
        <ResultTable
          state={calcState}
          entitySelection={state}
          multiProgramState={isAdvancedMode.value ? (multiProgState ?? undefined) : undefined}
          comparisonResults={isAdvancedMode.value ? multiProgState?.comparisonResults : undefined}
        />
      </div>
      {#if programLabel}
        <p class="text-sm text-muted-foreground -mt-2">{programLabel}</p>
      {/if}
      {#if state.isComplete && energyRangeLabel}
        <p class="text-xs text-muted-foreground">
          Valid range: {energyRangeLabel}
          ({state.selectedProgram.id === -1
            ? ((state.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto")
            : state.selectedProgram.name},
          {state.selectedParticle?.name ?? ""})
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
