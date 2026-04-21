import { describe, test, expect } from "vitest";
import { parseEnergyInput, convertEnergy } from "$lib/units/energy";

describe("parseEnergyInput", () => {
  test("parses valid positive numbers", () => {
    expect(parseEnergyInput("1.0\n2.5\n10.0")).toEqual([1.0, 2.5, 10.0]);
  });

  test("skips non-numeric lines", () => {
    expect(parseEnergyInput("1.0\ninvalid\n2.5")).toEqual([1.0, 2.5]);
  });

  test("skips zero", () => {
    expect(parseEnergyInput("0\n1.0\n0.0")).toEqual([1.0]);
  });

  test("skips negative values", () => {
    expect(parseEnergyInput("-1.0\n2.0\n-3.0")).toEqual([2.0]);
  });

  test("handles empty input", () => {
    expect(parseEnergyInput("")).toEqual([]);
  });

  test("handles whitespace-only lines", () => {
    expect(parseEnergyInput("1.0\n   \n2.0")).toEqual([1.0, 2.0]);
  });

  test("trims leading/trailing whitespace per line", () => {
    expect(parseEnergyInput("  1.0  \n  2.5  ")).toEqual([1.0, 2.5]);
  });

  test("parses scientific notation lowercase", () => {
    expect(parseEnergyInput("1e3")).toEqual([1000]);
  });

  test("parses scientific notation uppercase", () => {
    expect(parseEnergyInput("1.5E2")).toEqual([150]);
  });

  test("parses scientific notation with negative exponent", () => {
    expect(parseEnergyInput("1e-2")).toEqual([0.01]);
  });

  test("handles single value", () => {
    expect(parseEnergyInput("100")).toEqual([100]);
  });

  test("handles very large energies", () => {
    const result = parseEnergyInput("1e10");
    expect(result).toEqual([1e10]);
  });

  test("handles very small energies", () => {
    const result = parseEnergyInput("1e-10");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(1e-10);
  });

  test("mixed valid and invalid lines", () => {
    expect(parseEnergyInput("1.0\ninvalid\n2.5\n-1.0\n10.0")).toEqual([1.0, 2.5, 10.0]);
  });
});

describe("convertEnergy", () => {
  test("returns same value when units are identical — MeV", () => {
    expect(convertEnergy(100, "MeV", "MeV", 1, 1.007)).toBe(100);
  });

  test("returns same value when units are identical — MeV/nucl", () => {
    expect(convertEnergy(100, "MeV/nucl", "MeV/nucl", 4, 4.002)).toBe(100);
  });

  test("returns same value when units are identical — MeV/u", () => {
    expect(convertEnergy(100, "MeV/u", "MeV/u", 1, 1.007)).toBe(100);
  });

  test("MeV → MeV/nucl for proton (massNumber=1) is unchanged", () => {
    expect(convertEnergy(100, "MeV", "MeV/nucl", 1, 1.007)).toBeCloseTo(100);
  });

  test("MeV → MeV/nucl divides by massNumber for alpha (massNumber=4)", () => {
    expect(convertEnergy(400, "MeV", "MeV/nucl", 4, 4.002)).toBeCloseTo(100);
  });

  test("MeV/nucl → MeV multiplies by massNumber for alpha", () => {
    expect(convertEnergy(100, "MeV/nucl", "MeV", 4, 4.002)).toBeCloseTo(400);
  });

  test("MeV → MeV/u divides by atomicMass", () => {
    expect(convertEnergy(4.002, "MeV", "MeV/u", 4, 4.002)).toBeCloseTo(1.0);
  });

  test("MeV/u → MeV multiplies by atomicMass", () => {
    expect(convertEnergy(1.0, "MeV/u", "MeV", 1, 1.007)).toBeCloseTo(1.007);
  });

  test("MeV/nucl → MeV/u round-trip is lossless", () => {
    const original = 100;
    const toMevU = convertEnergy(original, "MeV/nucl", "MeV/u", 4, 4.002);
    const back = convertEnergy(toMevU, "MeV/u", "MeV/nucl", 4, 4.002);
    expect(back).toBeCloseTo(original);
  });

  test("MeV → MeV/nucl → MeV round-trip is lossless", () => {
    const original = 250;
    const converted = convertEnergy(original, "MeV", "MeV/nucl", 4, 4.002);
    const back = convertEnergy(converted, "MeV/nucl", "MeV", 4, 4.002);
    expect(back).toBeCloseTo(original);
  });

  test("returns input unchanged when massNumber is zero", () => {
    expect(convertEnergy(100, "MeV", "MeV/nucl", 0, 1.007)).toBe(100);
  });

  test("returns input unchanged when atomicMass is zero", () => {
    expect(convertEnergy(100, "MeV", "MeV/u", 1, 0)).toBe(100);
  });

  test("MeV → MeV/nucl ignores atomicMass when massNumber is valid", () => {
    expect(convertEnergy(400, "MeV", "MeV/nucl", 4, 0)).toBeCloseTo(100);
  });

  test("MeV/nucl → MeV ignores atomicMass when massNumber is valid", () => {
    expect(convertEnergy(100, "MeV/nucl", "MeV", 4, 0)).toBeCloseTo(400);
  });

  test("MeV → MeV/u ignores massNumber when atomicMass is valid", () => {
    expect(convertEnergy(4.002, "MeV", "MeV/u", 0, 4.002)).toBeCloseTo(1.0);
  });

  test("MeV/u → MeV ignores massNumber when atomicMass is valid", () => {
    expect(convertEnergy(1.0, "MeV/u", "MeV", 0, 1.007)).toBeCloseTo(1.007);
  });
});
