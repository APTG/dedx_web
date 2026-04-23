import { describe, test, expect, beforeEach } from "vitest";
import {
  selectedProgramId,
  selectedParticleId,
  selectedMaterialId,
  computeResolvedProgram,
} from "$lib/state/selection.svelte";
import { compatMatrix } from "$lib/state/entities.svelte";
import type { CompatibilityMatrix } from "$lib/wasm/types";

/**
 * Build a minimal CompatibilityMatrix for selection-state tests.
 * Tuple entries are [entityId, compatibleProgramIds].
 */
function createMatrix(
  allProgramIds: number[],
  programsByParticleEntries: Array<[number, number[]]>,
  programsByMaterialEntries: Array<[number, number[]]>,
): CompatibilityMatrix {
  return {
    particlesByProgram: new Map(),
    materialsByProgram: new Map(),
    programsByParticle: new Map(
      programsByParticleEntries.map(([particleId, programIds]) => [
        particleId,
        new Set(programIds),
      ]),
    ),
    programsByMaterial: new Map(
      programsByMaterialEntries.map(([materialId, programIds]) => [
        materialId,
        new Set(programIds),
      ]),
    ),
    allParticles: [],
    allMaterials: [],
    allPrograms: allProgramIds.map((id) => ({ id, name: `Program ${id}`, version: "1.0" })),
  };
}

// All state is module-level $state; reset to known baseline before each test.
beforeEach(() => {
  selectedProgramId.value = null;
  selectedParticleId.value = null;
  selectedMaterialId.value = null;
  compatMatrix.value = createMatrix([], [], []);
});

describe("computeResolvedProgram — explicit selection", () => {
  test("returns null when nothing is selected", () => {
    expect(computeResolvedProgram()).toBeNull();
  });

  test("returns explicit programId immediately", () => {
    selectedProgramId.value = 3;
    expect(computeResolvedProgram()).toBe(3);
  });

  test("explicit programId wins even when compat matrix would match another", () => {
    compatMatrix.value = createMatrix([5, 7], [[1, [7]]], [[1, [7]]]);
    selectedProgramId.value = 5;
    selectedParticleId.value = 1;
    selectedMaterialId.value = 1;
    expect(computeResolvedProgram()).toBe(5);
  });
});

describe("computeResolvedProgram — auto-select via compat matrix", () => {
  test("returns null when particle+material selected but compat matrix is empty", () => {
    selectedParticleId.value = 1;
    selectedMaterialId.value = 1;
    expect(computeResolvedProgram()).toBeNull();
  });

  test("returns null when only particle is selected (no material)", () => {
    compatMatrix.value = createMatrix(
      [2],
      [[1, [2]]],
      [
        [1, [2]],
        [2, [2]],
      ],
    );
    selectedParticleId.value = 1;
    expect(computeResolvedProgram()).toBeNull();
  });

  test("auto-selects program when particle+material match a compat entry", () => {
    compatMatrix.value = createMatrix(
      [2],
      [[1, [2]]],
      [
        [1, [2]],
        [2, [2]],
        [3, [2]],
      ],
    );
    selectedParticleId.value = 1;
    selectedMaterialId.value = 1;
    expect(computeResolvedProgram()).toBe(2);
  });

  test("returns null when material is not in the compat entry for that particle", () => {
    compatMatrix.value = createMatrix(
      [2],
      [[1, [2]]],
      [
        [10, [2]],
        [20, [2]],
      ],
    );
    selectedParticleId.value = 1;
    selectedMaterialId.value = 99;
    expect(computeResolvedProgram()).toBeNull();
  });

  test("returns null when particle does not appear in any compat entry", () => {
    compatMatrix.value = createMatrix(
      [2],
      [[5, [2]]],
      [
        [1, [2]],
        [2, [2]],
      ],
    );
    selectedParticleId.value = 99; // not particle 5
    selectedMaterialId.value = 1;
    expect(computeResolvedProgram()).toBeNull();
  });

  test("selects the first matching program when multiple entries match", () => {
    compatMatrix.value = createMatrix([1, 2], [[1, [1, 2]]], [[1, [1, 2]]]);
    selectedParticleId.value = 1;
    selectedMaterialId.value = 1;
    expect(computeResolvedProgram()).toBe(1);
  });
});
