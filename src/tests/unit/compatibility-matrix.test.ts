import { describe, test, expect, beforeEach } from "vitest";
import {
  buildCompatibilityMatrix,
  getAvailablePrograms,
  getAvailableParticles,
  getAvailableMaterials,
} from "$lib/state/compatibility-matrix";
import type {
  CompatibilityMatrix,
  ProgramEntity,
  ParticleEntity,
  MaterialEntity,
} from "$lib/wasm/types";

// Extended mock service for entity selection tests
class MockLibdedxService {
  getPrograms(): ProgramEntity[] {
    return [
      { id: 1, name: "PSTAR", version: "1.0" },
      { id: 2, name: "ASTAR", version: "1.0" },
      { id: 3, name: "MSTAR", version: "1.0" },
      { id: 9, name: "ICRU", version: "1.0" }, // DEDX_ICRU - internal auto-selector
      { id: 10, name: "Bethe-ext", version: "1.0" },
    ];
  }

  getParticles(programId: number): ParticleEntity[] {
    const particles: Map<number, ParticleEntity[]> = new Map([
      [1, [{ id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] }]], // PSTAR: proton only
      [2, [{ id: 2, name: "Helium", massNumber: 4, atomicMass: 4.002, symbol: "He", aliases: ["alpha", "α", "He-4"] }]], // ASTAR: alpha only
      [
        3,
        [
          { id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] },
          { id: 2, name: "Helium", massNumber: 4, atomicMass: 4.002, symbol: "He", aliases: ["alpha", "α", "He-4"] },
          { id: 6, name: "Carbon", massNumber: 12, atomicMass: 12.011, symbol: "C", aliases: ["C-12"] },
        ],
      ], // MSTAR: proton, alpha, carbon
      [9, [{ id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] }]], // DEDX_ICRU: proton
      [10, []], // Bethe-ext: zero particles (to test exclusion)
    ]);
    return particles.get(programId) || [];
  }

  getMaterials(programId: number): MaterialEntity[] {
    const materials: Map<number, MaterialEntity[]> = new Map([
      [1, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]], // PSTAR: water only
      [2, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]], // ASTAR: water only
      [
        3,
        [
          { id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false },
          { id: 267, name: "Air", density: 0.0012, isGasByDefault: true },
        ],
      ], // MSTAR: water, air
      [9, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]], // DEDX_ICRU: water
      [10, []], // Bethe-ext: zero materials (to test exclusion)
    ]);
    return materials.get(programId) || [];
  }
}

describe("buildCompatibilityMatrix", () => {
  let service: MockLibdedxService;

  beforeEach(() => {
    service = new MockLibdedxService();
  });

  test("builds matrix with all programs from service", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    // PSTAR, ASTAR, MSTAR (all have particles+materials); DEDX_ICRU excluded from UI; Bethe-ext has zero
    expect(matrix.allPrograms).toHaveLength(3);
  });

  test("allPrograms does NOT contain DEDX_ICRU (id=9)", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    const icruProgram = matrix.allPrograms.find((p) => p.id === 9);
    expect(icruProgram).toBeUndefined();
  });

  test("allPrograms excludes programs with zero particles", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    const betheExt = matrix.allPrograms.find((p) => p.id === 10);
    expect(betheExt).toBeUndefined();
  });

  test("allParticles is the union across all programs, no duplicates", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    const particleIds = matrix.allParticles.map((p) => p.id);
    // proton (1), alpha/helium (2), carbon (6) - no duplicates
    expect(particleIds).toEqual([1, 2, 6]);
  });

  test("allMaterials is the union across all programs, no duplicates", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    const materialIds = matrix.allMaterials.map((m) => m.id);
    // water (276), air (267)
    expect(materialIds).toEqual([276, 267]);
  });

  test("particlesByProgram is populated for each program", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    expect(matrix.particlesByProgram.get(1)).toEqual(new Set([1])); // PSTAR: proton
    expect(matrix.particlesByProgram.get(2)).toEqual(new Set([2])); // ASTAR: alpha
    expect(matrix.particlesByProgram.get(3)).toEqual(new Set([1, 2, 6])); // MSTAR: proton, alpha, carbon
  });

  test("materialsByProgram is populated for each program", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    expect(matrix.materialsByProgram.get(1)).toEqual(new Set([276])); // PSTAR: water
    expect(matrix.materialsByProgram.get(2)).toEqual(new Set([276])); // ASTAR: water
    expect(matrix.materialsByProgram.get(3)).toEqual(new Set([276, 267])); // MSTAR: water, air
  });

  test("programsByParticle is populated for each particle", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    expect(matrix.programsByParticle.get(1)).toEqual(new Set([1, 3, 9])); // proton: PSTAR, MSTAR, DEDX_ICRU
    expect(matrix.programsByParticle.get(2)).toEqual(new Set([2, 3])); // alpha: ASTAR, MSTAR
    expect(matrix.programsByParticle.get(6)).toEqual(new Set([3])); // carbon: MSTAR only
  });

  test("programsByMaterial is populated for each material", () => {
    const matrix = buildCompatibilityMatrix(service as any);
    expect(matrix.programsByMaterial.get(276)).toEqual(new Set([1, 2, 3, 9])); // water: PSTAR, ASTAR, MSTAR, DEDX_ICRU
    expect(matrix.programsByMaterial.get(267)).toEqual(new Set([3])); // air: MSTAR only
  });
});

describe("getAvailablePrograms", () => {
  let matrix: CompatibilityMatrix;
  let service: MockLibdedxService;

  beforeEach(() => {
    service = new MockLibdedxService();
    matrix = buildCompatibilityMatrix(service as any);
  });

  test("(undefined, undefined) returns all visible programs", () => {
    const programs = getAvailablePrograms(matrix);
    // PSTAR, ASTAR, MSTAR, Bethe-excluded; DEDX_ICRU excluded from UI
    expect(programs.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  test("(particleId=1, undefined) returns only programs supporting proton", () => {
    const programs = getAvailablePrograms(matrix, 1);
    // proton (1) is in PSTAR (1), MSTAR (3), DEDX_ICRU (9-excluded)
    expect(programs.map((p) => p.id)).toEqual([1, 3]);
  });

  test("(particleId=2, undefined) returns only programs supporting alpha", () => {
    const programs = getAvailablePrograms(matrix, 2);
    // alpha (2) is in ASTAR (2), MSTAR (3)
    expect(programs.map((p) => p.id)).toEqual([2, 3]);
  });

  test("(particleId=1, materialId=276) returns programs supporting both proton AND water", () => {
    const programs = getAvailablePrograms(matrix, 1, 276);
    // proton+water: PSTAR (1) has both, MSTAR (3) has both
    expect(programs.map((p) => p.id)).toEqual([1, 3]);
  });

  test("(particleId=6, materialId=276) returns only MSTAR (only program with carbon+water)", () => {
    const programs = getAvailablePrograms(matrix, 6, 276);
    // carbon+water: only MSTAR (3)
    expect(programs.map((p) => p.id)).toEqual([3]);
  });

  test("(particleId=999, undefined) returns empty array (unknown particle)", () => {
    const programs = getAvailablePrograms(matrix, 999);
    expect(programs).toEqual([]);
  });
});

describe("getAvailableParticles", () => {
  let matrix: CompatibilityMatrix;
  let service: MockLibdedxService;

  beforeEach(() => {
    service = new MockLibdedxService();
    matrix = buildCompatibilityMatrix(service as any);
  });

  test("(undefined, undefined) returns all particles (union)", () => {
    const particles = getAvailableParticles(matrix);
    expect(particles.map((p) => p.id)).toEqual([1, 2, 6]);
  });

  test("(programId=1, undefined) returns only particles in PSTAR", () => {
    const particles = getAvailableParticles(matrix, 1);
    // PSTAR has proton only
    expect(particles.map((p) => p.id)).toEqual([1]);
  });

  test("(programId=3, undefined) returns particles in MSTAR", () => {
    const particles = getAvailableParticles(matrix, 3);
    // MSTAR has proton, alpha, carbon
    expect(particles.map((p) => p.id)).toEqual([1, 2, 6]);
  });

  test("(undefined, materialId=267) returns only particles compatible with air", () => {
    const particles = getAvailableParticles(matrix, undefined, 267);
    // air is only in MSTAR, which has proton, alpha, carbon
    expect(particles.map((p) => p.id)).toEqual([1, 2, 6]);
  });

  test("deselecting program (undefined) expands particle list back", () => {
    const withProgram = getAvailableParticles(matrix, 1); // PSTAR: proton only
    const withoutProgram = getAvailableParticles(matrix, undefined); // all
    expect(withProgram.length).toBeLessThan(withoutProgram.length);
  });
});

describe("getAvailableMaterials", () => {
  let matrix: CompatibilityMatrix;
  let service: MockLibdedxService;

  beforeEach(() => {
    service = new MockLibdedxService();
    matrix = buildCompatibilityMatrix(service as any);
  });

  test("(undefined, undefined) returns all materials", () => {
    const materials = getAvailableMaterials(matrix);
    expect(materials.map((m) => m.id)).toEqual([276, 267]);
  });

  test("(programId=1, undefined) returns only materials in PSTAR", () => {
    const materials = getAvailableMaterials(matrix, 1);
    // PSTAR has water only
    expect(materials.map((m) => m.id)).toEqual([276]);
  });

  test("(undefined, particleId=6) returns only materials compatible with carbon", () => {
    const materials = getAvailableMaterials(matrix, undefined, 6);
    // carbon is only in MSTAR, which has water, air
    expect(materials.map((m) => m.id)).toEqual([276, 267]);
  });

  test("(programId=3, particleId=2) returns materials in MSTAR that also have alpha", () => {
    const materials = getAvailableMaterials(matrix, 3, 2);
    // MSTAR with alpha: water, air (both available in MSTAR)
    expect(materials.map((m) => m.id)).toEqual([276, 267]);
  });

  test("deselecting particle (undefined) expands material list back", () => {
    const withParticle = getAvailableMaterials(matrix, undefined, 6); // carbon: MSTAR materials
    const withoutParticle = getAvailableMaterials(matrix, undefined, undefined); // all
    expect(withParticle.length).toBeLessThanOrEqual(withoutParticle.length);
  });
});

describe("Bidirectional filtering", () => {
  let matrix: CompatibilityMatrix;
  let service: MockLibdedxService;

  beforeEach(() => {
    service = new MockLibdedxService();
    matrix = buildCompatibilityMatrix(service as any);
  });

  test("selecting proton greys out materials not reachable via any proton-supporting program", () => {
    // Proton is in PSTAR (water), MSTAR (water, air), DEDX_ICRU (water)
    const materialsWithProton = getAvailableMaterials(matrix, undefined, 1);
    // water (276) is reachable via PSTAR, MSTAR, DEDX_ICRU
    // air (267) is only in MSTAR, and MSTAR supports proton, so air should also be available
    expect(materialsWithProton.map((m) => m.id)).toEqual([276, 267]);
  });

  test("selecting water + proton leaves only programs that support both", () => {
    const programs = getAvailablePrograms(matrix, 1, 276);
    // PSTAR (1): proton, water ✓
    // ASTAR (2): alpha only ✗
    // MSTAR (3): alpha, carbon, water ✓
    expect(programs.map((p) => p.id)).toEqual([1, 3]);
  });

  test("clearing particle selection restores full material availability", () => {
    const withParticle = getAvailableMaterials(matrix, undefined, 1);
    const withoutParticle = getAvailableMaterials(matrix, undefined, undefined);
    // When a particle is selected, materials are filtered to those compatible
    expect(withParticle.length).toBeLessThanOrEqual(withoutParticle.length);
  });
});
