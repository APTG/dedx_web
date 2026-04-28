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

export interface AutoSelectProgram {
  id: -1;
  name: "Auto-select";
  resolvedProgram: ProgramEntity | null;
}

export type SelectedProgram = ProgramEntity | AutoSelectProgram;

export interface EntitySelectionState {
  selectedProgram: SelectedProgram;
  resolvedProgramId: number | null;
  selectedParticle: ParticleEntity | null;
  selectedMaterial: MaterialEntity | null;
  isComplete: boolean;
  selectionSummary: string;
  allParticles: ParticleEntity[];
  allMaterials: MaterialEntity[];
  availablePrograms: ProgramEntity[];
  availableParticles: ParticleEntity[];
  availableMaterials: MaterialEntity[];
  lastAutoFallbackMessage: string | null;
  selectProgram(programId: number): void;
  selectParticle(particleId: number | null): void;
  selectMaterial(materialId: number | null): void;
  clearParticle(): void;
  clearMaterial(): void;
  resetAll(): void;
  clearAutoFallbackMessage(): void;
}

const AUTO_SELECT_PROGRAM: AutoSelectProgram = {
  id: -1,
  name: "Auto-select",
  resolvedProgram: null,
};

const PROTON_ID = 1;
const HELIUM_ID = 2;
const CARBON_ID = 6;
const WATER_ID = 276;
const ELECTRON_ID = 1001;
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
  let selectedMaterialId = $state<number | null>(WATER_ID);
  let selectedProgramId = $state<number>(-1);
  let lastAutoFallbackMessage = $state<string | null>(null);

  function resolveAutoSelect(particleId: number | null, materialId: number | null): number | null {
    if (particleId === null || materialId === null) return null;
    if (particleId === ELECTRON_ID) return null;
    const chain = AUTO_SELECT_CHAIN[particleId] ?? DEFAULT_AUTO_SELECT_CHAIN;
    const availablePrograms = getAvailablePrograms(matrix, particleId, materialId);
    const availableProgramIds = new Set(availablePrograms.map((program) => program.id));
    // Preferred chain first (accuracy-ordered for this particle type).
    for (const pid of chain) {
      if (availableProgramIds.has(pid)) return pid;
    }
    // Fallback: any program that supports this combination rather than blocking.
    return availablePrograms[0]?.id ?? null;
  }

  function getResolvedProgramId(
    programId: number,
    particleId: number | null,
    materialId: number | null,
  ): number | null {
    if (programId === -1) {
      return resolveAutoSelect(particleId, materialId);
    }
    return programId;
  }

  function computeAvailablePrograms(): ProgramEntity[] {
    return getAvailablePrograms(
      matrix,
      selectedParticleId ?? undefined,
      selectedMaterialId ?? undefined,
    );
  }

  function computeAvailableParticles(): ParticleEntity[] {
    return getAvailableParticles(
      matrix,
      selectedProgramId === -1 ? undefined : selectedProgramId,
      selectedMaterialId ?? undefined,
    );
  }

  function computeAvailableMaterials(): MaterialEntity[] {
    return getAvailableMaterials(
      matrix,
      selectedProgramId === -1 ? undefined : selectedProgramId,
      selectedParticleId ?? undefined,
    );
  }

  function isParticleAvailable(particleId: number): boolean {
    const available = computeAvailableParticles();
    return available.some((p) => p.id === particleId);
  }

  function isMaterialAvailable(materialId: number): boolean {
    const available = computeAvailableMaterials();
    return available.some((m) => m.id === materialId);
  }

  function isProgramAvailable(programId: number): boolean {
    const available = computeAvailablePrograms();
    return available.some((p) => p.id === programId);
  }

  const state: EntitySelectionState = {
    get selectedProgram(): SelectedProgram {
      if (selectedProgramId === -1) {
        const resolvedId = resolveAutoSelect(selectedParticleId, selectedMaterialId);
        const resolvedProgram = resolvedId
          ? matrix.allPrograms.find((p) => p.id === resolvedId) || null
          : null;
        return {
          ...AUTO_SELECT_PROGRAM,
          resolvedProgram,
        };
      }
      return matrix.allPrograms.find((p) => p.id === selectedProgramId) || AUTO_SELECT_PROGRAM;
    },

    get resolvedProgramId(): number | null {
      return getResolvedProgramId(selectedProgramId, selectedParticleId, selectedMaterialId);
    },

    get selectedParticle(): ParticleEntity | null {
      return selectedParticleId
        ? matrix.allParticles.find((p) => p.id === selectedParticleId) || null
        : null;
    },

    get selectedMaterial(): MaterialEntity | null {
      return selectedMaterialId
        ? matrix.allMaterials.find((m) => m.id === selectedMaterialId) || null
        : null;
    },

    get isComplete(): boolean {
      if (selectedParticleId === null || selectedMaterialId === null) {
        return false;
      }
      if (selectedParticleId === ELECTRON_ID) {
        return false;
      }
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
      if (sp.id !== -1) {
        programText = sp.name;
      } else if (sp.resolvedProgram) {
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

    get availablePrograms(): ProgramEntity[] {
      return computeAvailablePrograms();
    },

    get availableParticles(): ParticleEntity[] {
      return computeAvailableParticles();
    },

    get availableMaterials(): MaterialEntity[] {
      return computeAvailableMaterials();
    },

    selectProgram(programId: number): void {
      selectedProgramId = programId;

      if (programId !== -1) {
        const availableParticles = computeAvailableParticles();
        if (selectedParticleId !== null && !isParticleAvailable(selectedParticleId)) {
          const protonAvailable = availableParticles.some((p) => p.id === PROTON_ID);
          if (protonAvailable) {
            selectedParticleId = PROTON_ID;
          } else {
            selectedParticleId = availableParticles[0]?.id || null;
          }
        }

        const availableMaterials = computeAvailableMaterials();
        if (selectedMaterialId !== null && !isMaterialAvailable(selectedMaterialId)) {
          const waterAvailable = availableMaterials.some((m) => m.id === WATER_ID);
          if (waterAvailable) {
            selectedMaterialId = WATER_ID;
          } else {
            selectedMaterialId = availableMaterials[0]?.id || null;
          }
        }
      }
    },

    selectParticle(particleId: number | null): void {
      if (particleId === null) {
        selectedParticleId = null;
        return;
      }

      selectedParticleId = particleId;

      if (selectedMaterialId !== null && !isMaterialAvailable(selectedMaterialId)) {
        const availableMaterials = computeAvailableMaterials();
        const waterAvailable = availableMaterials.some((m) => m.id === WATER_ID);
        if (waterAvailable) {
          selectedMaterialId = WATER_ID;
        } else {
          selectedMaterialId = availableMaterials[0]?.id || null;
        }
      }

      const oldProgramId = selectedProgramId;
      const wasExplicitProgram = selectedProgramId !== -1;

      // Preserve explicit program choice when still valid for the new particle/material.
      // Fall back to Auto-select only when the concrete program became incompatible.
      if (selectedProgramId !== -1 && !isProgramAvailable(selectedProgramId)) {
        selectedProgramId = -1;
      }

      if (wasExplicitProgram && oldProgramId !== -1 && selectedProgramId === -1) {
        const oldProgram = matrix.allPrograms.find((p) => p.id === oldProgramId);
        if (oldProgram) {
          lastAutoFallbackMessage = `Program changed to Auto-select — "${oldProgram.name}" does not support the selected particle.`;
        }
      }
    },

    selectMaterial(materialId: number | null): void {
      if (materialId === null) {
        selectedMaterialId = null;
        return;
      }

      selectedMaterialId = materialId;

      if (selectedParticleId !== null && !isParticleAvailable(selectedParticleId)) {
        const availableParticles = computeAvailableParticles();
        const protonAvailable = availableParticles.some((p) => p.id === PROTON_ID);
        if (protonAvailable) {
          selectedParticleId = PROTON_ID;
        } else {
          selectedParticleId = availableParticles[0]?.id || null;
        }
      }

      const oldProgramId = selectedProgramId;
      const wasExplicitProgram = selectedProgramId !== -1;

      if (selectedProgramId !== -1 && !isProgramAvailable(selectedProgramId)) {
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
  };

  return state;
}
