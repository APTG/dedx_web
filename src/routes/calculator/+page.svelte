<script lang="ts">
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import { type AutoSelectProgram } from "$lib/state/entity-selection.svelte";

  import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
  import EntitySelection from "$lib/components/entity-selection/entity-selection.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import ResultTable from "$lib/components/result-table.svelte";
  import TableBasic from "$lib/components/results/table-basic.svelte";
  import TableAdvanced from "$lib/components/results/table-advanced.svelte";
  import TableInverseStp from "$lib/components/results/table-inverse-stp.svelte";
  import UnitAnchorStrip from "$lib/components/results/unit-anchor-strip.svelte";
  import CompareAcrossStrip from "$lib/components/results/compare-across-strip.svelte";
  import TableMulti from "$lib/components/results/table-multi.svelte";
  import QuantityToggle from "$lib/components/results/quantity-toggle.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { isCustomMaterial } from "$lib/utils/custom-compound-material";
  import { initExportState } from "$lib/state/export.svelte";
  import { advancedOptions } from "$lib/state/advanced-options.svelte";
  import { getEnergyAnchorOptions } from "$lib/utils/energy-anchor-options";
  import { buildCalculatorPdfMetadata } from "$lib/utils/calculator-pdf-metadata";
  import { type EnergyUnit } from "$lib/wasm/types";
  import UrlVersionWarningBanner from "$lib/components/url-version-warning-banner.svelte";
  import ExternalSourcesPanel from "$lib/components/entity-selection/external-sources-panel.svelte";
  import LoadExternalModal from "$lib/components/entity-selection/load-external-modal.svelte";
  import { goto } from "$app/navigation";
  import type { ExternalSourceDescriptor } from "$lib/external-data/types";
  import type { ExternalStoreMetadata } from "$lib/external-data/schema";
  import { externalDataService } from "$lib/external-data/service";

  import PageErrorFallback from "$lib/components/layout/page-error-fallback.svelte";
  import AdvancedHint from "$lib/components/calculator/advanced-hint.svelte";
  import SharedCompoundAlert from "$lib/components/calculator/shared-compound-alert.svelte";
  import { createCalculatorPageOrchestrator } from "$lib/state/calculator-page-orchestrator.svelte";

  import { appInit } from "$lib/state/app-init.svelte";

  let showLoadExternalModal = $state(false);

  let loadedExternalSources = $derived(appInit.loadedExternalSources);
  let externalLoading = $derived(appInit.isInitializing && appInit.hasExternalSources);
  let externalError = $derived(appInit.error);

  function handleRemoveExternalSource(label: string): void {
    appInit.removeExternalSource(label);
  }

  async function handleModalLoad(
    descriptor: ExternalSourceDescriptor,
    metadata: ExternalStoreMetadata,
  ) {
    showLoadExternalModal = false;
    appInit.addExternalSource(descriptor, metadata);
  }

  function handleLoadDefaults() {
    goto("/calculator", { replaceState: true });
    orchestrator.urlVersionMismatch = null;
  }

  const orchestrator = createCalculatorPageOrchestrator();

  let calcState = $derived(orchestrator.calcState);
  let energyRangeLabel = $derived(orchestrator.energyRangeLabel);
  let urlVersionMismatch = $derived(orchestrator.urlVersionMismatch);
  let multiProgState = $derived(orchestrator.multiProgState);
  let multiEntityState = $derived(orchestrator.multiEntityState);
  let inverseLookupState = $derived(orchestrator.inverseLookupState);

  $effect(() => {
    if (calcState && appInit.entityState) {
      initExportState(calcState, appInit.entityState);
    }
    // Set the advanced metadata getter callback for PDF export
    import("$lib/state/export.svelte").then((mod) => {
      mod.getCalculatorAdvancedMetadata.value = () => {
        if (!isAdvancedMode.value) return null;
        if (!appInit.entityState || !calcState) return null;
        return buildCalculatorPdfMetadata(appInit.entityState, advancedOptions.value);
      };
    });
  });

  let programLabel = $derived.by(() => {
    if (!appInit.entityState) return "";
    const program = appInit.entityState.selectedProgram;
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
</script>

<svelte:head>
  <title>Calculator - dEdx Web</title>
</svelte:head>

<div class="container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
  <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight text-foreground">Stopping Power Calculator</h1>
      <p class="text-muted-foreground mt-2">
        Calculate dE/dx and ranges for various particles and materials.
      </p>
    </div>
  </div>

  <PageErrorFallback {externalError} fallbackUrl="/calculator" />

  {#if urlVersionMismatch}
    <div class="mb-6">
      <UrlVersionWarningBanner
        version={urlVersionMismatch.version}
        onLoadDefaults={handleLoadDefaults}
      />
    </div>
  {/if}

  {#if externalLoading}
    <div class="mx-auto max-w-md space-y-4">
      <Skeleton class="h-8 w-3/4 mx-auto" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-5/6 mx-auto" />
    </div>
  {:else if appInit.entityState && calcState}
    {@const es = appInit.entityState}
    <div class="space-y-6">
      <SelectionLiveRegion state={es} />

      <EntitySelection
        selectionState={es}
        onParticleSelect={(particleId) => calcState?.switchParticle(particleId)}
        collapsible={true}
        onLoadExternal={() => (showLoadExternalModal = true)}
      />

      {#if Object.keys(loadedExternalSources).length > 0}
        <ExternalSourcesPanel
          sources={loadedExternalSources}
          onRemove={handleRemoveExternalSource}
        />
      {/if}

      <LoadExternalModal
        open={showLoadExternalModal}
        existingLabels={new Set([
          ...loadedExternalSources.map((s) => s.label),
          ...externalDataService.getLoadedLabels(),
        ])}
        onCancel={() => (showLoadExternalModal = false)}
        onLoad={handleModalLoad}
      />

      {#if isAdvancedMode.value}
        <div class="flex items-center gap-3 pt-2 flex-wrap">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >Compare across</span
          >
          <CompareAcrossStrip value={es.across} onChange={(v) => es.setAcross(v)} />
        </div>

        {#if es.across === "program" || es.across === "single"}
          {@const selMatAdv = es.selectedMaterial}
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
            selectedProgram={es.selectedProgram.id === -1
              ? ((es.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "")
              : es.selectedProgram.name}
          />
        {/if}
      {/if}

      <AdvancedHint {multiProgState} />

      {#if es.lastAutoFallbackMessage}
        <div
          class="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <span role="status" aria-live="polite">{es.lastAutoFallbackMessage}</span>
          <button
            class="ml-2 text-amber-600 hover:text-amber-800 text-lg leading-none"
            aria-label="Dismiss"
            onclick={() => es.clearAutoFallbackMessage()}
          >
            ×
          </button>
        </div>
      {/if}

      <SharedCompoundAlert
        bind:sharedUrlCompound={orchestrator.sharedUrlCompound}
        bind:sharedUrlWarning={orchestrator.sharedUrlWarning}
      />

      {#if isAdvancedMode.value && ((multiProgState !== null && multiProgState.selectedProgramIds.length > 1) || multiEntityState !== null)}
        <UnitAnchorStrip
          options={getEnergyAnchorOptions(
            es.selectedParticle && "massNumber" in es.selectedParticle ? es.selectedParticle : null,
            isAdvancedMode.value,
          )}
          selected={calcState.masterUnit}
          onSelect={(v) => calcState?.setMasterUnit(v as EnergyUnit)}
          disabled={calcState.isPerRowMode}
        />
      {/if}

      {#if isAdvancedMode.value}
        <!-- Tab switcher for Advanced mode -->
        <div class="border-b">
          <div class="flex gap-2" role="tablist" aria-label="Calculator mode">
            <button
              role="tab"
              aria-selected={inverseLookupState?.activeTab === "forward"}
              class="flex flex-col items-start px-4 py-2 text-sm border-b-2 transition-colors"
              class:border-primary={inverseLookupState?.activeTab === "forward"}
              class:border-transparent={inverseLookupState?.activeTab !== "forward"}
              class:text-foreground={inverseLookupState?.activeTab === "forward"}
              class:text-muted-foreground={inverseLookupState?.activeTab !== "forward"}
              onclick={() => inverseLookupState?.setActiveTab("forward")}
              data-testid="inverse-tab-forward"
            >
              <span class="hidden min-[400px]:block font-bold">Energy →</span>
              <span class="hidden min-[400px]:block text-xs font-normal text-muted-foreground"
                >→ STP, Range</span
              >
              <span class="min-[400px]:hidden font-bold">E→</span>
            </button>
            <button
              role="tab"
              aria-selected={inverseLookupState?.activeTab === "csda"}
              class="flex flex-col items-start px-4 py-2 text-sm border-b-2 transition-colors"
              class:border-primary={inverseLookupState?.activeTab === "csda"}
              class:border-transparent={inverseLookupState?.activeTab !== "csda"}
              class:text-foreground={inverseLookupState?.activeTab === "csda"}
              class:text-muted-foreground={inverseLookupState?.activeTab !== "csda"}
              onclick={() => inverseLookupState?.setActiveTab("csda")}
              data-testid="inverse-tab-range"
            >
              <span class="hidden min-[400px]:block font-bold">Range →</span>
              <span class="hidden min-[400px]:block text-xs font-normal text-muted-foreground"
                >→ Energy</span
              >
              <span class="min-[400px]:hidden font-bold">R→</span>
            </button>
            <button
              role="tab"
              aria-selected={inverseLookupState?.activeTab === "stp"}
              class="flex flex-col items-start px-4 py-2 text-sm border-b-2 transition-colors"
              class:border-primary={inverseLookupState?.activeTab === "stp"}
              class:border-transparent={inverseLookupState?.activeTab !== "stp"}
              class:text-foreground={inverseLookupState?.activeTab === "stp"}
              class:text-muted-foreground={inverseLookupState?.activeTab !== "stp"}
              onclick={() => inverseLookupState?.setActiveTab("stp")}
              data-testid="inverse-tab-stp"
            >
              <span class="hidden min-[400px]:block font-bold">STP →</span>
              <span class="hidden min-[400px]:block text-xs font-normal text-muted-foreground"
                >→ Energy</span
              >
              <span class="min-[400px]:hidden font-bold">S→</span>
            </button>
          </div>
        </div>
      {/if}

      <!-- Forward tab content (default) -->
      {#if !inverseLookupState || !isAdvancedMode.value || inverseLookupState.activeTab === "forward"}
        <div class="rounded-lg border bg-card p-3 sm:p-6">
          {#if isAdvancedMode.value && es.across === "program" && multiProgState && multiProgState.selectedProgramIds.length > 1}
            <div class="mb-3">
              <QuantityToggle
                value={multiProgState.quantityFocus}
                onChange={(v) => multiProgState?.setQuantityFocus(v)}
              />
            </div>
            <ResultTable
              {calcState}
              entitySelection={es}
              multiProgramState={multiProgState}
              comparisonResults={multiProgState.comparisonResults}
            />
          {:else if isAdvancedMode.value && multiEntityState && (es.across === "material" || es.across === "particle")}
            {@const entityIds = (
              es.across === "material" ? es.multiSelected.material : es.multiSelected.particle
            ) as import("$lib/external-data/types").EntityId[]}
            <div class="mb-3">
              <QuantityToggle
                value={multiEntityState.quantityFocus}
                onChange={(v) => multiEntityState?.setQuantityFocus(v)}
              />
            </div>
            <TableMulti
              {calcState}
              {entityIds}
              results={multiEntityState.comparisonResults}
              entityName={(id) => multiEntityState?.entityName(id) ?? String(id)}
              quantityFocus={multiEntityState.quantityFocus}
              getDensity={(entityId) => {
                if (es.across !== "material") {
                  return advancedOptions.value.densityOverride ?? es.selectedMaterial?.density ?? 1;
                }
                if (typeof entityId === "number") {
                  return es.allMaterials.find((m) => m.id === entityId)?.density ?? 1;
                }
                if (String(entityId).startsWith("ext:")) {
                  return es.externalOnlyMaterials.find((m) => m.id === entityId)?.density ?? 1;
                }
                return 1;
              }}
            />
          {:else if isAdvancedMode.value}
            <TableAdvanced mode="energy" {calcState} entitySelection={es} />
          {:else}
            <TableBasic {calcState} entitySelection={es} />
          {/if}
        </div>
      {/if}

      <!-- Range lookup tab content -->
      {#if inverseLookupState && isAdvancedMode.value && inverseLookupState.activeTab === "csda"}
        <div class="rounded-lg border bg-card p-3 sm:p-6">
          {#if es.across !== "single"}
            <div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 mb-4">
              <p class="font-medium text-sm">Not supported</p>
              <p class="text-sm mt-1">
                Inverse lookups are currently only supported when calculating for a single particle,
                material, and program.
              </p>
            </div>
          {:else}
            <TableAdvanced mode="range" {inverseLookupState} />
            {#if es.isComplete && energyRangeLabel}
              <p class="text-xs text-muted-foreground mt-4">
                Valid range: {energyRangeLabel}
                ({es.selectedProgram.id === -1
                  ? ((es.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto")
                  : es.selectedProgram.name},
                {es.selectedParticle?.name ?? ""})
              </p>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- STP lookup tab content -->
      {#if inverseLookupState && isAdvancedMode.value && inverseLookupState.activeTab === "stp"}
        <div class="rounded-lg border bg-card p-3 sm:p-6">
          {#if es.across !== "single"}
            <div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 mb-4">
              <p class="font-medium text-sm">Not supported</p>
              <p class="text-sm mt-1">
                Inverse lookups are currently only supported when calculating for a single particle,
                material, and program.
              </p>
            </div>
          {:else}
            <TableInverseStp {inverseLookupState} />
            {#if es.isComplete && energyRangeLabel}
              <p class="text-xs text-muted-foreground mt-4">
                Valid range: {energyRangeLabel}
                ({es.selectedProgram.id === -1
                  ? ((es.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto")
                  : es.selectedProgram.name},
                {es.selectedParticle?.name ?? ""})
              </p>
            {/if}
          {/if}
        </div>
      {/if}

      {#if es.isComplete && energyRangeLabel}
        <p class="text-xs text-muted-foreground">
          Valid range: {energyRangeLabel}
          ({es.selectedProgram.id === -1
            ? ((es.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto")
            : es.selectedProgram.name},
          {es.selectedParticle?.name ?? ""})
        </p>
      {/if}

      {#if programLabel}
        <p class="text-xs text-muted-foreground border-t pt-2">
          {programLabel}
        </p>
      {/if}
    </div>
  {/if}
</div>
