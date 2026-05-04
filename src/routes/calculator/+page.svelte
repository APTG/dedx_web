<script lang="ts">
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
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
  import { decodeCalculatorUrl, encodeCalculatorUrl } from "$lib/utils/calculator-url";
  import { decodeMultiProgramUrl } from "$lib/state/multi-program.svelte.ts";
  import { initExportState } from "$lib/state/export.svelte";

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

        const urlState = decodeCalculatorUrl(page.url.searchParams);
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

  $effect(() => {
    if (!urlInitialized || !calcState || !state) return;

    const params = encodeCalculatorUrl({
      particleId: state.selectedParticle?.id ?? null,
      materialId: state.selectedMaterial?.id ?? null,
      programId: state.resolvedProgramId,
      rows: calcState.rows,
      masterUnit: calcState.masterUnit,
      // Include advanced mode state when active
      ...(multiProgState
        ? {
            isAdvancedMode: true,
            selectedProgramIds: multiProgState.selectedProgramIds.filter(
              (id) => id !== state.resolvedProgramId,
            ),
            hiddenProgramIds: multiProgState.selectedProgramIds.filter(
              (id) => multiProgState.columnVisibility.get(id) === false,
            ),
            quantityFocus: multiProgState.quantityFocus,
          }
        : {}),
    });
    // Build the new URL from `window.location.pathname` rather than
    // `page.url.pathname` so reading `page.url` does not register a
    // reactive dependency on the very URL we are about to rewrite —
    // otherwise this effect re-runs on every `replaceState` and forms a
    // (silent) replaceState loop. Same pattern as plot/+page.svelte.
    const next = `${window.location.pathname}?${params.toString()}`;
    if (next === `${window.location.pathname}${window.location.search}`) return;
    replaceState(next, page.state);
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
  let programPickerInteracted = $state(false);

  $effect(() => {
    if (!isAdvancedMode.value || !multiProgState) return;

    const storageKey = "dedx_adv_hint_count";
    const count = parseInt(localStorage.getItem(storageKey) || "0", 10);

    if (count < 2 && !programPickerInteracted) {
      showAdvancedHint = true;
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
  let columnDropdownTimeout: ReturnType<typeof setTimeout> | undefined;

  function toggleColumnDropdown(): void {
    showColumnDropdown = !showColumnDropdown;
    if (showColumnDropdown) {
      // Close when clicking outside
      columnDropdownTimeout = setTimeout(() => {
        const handleOutsideClick = (e: MouseEvent) => {
          const target = e.target as Node;
          const dropdown = document.getElementById("column-visibility-dropdown");
          const button = document.getElementById("columns-button");
          if (dropdown && !dropdown.contains(target) && button && !button.contains(target)) {
            showColumnDropdown = false;
            document.removeEventListener("click", handleOutsideClick);
          }
        };
        // Use setTimeout to avoid immediate trigger
        setTimeout(() => {
          document.addEventListener("click", handleOutsideClick);
        }, 0);
      }, 0);
    } else if (columnDropdownTimeout) {
      clearTimeout(columnDropdownTimeout);
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

  // Create/destroy multi-program state when advanced mode toggles or entity selection changes
  $effect(() => {
    if (!isAdvancedMode.value || !state || !calcState) {
      multiProgState = null;
      return;
    }

    multiProgState = createMultiProgramState();
    multiProgState.setAdvancedMode(true);

    // Restore advanced mode state from URL if present
    const multiParams = decodeMultiProgramUrl(page.url.searchParams);

    // Initialize with the resolved program as default
    const defaultProgramId = state.resolvedProgramId;
    if (defaultProgramId !== null && defaultProgramId !== -1) {
      multiProgState.addProgram(defaultProgramId);
      multiProgState.setDefaultProgram(defaultProgramId);
    }

    // Restore selected programs from URL
    if (multiParams.mode === "advanced" && multiParams.parsedProgramIds) {
      // Filter to only include valid programs (available and compatible)
      const availableIds = new Set(state.availablePrograms.map((p) => p.id));
      const validProgramIds = multiParams.parsedProgramIds.filter((id) => availableIds.has(id));

      // Add programs from URL (excluding default which is already added)
      for (const programId of validProgramIds) {
        if (programId !== defaultProgramId) {
          multiProgState.addProgram(programId);
        }
      }

      // Restore display order (default must be first)
      if (validProgramIds.length > 0) {
        const orderedIds = [
          defaultProgramId !== null ? defaultProgramId : validProgramIds[0],
          ...validProgramIds.filter((id) => id !== defaultProgramId),
        ];
        multiProgState.setProgramDisplayOrder(orderedIds);
      }

      // Restore hidden programs
      if (multiParams.parsedHiddenIds) {
        for (const hiddenId of multiParams.parsedHiddenIds) {
          if (availableIds.has(hiddenId) && hiddenId !== defaultProgramId) {
            multiProgState.toggleColumnVisibility(hiddenId);
          }
        }
      }

      // Restore quantity focus
      if (
        multiParams.qfocus === "both" ||
        multiParams.qfocus === "stp" ||
        multiParams.qfocus === "csda"
      ) {
        multiProgState.setQuantityFocus(multiParams.qfocus);
      }
    }

    return () => {
      multiProgState = null;
    };
  });

  // Update default program when resolvedProgramId changes
  $effect(() => {
    if (!multiProgState || !state) return;

    const defaultProgramId = state.resolvedProgramId;
    if (defaultProgramId !== null && defaultProgramId !== -1) {
      if (!multiProgState.selectedProgramIds.includes(defaultProgramId)) {
        multiProgState.addProgram(defaultProgramId);
      }
      multiProgState.setDefaultProgram(defaultProgramId);
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

    // Debounce the calculation
    const timer = setTimeout(async () => {
      if (!multiProgState) return;
      const service = await getService();
      const results = service.calculateMulti({
        programIds: selectedProgramIds,
        particleId,
        materialId,
        energies,
      });

      multiProgState.setComparisonResults(results);
    }, 300);

    return () => {
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
