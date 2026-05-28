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
import { getAvailableExternalPrograms, EMPTY_EXTERNAL_CONTEXT } from "./external-compatibility";
import type {
  ExternalCompatibilityContext,
  ExternalProgramEntity,
  ExternalOnlyParticle,
  ExternalOnlyMaterial,
} from "./external-compatibility";

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
// Carbon/heavy ions: ICRU73 → ICRU73_OLD → MSTAR
// Electron (id=1001): N/A (ESTAR remains unimplemented)
const AUTO_SELECT_CHAIN: Record<number, number[]> = {
  [PROTON_ID]: [PROGRAM_ID.ICRU49, PROGRAM_ID.PSTAR],
  [HELIUM_ID]: [PROGRAM_ID.ICRU49, PROGRAM_ID.ASTAR],
  [CARBON_ID]: [PROGRAM_ID.ICRU73, PROGRAM_ID.ICRU73_OLD, PROGRAM_ID.MSTAR],
};
const DEFAULT_AUTO_SELECT_CHAIN = [PROGRAM_ID.ICRU73, PROGRAM_ID.ICRU73_OLD, PROGRAM_ID.MSTAR];

export interface EntityAvailabilityState {
  externalContext: ExternalCompatibilityContext;
  setExternalContext(ctx: ExternalCompatibilityContext): void;

  readonly availablePrograms: ProgramEntity[];
  readonly availableExternalPrograms: ExternalProgramEntity[];
  readonly availableParticles: Array<ParticleEntity | ExternalOnlyParticle>;
  readonly availableMaterials: Array<MaterialEntity | ExternalOnlyMaterial>;

  readonly externalOnlyParticles: ExternalOnlyParticle[];
  readonly externalOnlyMaterials: ExternalOnlyMaterial[];

  resolveAutoSelect(): number | null;
  getResolvedProgramId(): number | string | null;
  isParticleAvailable(particleId: number | string): boolean;
  isMaterialAvailable(materialId: number | string): boolean;
  isBuiltinProgramAvailable(programId: number): boolean;
}

export function createEntityAvailabilityState(
  matrix: CompatibilityMatrix,
  selection: {
    get selectedParticleId(): number | string | null;
    get selectedMaterialId(): number | string | null;
    get selectedProgramId(): number | string;
  },
): EntityAvailabilityState {
  let extCtx = $state<ExternalCompatibilityContext>(EMPTY_EXTERNAL_CONTEXT);

  function computeAvailablePrograms(): ProgramEntity[] {
    return getAvailablePrograms(
      matrix,
      typeof selection.selectedParticleId === "number" ? selection.selectedParticleId : undefined,
      typeof selection.selectedMaterialId === "number" ? selection.selectedMaterialId : undefined,
    );
  }

  function computeAvailableExternalPrograms(): ExternalProgramEntity[] {
    return getAvailableExternalPrograms(
      extCtx,
      selection.selectedParticleId,
      selection.selectedMaterialId,
    );
  }

  function computeAvailableParticles(): Array<ParticleEntity | ExternalOnlyParticle> {
    // If an external program is selected, filter by its covered particles
    const selectedProgramId = selection.selectedProgramId;
    if (typeof selectedProgramId === "string") {
      const covered = extCtx.particlesByProgram.get(selectedProgramId);
      if (!covered) return [];
      return [
        ...matrix.allParticles.filter((p) => covered.has(p.id as number)),
        ...extCtx.externalOnlyParticles.filter((p) => covered.has(p.id)),
      ];
    }

    const builtinParticles = getAvailableParticles(
      matrix,
      selectedProgramId === -1 ? undefined : (selectedProgramId as number),
      typeof selection.selectedMaterialId === "number" ? selection.selectedMaterialId : undefined,
    );

    if (selectedProgramId !== -1) return builtinParticles;

    const externalOnlyParticles = extCtx.externalOnlyParticles.filter((particle) =>
      getAvailableExternalPrograms(extCtx, particle.id, selection.selectedMaterialId).some(Boolean),
    );
    return [...builtinParticles, ...externalOnlyParticles];
  }

  function computeAvailableMaterials(): Array<MaterialEntity | ExternalOnlyMaterial> {
    // If an external program is selected, filter by its covered materials
    const selectedProgramId = selection.selectedProgramId;
    if (typeof selectedProgramId === "string") {
      const covered = extCtx.materialsByProgram.get(selectedProgramId);
      if (!covered) return [];
      return [
        ...matrix.allMaterials.filter((m) => covered.has(m.id as number)),
        ...extCtx.externalOnlyMaterials.filter((m) => covered.has(m.id)),
      ];
    }

    const builtinMaterials = getAvailableMaterials(
      matrix,
      selectedProgramId === -1 ? undefined : (selectedProgramId as number),
      typeof selection.selectedParticleId === "number" ? selection.selectedParticleId : undefined,
    );

    if (selectedProgramId !== -1) return builtinMaterials;

    const externalOnlyMaterials = extCtx.externalOnlyMaterials.filter((material) =>
      getAvailableExternalPrograms(extCtx, selection.selectedParticleId, material.id).some(Boolean),
    );
    return [...builtinMaterials, ...externalOnlyMaterials];
  }

  const availablePrograms = $derived(computeAvailablePrograms());
  const availableExternalPrograms = $derived(computeAvailableExternalPrograms());
  const availableParticles = $derived(computeAvailableParticles());
  const availableMaterials = $derived(computeAvailableMaterials());

  return {
    get externalContext() {
      return extCtx;
    },
    setExternalContext(ctx: ExternalCompatibilityContext) {
      extCtx = ctx;
    },

    get availablePrograms() {
      return availablePrograms;
    },
    get availableExternalPrograms() {
      return availableExternalPrograms;
    },
    get availableParticles() {
      return availableParticles;
    },
    get availableMaterials() {
      return availableMaterials;
    },

    get externalOnlyParticles() {
      return extCtx.externalOnlyParticles;
    },
    get externalOnlyMaterials() {
      return extCtx.externalOnlyMaterials;
    },

    resolveAutoSelect(): number | null {
      const particleId = selection.selectedParticleId;
      const materialId = selection.selectedMaterialId;
      if (particleId === null || materialId === null) return null;
      if (typeof particleId !== "number") return null;
      if (particleId === ELECTRON_ID) return null;
      const chain = AUTO_SELECT_CHAIN[particleId] ?? DEFAULT_AUTO_SELECT_CHAIN;
      const availableProgramIds = new Set(availablePrograms.map((program) => program.id));
      for (const pid of chain) {
        if (availableProgramIds.has(pid)) return pid;
      }
      return (availablePrograms[0]?.id as number | undefined) ?? null;
    },

    getResolvedProgramId(): number | string | null {
      const programId = selection.selectedProgramId;
      if (programId === -1) {
        return this.resolveAutoSelect();
      }
      return programId;
    },

    isParticleAvailable(particleId: number | string): boolean {
      return availableParticles.some((p) => p.id === particleId);
    },

    isMaterialAvailable(materialId: number | string): boolean {
      const selectedProgramId = selection.selectedProgramId;
      if (typeof selectedProgramId === "string") {
        return availableMaterials.some((m) => m.id === materialId);
      }
      if (typeof materialId === "number") {
        return availableMaterials.some((m) => m.id === materialId);
      }
      return true; // custom compounds and external-only materials are always "available"
    },

    isBuiltinProgramAvailable(programId: number): boolean {
      return availablePrograms.some((p) => p.id === programId);
    },
  };
}
