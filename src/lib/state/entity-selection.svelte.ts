import type {
  CompatibilityMatrix,
  ProgramEntity,
  ParticleEntity,
  MaterialEntity,
} from "$lib/wasm/types";
import { customCompounds } from "./custom-compounds.svelte";
import type {
  ExternalCompatibilityContext,
  ExternalProgramEntity,
  ExternalOnlyParticle,
  ExternalOnlyMaterial,
} from "./external-compatibility";
import {
  createEntityAvailabilityState,
  PROTON_ID,
  HELIUM_ID,
  CARBON_ID,
  WATER_ID,
  ELECTRON_ID,
} from "./entity-availability.svelte";

export interface AutoSelectProgram {
  id: -1;
  name: "Auto-select";
  resolvedProgram: ProgramEntity | null;
}

export type SelectedProgram = ProgramEntity | AutoSelectProgram | ExternalProgramEntity;

import {
  createMultiSelectionState,
  type PickerTabId,
  type AcrossDimension,
} from "./multi-selection.svelte";
export type { PickerTabId, AcrossDimension };

export interface EntitySelectionState {
  selectedProgram: SelectedProgram;
  /** Numeric built-in program ID, or ExtRef string for external programs, or null. */
  resolvedProgramId: number | string | null;
  selectedParticle: ParticleEntity | ExternalOnlyParticle | null;
  selectedMaterial: MaterialEntity | ExternalOnlyMaterial | null;
  isComplete: boolean;
  selectionSummary: string;
  allParticles: ParticleEntity[];
  allMaterials: MaterialEntity[];
  /** External-only particles not merged with built-in. */
  externalOnlyParticles: ExternalOnlyParticle[];
  /** External-only materials not merged with built-in. */
  externalOnlyMaterials: ExternalOnlyMaterial[];
  availablePrograms: ProgramEntity[];
  /** Available external programs for the current particle/material selection. */
  availableExternalPrograms: ExternalProgramEntity[];
  availableParticles: Array<ParticleEntity | ExternalOnlyParticle>;
  availableMaterials: Array<MaterialEntity | ExternalOnlyMaterial>;
  lastAutoFallbackMessage: string | null;

  /** Which tab the search bar / coral underline is bound to. */
  activeTarget: PickerTabId;
  /** Whether the list panel below the search row is visible. */
  expanded: boolean;
  /** Multi-axis compare dimension (Advanced only; forced to "program" in Basic). */
  across: AcrossDimension;
  /** Multi-selection arrays — populated for the active `across` dimension. */
  multiSelected: {
    particle: (number | string)[];
    material: (number | string)[];
    program: (number | string)[];
  };

  /** Whether the full-screen search sheet is open. */
  sheetOpen: boolean;
  /** Open or close the full-screen search sheet. */
  setSheetOpen(open: boolean): void;

  /** Select a built-in program (numeric) or external program (string ExtRef). */
  selectProgram(programId: number | string): void;
  selectParticle(particleId: number | string | null): void;
  selectMaterial(materialId: number | string | null): void;
  clearParticle(): void;
  clearMaterial(): void;
  resetAll(): void;
  clearAutoFallbackMessage(): void;
  /** Update the external compatibility context (called when extdata sources load). */
  setExternalContext(ctx: ExternalCompatibilityContext): void;
  /** Current external compatibility context. */
  externalContext: ExternalCompatibilityContext;

  /** Set the active target tab (does not change `expanded`). */
  setActiveTarget(tab: PickerTabId): void;
  /** Set the panel expand/collapse state. */
  setExpanded(expanded: boolean): void;
  /**
   * Change the Compare-across dimension.
   * - When `newAcross === "single"`: collapses all multi-selection arrays to at
   *   most one element without changing `activeTarget` or `expanded`.
   * - Otherwise: seeds `multiSelected[newAcross]` from the current single
   *   selection and sets `activeTarget = newAcross` and `expanded = true`.
   */
  setAcross(newAcross: AcrossDimension): void;
  /** Toggle an id in `multiSelected[across]` (preserving order; first is default). */
  toggleMulti(dim: AcrossDimension, id: number | string): void;
  /** Move `id` within `multiSelected[dim]` to `newIndex` (anchor at 0 is locked). */
  reorderMulti(dim: AcrossDimension, id: number | string, newIndex: number): void;
  /**
   * Truncate all three multi-selection arrays to at most one element (the anchor).
   * Called when switching from Advanced to Basic mode so that returning to Advanced
   * mode starts with a clean single-item selection rather than a stale multi-set.
   */
  collapseToSingle(): void;
  /**
   * Directly set the program multi-selection array without the side effects of
   * setAcross() (no activeTarget change, no expand). Used to seed the array
   * from the initial resolved program when Advanced mode is first enabled.
   */
  setMultiProgram(ids: (number | string)[]): void;
  setMultiMaterial(ids: (number | string)[]): void;
  /** Directly set the particle multi-selection array from URL restore. */
  setMultiParticle(ids: (number | string)[]): void;
}

const AUTO_SELECT_PROGRAM: AutoSelectProgram = {
  id: -1,
  name: "Auto-select",
  resolvedProgram: null,
};

export { PROTON_ID, HELIUM_ID, CARBON_ID, WATER_ID, ELECTRON_ID };

export function createEntitySelectionState(matrix: CompatibilityMatrix): EntitySelectionState {
  let selectedParticleId = $state<number | string | null>(PROTON_ID);
  let selectedMaterialId = $state<number | string | null>(WATER_ID);
  // -1 = Auto-select (built-in), number > 0 = built-in program ID, string = ExtRef for external
  let selectedProgramId = $state<number | string>(-1);
  let lastAutoFallbackMessage = $state<string | null>(null);

  const multiState = createMultiSelectionState();

  // Mobile picker sheet state (issue #530 — adaptive picker kit).
  let sheetOpen = $state(false);

  const availability = createEntityAvailabilityState(matrix, {
    get selectedParticleId() {
      return selectedParticleId;
    },
    get selectedMaterialId() {
      return selectedMaterialId;
    },
    get selectedProgramId() {
      return selectedProgramId;
    },
  });

  const state: EntitySelectionState = {
    get selectedProgram(): SelectedProgram {
      // External program selected
      if (typeof selectedProgramId === "string") {
        const ext = availability.externalContext.programs.find((p) => p.id === selectedProgramId);
        if (ext) return ext;
      }
      // Auto-select
      if (selectedProgramId === -1) {
        const resolvedId = availability.resolveAutoSelect();
        const resolvedProgram = resolvedId
          ? matrix.allPrograms.find((p) => p.id === resolvedId) || null
          : null;
        return { ...AUTO_SELECT_PROGRAM, resolvedProgram };
      }
      // Built-in
      return matrix.allPrograms.find((p) => p.id === selectedProgramId) || AUTO_SELECT_PROGRAM;
    },

    get resolvedProgramId(): number | string | null {
      return availability.getResolvedProgramId();
    },

    get selectedParticle(): ParticleEntity | ExternalOnlyParticle | null {
      if (selectedParticleId === null) return null;
      // Built-in
      if (typeof selectedParticleId === "number") {
        const builtin = matrix.allParticles.find((p) => p.id === selectedParticleId);
        if (builtin) return builtin;
      } else if (selectedParticleId.startsWith("ext:")) {
        const extParticle = availability.externalOnlyParticles.find(
          (p) => p.id === selectedParticleId,
        );
        if (extParticle) return extParticle;
      }
      return null;
    },

    get selectedMaterial(): MaterialEntity | ExternalOnlyMaterial | null {
      if (selectedMaterialId === null) return null;

      // Check built-in materials
      const builtinMaterial = matrix.allMaterials.find((m) => m.id === selectedMaterialId);
      if (builtinMaterial) return builtinMaterial;

      // Check custom compounds (string id starting with "cc_")
      if (typeof selectedMaterialId === "string" && !selectedMaterialId.startsWith("ext:")) {
        const customCompound = customCompounds.compounds.find((c) => c.id === selectedMaterialId);
        if (customCompound) {
          return {
            id: customCompound.id,
            name: customCompound.name,
            density: customCompound.density,
            iValue: customCompound.iValue,
            phase: customCompound.phase === "gas" ? "gas" : "condensed",
            elements: customCompound.elements,
            isGasByDefault: customCompound.phase === "gas",
          } satisfies MaterialEntity;
        }
      }

      // Check external-only materials
      if (typeof selectedMaterialId === "string" && selectedMaterialId.startsWith("ext:")) {
        const extMat = availability.externalOnlyMaterials.find((m) => m.id === selectedMaterialId);
        if (extMat) return extMat;
      }

      return null;
    },

    get isComplete(): boolean {
      if (selectedParticleId === null || selectedMaterialId === null) return false;
      // External program: always complete if particle/material covered
      if (typeof selectedProgramId === "string") {
        const covered = availability.externalContext.particlesByProgram.get(selectedProgramId);
        return covered ? covered.has(selectedParticleId) : false;
      }
      if (selectedParticleId === ELECTRON_ID) return false;
      const resolvedId = availability.getResolvedProgramId();
      return resolvedId !== null;
    },

    get selectionSummary(): string {
      const particleName = this.selectedParticle?.name ?? "None";
      const materialName = this.selectedMaterial?.name ?? "None";
      let programText = "Auto-select";

      const sp = this.selectedProgram;
      if (typeof sp.id === "string") {
        programText = sp.name;
      } else if (sp.id !== -1) {
        programText = sp.name;
      } else if ("resolvedProgram" in sp && sp.resolvedProgram) {
        programText = `Auto-select → ${sp.resolvedProgram.name}`;
      }

      return `Particle: ${particleName}. Material: ${materialName}. Program: ${programText}.`;
    },

    get allParticles(): ParticleEntity[] {
      return matrix.allParticles;
    },

    get allMaterials(): MaterialEntity[] {
      return matrix.allMaterials;
    },

    get externalOnlyParticles(): ExternalOnlyParticle[] {
      return availability.externalOnlyParticles;
    },

    get externalOnlyMaterials(): ExternalOnlyMaterial[] {
      return availability.externalOnlyMaterials;
    },

    get availablePrograms(): ProgramEntity[] {
      return availability.availablePrograms;
    },

    get availableExternalPrograms(): ExternalProgramEntity[] {
      return availability.availableExternalPrograms;
    },

    get availableParticles(): Array<ParticleEntity | ExternalOnlyParticle> {
      return availability.availableParticles;
    },

    get availableMaterials(): Array<MaterialEntity | ExternalOnlyMaterial> {
      return availability.availableMaterials;
    },

    selectProgram(programId: number | string): void {
      selectedProgramId = programId;

      if (typeof programId === "string") {
        // External program selected — validate particle/material against coverage
        const covered = availability.externalContext.particlesByProgram.get(programId);
        if (covered && selectedParticleId !== null && !covered.has(selectedParticleId)) {
          // Select first covered built-in particle
          const firstAvailable = [...covered][0] ?? null;
          selectedParticleId = firstAvailable;
        }
        const covMat = availability.externalContext.materialsByProgram.get(programId);
        if (covMat && selectedMaterialId !== null && !covMat.has(selectedMaterialId)) {
          const firstMat = [...covMat].find((id): id is number => typeof id === "number");
          selectedMaterialId = firstMat ?? null;
        }
        return;
      }

      if (programId !== -1) {
        const availableParticles = availability.availableParticles;
        if (selectedParticleId !== null && !availability.isParticleAvailable(selectedParticleId)) {
          const protonAvailable = availableParticles.some((p) => p.id === PROTON_ID);
          selectedParticleId = protonAvailable ? PROTON_ID : (availableParticles[0]?.id ?? null);
        }

        const availableMaterials = availability.availableMaterials;
        if (
          typeof selectedMaterialId === "number" &&
          !availability.isMaterialAvailable(selectedMaterialId)
        ) {
          const waterAvailable = availableMaterials.some((m) => m.id === WATER_ID);
          selectedMaterialId = waterAvailable ? WATER_ID : (availableMaterials[0]?.id ?? null);
        }
      }
    },

    selectParticle(particleId: number | string | null): void {
      if (particleId === null) {
        selectedParticleId = null;
        return;
      }

      selectedParticleId = particleId;

      if (
        typeof selectedMaterialId === "number" &&
        !availability.isMaterialAvailable(selectedMaterialId)
      ) {
        const availableMaterials = availability.availableMaterials;
        const waterAvailable = availableMaterials.some((m) => m.id === WATER_ID);
        selectedMaterialId = waterAvailable ? WATER_ID : (availableMaterials[0]?.id ?? null);
      }

      // Don't reset external program based on built-in particle change
      if (typeof selectedProgramId === "string") return;

      if (typeof particleId === "string") {
        if (selectedProgramId !== -1) selectedProgramId = -1;
        return;
      }

      const oldProgramId = selectedProgramId;
      const wasExplicitProgram = selectedProgramId !== -1;

      if (
        selectedProgramId !== -1 &&
        !availability.isBuiltinProgramAvailable(selectedProgramId as number)
      ) {
        selectedProgramId = -1;
      }

      if (wasExplicitProgram && oldProgramId !== -1 && selectedProgramId === -1) {
        const oldProgram = matrix.allPrograms.find((p) => p.id === oldProgramId);
        if (oldProgram) {
          lastAutoFallbackMessage = `Program changed to Auto-select — "${oldProgram.name}" does not support the selected particle.`;
        }
      }
    },

    selectMaterial(materialId: number | string | null): void {
      if (materialId === null) {
        selectedMaterialId = null;
        return;
      }

      selectedMaterialId = materialId;

      if (
        typeof materialId === "string" &&
        materialId.startsWith("ext:") &&
        typeof selectedProgramId === "number" &&
        selectedProgramId !== -1
      ) {
        selectedProgramId = -1;
      }

      if (selectedParticleId !== null && !availability.isParticleAvailable(selectedParticleId)) {
        const availableParticles = availability.availableParticles;
        const protonAvailable = availableParticles.some((p) => p.id === PROTON_ID);
        selectedParticleId = protonAvailable ? PROTON_ID : (availableParticles[0]?.id ?? null);
      }

      // Don't reset external program based on material change
      if (typeof selectedProgramId === "string") return;

      const oldProgramId = selectedProgramId;
      const wasExplicitProgram = selectedProgramId !== -1;

      if (
        typeof selectedProgramId === "number" &&
        selectedProgramId !== -1 &&
        !availability.isBuiltinProgramAvailable(selectedProgramId)
      ) {
        selectedProgramId = -1;
      }

      if (wasExplicitProgram && oldProgramId !== -1 && selectedProgramId === -1) {
        const oldProgram = matrix.allPrograms.find((p) => p.id === oldProgramId);
        if (oldProgram) {
          lastAutoFallbackMessage = `Program changed to Auto-select — "${oldProgram.name}" does not support the selected particle or material.`;
        }
      }
    },

    clearParticle(): void {
      selectedParticleId = null;
    },

    clearMaterial(): void {
      selectedMaterialId = null;
    },

    resetAll(): void {
      selectedParticleId = PROTON_ID;
      selectedMaterialId = WATER_ID;
      selectedProgramId = -1;
      lastAutoFallbackMessage = null;
      multiState.resetAll();
    },

    get activeTarget() {
      return multiState.activeTarget;
    },
    get expanded() {
      return multiState.expanded;
    },
    get across() {
      return multiState.across;
    },
    get multiSelected() {
      return multiState.multiSelected;
    },
    setActiveTarget: multiState.setActiveTarget,
    setExpanded: multiState.setExpanded,
    setAcross: (newAcross: AcrossDimension) =>
      multiState.setAcross(newAcross, selectedProgramId, selectedParticleId, selectedMaterialId),
    toggleMulti: multiState.toggleMulti,
    reorderMulti: multiState.reorderMulti,
    collapseToSingle: multiState.collapseToSingle,
    setMultiProgram: multiState.setMultiProgram,
    setMultiMaterial: multiState.setMultiMaterial,
    setMultiParticle: multiState.setMultiParticle,

    get lastAutoFallbackMessage() {
      return lastAutoFallbackMessage;
    },

    clearAutoFallbackMessage(): void {
      lastAutoFallbackMessage = null;
    },

    setExternalContext(ctx: ExternalCompatibilityContext): void {
      availability.setExternalContext(ctx);
    },

    get externalContext(): ExternalCompatibilityContext {
      return availability.externalContext;
    },

    get sheetOpen() {
      return sheetOpen;
    },

    setSheetOpen(open: boolean): void {
      sheetOpen = open;
    },
  };

  return state;
}
