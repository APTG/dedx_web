import { describe, it, expect } from "vitest";
import {
  buildExternalCompatibilityContext,
  getAvailableExternalPrograms,
  EMPTY_EXTERNAL_CONTEXT,
} from "$lib/state/external-compatibility";
import type { ExternalStoreMetadata } from "$lib/external-data/schema";
import type { ParticleEntity, MaterialEntity } from "$lib/wasm/types";

// Minimal built-in particles matching what libdedx exposes
const BUILTIN_PARTICLES: ParticleEntity[] = [
  { id: 1, name: "Proton", symbol: "p", massNumber: 1, atomicMass: 1.00728 } as ParticleEntity,
  { id: 2, name: "Helium", symbol: "He", massNumber: 4, atomicMass: 4.00151 } as ParticleEntity,
  { id: 6, name: "Carbon", symbol: "C", massNumber: 12, atomicMass: 11.99671 } as ParticleEntity,
];

const BUILTIN_MATERIALS: MaterialEntity[] = [
  { id: 276, name: "Water, Liquid", density: 1.0 } as MaterialEntity,
  { id: 13, name: "Aluminum", atomicNumber: 13 } as MaterialEntity,
];

function makeStore(overrides: Partial<ExternalStoreMetadata> = {}): ExternalStoreMetadata {
  return {
    label: "test",
    url: "https://example.test/",
    name: "Test Store",
    programs: [{ id: "prog1", name: "Test Program" }],
    particles: [
      {
        id: "p",
        name: "Proton",
        symbol: "p",
        Z: 1,
        A: 1,
        atomicMass: 1.00728,
        pdgCode: 2212,
        index: 0,
      },
    ],
    materials: [
      {
        id: "water",
        name: "Water, Liquid",
        icruId: 276,
        index: 0,
        linearUnitsAvailable: true,
        density: 1.0,
      },
    ],
    energyGrid: [1, 10, 100],
    energyUnit: "MeV",
    stpUnit: "MeV·cm²/g",
    hasCsdaRange: false,
    ...overrides,
  };
}

describe("buildExternalCompatibilityContext", () => {
  it("merges proton by PDG code (2212 → id 1)", () => {
    const ctx = buildExternalCompatibilityContext(
      [makeStore()],
      BUILTIN_PARTICLES,
      BUILTIN_MATERIALS,
    );

    expect(ctx.mergedParticleMap.get("ext:test:p")).toBe(1);
    expect(ctx.externalOnlyParticles).toHaveLength(0);
  });

  it("merges water by ICRU id (276 → id 276)", () => {
    const ctx = buildExternalCompatibilityContext(
      [makeStore()],
      BUILTIN_PARTICLES,
      BUILTIN_MATERIALS,
    );

    expect(ctx.mergedMaterialMap.get("ext:test:water")).toBe(276);
    expect(ctx.externalOnlyMaterials).toHaveLength(0);
  });

  it("registers external program", () => {
    const ctx = buildExternalCompatibilityContext(
      [makeStore()],
      BUILTIN_PARTICLES,
      BUILTIN_MATERIALS,
    );

    expect(ctx.programs).toHaveLength(1);
    expect(ctx.programs[0]!.id).toBe("ext:test:prog1");
    expect(ctx.programs[0]!.label).toBe("test");
  });

  it("populates particlesByProgram with merged builtin ID", () => {
    const ctx = buildExternalCompatibilityContext(
      [makeStore()],
      BUILTIN_PARTICLES,
      BUILTIN_MATERIALS,
    );

    const covered = ctx.particlesByProgram.get("ext:test:prog1");
    expect(covered?.has(1)).toBe(true); // proton builtin id = 1
  });

  it("populates materialsByProgram with merged builtin ID", () => {
    const ctx = buildExternalCompatibilityContext(
      [makeStore()],
      BUILTIN_PARTICLES,
      BUILTIN_MATERIALS,
    );

    const covered = ctx.materialsByProgram.get("ext:test:prog1");
    expect(covered?.has(276)).toBe(true);
  });

  it("reverse index: externalProgramsByBuiltinParticle", () => {
    const ctx = buildExternalCompatibilityContext(
      [makeStore()],
      BUILTIN_PARTICLES,
      BUILTIN_MATERIALS,
    );

    const progs = ctx.externalProgramsByBuiltinParticle.get(1);
    expect(progs?.has("ext:test:prog1")).toBe(true);
  });

  it("reverse index: externalRefsForBuiltinParticle", () => {
    const ctx = buildExternalCompatibilityContext(
      [makeStore()],
      BUILTIN_PARTICLES,
      BUILTIN_MATERIALS,
    );

    const refs = ctx.externalRefsForBuiltinParticle.get(1);
    expect(refs).toContain("ext:test:p");
  });

  it("falls back to (Z, A) match when no PDG code", () => {
    const store = makeStore({
      particles: [
        { id: "he4", name: "Helium-4", symbol: "He", Z: 2, A: 4, atomicMass: 4.0, index: 0 },
      ],
    });
    const ctx = buildExternalCompatibilityContext([store], BUILTIN_PARTICLES, BUILTIN_MATERIALS);

    // Built-in helium has id=2, Z=2, A=4
    expect(ctx.mergedParticleMap.get("ext:test:he4")).toBe(2);
  });

  it("registers external-only particle when no match found", () => {
    const store = makeStore({
      particles: [
        {
          id: "mu",
          name: "Muon",
          symbol: "μ",
          Z: 0,
          A: 0,
          atomicMass: 0.11357,
          pdgCode: 13,
          index: 0,
        },
      ],
    });
    const ctx = buildExternalCompatibilityContext([store], BUILTIN_PARTICLES, BUILTIN_MATERIALS);

    expect(ctx.mergedParticleMap.has("ext:test:mu")).toBe(false);
    expect(ctx.externalOnlyParticles).toHaveLength(1);
    expect(ctx.externalOnlyParticles[0]!.id).toBe("ext:test:mu");
  });

  it("material falls back to atomic number match", () => {
    const store = makeStore({
      materials: [
        {
          id: "al",
          name: "Aluminium (alt)",
          atomicNumber: 13,
          index: 0,
          linearUnitsAvailable: false,
        },
      ],
    });
    const ctx = buildExternalCompatibilityContext([store], BUILTIN_PARTICLES, BUILTIN_MATERIALS);

    expect(ctx.mergedMaterialMap.get("ext:test:al")).toBe(13);
  });

  it("material falls back to case-insensitive name match", () => {
    const store = makeStore({
      materials: [{ id: "al-alt", name: "aluminum", index: 0, linearUnitsAvailable: false }],
    });
    const ctx = buildExternalCompatibilityContext([store], BUILTIN_PARTICLES, BUILTIN_MATERIALS);

    expect(ctx.mergedMaterialMap.get("ext:test:al-alt")).toBe(13);
  });

  it("material matches against built-in rawName when friendly name has parenthetical disambiguator", () => {
    // Real SRIM datasets export materials with bare names like "Water"; the
    // built-in libdedx friendly name is "Water (liquid)" but its rawName is
    // "WATER". Without rawName matching the SRIM "Water" entry would fall
    // through as external-only, which would empty out `availableExternalPrograms`
    // for built-in proton+water selections (PR #476 review feedback).
    const builtinWithRaw: MaterialEntity[] = [
      { id: 276, name: "Water (liquid)", rawName: "WATER", density: 1.0 } as MaterialEntity,
      { id: 277, name: "Water Vapor", rawName: "WATERVAPOR", density: 0.0008 } as MaterialEntity,
    ];
    const store = makeStore({
      materials: [
        { id: "water", name: "Water", index: 0, linearUnitsAvailable: true, density: 1.0 },
      ],
    });
    const ctx = buildExternalCompatibilityContext([store], BUILTIN_PARTICLES, builtinWithRaw);

    // Should merge to liquid water (276), not vapor (277)
    expect(ctx.mergedMaterialMap.get("ext:test:water")).toBe(276);
    expect(ctx.externalOnlyMaterials).toHaveLength(0);
  });

  it("material matches via parenthetical-suffix fallback when rawName missing", () => {
    // Defensive fallback: even without rawName plumbed (e.g. older mocks or
    // tests), a bare external name should still match a friendly built-in
    // whose only difference is a parenthetical disambiguator.
    const store = makeStore({
      materials: [
        { id: "water", name: "Water", index: 0, linearUnitsAvailable: true, density: 1.0 },
      ],
    });
    const builtin: MaterialEntity[] = [
      { id: 276, name: "Water (liquid)", density: 1.0 } as MaterialEntity,
    ];
    const ctx = buildExternalCompatibilityContext([store], BUILTIN_PARTICLES, builtin);

    expect(ctx.mergedMaterialMap.get("ext:test:water")).toBe(276);
  });

  it("stores source metadata", () => {
    const ctx = buildExternalCompatibilityContext(
      [makeStore()],
      BUILTIN_PARTICLES,
      BUILTIN_MATERIALS,
    );

    expect(ctx.sourceMetadata.has("test")).toBe(true);
  });

  it("handles empty sources", () => {
    const ctx = buildExternalCompatibilityContext([], BUILTIN_PARTICLES, BUILTIN_MATERIALS);

    expect(ctx.programs).toHaveLength(0);
    expect(ctx.externalOnlyParticles).toHaveLength(0);
  });
});

describe("EMPTY_EXTERNAL_CONTEXT", () => {
  it("has no programs", () => {
    expect(EMPTY_EXTERNAL_CONTEXT.programs).toHaveLength(0);
    expect(EMPTY_EXTERNAL_CONTEXT.externalOnlyParticles).toHaveLength(0);
  });
});

describe("getAvailableExternalPrograms", () => {
  const ctx = buildExternalCompatibilityContext(
    [makeStore()],
    BUILTIN_PARTICLES,
    BUILTIN_MATERIALS,
  );

  it("returns all programs when no filter", () => {
    expect(getAvailableExternalPrograms(ctx)).toHaveLength(1);
  });

  it("filters by matching particle id", () => {
    const result = getAvailableExternalPrograms(ctx, 1, null); // proton
    expect(result).toHaveLength(1);
  });

  it("returns empty for non-covered particle", () => {
    const result = getAvailableExternalPrograms(ctx, 6, null); // carbon — not in store
    expect(result).toHaveLength(0);
  });

  it("filters by matching material id", () => {
    const result = getAvailableExternalPrograms(ctx, null, 276); // water
    expect(result).toHaveLength(1);
  });

  it("returns empty for non-covered material", () => {
    const result = getAvailableExternalPrograms(ctx, null, 99999);
    expect(result).toHaveLength(0);
  });

  it("filters by both particle and material", () => {
    const result = getAvailableExternalPrograms(ctx, 1, 276);
    expect(result).toHaveLength(1);
  });
});
