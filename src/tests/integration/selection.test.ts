import { describe, test, expect, beforeEach } from "vitest";
import {
  selectedProgramId,
  selectedParticleId,
  selectedMaterialId,
  computeResolvedProgram,
} from "$lib/state/selection.svelte";
import { compatMatrix } from "$lib/state/entities.svelte";

// All state is module-level $state; reset to known baseline before each test.
beforeEach(() => {
  selectedProgramId.value = null;
  selectedParticleId.value = null;
  selectedMaterialId.value = null;
  compatMatrix.value = new Map();
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
    compatMatrix.value = new Map([["7:1", [1]]]);
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
    compatMatrix.value = new Map([["2:1", [1, 2]]]);
    selectedParticleId.value = 1;
    expect(computeResolvedProgram()).toBeNull();
  });

  test("auto-selects program when particle+material match a compat entry", () => {
    // key format: "programId:particleId" → array of materialIds
    compatMatrix.value = new Map([["2:1", [1, 2, 3]]]);
    selectedParticleId.value = 1;
    selectedMaterialId.value = 1;
    expect(computeResolvedProgram()).toBe(2);
  });

  test("returns null when material is not in the compat entry for that particle", () => {
    compatMatrix.value = new Map([["2:1", [10, 20]]]);
    selectedParticleId.value = 1;
    selectedMaterialId.value = 99;
    expect(computeResolvedProgram()).toBeNull();
  });

  test("returns null when particle does not appear in any compat entry", () => {
    compatMatrix.value = new Map([["2:5", [1, 2]]]);
    selectedParticleId.value = 99; // not particle 5
    selectedMaterialId.value = 1;
    expect(computeResolvedProgram()).toBeNull();
  });

  test("selects the first matching program when multiple entries match", () => {
    // JavaScript Map preserves insertion order
    compatMatrix.value = new Map([
      ["1:1", [1]],
      ["2:1", [1]],
    ]);
    selectedParticleId.value = 1;
    selectedMaterialId.value = 1;
    // First match should be program 1
    expect(computeResolvedProgram()).toBe(1);
  });
});
