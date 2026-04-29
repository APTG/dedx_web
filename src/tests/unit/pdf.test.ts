import { describe, test, expect } from "vitest";
import * as pdfModule from "$lib/export/pdf";
import type { PdfEntity } from "$lib/export/pdf";

function makeMockParticle(options?: Partial<PdfEntity>): PdfEntity {
  return { name: "Proton", ...options };
}

function makeMockMaterial(options?: Partial<PdfEntity>): PdfEntity {
  return { name: "Water (liquid)", ...options };
}

function makeMockProgram(options?: Partial<PdfEntity>): PdfEntity {
  return { name: "PSTAR", ...options };
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

  test("collapses spaces to underscores", () => {
    const filename = pdfModule.buildPdfFilename(
      makeMockParticle({ name: "Some Particle" }),
      makeMockMaterial({ name: "Heavy Water" }),
      makeMockProgram({ name: "ICRU 90" }),
    );
    expect(filename).not.toMatch(/ /);
    expect(filename).toMatch(/_/);
  });

  test("all lowercase", () => {
    const particle = makeMockParticle({ name: "Carbon-12" });
    const filename = pdfModule.buildPdfFilename(particle, makeMockMaterial(), makeMockProgram());
    expect(filename).toBe(filename.toLowerCase());
  });
});
