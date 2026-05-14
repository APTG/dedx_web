import {
  getAvailablePrograms,
  getAvailableParticles,
  getAvailableMaterials,
} from "./compatibility-matrix";
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
  getAvailableExternalPrograms,
  EMPTY_EXTERNAL_CONTEXT,
} from "./external-compatibility";

export interface AutoSelectProgram {
  id: -1;
  name: "Auto-select";
  resolvedProgram: ProgramEntity | null;
}

export type SelectedProgram = ProgramEntity | AutoSelectProgram | ExternalProgramEntity;

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
  availableParticles: ParticleEntity[];
  availableMaterials: MaterialEntity[];
  lastAutoFallbackMessage: string | null;
  /** Select a built-in program (numeric) or external program (string ExtRef). */
  selectProgram(programId: number | string): void;
  selectParticle(particleId: number | null): void;
  selectMaterial(materialId: number | string | null): void;
  clearParticle(): void;
  clearMaterial(): void;
  resetAll(): void;
  clearAutoFallbackMessage(): void;
  /** Update the external compatibility context (called when extdata sources load). */
  setExternalContext(ctx: ExternalCompatibilityContext): void;
  /** Current external compatibility context. */
  externalContext: ExternalCompatibilityContext;
}

const AUTO_SELECT_PROGRAM: AutoSelectProgram = {
  id: -1,
  name: "Auto-select",
  resolvedProgram: null,
};

export const PROTON_ID = 1;
export const HELIUM_ID = 2;
export const CARBON_ID = 6;
export const WATER_ID = 276;
export const ELECTRON_ID = 1001;
const PROGRAM_ID = {
  ASTAR: 1,
  PSTAR: 2,
  MSTAR: 4,
  ICRU73_OLD: 5,
  ICRU73: 6,
  ICRU49: 7,
} as const;

// Program IDs follow runtime verification in wasm/verify.mjs:140-144 and
// docs/06-wasm-api-contract.md (program enum table).
//
// Auto-select priority follows docs/04-feature-specs/entity-selection.md §7
// using the currently runtime-available ICRU family:
// Proton: ICRU49 → PSTAR
// Alpha:  ICRU49 → ASTAR
// Carbon/heavy ions: ICRU73 → ICRU73(old) → MSTAR
// Electron (id=1001): N/A (ESTAR remains unimplemented)
const AUTO_SELECT_CHAIN: Record<number, number[]> = {
  [PROTON_ID]: [PROGRAM_ID.ICRU49, PROGRAM_ID.PSTAR],
  [HELIUM_ID]: [PROGRAM_ID.ICRU49, PROGRAM_ID.ASTAR],
  [CARBON_ID]: [PROGRAM_ID.ICRU73, PROGRAM_ID.ICRU73_OLD, PROGRAM_ID.MSTAR],
};
const DEFAULT_AUTO_SELECT_CHAIN = [PROGRAM_ID.ICRU73, PROGRAM_ID.ICRU73_OLD, PROGRAM_ID.MSTAR];

export function createEntitySelectionState(matrix: CompatibilityMatrix): EntitySelectionState {
  let selectedParticleId = $state<number | null>(PROTON_ID);
  let selectedMaterialId = $state<number | string | null>(WATER_ID);
  // -1 = Auto-select (built-in), number > 0 = built-in program ID, string = ExtRef for external
  let selectedProgramId = $state<number | string>(-1);
  let lastAutoFallbackMessage = $state<string | null>(null);
  let extCtx = $state<ExternalCompatibilityContext>(EMPTY_EXTERNAL_CONTEXT);

  function resolveAutoSelect(
    particleId: number | null,
    materialId: number | string | null,
  ): number | null {
    if (particleId === null || materialId === null) return null;
    if (particleId === ELECTRON_ID) return null;
    const chain = AUTO_SELECT_CHAIN[particleId] ?? DEFAULT_AUTO_SELECT_CHAIN;
    const availablePrograms = getAvailablePrograms(
      matrix,
      particleId,
      typeof materialId === "number" ? materialId : undefined,
    );
    const availableProgramIds = new Set(availablePrograms.map((program) => program.id));
    for (const pid of chain) {
      if (availableProgramIds.has(pid)) return pid;
    }
    return (availablePrograms[0]?.id as number | undefined) ?? null;
  }

  function getResolvedProgramId(
    programId: number | string,
    particleId: number | null,
    materialId: number | string | null,
  ): number | string | null {
    if (programId === -1) {
      return resolveAutoSelect(particleId, materialId);
    }
    return programId;
  }

  function computeAvailablePrograms(): ProgramEntity[] {
    return getAvailablePrograms(
      matrix,
      selectedParticleId ?? undefined,
      typeof selectedMaterialId === "number" ? selectedMaterialId : undefined,
    );
  }

  function computeAvailableExternalPrograms(): ExternalProgramEntity[] {
    return getAvailableExternalPrograms(extCtx, selectedParticleId, selectedMaterialId);
  }

  function computeAvailableParticles(): ParticleEntity[] {
    // If an external program is selected, filter by its covered particles
    if (typeof selectedProgramId === "string") {
      const covered = extCtx.particlesByProgram.get(selectedProgramId);
      if (!covered) return [];
      // Return only built-in particles that the external program covers
      return matrix.allParticles.filter((p) => covered.has(p.id as number));
    }
    return getAvailableParticles(
      matrix,
      selectedProgramId === -1 ? undefined : (selectedProgramId as number),
      typeof selectedMaterialId === "number" ? selectedMaterialId : undefined,
    );
  }

  function computeAvailableMaterials(): MaterialEntity[] {
    // If an external program is selected, filter by its covered materials
    if (typeof selectedProgramId === "string") {
      const covered = extCtx.materialsByProgram.get(selectedProgramId);
      if (!covered) return [];
      return matrix.allMaterials.filter((m) => covered.has(m.id as number));
    }
    return getAvailableMaterials(
      matrix,
      selectedProgramId === -1 ? undefined : (selectedProgramId as number),
      selectedParticleId ?? undefined,
    );
  }

  function isParticleAvailable(particleId: number): boolean {
    return computeAvailableParticles().some((p) => p.id === particleId);
  }

  function isMaterialAvailable(materialId: number | string): boolean {
    if (typeof selectedProgramId === "string") {
      return computeAvailableMaterials().some((m) => m.id === materialId);
    }
    if (typeof materialId === "number") {
      return computeAvailableMaterials().some((m) => m.id === materialId);
    }
    return true; // custom compounds and external-only materials are always "available"
  }

  function isBuiltinProgramAvailable(programId: number): boolean {
    return computeAvailablePrograms().some((p) => p.id === programId);
  }

  const state: EntitySelectionState = {
    get selectedProgram(): SelectedProgram {
      // External program selected
      if (typeof selectedProgramId === "string") {
        const ext = extCtx.programs.find((p) => p.id === selectedProgramId);
        if (ext) return ext;
      }
      // Auto-select
      if (selectedProgramId === -1) {
        const resolvedId = resolveAutoSelect(selectedParticleId, selectedMaterialId);
        const resolvedProgram = resolvedId
          ? matrix.allPrograms.find((p) => p.id === resolvedId) || null
          : null;
        return { ...AUTO_SELECT_PROGRAM, resolvedProgram };
      }
      // Built-in
      return (
        matrix.allPrograms.find((p) => p.id === selectedProgramId) || AUTO_SELECT_PROGRAM
      );
    },

    get resolvedProgramId(): number | string | null {
      return getResolvedProgramId(selectedProgramId, selectedParticleId, selectedMaterialId);
    },

    get selectedParticle(): ParticleEntity | ExternalOnlyParticle | null {
      if (selectedParticleId === null) return null;
      // Built-in
      const builtin = matrix.allParticles.find((p) => p.id === selectedParticleId);
      if (builtin) return builtin;
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
        const extMat = extCtx.externalOnlyMaterials.find((m) => m.id === selectedMaterialId);
        if (extMat) return extMat;
      }

      return null;
    },

    get isComplete(): boolean {
      if (selectedParticleId === null || selectedMaterialId === null) return false;
      // External program: always complete if particle/material covered
      if (typeof selectedProgramId === "string") {
        const covered = extCtx.particlesByProgram.get(selectedProgramId);
        return covered ? covered.has(selectedParticleId) : false;
      }
      if (selectedParticleId === ELECTRON_ID) return false;
      const resolvedId = getResolvedProgramId(
        selectedProgramId,
        selectedParticleId,
        selectedMaterialId,
      );
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
      return extCtx.externalOnlyParticles;
    },

    get externalOnlyMaterials(): ExternalOnlyMaterial[] {
      return extCtx.externalOnlyMaterials;
    },

    get availablePrograms(): ProgramEntity[] {
      return computeAvailablePrograms();
    },

    get availableExternalPrograms(): ExternalProgramEntity[] {
      return computeAvailableExternalPrograms();
    },

    get availableParticles(): ParticleEntity[] {
      return computeAvailableParticles();
    },

    get availableMaterials(): MaterialEntity[] {
      return computeAvailableMaterials();
    },

    selectProgram(programId: number | string): void {
      selectedProgramId = programId;

      if (typeof programId === "string") {
        // External program selected — validate particle/material against coverage
        const covered = extCtx.particlesByProgram.get(programId);
        if (covered && selectedParticleId !== null && !covered.has(selectedParticleId)) {
          // Select first covered built-in particle
          const firstCovered = [...covered].find((id): id is number => typeof id === "number");
          selectedParticleId = firstCovered ?? null;
        }
        const covMat = extCtx.materialsByProgram.get(programId);
        if (covMat && selectedMaterialId !== null && !covMat.has(selectedMaterialId)) {
          const firstMat = [...covMat].find((id): id is number => typeof id === "number");
          selectedMaterialId = firstMat ?? null;
        }
        return;
      }

      if (programId !== -1) {
        const availableParticles = computeAvailableParticles();
        if (selectedParticleId !== null && !isParticleAvailable(selectedParticleId)) {
          const protonAvailable = availableParticles.some((p) => p.id === PROTON_ID);
          selectedParticleId = protonAvailable ? PROTON_ID : ((availableParticles[0]?.id as number | undefined) ?? null);
        }

        const availableMaterials = computeAvailableMaterials();
        if (
          typeof selectedMaterialId === "number" &&
          !isMaterialAvailable(selectedMaterialId)
        ) {
          const waterAvailable = availableMaterials.some((m) => m.id === WATER_ID);
          selectedMaterialId = waterAvailable ? WATER_ID : (availableMaterials[0]?.id ?? null);
        }
      }
    },

    selectParticle(particleId: number | null): void {
      if (particleId === null) {
        selectedParticleId = null;
        return;
      }

      selectedParticleId = particleId;

      if (typeof selectedMaterialId === "number" && !isMaterialAvailable(selectedMaterialId)) {
        const availableMaterials = computeAvailableMaterials();
        const waterAvailable = availableMaterials.some((m) => m.id === WATER_ID);
        selectedMaterialId = waterAvailable ? WATER_ID : (availableMaterials[0]?.id ?? null);
      }

      // Don't reset external program based on built-in particle change
      if (typeof selectedProgramId === "string") return;

      const oldProgramId = selectedProgramId;
      const wasExplicitProgram = selectedProgramId !== -1;

      if (selectedProgramId !== -1 && !isBuiltinProgramAvailable(selectedProgramId as number)) {
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

      if (selectedParticleId !== null && !isParticleAvailable(selectedParticleId)) {
        const availableParticles = computeAvailableParticles();
        const protonAvailable = availableParticles.some((p) => p.id === PROTON_ID);
        selectedParticleId = protonAvailable ? PROTON_ID : ((availableParticles[0]?.id as number | undefined) ?? null);
      }

      // Don't reset external program based on material change
      if (typeof selectedProgramId === "string") return;

      const oldProgramId = selectedProgramId;
      const wasExplicitProgram = selectedProgramId !== -1;

      if (
        typeof selectedProgramId === "number" &&
        selectedProgramId !== -1 &&
        !isBuiltinProgramAvailable(selectedProgramId)
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
    },

    get lastAutoFallbackMessage() {
      return lastAutoFallbackMessage;
    },

    clearAutoFallbackMessage(): void {
      lastAutoFallbackMessage = null;
    },

    setExternalContext(ctx: ExternalCompatibilityContext): void {
      extCtx = ctx;
    },

    get externalContext(): ExternalCompatibilityContext {
      return extCtx;
    },
  };

  return state;
}
