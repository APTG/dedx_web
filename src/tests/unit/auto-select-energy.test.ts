import { describe, test, expect, beforeEach } from "vitest";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import type { ProgramEntity, ParticleEntity, MaterialEntity } from "$lib/wasm/types";

// Issue #871 repro: Auto-select resolves a program from particle+material alone,
// ignoring energy — a heavy ion below ICRU 73's energy floor gets stuck on ICRU 73
// ("out of range") even though MSTAR, later in the same chain, covers it.
//
// Program IDs follow entity-availability.svelte.ts's PROGRAM_ID map:
// ICRU73_OLD=5, ICRU73=6, MSTAR=4. Boron (id=5, not proton/helium/carbon) exercises
// DEFAULT_AUTO_SELECT_CHAIN = [ICRU73, ICRU73_OLD, MSTAR], same chain as carbon/heavy ions.
const BORON_ID = 5;
const SILICON_ID = 14;

const boron: ParticleEntity = {
  id: BORON_ID,
  name: "Boron-11",
  massNumber: 11,
  atomicMass: 11.009,
  symbol: "B",
  aliases: ["B-11"],
};

const silicon: MaterialEntity = {
  id: SILICON_ID,
  name: "Silicon",
  density: 2.33,
  isGasByDefault: false,
};

class MockLibdedxServiceWithEnergyFloors {
  getPrograms(): ProgramEntity[] {
    return [
      { id: 4, name: "MSTAR", version: "1.0" },
      { id: 5, name: "ICRU73_OLD", version: "1.0" },
      { id: 6, name: "ICRU73", version: "1.0" },
    ];
  }

  getParticles(_programId: number): ParticleEntity[] {
    return [boron];
  }

  getMaterials(_programId: number): MaterialEntity[] {
    return [silicon];
  }

  getMinEnergy(programId: number): number {
    // ICRU 73 / ICRU 73 (old) have a 0.025 MeV/nucleon floor for ions heavier
    // than He; MSTAR covers down to 0.001 MeV/nucleon.
    if (programId === 6 || programId === 5) return 0.025;
    return 0.001;
  }

  getMaxEnergy(_programId: number): number {
    return 1000;
  }
}

describe("Auto-select energy-aware resolution (issue #871)", () => {
  let service: MockLibdedxServiceWithEnergyFloors;
  let matrix: ReturnType<typeof buildCompatibilityMatrix>;

  beforeEach(() => {
    service = new MockLibdedxServiceWithEnergyFloors();
    matrix = buildCompatibilityMatrix(service as any);
  });

  test("with no energy hint, falls back to today's energy-blind first-chain-candidate behavior", () => {
    const state = createEntitySelectionState(matrix, service as any);
    state.selectParticle(BORON_ID);
    state.selectMaterial(SILICON_ID);
    expect(state.resolvedProgramId).toBe(6); // ICRU73
  });

  test("energy below ICRU 73's floor but within MSTAR's range resolves to MSTAR, not ICRU 73", () => {
    const state = createEntitySelectionState(matrix, service as any);
    state.selectParticle(BORON_ID);
    state.selectMaterial(SILICON_ID);
    state.setAutoSelectEnergyHint(0.02); // 220.5 keV / 11 nucleons ≈ 0.02 MeV/nucleon

    expect(state.resolvedProgramId).toBe(4); // MSTAR
  });

  test("energy within ICRU 73's range still resolves to ICRU 73 (chain order preserved)", () => {
    const state = createEntitySelectionState(matrix, service as any);
    state.selectParticle(BORON_ID);
    state.selectMaterial(SILICON_ID);
    state.setAutoSelectEnergyHint(1.0);

    expect(state.resolvedProgramId).toBe(6); // ICRU73
  });

  test("energy outside every chain candidate's range falls back to the first available program", () => {
    const state = createEntitySelectionState(matrix, service as any);
    state.selectParticle(BORON_ID);
    state.selectMaterial(SILICON_ID);
    state.setAutoSelectEnergyHint(5000); // above every program's 1000 MeV/nucleon ceiling

    expect(state.resolvedProgramId).toBe(6); // ICRU73, today's energy-blind fallback
  });

  test("without a service passed to createEntitySelectionState, resolution stays energy-blind", () => {
    const state = createEntitySelectionState(matrix); // no service
    state.selectParticle(BORON_ID);
    state.selectMaterial(SILICON_ID);
    state.setAutoSelectEnergyHint(0.02);

    expect(state.resolvedProgramId).toBe(6); // no service to consult getMinEnergy/getMaxEnergy
  });
});
