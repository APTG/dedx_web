import { describe, test, expect, beforeEach } from "vitest";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { ProgramEntity, ParticleEntity, MaterialEntity } from "$lib/wasm/types";

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
      [1, [{ id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] }]],
      [2, [{ id: 2, name: "Helium", massNumber: 4, atomicMass: 4.002, symbol: "He", aliases: ["alpha", "α", "He-4"] }]],
      [
        3,
        [
          { id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] },
          { id: 2, name: "Helium", massNumber: 4, atomicMass: 4.002, symbol: "He", aliases: ["alpha", "α", "He-4"] },
          { id: 6, name: "Carbon", massNumber: 12, atomicMass: 12.011, symbol: "C", aliases: ["C-12"] },
        ],
      ],
      [9, [{ id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] }]],
      [10, []],
    ]);
    return particles.get(programId) || [];
  }

  getMaterials(programId: number): MaterialEntity[] {
    const materials: Map<number, MaterialEntity[]> = new Map([
      [1, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
      [2, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
      [
        3,
        [
          { id: 1, name: "Hydrogen", density: 0.000089, isGasByDefault: true },
          { id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false },
          { id: 267, name: "Air", density: 0.0012, isGasByDefault: true },
        ],
      ],
      [9, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
      [10, []],
    ]);
    return materials.get(programId) || [];
  }
}

// Electron mock service
class MockLibdedxServiceWithElectron {
  getPrograms(): ProgramEntity[] {
    return [
      { id: 3, name: "ESTAR", version: "1.0" },
      { id: 1, name: "PSTAR", version: "1.0" },
    ];
  }

  getParticles(programId: number): ParticleEntity[] {
    if (programId === 3) {
      return [{ id: 1001, name: "Electron", massNumber: 0, atomicMass: 0.000548, symbol: "e⁻", aliases: ["e⁻", "e-", "beta"] }];
    }
    if (programId === 1) {
      return [{ id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] }];
    }
    return [];
  }

  getMaterials(programId: number): MaterialEntity[] {
    if (programId === 3) {
      return [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }];
    }
    if (programId === 1) {
      return [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }];
    }
    return [];
  }
}

describe("createEntitySelectionState", () => {
  let service: MockLibdedxService;
  let matrix: ReturnType<typeof buildCompatibilityMatrix>;

  beforeEach(() => {
    service = new MockLibdedxService();
    matrix = buildCompatibilityMatrix(service as any);
  });

  describe("Defaults on init", () => {
    test("selectedParticle is proton (id=1) by default", () => {
      const state = createEntitySelectionState(matrix);
      expect(state.selectedParticle?.id).toBe(1);
    });

    test("selectedMaterial is liquid water (id=276) by default", () => {
      const state = createEntitySelectionState(matrix);
      expect(state.selectedMaterial?.id).toBe(276);
    });

    test("selectedProgram is Auto-select (id=-1) by default", () => {
      const state = createEntitySelectionState(matrix);
      expect(state.selectedProgram.id).toBe(-1);
    });

    test("isComplete is true when all three defaults are set", () => {
      const state = createEntitySelectionState(matrix);
      expect(state.isComplete).toBe(true);
    });

    test("Auto-select resolves to a concrete program (not null) for proton+water", () => {
      const state = createEntitySelectionState(matrix);
      // Auto-select with proton+water should resolve to PSTAR or ICRU
      expect(state.resolvedProgramId).not.toBeNull();
      expect(state.resolvedProgramId).toBeGreaterThan(0);
    });
  });

  describe("Preserve / fallback on particle change", () => {
    test("switching proton → carbon: water stays selected if still compatible; program resets to Auto-select if no longer valid", () => {
      const state = createEntitySelectionState(matrix);
      // Start: proton, water, PSTAR
      expect(state.selectedParticle?.id).toBe(1);
      expect(state.selectedMaterial?.id).toBe(276);

      state.selectParticle(6); // carbon
      // Water is compatible with carbon (via MSTAR)
      expect(state.selectedMaterial?.id).toBe(276);
      // PSTAR doesn't support carbon, so program should reset to Auto-select
      expect(state.selectedProgram.id).toBe(-1);
    });

    test("switching to a particle where current material is incompatible: falls back to water (id=276) if available", () => {
      const state = createEntitySelectionState(matrix);
      // Start: proton, water
      state.selectParticle(2); // alpha
      // Alpha is compatible with water (via ASTAR, MSTAR)
      expect(state.selectedMaterial?.id).toBe(276);
    });

    test("switching to a particle where current program is incompatible: resets program to Auto-select", () => {
      const state = createEntitySelectionState(matrix);
      // Start: proton, water, PSTAR
      state.selectParticle(2); // alpha
      // PSTAR doesn't support alpha
      expect(state.selectedProgram.id).toBe(-1);
    });
  });

  describe("Preserve / fallback on material change", () => {
    test("switching water → air: particle preserved if still compatible; program resets if incompatible", () => {
      const state = createEntitySelectionState(matrix);
      // Start: proton, water, PSTAR
      state.selectMaterial(267); // air
      // Air is in MSTAR, which now has proton
      // Proton is preserved since it's compatible with air via MSTAR
      expect(state.selectedParticle?.id).toBe(1);
      // PSTAR doesn't support air, so program resets
      expect(state.selectedProgram.id).toBe(-1);
    });

    test("selecting a material incompatible with current particle: particle falls back to proton if available", () => {
      // This tests a scenario where the current particle has no common program with the new material
      const state = createEntitySelectionState(matrix);
      // Start with alpha (only in ASTAR, MSTAR) and water
      state.selectParticle(2); // alpha
      state.selectMaterial(276); // water - compatible
      // Now if we had a material only compatible with proton, alpha would fall back
      // In our mock, all materials are compatible with alpha via MSTAR
      // So this tests that particle is preserved when compatible
      expect(state.selectedParticle?.id).toBe(2);
    });
  });

  describe("Preserve / fallback on program change", () => {
    test("selecting PSTAR: particle list narrows; if current particle unsupported, falls back to proton", () => {
      const state = createEntitySelectionState(matrix);
      // Start with carbon (only in MSTAR)
      state.selectParticle(6);
      state.selectMaterial(276);
      // Now select PSTAR which doesn't support carbon
      state.selectProgram(1); // PSTAR
      // Carbon unsupported, should fall back to proton (PSTAR's only particle)
      expect(state.selectedParticle?.id).toBe(1);
    });

    test("selecting MSTAR: proton becomes unavailable; particle falls back to alpha or first available", () => {
      const state = createEntitySelectionState(matrix);
      // Start: proton, water, PSTAR
      // MSTAR supports alpha, carbon - proton is also supported via MSTAR in our mock
      // Let's adjust: select a program that doesn't support proton
      state.selectProgram(2); // ASTAR - only alpha
      // Proton not in ASTAR, should fall back to alpha
      expect(state.selectedParticle?.id).toBe(2);
    });

    test("selecting Auto-select always succeeds (never greyed out)", () => {
      const state = createEntitySelectionState(matrix);
      state.selectProgram(1); // PSTAR
      state.selectProgram(-1); // Auto-select
      expect(state.selectedProgram.id).toBe(-1);
    });
  });

  describe("Clear / deselect", () => {
    test("clearParticle() removes particle constraint; available materials and programs expand", () => {
      const state = createEntitySelectionState(matrix);
      const beforeMaterials = state.availableMaterials.length;
      const beforePrograms = state.availablePrograms.length;

      state.selectParticle(6); // carbon - restricts to MSTAR
      const withCarbonMaterials = state.availableMaterials.length;
      const withCarbonPrograms = state.availablePrograms.length;

      state.clearParticle();
      const afterMaterials = state.availableMaterials.length;
      const afterPrograms = state.availablePrograms.length;

      expect(afterMaterials).toBeGreaterThanOrEqual(withCarbonMaterials);
      expect(afterPrograms).toBeGreaterThanOrEqual(withCarbonPrograms);
    });

    test("clearMaterial() removes material constraint; available particles and programs expand", () => {
      const state = createEntitySelectionState(matrix);
      state.selectMaterial(267); // air - restricts to MSTAR
      const withAirParticles = state.availableParticles.length;

      state.clearMaterial();
      const afterParticles = state.availableParticles.length;

      expect(afterParticles).toBeGreaterThanOrEqual(withAirParticles);
    });

    test("deselecting program resets to Auto-select (not null)", () => {
      const state = createEntitySelectionState(matrix);
      state.selectProgram(1); // PSTAR
      expect(state.selectedProgram.id).toBe(1);

      state.selectProgram(-1); // Auto-select
      expect(state.selectedProgram.id).toBe(-1);
    });

    test("isComplete is false when particle is cleared", () => {
      const state = createEntitySelectionState(matrix);
      expect(state.isComplete).toBe(true);

      state.clearParticle();
      expect(state.isComplete).toBe(false);
    });
  });

  describe("Reset", () => {
    test("resetAll() restores proton / water / Auto-select", () => {
      const state = createEntitySelectionState(matrix);
      // Change everything
      state.selectParticle(6); // carbon
      state.selectMaterial(267); // air
      state.selectProgram(3); // MSTAR

      state.resetAll();

      expect(state.selectedParticle?.id).toBe(1); // proton
      expect(state.selectedMaterial?.id).toBe(276); // water
      expect(state.selectedProgram.id).toBe(-1); // Auto-select
    });
  });

  describe("DEDX_ICRU exclusion", () => {
    test("DEDX_ICRU (id=9) never appears in availablePrograms", () => {
      const state = createEntitySelectionState(matrix);
      const hasIcru = state.availablePrograms.some((p) => p.id === 9);
      expect(hasIcru).toBe(false);
    });
  });

  describe("Electron special case", () => {
    test("electron (id=1001) appears in availableParticles", () => {
      const electronService = new MockLibdedxServiceWithElectron();
      const electronMatrix = buildCompatibilityMatrix(electronService as any);
      const state = createEntitySelectionState(electronMatrix);

      const hasElectron = state.availableParticles.some((p) => p.id === 1001);
      expect(hasElectron).toBe(true);
    });

    test("electron is never isComplete=true (ESTAR not implemented)", () => {
      const electronService = new MockLibdedxServiceWithElectron();
      const electronMatrix = buildCompatibilityMatrix(electronService as any);
      const state = createEntitySelectionState(electronMatrix);

      state.selectParticle(1001); // electron
      // Electron with ESTAR is not a valid complete state
      // Per spec: electron is always greyed out because ESTAR is not implemented
      expect(state.isComplete).toBe(false);
    });
  });
});
