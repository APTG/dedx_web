import { compatMatrix } from "./entities.svelte";
import { getAvailablePrograms } from "./compatibility-matrix";

export const selectedProgramId = $state<{ value: number | null }>({ value: null });
export const selectedParticleId = $state<{ value: number | null }>({ value: null });
export const selectedMaterialId = $state<{ value: number | null }>({ value: null });

export function computeResolvedProgram(): number | null {
  if (selectedProgramId.value !== null) {
    return selectedProgramId.value;
  }
  if (
    selectedParticleId.value === null ||
    selectedMaterialId.value === null ||
    compatMatrix.value === null
  ) {
    return null;
  }
  return (
    getAvailablePrograms(compatMatrix.value, selectedParticleId.value, selectedMaterialId.value)[0]
      ?.id ?? null
  );
}
