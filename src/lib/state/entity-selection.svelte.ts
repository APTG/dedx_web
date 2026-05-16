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
import { getAvailableExternalPrograms, EMPTY_EXTERNAL_CONTEXT } from "./external-compatibility";

export interface AutoSelectProgram {
  id: -1;
  name: "Auto-select";
  resolvedProgram: ProgramEntity | null;
}

export type SelectedProgram = ProgramEntity | AutoSelectProgram | ExternalProgramEntity;

/**
 * Which of the three picker tabs is currently the "active target" — the tab
 * whose list opens when the user focuses the search field, marked by the
 * coral underline in `tab-bar.svelte`.
 */
export type PickerTabId = "particle" | "material" | "program";

/**
 * Compare-across dimension (Advanced mode). Reserved for the multi-select
 * follow-up — `multiSelected[dim]` is intentionally **not consumed** by any
 * calculation/URL surface in this PR. The `<MultiList>` rendering branch in
 * the Program tab was removed for the same reason; the multi-program
 * comparison is still driven by `MultiProgramState` above the Calculator
 * results table.
 *
 * Tracked follow-up: enable Materials/Particles dropdown options and wire
 * `multiSelected.*` end-to-end through `calculator-state` / `plot-state`.
 */
export type AcrossDimension = "particle" | "material" | "program";

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
   * Change the Compare-across dimension. Sets `multiSelected[newAcross]` to
   * the current single value (one-item array), sets `activeTarget = newAcross`
   * and `expanded = true`.
   */
  setAcross(newAcross: AcrossDimension): void;
  /** Toggle an id in `multiSelected[across]` (preserving order; first is default). */
  toggleMulti(dim: AcrossDimension, id: number | string): void;
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
  let selectedParticleId = $state<number | string | null>(PROTON_ID);
  let selectedMaterialId = $state<number | string | null>(WATER_ID);
  // -1 = Auto-select (built-in), number > 0 = built-in program ID, string = ExtRef for external
  let selectedProgramId = $state<number | string>(-1);
  let lastAutoFallbackMessage = $state<string | null>(null);
  let extCtx = $state<ExternalCompatibilityContext>(EMPTY_EXTERNAL_CONTEXT);

  // New picker chrome state (entity-selector rework — see
  // docs/04-feature-specs/entity-selection.md § Active target + expand/collapse).
  let activeTarget = $state<PickerTabId>("particle");
  let expanded = $state(true);
  let across = $state<AcrossDimension>("program");
  let multiParticle = $state<(number | string)[]>([]);
  let multiMaterial = $state<(number | string)[]>([]);
  let multiProgram = $state<(number | string)[]>([]);

  function resolveAutoSelect(
    particleId: number | string | null,
    materialId: number | string | null,
  ): number | null {
    if (particleId === null || materialId === null) return null;
    if (typeof particleId !== "number") return null;
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
    particleId: number | string | null,
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
      typeof selectedParticleId === "number" ? selectedParticleId : undefined,
      typeof selectedMaterialId === "number" ? selectedMaterialId : undefined,
    );
  }

  function computeAvailableExternalPrograms(): ExternalProgramEntity[] {
    return getAvailableExternalPrograms(extCtx, selectedParticleId, selectedMaterialId);
  }

  function computeAvailableParticles(): Array<ParticleEntity | ExternalOnlyParticle> {
    // If an external program is selected, filter by its covered particles
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
      typeof selectedMaterialId === "number" ? selectedMaterialId : undefined,
    );

    if (selectedProgramId !== -1) return builtinParticles;

    const externalOnlyParticles = extCtx.externalOnlyParticles.filter((particle) =>
      getAvailableExternalPrograms(extCtx, particle.id, selectedMaterialId).some(Boolean),
    );
    return [...builtinParticles, ...externalOnlyParticles];
  }

  function computeAvailableMaterials(): Array<MaterialEntity | ExternalOnlyMaterial> {
    // If an external program is selected, filter by its covered materials
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
      typeof selectedParticleId === "number" ? selectedParticleId : undefined,
    );

    if (selectedProgramId !== -1) return builtinMaterials;

    const externalOnlyMaterials = extCtx.externalOnlyMaterials.filter((material) =>
      getAvailableExternalPrograms(extCtx, selectedParticleId, material.id).some(Boolean),
    );
    return [...builtinMaterials, ...externalOnlyMaterials];
  }

  function isParticleAvailable(particleId: number | string): boolean {
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
      return matrix.allPrograms.find((p) => p.id === selectedProgramId) || AUTO_SELECT_PROGRAM;
    },

    get resolvedProgramId(): number | string | null {
      return getResolvedProgramId(selectedProgramId, selectedParticleId, selectedMaterialId);
    },

    get selectedParticle(): ParticleEntity | ExternalOnlyParticle | null {
      if (selectedParticleId === null) return null;
      // Built-in
      if (typeof selectedParticleId === "number") {
        const builtin = matrix.allParticles.find((p) => p.id === selectedParticleId);
        if (builtin) return builtin;
      } else if (selectedParticleId.startsWith("ext:")) {
        const extParticle = extCtx.externalOnlyParticles.find((p) => p.id === selectedParticleId);
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

    get availableParticles(): Array<ParticleEntity | ExternalOnlyParticle> {
      return computeAvailableParticles();
    },

    get availableMaterials(): Array<MaterialEntity | ExternalOnlyMaterial> {
      return computeAvailableMaterials();
    },

    selectProgram(programId: number | string): void {
      selectedProgramId = programId;

      if (typeof programId === "string") {
        // External program selected — validate particle/material against coverage
        const covered = extCtx.particlesByProgram.get(programId);
        if (covered && selectedParticleId !== null && !covered.has(selectedParticleId)) {
          // Select first covered built-in particle
          const firstAvailable = [...covered][0] ?? null;
          selectedParticleId = firstAvailable;
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
          selectedParticleId = protonAvailable ? PROTON_ID : (availableParticles[0]?.id ?? null);
        }

        const availableMaterials = computeAvailableMaterials();
        if (typeof selectedMaterialId === "number" && !isMaterialAvailable(selectedMaterialId)) {
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

      if (typeof selectedMaterialId === "number" && !isMaterialAvailable(selectedMaterialId)) {
        const availableMaterials = computeAvailableMaterials();
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

      if (
        typeof materialId === "string" &&
        materialId.startsWith("ext:") &&
        typeof selectedProgramId === "number" &&
        selectedProgramId !== -1
      ) {
        selectedProgramId = -1;
      }

      if (selectedParticleId !== null && !isParticleAvailable(selectedParticleId)) {
        const availableParticles = computeAvailableParticles();
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
      activeTarget = "particle";
      expanded = true;
      across = "program";
      multiParticle = [];
      multiMaterial = [];
      multiProgram = [];
    },

    get activeTarget() {
      return activeTarget;
    },

    get expanded() {
      return expanded;
    },

    get across() {
      return across;
    },

    get multiSelected() {
      return {
        particle: multiParticle,
        material: multiMaterial,
        program: multiProgram,
      };
    },

    setActiveTarget(tab: PickerTabId): void {
      activeTarget = tab;
    },

    setExpanded(value: boolean): void {
      expanded = value;
    },

    setAcross(newAcross: AcrossDimension): void {
      across = newAcross;
      // Seed multi array from current single value (preserves it as element 0).
      if (newAcross === "program") {
        const id = selectedProgramId;
        multiProgram = id !== -1 ? [id] : [];
      } else if (newAcross === "particle") {
        multiParticle = selectedParticleId !== null ? [selectedParticleId] : [];
      } else if (newAcross === "material") {
        multiMaterial = selectedMaterialId !== null ? [selectedMaterialId] : [];
      }
      activeTarget = newAcross;
      expanded = true;
    },

    toggleMulti(dim: AcrossDimension, id: number | string): void {
      const arr =
        dim === "program" ? multiProgram : dim === "particle" ? multiParticle : multiMaterial;
      const idx = arr.indexOf(id);
      let next: (number | string)[];
      if (idx >= 0) {
        // Cannot deselect the default (first) entry — must reorder first.
        if (idx === 0) return;
        next = arr.filter((x) => x !== id);
      } else {
        next = [...arr, id];
      }
      if (dim === "program") multiProgram = next;
      else if (dim === "particle") multiParticle = next;
      else multiMaterial = next;
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
