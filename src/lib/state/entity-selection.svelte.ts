import { getAvailablePrograms, getAvailableParticles, getAvailableMaterials } from "./compatibility-matrix";
import type { CompatibilityMatrix, ProgramEntity, ParticleEntity, MaterialEntity } from "$lib/wasm/types";

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
  allParticles: ParticleEntity[];
  allMaterials: MaterialEntity[];
  availablePrograms: ProgramEntity[];
  availableParticles: ParticleEntity[];
  availableMaterials: MaterialEntity[];
  selectProgram(programId: number): void;
  selectParticle(particleId: number | null): void;
  selectMaterial(materialId: number | null): void;
  clearParticle(): void;
  clearMaterial(): void;
  resetAll(): void;
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

// Resolution chain per entity-selection.md § "Auto-select program resolution":
// Proton → ICRU 90 (id=90) → PSTAR (id=1)
// Alpha  → ICRU 90 (id=90) → ICRU 49 (id=7)
// Carbon → ICRU 90 (id=90) → ICRU 73 (id=6) → ICRU 73old (id=5)
// Other heavy ions → ICRU 73 (id=6) → ICRU 73old (id=5)
// Electron (id=1001) → N/A (ESTAR not implemented)
const AUTO_SELECT_CHAIN: Record<number, number[]> = {
  [PROTON_ID]: [90, 1],
  [HELIUM_ID]: [90, 7],
  [CARBON_ID]: [90, 6, 5],
};
const DEFAULT_AUTO_SELECT_CHAIN = [6, 5];

export function createEntitySelectionState(matrix: CompatibilityMatrix): EntitySelectionState {
  let selectedParticleId = $state<number | null>(PROTON_ID);
  let selectedMaterialId = $state<number | null>(WATER_ID);
  let selectedProgramId = $state<number>(-1);

  function resolveAutoSelect(programId: number, particleId: number | null, materialId: number | null): number | null {
    if (particleId === null || materialId === null) return null;
    if (particleId === ELECTRON_ID) return null;
    const chain = AUTO_SELECT_CHAIN[particleId] ?? DEFAULT_AUTO_SELECT_CHAIN;
    const progs = matrix.programsByParticle.get(particleId);
    for (const pid of chain) {
      if (progs?.has(pid)) return pid;
    }
    return null;
  }

  function getResolvedProgramId(programId: number, particleId: number | null, materialId: number | null): number | null {
    if (programId === -1) {
      return resolveAutoSelect(programId, particleId, materialId);
    }
    return programId;
  }

  function computeAvailablePrograms(): ProgramEntity[] {
    return getAvailablePrograms(matrix, selectedParticleId ?? undefined, selectedMaterialId ?? undefined);
  }

  function computeAvailableParticles(): ParticleEntity[] {
    return getAvailableParticles(matrix, selectedProgramId === -1 ? undefined : selectedProgramId, selectedMaterialId ?? undefined);
  }

  function computeAvailableMaterials(): MaterialEntity[] {
    return getAvailableMaterials(matrix, selectedProgramId === -1 ? undefined : selectedProgramId, selectedParticleId ?? undefined);
  }

  function getCurrentProgramId(): number | undefined {
    return selectedProgramId === -1 ? undefined : selectedProgramId;
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
        const resolvedId = resolveAutoSelect(-1, selectedParticleId, selectedMaterialId);
        const resolvedProgram = resolvedId ? matrix.allPrograms.find((p) => p.id === resolvedId) || null : null;
        return {
          ...AUTO_SELECT_PROGRAM,
          resolvedProgram,
        };
      }
      return matrix.allPrograms.find((p) => p.id === selectedProgramId)!;
    },

    get resolvedProgramId(): number | null {
      return getResolvedProgramId(selectedProgramId, selectedParticleId, selectedMaterialId);
    },

    get selectedParticle(): ParticleEntity | null {
      return selectedParticleId ? matrix.allParticles.find((p) => p.id === selectedParticleId) || null : null;
    },

    get selectedMaterial(): MaterialEntity | null {
      return selectedMaterialId ? matrix.allMaterials.find((m) => m.id === selectedMaterialId) || null : null;
    },

    get isComplete(): boolean {
      if (selectedParticleId === null || selectedMaterialId === null) {
        return false;
      }
      if (selectedParticleId === ELECTRON_ID) {
        return false;
      }
      const resolvedId = getResolvedProgramId(selectedProgramId, selectedParticleId, selectedMaterialId);
      return resolvedId !== null;
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

      if (selectedProgramId !== -1) {
        selectedProgramId = -1;
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

      if (selectedProgramId !== -1 && !isProgramAvailable(selectedProgramId)) {
        selectedProgramId = -1;
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
    },
  };

  return state;
}
