import { describe, it, expect } from "vitest";
import {
  parseRowEnergy,
  convertRowTextForNewParticle,
  convertRowTextToUnit,
  type ParticleMass,
} from "$lib/utils/energy-row-parse";

// Mass data mirrors the WASM mock fixtures (src/lib/wasm/__mocks__/libdedx.ts).
const proton: ParticleMass = { id: 1, massNumber: 1, atomicMass: 1.007 };
const helium: ParticleMass = { id: 2, massNumber: 4, atomicMass: 4.002 };
const carbon: ParticleMass = { id: 6, massNumber: 12, atomicMass: 12.011 };
const electron: ParticleMass = { id: 1001, massNumber: 0, atomicMass: 0.000548 };

describe("parseRowEnergy", () => {
  it("returns empty status for blank input, carrying the master unit", () => {
    const out = parseRowEnergy("", "MeV/nucl", proton.massNumber, proton.atomicMass);
    expect(out.status).toBe("empty");
    expect(out.unit).toBe("MeV/nucl");
    expect(out.normalizedMevNucl).toBeNull();
  });

  it("returns empty status for whitespace-only input", () => {
    expect(parseRowEnergy("   ", "MeV", 1, 1.007).status).toBe("empty");
  });

  it("flags unparseable input as invalid with the parser message", () => {
    const out = parseRowEnergy("abc", "MeV", 1, 1.007);
    expect(out.status).toBe("invalid");
    if (out.status === "invalid") {
      expect(out.message).toBe("invalid number");
    }
    expect(out.unitFromSuffix).toBe(false);
  });

  it("flags an unknown unit suffix as invalid", () => {
    const out = parseRowEnergy("100 Joules", "MeV", 1, 1.007);
    expect(out.status).toBe("invalid");
  });

  it("flags non-positive (out-of-range) energy as invalid", () => {
    const out = parseRowEnergy("0", "MeV", 1, 1.007);
    expect(out.status).toBe("invalid");
    if (out.status === "invalid") {
      expect(out.message).toBe("must be positive");
    }
  });

  it("interprets a plain number under the master unit (proton, MeV)", () => {
    const out = parseRowEnergy("100", "MeV", proton.massNumber, proton.atomicMass);
    expect(out.status).toBe("valid");
    if (out.status === "valid") {
      expect(out.unit).toBe("MeV");
      expect(out.unitFromSuffix).toBe(false);
      expect(out.normalizedMevNucl).toBeCloseTo(100, 6);
    }
  });

  it("interprets a plain number under a MeV/nucl master unit (carbon)", () => {
    const out = parseRowEnergy("10", "MeV/nucl", carbon.massNumber, carbon.atomicMass);
    expect(out.status).toBe("valid");
    if (out.status === "valid") {
      expect(out.unit).toBe("MeV/nucl");
      expect(out.normalizedMevNucl).toBeCloseTo(10, 6);
    }
  });

  it('normalizes "12 MeV/u" for a proton to ≈12.1 MeV/nucl', () => {
    const out = parseRowEnergy("12 MeV/u", "MeV", proton.massNumber, proton.atomicMass);
    expect(out.status).toBe("valid");
    if (out.status === "valid") {
      expect(out.unit).toBe("MeV/u");
      expect(out.unitFromSuffix).toBe(true);
      expect(out.normalizedMevNucl).toBeCloseTo(12.1, 1);
    }
  });

  it('normalizes "12 MeV/nucl" for a proton to exactly 12', () => {
    const out = parseRowEnergy("12 MeV/nucl", "MeV", proton.massNumber, proton.atomicMass);
    expect(out.status).toBe("valid");
    if (out.status === "valid") {
      expect(out.normalizedMevNucl).toBeCloseTo(12, 6);
    }
  });

  it("collapses an SI-prefixed suffix to its base display category", () => {
    // "1 GeV" → 1000 MeV total → 1000 MeV/nucl for a proton; display unit "MeV".
    const out = parseRowEnergy("1 GeV", "MeV", proton.massNumber, proton.atomicMass);
    expect(out.status).toBe("valid");
    if (out.status === "valid") {
      expect(out.unit).toBe("MeV");
      expect(out.unitFromSuffix).toBe(true);
      expect(out.normalizedMevNucl).toBeCloseTo(1000, 6);
    }
  });

  it('normalizes "100 MeV/u" for carbon (A=12) using atomic mass', () => {
    const out = parseRowEnergy("100 MeV/u", "MeV", carbon.massNumber, carbon.atomicMass);
    expect(out.status).toBe("valid");
    if (out.status === "valid") {
      // (100 * 12.011) / 12 ≈ 100.09 MeV/nucl
      expect(out.normalizedMevNucl).toBeCloseTo(100.09, 1);
    }
  });
});

describe("convertRowTextForNewParticle", () => {
  it("returns null for blank rows (leave untouched)", () => {
    expect(convertRowTextForNewParticle("", "MeV", helium, proton)).toBeNull();
    expect(convertRowTextForNewParticle("   ", "MeV", helium, proton)).toBeNull();
  });

  it("returns null for unparseable rows", () => {
    expect(convertRowTextForNewParticle("abc", "MeV", helium, proton)).toBeNull();
  });

  it('He "20 MeV/nucl" → proton conserves E_nucl as "20 MeV"', () => {
    expect(convertRowTextForNewParticle("20 MeV/nucl", "MeV", helium, proton)).toBe("20 MeV");
  });

  it('He "80 MeV" → proton becomes "20 MeV"', () => {
    expect(convertRowTextForNewParticle("80 MeV", "MeV", helium, proton)).toBe("20 MeV");
  });

  it('Carbon "120 MeV" → proton becomes "10 MeV"', () => {
    expect(convertRowTextForNewParticle("120 MeV", "MeV", carbon, proton)).toBe("10 MeV");
  });

  it('Carbon "10 MeV/nucl" → He preserves the per-nucleon unit "10 MeV/nucl"', () => {
    expect(convertRowTextForNewParticle("10 MeV/nucl", "MeV", carbon, helium)).toBe("10 MeV/nucl");
  });

  it('He "20 MeV/nucl" → electron uses total MeV: "80 MeV"', () => {
    expect(convertRowTextForNewParticle("20 MeV/nucl", "MeV", helium, electron)).toBe("80 MeV");
  });

  it('plain "100" (master MeV, proton) → carbon conserves E_nucl as "1200 MeV"', () => {
    expect(convertRowTextForNewParticle("100", "MeV", proton, carbon)).toBe("1200 MeV");
  });

  it('preserves MeV/u for heavy-ion → heavy-ion switches (Carbon "10 MeV/u" → He)', () => {
    const result = convertRowTextForNewParticle("10 MeV/u", "MeV", carbon, helium);
    expect(result).not.toBeNull();
    expect(result!.endsWith(" MeV/u")).toBe(true);
    expect(parseFloat(result!)).toBeCloseTo(10, 1);
  });
});

describe("convertRowTextToUnit", () => {
  it("returns null for blank or unparseable rows", () => {
    expect(
      convertRowTextToUnit("", "MeV", "MeV/nucl", carbon.massNumber, carbon.atomicMass),
    ).toBeNull();
    expect(
      convertRowTextToUnit("abc", "MeV", "MeV/nucl", carbon.massNumber, carbon.atomicMass),
    ).toBeNull();
  });

  it('Carbon "12 MeV" → MeV/nucl becomes "1 MeV/nucl"', () => {
    expect(
      convertRowTextToUnit("12 MeV", "MeV", "MeV/nucl", carbon.massNumber, carbon.atomicMass),
    ).toBe("1 MeV/nucl");
  });

  it('Carbon "1 MeV/nucl" → MeV becomes "12 MeV"', () => {
    expect(
      convertRowTextToUnit("1 MeV/nucl", "MeV", "MeV", carbon.massNumber, carbon.atomicMass),
    ).toBe("12 MeV");
  });

  it('Helium "80 MeV" → MeV/nucl becomes "20 MeV/nucl"', () => {
    expect(
      convertRowTextToUnit("80 MeV", "MeV", "MeV/nucl", helium.massNumber, helium.atomicMass),
    ).toBe("20 MeV/nucl");
  });

  it('Proton "100 MeV" → MeV/nucl becomes "100 MeV/nucl"', () => {
    expect(
      convertRowTextToUnit("100 MeV", "MeV", "MeV/nucl", proton.massNumber, proton.atomicMass),
    ).toBe("100 MeV/nucl");
  });

  it("interprets a plain number under the master unit before converting", () => {
    // Carbon master MeV/nucl: "10" means 10 MeV/nucl → 120 MeV total.
    expect(
      convertRowTextToUnit("10", "MeV/nucl", "MeV", carbon.massNumber, carbon.atomicMass),
    ).toBe("120 MeV");
  });
});
