import { describe, test, expect } from "vitest";
import {
  autoScaleEnergy,
  formatEnergyWithUnit,
  columnHeaderUnit,
} from "$lib/utils/energy-autoscale";

describe("autoScaleEnergy", () => {
  test("scales 0.001 MeV to keV", () => {
    const result = autoScaleEnergy(0.001);
    expect(result).toEqual({ scaled: 1, prefix: "keV" });
  });

  test("scales 0.0005 MeV to eV", () => {
    const result = autoScaleEnergy(0.0005);
    expect(result).toEqual({ scaled: 500, prefix: "eV" });
  });

  test("scales 1.0 MeV to MeV", () => {
    const result = autoScaleEnergy(1.0);
    expect(result).toEqual({ scaled: 1, prefix: "MeV" });
  });

  test("scales 100.0 MeV to MeV", () => {
    const result = autoScaleEnergy(100.0);
    expect(result).toEqual({ scaled: 100, prefix: "MeV" });
  });

  test("scales 1200.0 MeV to GeV", () => {
    const result = autoScaleEnergy(1200.0);
    expect(result).toEqual({ scaled: 1.2, prefix: "GeV" });
  });

  test("scales 9999.0 MeV to GeV", () => {
    const result = autoScaleEnergy(9999.0);
    expect(result).toEqual({ scaled: 9.999, prefix: "GeV" });
  });

  test("scales 500 MeV to MeV", () => {
    const result = autoScaleEnergy(500);
    expect(result).toEqual({ scaled: 500, prefix: "MeV" });
  });

  test("scales 0.5 MeV to keV", () => {
    const result = autoScaleEnergy(0.5);
    expect(result).toEqual({ scaled: 500, prefix: "keV" });
  });

  test("scales 0.0015 MeV to keV", () => {
    const result = autoScaleEnergy(0.0015);
    expect(result).toEqual({ scaled: 1.5, prefix: "keV" });
  });

  test("scales 0.0001 MeV to eV", () => {
    const result = autoScaleEnergy(0.0001);
    expect(result).toEqual({ scaled: 100, prefix: "eV" });
  });

  test("scales 10000 MeV to GeV", () => {
    const result = autoScaleEnergy(10000);
    expect(result).toEqual({ scaled: 10, prefix: "GeV" });
  });

  test("handles boundary: exactly 1000 MeV → GeV", () => {
    const result = autoScaleEnergy(1000);
    expect(result).toEqual({ scaled: 1, prefix: "GeV" });
  });

  test("handles boundary: exactly 1 MeV → MeV", () => {
    const result = autoScaleEnergy(1);
    expect(result).toEqual({ scaled: 1, prefix: "MeV" });
  });

  test("handles boundary: exactly 0.001 MeV → keV", () => {
    const result = autoScaleEnergy(0.001);
    expect(result).toEqual({ scaled: 1, prefix: "keV" });
  });

  test("handles very small values: 1e-6 MeV → eV", () => {
    const result = autoScaleEnergy(1e-6);
    expect(result).toEqual({ scaled: 1, prefix: "eV" });
  });
});

describe("formatEnergyWithUnit", () => {
  test("formats 0.001 MeV with base unit 'MeV' → '1.000 keV'", () => {
    const result = formatEnergyWithUnit(0.001, "MeV");
    expect(result).toBe("1.000 keV");
  });

  test("formats 0.0005 MeV with base unit 'MeV' → '500.0 eV'", () => {
    const result = formatEnergyWithUnit(0.0005, "MeV");
    expect(result).toBe("500.0 eV");
  });

  test("formats 1.0 MeV with base unit 'MeV' → '1.000 MeV'", () => {
    const result = formatEnergyWithUnit(1.0, "MeV");
    expect(result).toBe("1.000 MeV");
  });

  test("formats 100.0 MeV with base unit 'MeV' → '100.0 MeV'", () => {
    const result = formatEnergyWithUnit(100.0, "MeV");
    expect(result).toBe("100.0 MeV");
  });

  test("formats 1200.0 MeV with base unit 'MeV' → '1.200 GeV'", () => {
    const result = formatEnergyWithUnit(1200.0, "MeV");
    expect(result).toBe("1.200 GeV");
  });

  test("formats 9999.0 MeV with base unit 'MeV' → '9.999 GeV'", () => {
    const result = formatEnergyWithUnit(9999.0, "MeV");
    expect(result).toBe("9.999 GeV");
  });

  test("formats with per-nucleon unit: 1200 MeV/nucl → '1.200 GeV/nucl'", () => {
    const result = formatEnergyWithUnit(1200, "MeV/nucl");
    expect(result).toBe("1.200 GeV/nucl");
  });

  test("formats with per-u unit: 0.001 MeV/u → '1.000 keV/u'", () => {
    const result = formatEnergyWithUnit(0.001, "MeV/u");
    expect(result).toBe("1.000 keV/u");
  });

  test("formats 500 MeV with base unit 'MeV' → '500.0 MeV'", () => {
    const result = formatEnergyWithUnit(500, "MeV");
    expect(result).toBe("500.0 MeV");
  });

  test("formats 0.5 MeV with base unit 'MeV' → '500.0 keV'", () => {
    const result = formatEnergyWithUnit(0.5, "MeV");
    expect(result).toBe("500.0 keV");
  });
});

describe("columnHeaderUnit", () => {
  test("returns common prefix unit when all rows share the same prefix", () => {
    const rows = [
      { energyMev: 100, autoResult: { scaled: 100, prefix: "MeV" } },
      { energyMev: 500, autoResult: { scaled: 500, prefix: "MeV" } },
      { energyMev: 1.5, autoResult: { scaled: 1.5, prefix: "MeV" } },
    ];
    const result = columnHeaderUnit(rows);
    expect(result).toBe("MeV");
  });

  test("returns '(auto)' when rows have mixed prefixes", () => {
    const rows = [
      { energyMev: 100, autoResult: { scaled: 100, prefix: "MeV" } },
      { energyMev: 0.001, autoResult: { scaled: 1, prefix: "keV" } },
      { energyMev: 1200, autoResult: { scaled: 1.2, prefix: "GeV" } },
    ];
    const result = columnHeaderUnit(rows);
    expect(result).toBe("(auto)");
  });

  test("returns '(auto)' for empty rows array", () => {
    const rows: Array<{ energyMev: number; autoResult: { scaled: number; prefix: string } }> = [];
    const result = columnHeaderUnit(rows);
    expect(result).toBe("(auto)");
  });

  test("returns common unit for single row", () => {
    const rows = [{ energyMev: 0.0005, autoResult: { scaled: 500, prefix: "eV" } }];
    const result = columnHeaderUnit(rows);
    expect(result).toBe("eV");
  });
});
