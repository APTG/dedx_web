<script lang="ts">
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import { type AutoSelectProgram } from "$lib/state/entity-selection.svelte";

  import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
  import EntitySelection from "$lib/components/entity-selection/entity-selection.svelte";
  import SelectionLiveRegion from "$lib/components/selection-live-region.svelte";
  import ResultTable from "$lib/components/results/table-multi-program.svelte";
  import TableBasic from "$lib/components/results/table-basic.svelte";
  import TableBasicRange from "$lib/components/results/table-basic-range.svelte";
  import TableBasicStp from "$lib/components/results/table-basic-stp.svelte";
  import TableAdvanced from "$lib/components/results/table-advanced.svelte";
  import TableInverseStp from "$lib/components/results/table-inverse-stp.svelte";
  import UnitAnchorStrip from "$lib/components/results/unit-anchor-strip.svelte";
  import ProgramAnnotation from "$lib/components/program-annotation.svelte";
  import CompareAcrossStrip from "$lib/components/results/compare-across-strip.svelte";
  import TableMulti from "$lib/components/results/table-multi.svelte";
  import QuantityToggle from "$lib/components/results/quantity-toggle.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { isCustomMaterial } from "$lib/utils/custom-compound-material";
  import { initExportState } from "$lib/state/export.svelte";
  import { advancedOptions } from "$lib/state/advanced-options.svelte";
  import { getEnergyAnchorOptions } from "$lib/utils/energy-anchor-options";
  import { isHeavyIonParticle } from "$lib/utils/available-units";
  import { buildCalculatorPdfMetadata } from "$lib/utils/calculator-pdf-metadata";
  import { type EnergyUnit } from "$lib/wasm/types";
  import UrlVersionWarningBanner from "$lib/components/url-version-warning-banner.svelte";
  import ExternalSourcesPanel from "$lib/components/entity-selection/external-sources-panel.svelte";
  import LoadExternalModal from "$lib/components/entity-selection/load-external-modal.svelte";
  import { goto } from "$app/navigation";
  import type { ExternalSourceDescriptor } from "$lib/external-data/types";
  import type { ExternalStoreMetadata } from "$lib/external-data/schema";
  import { externalDataService } from "$lib/external-data/service";

  import NoticeToast from "$lib/components/notice-toast.svelte";
  import PageErrorFallback from "$lib/components/layout/page-error-fallback.svelte";
  import AdvancedHint from "$lib/components/calculator/advanced-hint.svelte";
  import SharedCompoundAlert from "$lib/components/calculator/shared-compound-alert.svelte";
  import CompoundEditorModal from "$lib/components/compound-editor-modal.svelte";
  import { customCompounds } from "$lib/state/custom-compounds.svelte";
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

  // "Calculated with <program> (auto-selected)" annotation (#816). Basic mode
  // hides the program selector, so this names the auto-selected program; in
  // Advanced mode it reflects the user's explicit choice (no "auto-selected").
  let programAnnotation = $derived.by<{ name: string; autoSelected: boolean } | null>(() => {
    if (!appInit.entityState) return null;
    const program = appInit.entityState.selectedProgram;
    if (program.id === -1) {
      const resolvedName = (program as AutoSelectProgram).resolvedProgram?.name;
      return resolvedName ? { name: resolvedName, autoSelected: true } : null;
    }
    return { name: program.name, autoSelected: false };
  });
</script>

<svelte:head>
  <title>Calculator - dEdx Web</title>
</svelte:head>

<div class="container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
  <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        Range &amp; Stopping Power Calculator
      </h1>
      <p class="text-muted-foreground mt-2">
        Find how deep a charged particle travels — its CSDA range — and how fast it loses energy —
        its stopping power (dE/dx) — in any material. Runs entirely in your browser.
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

  {#if externalLoading || !appInit.entityState || !calcState}
    <div class="mx-auto max-w-md space-y-4">
      <Skeleton class="h-8 w-3/4 mx-auto" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-5/6 mx-auto" />
    </div>
  {:else if appInit.entityState && calcState}
    {@const es = appInit.entityState}
    {@const isHeavyIon = isHeavyIonParticle(es.selectedParticle)}
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
        sharedUrlCompound={orchestrator.sharedUrlCompound}
        sharedUrlWarning={orchestrator.sharedUrlWarning}
        fromTransient={orchestrator.sharedUrlFromTransient}
        canEdit={!!orchestrator.sharedUrlCompound || !!orchestrator.sharedUrlPartial}
        onSaveToLibrary={() => orchestrator.saveSharedToLibrary()}
        onEditAndSaveCopy={() => orchestrator.openSharedCompoundEditor()}
        onDismiss={() => orchestrator.dismissSharedCompound()}
      />

      <CompoundEditorModal
        open={orchestrator.compoundEditorOpen}
        compound={null}
        prefill={orchestrator.compoundEditorPrefill}
        initialWarning={orchestrator.compoundEditorWarning}
        onOpenChange={(open) => {
          if (!open) orchestrator.closeSharedCompoundEditor();
        }}
        onSave={(data) => orchestrator.saveSharedCompoundCopy(data)}
        onDelete={() => {}}
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

      <!-- Tab switcher: shared between Basic and Advanced modes (issue #840) -->
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
              >→ Range, STP</span
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
              >→ Energy, STP</span
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
              >→ Energy, Range</span
            >
            <span class="min-[400px]:hidden font-bold">S→</span>
          </button>
        </div>
      </div>

      <!-- Forward tab content (default) -->
      {#if !inverseLookupState || inverseLookupState.activeTab === "forward"}
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
                return customCompounds.getById(String(entityId))?.density ?? 1;
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
      {#if inverseLookupState && inverseLookupState.activeTab === "csda"}
        <div class="rounded-lg border bg-card p-3 sm:p-6">
          {#if es.across !== "single"}
            <div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 mb-4">
              <p class="font-medium text-sm">Not supported</p>
              <p class="text-sm mt-1">
                Inverse lookups are currently only supported when calculating for a single particle,
                material, and program.
              </p>
            </div>
          {:else if isAdvancedMode.value}
            {@const rangeSelMat = es.selectedMaterial}
            {@const rangeIsCustom = isCustomMaterial(
              rangeSelMat && "isGasByDefault" in rangeSelMat ? rangeSelMat : null,
            )}
            <TableAdvanced
              mode="range"
              {inverseLookupState}
              stpDisplayUnit={calcState.stpDisplayUnit}
              onSelectStpUnit={(u) => calcState.setStpDisplayUnit(u)}
              density={(rangeIsCustom ? undefined : advancedOptions.value.densityOverride) ??
                rangeSelMat?.density ??
                1}
              {isHeavyIon}
            />
          {:else}
            {@const basicRangeSelMat = es.selectedMaterial}
            {@const basicRangeBuiltinMat =
              basicRangeSelMat && "isGasByDefault" in basicRangeSelMat ? basicRangeSelMat : null}
            <TableBasicRange
              {inverseLookupState}
              isGas={basicRangeBuiltinMat?.isGasByDefault ?? false}
              density={basicRangeSelMat?.density ?? 1}
              {isHeavyIon}
            />
          {/if}
          {#if es.across === "single" && es.isComplete && energyRangeLabel}
            <p class="text-xs text-muted-foreground mt-4">
              Valid range: {energyRangeLabel}
              ({es.selectedProgram.id === -1
                ? ((es.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto")
                : es.selectedProgram.name},
              {es.selectedParticle?.name ?? ""})
            </p>
          {/if}
        </div>
      {/if}

      <!-- STP lookup tab content -->
      {#if inverseLookupState && inverseLookupState.activeTab === "stp"}
        <div class="rounded-lg border bg-card p-3 sm:p-6">
          {#if es.across !== "single"}
            <div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 mb-4">
              <p class="font-medium text-sm">Not supported</p>
              <p class="text-sm mt-1">
                Inverse lookups are currently only supported when calculating for a single particle,
                material, and program.
              </p>
            </div>
          {:else if isAdvancedMode.value}
            <TableInverseStp
              {inverseLookupState}
              {isHeavyIon}
              onPlotRow={(rowIndex) => {
                const row = inverseLookupState?.stpRows[rowIndex];
                if (!row || row.energyHighMevNucl === null || row.energyLowMevNucl === null) return;
                const pId = es.selectedParticle?.id;
                const mId = es.selectedMaterial?.id;
                const progId = es.resolvedProgramId;
                if (
                  typeof pId !== "number" ||
                  typeof mId !== "number" ||
                  typeof progId !== "number"
                )
                  return;
                goto(`/plot?particle=${pId}&material=${mId}&program=${progId}&inv_stp_branch=both`);
              }}
            />
          {:else}
            {@const basicStpSelMat = es.selectedMaterial}
            {@const basicStpBuiltinMat =
              basicStpSelMat && "isGasByDefault" in basicStpSelMat ? basicStpSelMat : null}
            <TableBasicStp
              {inverseLookupState}
              isGas={basicStpBuiltinMat?.isGasByDefault ?? false}
              {isHeavyIon}
            />
          {/if}
          {#if es.across === "single" && es.isComplete && energyRangeLabel}
            <p class="text-xs text-muted-foreground mt-4">
              Valid range: {energyRangeLabel}
              ({es.selectedProgram.id === -1
                ? ((es.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto")
                : es.selectedProgram.name},
              {es.selectedParticle?.name ?? ""})
            </p>
          {/if}
        </div>
      {/if}

      <!-- Single compact row (#816 follow-up): the program name and the valid
           energy range used to sit on two separate lines and repeated the
           program name. They are merged here — "Calculated with <program>
           (auto-selected) · valid range … for <particle>" — to save vertical
           space. The valid range depends on program + particle, so the particle
           is kept; the program is named once by the annotation itself. -->
      {#if programAnnotation}
        <ProgramAnnotation
          programName={programAnnotation.name}
          autoSelected={programAnnotation.autoSelected}
          detail={es.isComplete && energyRangeLabel
            ? `valid range ${energyRangeLabel} for ${es.selectedParticle?.name ?? ""}`
            : ""}
          class="border-t pt-2"
        />
      {/if}
    </div>
  {/if}

  <!-- Basic-mode "link's program was ignored" toast (#869). -->
  <NoticeToast
    feedback={orchestrator.programFeedback}
    onDismiss={() => (orchestrator.programFeedback = null)}
    testId="calculator-notice-toast"
  />
</div>
