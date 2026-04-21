import { compatMatrix } from "./entities.svelte";

export const selectedProgramId = $state<{ value: number | null }>({ value: null });
export const selectedParticleId = $state<{ value: number | null }>({ value: null });
export const selectedMaterialId = $state<{ value: number | null }>({ value: null });

export function computeResolvedProgram(): number | null {
  const autoSelectProgram = (
    programId: number | null,
    particleId: number | null,
    materialId: number | null,
    compatMatrix: Map<string, number[]>
  ): number | null => {
    if (programId !== null) return programId;
    if (particleId === null && materialId === null) return null;

    for (const [key, materials] of compatMatrix) {
      const [progId, partId] = key.split(':').map(Number);
      if (materialId !== null && partId === particleId && materials.includes(materialId)) {
        return progId ?? null;
      }
    }
    return null;
  };

  return autoSelectProgram(
    selectedProgramId.value,
    selectedParticleId.value,
    selectedMaterialId.value,
    compatMatrix.value
  );
}
