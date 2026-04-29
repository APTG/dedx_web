import { describe, test, expect } from "vitest";
import type { ParticleEntity, MaterialEntity, ProgramEntity } from "$lib/wasm/types";
import * as pdfModule from "$lib/export/pdf";

function makeMockParticle(options?: Partial<ParticleEntity>): ParticleEntity {
  return {
    id: 1,
    name: 'Proton',
    massNumber: 1,
    atomicMass: 1.007,
    symbol: 'p',
    aliases: ['proton'],
    ...options,
  };
}

function makeMockMaterial(options?: Partial<MaterialEntity>): MaterialEntity {
  return {
    id: 276,
    name: 'Water (liquid)',
    density: 0.997,
    isGasByDefault: false,
    ...options,
  };
}

function makeMockProgram(options?: Partial<ProgramEntity>): ProgramEntity {
  return {
    id: 2,
    name: 'PSTAR',
    version: '1.0',
    ...options,
  };
}

function makeMockProgram(options?: Partial<ProgramEntity>): ProgramEntity {
  return {
    id: 2,
    name: 'PSTAR',
    version: '1.0',
    ...options,
  };
}

// --- Tests ---

describe("buildPdfFilename", () => {
  test("produces filename with particle, material, program slugs", () => {
    const particle = makeMockParticle({ name: "Carbon-12" });
    const material = makeMockMaterial({ name: "Water (liquid)" });
    const program = makeMockProgram({ name: "PSTAR" });

    const filename = pdfModule.buildPdfFilename(particle, material, program);
    expect(filename).toBe("dedx_calculator_carbon-12_water_(liquid)_pstar.pdf");
  });

  test("falls back to 'unknown_*' when particle is null", () => {
    const filename = pdfModule.buildPdfFilename(null, makeMockMaterial(), makeMockProgram());
    expect(filename).toMatch(/unknown_particle/);
    expect(filename).toMatch(/\.pdf$/);
  });

  test("falls back to 'unknown_*' when material is null", () => {
    const filename = pdfModule.buildPdfFilename(makeMockParticle(), null, makeMockProgram());
    expect(filename).toMatch(/unknown_material/);
  });

  test("falls back to 'unknown_*' when program is null", () => {
    const filename = pdfModule.buildPdfFilename(makeMockParticle(), makeMockMaterial(), null);
    expect(filename).toMatch(/unknown_program/);
  });

  test("conspaces spaces to underscores", () => {
    const filename = pdfModule.buildPdfFilename(makeMockMaterial(), makeMockMaterial(), makeMockMaterial());
    expect(filename).not.toMatch(/ /);
    expect(filename).toMatch(/_/);
  });

  test("all lowercase", () => {
    const particle = makeMockParticle({ name: "Carbon-12" });
    const filename = pdfModule.buildPdfFilename(particle, makeMockMaterial(), makeMockProgram());
    expect(filename).toBe(filename.toLowerCase());
  });
});
