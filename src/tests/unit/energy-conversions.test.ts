import { describe, test, expect } from "vitest";
import { convertEnergyToMeVperNucl, convertEnergyFromMeVperU } from "$lib/utils/energy-conversions";

describe("convertEnergyToMeVperNucl", () => {
  test("MeV/nucl to MeV/nucl is unchanged", () => {
    expect(convertEnergyToMeVperNucl(1, "MeV/nucl", 1)).toBe(1);
  });

  test("MeV to MeV/nucl for proton (A=1)", () => {
    expect(convertEnergyToMeVperNucl(1, "MeV", 1)).toBe(1);
  });

  test("MeV to MeV/nucl for carbon (A=12)", () => {
    expect(convertEnergyToMeVperNucl(1, "MeV", 12)).toBeCloseTo(1 / 12, 6);
  });

  test("MeV to MeV/nucl for carbon (A=12) - 100 MeV", () => {
    expect(convertEnergyToMeVperNucl(100, "MeV", 12)).toBeCloseTo(100 / 12, 6);
  });

  test("keV to MeV/nucl for proton (A=1)", () => {
    expect(convertEnergyToMeVperNucl(1, "keV", 1)).toBe(0.001);
  });

  test("GeV to MeV/nucl for proton (A=1)", () => {
    expect(convertEnergyToMeVperNucl(1, "GeV", 1)).toBe(1000);
  });

  test("MeV/u to MeV/nucl for carbon (A=12)", () => {
    const m_u = 12.0; // atomic mass ≈ mass number
    expect(convertEnergyToMeVperNucl(1, "MeV/u", 12, m_u)).toBeCloseTo(1, 6);
  });

  test("MeV/u to MeV/nucl with different atomic mass", () => {
    const m_u = 12.096; // carbon-12 atomic mass units
    expect(convertEnergyToMeVperNucl(1, "MeV/u", 12, m_u)).toBeCloseTo((1 * m_u) / 12, 6);
  });

  test("eV to MeV/nucl", () => {
    expect(convertEnergyToMeVperNucl(1000000, "eV", 1)).toBe(1);
  });

  test("GeV/nucl to MeV/nucl", () => {
    expect(convertEnergyToMeVperNucl(1, "GeV/nucl", 12)).toBeCloseTo(1000, 6);
  });

  test("keV/nucl to MeV/nucl", () => {
    expect(convertEnergyToMeVperNucl(1000, "keV/nucl", 1)).toBeCloseTo(1, 6);
  });
});

describe("convertEnergyFromMeVperU", () => {
  test("MeV/u to MeV/u is unchanged", () => {
    expect(convertEnergyFromMeVperU(1, "MeV/u", 1)).toBe(1);
  });

  test("MeV/u to MeV for proton (A=1)", () => {
    expect(convertEnergyFromMeVperU(1, "MeV", 1)).toBe(1);
  });

  test("MeV/u to MeV for carbon (A=12)", () => {
    expect(convertEnergyFromMeVperU(1, "MeV", 12)).toBeCloseTo(12, 6);
  });

  test("MeV/u to keV for proton (A=1)", () => {
    expect(convertEnergyFromMeVperU(1, "keV", 1)).toBe(1000);
  });

  test("MeV/u to GeV for proton (A=1)", () => {
    expect(convertEnergyFromMeVperU(1, "GeV", 1)).toBe(0.001);
  });

  test("MeV/u to MeV/nucl is unchanged", () => {
    expect(convertEnergyFromMeVperU(1, "MeV/nucl", 1)).toBe(1);
  });

  test("MeV/u to eV for proton (A=1)", () => {
    expect(convertEnergyFromMeVperU(1, "eV", 1)).toBe(1000000);
  });

  test("round-trip: MeV → MeV/nucl → MeV for carbon", () => {
    const original = 120;
    const massNumber = 12;
    const toMeVperNucl = convertEnergyToMeVperNucl(original, "MeV", massNumber);
    const back = convertEnergyFromMeVperU(toMeVperNucl, "MeV", massNumber);
    expect(back).toBeCloseTo(original, 6);
  });

  test("round-trip: keV → MeV/nucl → keV for helium", () => {
    const original = 500;
    const massNumber = 4;
    const toMeVperNucl = convertEnergyToMeVperNucl(original, "keV", massNumber);
    const back = convertEnergyFromMeVperU(toMeVperNucl, "keV", massNumber);
    expect(back).toBeCloseTo(original, 6);
  });
});
