/** Picker tab IDs used by the entity selection panel state/UI. */
export type PickerTabId = "particle" | "material" | "program";
/** Compare-across dimension; "single" disables multi-selection mode. */
export type AcrossDimension = "single" | "particle" | "material" | "program";

export interface MultiSelectionState {
  activeTarget: PickerTabId;
  expanded: boolean;
  across: AcrossDimension;
  multiSelected: {
    particle: (number | string)[];
    material: (number | string)[];
    program: (number | string)[];
  };
  setActiveTarget(tab: PickerTabId): void;
  setExpanded(expanded: boolean): void;
  setAcross(
    newAcross: AcrossDimension,
    currentSingleProgramId: number | string,
    currentSingleParticleId: number | string | null,
    currentSingleMaterialId: number | string | null,
  ): void;
  toggleMulti(dim: AcrossDimension, id: number | string): void;
  collapseToSingle(): void;
  setMultiProgram(ids: (number | string)[]): void;
  setMultiMaterial(ids: (number | string)[]): void;
  setMultiParticle(ids: (number | string)[]): void;
  resetAll(): void;
}

export function createMultiSelectionState(): MultiSelectionState {
  let activeTarget = $state<PickerTabId>("particle");
  let expanded = $state(true);
  let across = $state<AcrossDimension>("single");
  let multiParticle = $state<(number | string)[]>([]);
  let multiMaterial = $state<(number | string)[]>([]);
  let multiProgram = $state<(number | string)[]>([]);

  return {
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
    setActiveTarget(tab: PickerTabId) {
      activeTarget = tab;
    },
    setExpanded(value: boolean) {
      expanded = value;
    },
    setAcross(
      newAcross: AcrossDimension,
      currentSingleProgramId: number | string,
      currentSingleParticleId: number | string | null,
      currentSingleMaterialId: number | string | null,
    ) {
      if (across === newAcross) return;
      across = newAcross;
      if (newAcross === "single") {
        if (multiParticle.length > 1) multiParticle = [multiParticle[0]!];
        if (multiMaterial.length > 1) multiMaterial = [multiMaterial[0]!];
        if (multiProgram.length > 1) multiProgram = [multiProgram[0]!];
      } else {
        if (newAcross === "program") {
          multiProgram = currentSingleProgramId !== -1 ? [currentSingleProgramId] : [];
        } else if (newAcross === "particle") {
          multiParticle = currentSingleParticleId !== null ? [currentSingleParticleId] : [];
        } else if (newAcross === "material") {
          multiMaterial = currentSingleMaterialId !== null ? [currentSingleMaterialId] : [];
        }
        activeTarget = newAcross;
        expanded = true;
      }
    },
    toggleMulti(dim: AcrossDimension, id: number | string) {
      if (dim === "single") return;
      const arr =
        dim === "program" ? multiProgram : dim === "particle" ? multiParticle : multiMaterial;
      const idx = arr.indexOf(id);
      let next: (number | string)[];
      if (idx >= 0) {
        if (idx === 0) return;
        next = arr.filter((x) => x !== id);
      } else {
        next = [...arr, id];
      }
      if (dim === "program") multiProgram = next;
      else if (dim === "particle") multiParticle = next;
      else multiMaterial = next;
    },
    collapseToSingle() {
      if (multiParticle.length > 1) multiParticle = [multiParticle[0]!];
      if (multiMaterial.length > 1) multiMaterial = [multiMaterial[0]!];
      if (multiProgram.length > 1) multiProgram = [multiProgram[0]!];
    },
    setMultiProgram(ids: (number | string)[]) {
      multiProgram = [...new Set(ids)];
    },
    setMultiMaterial(ids: (number | string)[]) {
      multiMaterial = [...new Set(ids)];
    },
    setMultiParticle(ids: (number | string)[]) {
      multiParticle = [...new Set(ids)];
    },
    resetAll() {
      activeTarget = "particle";
      expanded = true;
      across = "single";
      multiParticle = [];
      multiMaterial = [];
      multiProgram = [];
    },
  };
}
