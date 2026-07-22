import { browser } from "$app/environment";
import { getService } from "$lib/wasm/loader";
import { externalDataService } from "$lib/external-data/service";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { buildExternalCompatibilityContext } from "$lib/state/external-compatibility";
import {
  createEntitySelectionState,
  type EntitySelectionState,
  WATER_ID,
} from "$lib/state/entity-selection.svelte";
import type { CompatibilityMatrix, LibdedxService } from "$lib/wasm/types";
import type { ExternalDataError } from "$lib/external-data/errors";
import type { ExternalSourceDescriptor } from "$lib/external-data/types";
import { parseExtdataParams } from "$lib/external-data/url";
import type { ExternalStoreMetadata } from "$lib/external-data/schema";

/**
 * Headless Svelte 5 state module managing application initialization.
 *
 * Orchestrates fetching the WASM service and any external data sources defined in the URL,
 * builds compatibility matrices, and prepares the core EntitySelectionState.
 * This decouples the heavy async bootstrap phase from the page UI components.
 */
export class AppInitState {
  // Reactive flags indicating initialization progress
  isInitializing = $state(false);
  error = $state<ExternalDataError | null>(null);
  /** True while `initialize()` is running and external sources were requested via URL. */
  hasExternalSources = $state(false);

  // Ready data
  service = $state<LibdedxService | null>(null);
  compatibilityMatrix = $state<CompatibilityMatrix | null>(null);
  loadedExternalSources = $state<ExternalSourceDescriptor[]>([]);
  entityState = $state<EntitySelectionState | null>(null);

  /**
   * Triggers the bootstrap process reading from current URL params.
   * Ensures the async fetch and matrix builds are done exactly once per page load.
   */
  initialize(searchParams: URLSearchParams): void {
    if (!browser || this.isInitializing || this.entityState) return;

    this.error = null;
    this.isInitializing = true;
    const extdataResult = parseExtdataParams(searchParams);
    const extSources = extdataResult.sources;
    this.hasExternalSources = extSources.length > 0;

    Promise.all([
      getService(),
      Promise.all(extSources.map((s) => externalDataService.loadSource(s))),
    ])
      .then(([service, extMetadatas]) => {
        this.loadedExternalSources = extSources;
        this.service = service;

        const matrix = buildCompatibilityMatrix(service);
        this.compatibilityMatrix = matrix;
        const extCtx = buildExternalCompatibilityContext(
          extMetadatas,
          matrix.allParticles,
          matrix.allMaterials,
        );

        const newEntityState = createEntitySelectionState(matrix, service);
        newEntityState.setExternalContext(extCtx);

        this.entityState = newEntityState;
        this.isInitializing = false;
        this.error = null;
      })
      .catch((err: unknown) => {
        this.isInitializing = false;
        this.error = err as ExternalDataError;
      });
  }

  /**
   * Helper to append an external source dynamically (e.g. from modal) and rebuild context.
   */
  addExternalSource(descriptor: ExternalSourceDescriptor, metadata: ExternalStoreMetadata): void {
    if (!this.entityState || !this.compatibilityMatrix) return;

    this.loadedExternalSources = [...this.loadedExternalSources, descriptor];

    // We assume externalDataService already caches metadata
    const allMetadata = this.loadedExternalSources
      .map((s) => externalDataService.getMetadata(s.label))
      .filter((m): m is ExternalStoreMetadata => m !== undefined);

    // Ensure the newly loaded metadata is included
    const merged = allMetadata.some((m) => m.label === metadata.label)
      ? allMetadata
      : [...allMetadata, metadata];

    const extCtx = buildExternalCompatibilityContext(
      merged,
      this.compatibilityMatrix.allParticles,
      this.compatibilityMatrix.allMaterials,
    );
    this.entityState.setExternalContext(extCtx);
    this.reconcileSelectionAfterExternalContextChange(this.entityState);
  }

  /**
   * Helper to remove an external source dynamically and rebuild context.
   */
  removeExternalSource(label: string): void {
    if (!this.entityState || !this.compatibilityMatrix) return;

    this.loadedExternalSources = this.loadedExternalSources.filter((s) => s.label !== label);

    const remaining = this.loadedExternalSources
      .map((s) => externalDataService.getMetadata(s.label))
      .filter((m): m is ExternalStoreMetadata => m !== undefined);

    const extCtx = buildExternalCompatibilityContext(
      remaining,
      this.compatibilityMatrix.allParticles,
      this.compatibilityMatrix.allMaterials,
    );
    this.entityState.setExternalContext(extCtx);
    this.reconcileSelectionAfterExternalContextChange(this.entityState);
  }

  /**
   * After external-source add/remove, reset now-invalid selections to safe fallbacks.
   * Fallback order: Auto-select for program, first available particle, Water (if
   * present) then first available material.
   */
  private reconcileSelectionAfterExternalContextChange(state: EntitySelectionState): void {
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
}

// Global singleton instance for the app
export const appInit = new AppInitState();
