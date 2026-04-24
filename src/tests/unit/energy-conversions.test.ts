import { describe, test, expect } from "vitest";
import { convertEnergyToMeVperU, convertEnergyFromMeVperU } from "$lib/utils/energy-conversions";

describe("convertEnergyToMeVperU", () => {
  test("MeV/u to MeV/u is unchanged", () => {
    expect(convertEnergyToMeVperU(1, "MeV/u", 1)).toBe(1);
  });

  test("MeV to MeV/u for proton (A=1)", () => {
    expect(convertEnergyToMeVperU(1, "MeV", 1)).toBe(1);
  });

  test("MeV to MeV/u for carbon (A=12)", () => {
    expect(convertEnergyToMeVperU(1, "MeV", 12)).toBeCloseTo(1 / 12, 6);
  });

  test("MeV to MeV/u for carbon (A=12) - 100 MeV", () => {
    expect(convertEnergyToMeVperU(100, "MeV", 12)).toBeCloseTo(100 / 12, 6);
  });

  test("keV to MeV/u for proton (A=1)", () => {
    expect(convertEnergyToMeVperU(1, "keV", 1)).toBe(0.001);
  });

  test("GeV to MeV/u for proton (A=1)", () => {
    expect(convertEnergyToMeVperU(1, "GeV", 1)).toBe(1000);
  });

  test("MeV/nucl to MeV/u is unchanged (MeV/nucl ≡ MeV/u)", () => {
    expect(convertEnergyToMeVperU(1, "MeV/nucl", 1)).toBe(1);
  });

  test("eV to MeV/u", () => {
    expect(convertEnergyToMeVperU(1000000, "eV", 1)).toBe(1);
  });

  test("GeV/nucl to MeV/u", () => {
    expect(convertEnergyToMeVperU(1, "GeV/nucl", 12)).toBeCloseTo(1000, 6);
  });

  test("keV/nucl to MeV/u", () => {
    expect(convertEnergyToMeVperU(1000, "keV/nucl", 1)).toBeCloseTo(1, 6);
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

  test("round-trip: MeV → MeV/u → MeV for carbon", () => {
    const original = 120;
    const massNumber = 12;
    const toMeVperU = convertEnergyToMeVperU(original, "MeV", massNumber);
    const back = convertEnergyFromMeVperU(toMeVperU, "MeV", massNumber);
    expect(back).toBeCloseTo(original, 6);
  });

  test("round-trip: keV → MeV/u → keV for helium", () => {
    const original = 500;
    const massNumber = 4;
    const toMeVperU = convertEnergyToMeVperU(original, "keV", massNumber);
    const back = convertEnergyFromMeVperU(toMeVperU, "keV", massNumber);
    expect(back).toBeCloseTo(original, 6);
  });
});
