import { describe, it, expect } from "vitest";
import { encodeCalculatorUrl, decodeCalculatorUrl } from "$lib/utils/calculator-url";
import type { CalculatorUrlState } from "$lib/utils/calculator-url";

const defaultState: CalculatorUrlState = {
  particleId: 1,
  materialId: 276,
  programId: null,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
};

describe("encodeCalculatorUrl", () => {
  it("encodes particle, material, program=auto, energies, eunit", () => {
    const p = encodeCalculatorUrl(defaultState);
    expect(p.get("particle")).toBe("1");
    expect(p.get("material")).toBe("276");
    expect(p.get("program")).toBe("auto");
    expect(p.get("energies")).toBe("100");
    expect(p.get("eunit")).toBe("MeV");
  });

  it("encodes explicit program ID", () => {
    const p = encodeCalculatorUrl({ ...defaultState, programId: 4 });
    expect(p.get("program")).toBe("4");
  });

  it("encodes multiple rows as comma-separated", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "200", unit: "MeV", unitFromSuffix: false },
      ],
    });
    expect(p.get("energies")).toBe("100,200");
  });

  it("encodes mixed-unit rows with :unit suffix for rows that differ from masterUnit", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      masterUnit: "MeV",
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "500", unit: "keV", unitFromSuffix: true },
      ],
    });
    expect(p.get("energies")).toBe("100,500:keV");
  });

  it("skips empty rows", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "", unit: "MeV", unitFromSuffix: false },
      ],
    });
    expect(p.get("energies")).toBe("100");
  });
});

describe("decodeCalculatorUrl", () => {
  it("decodes basic params", () => {
    const params = new URLSearchParams("particle=1&material=276&program=auto&energies=100,200&eunit=MeV");
    const s = decodeCalculatorUrl(params);
    expect(s.particleId).toBe(1);
    expect(s.materialId).toBe(276);
    expect(s.programId).toBeNull();
    expect(s.rows).toEqual([
      { rawInput: "100", unit: "MeV", unitFromSuffix: false },
      { rawInput: "200", unit: "MeV", unitFromSuffix: false },
    ]);
    expect(s.masterUnit).toBe("MeV");
  });

  it("decodes mixed-unit rows with :unit suffix", () => {
    const params = new URLSearchParams("energies=100,500:keV&eunit=MeV");
    const s = decodeCalculatorUrl(params);
    expect(s.rows[0]).toEqual({ rawInput: "100", unit: "MeV", unitFromSuffix: false });
    expect(s.rows[1]).toEqual({ rawInput: "500", unit: "keV", unitFromSuffix: true });
  });

  it("falls back to default single row on missing energies param", () => {
    const params = new URLSearchParams("particle=1&material=276");
    const s = decodeCalculatorUrl(params);
    expect(s.rows).toEqual([{ rawInput: "100", unit: "MeV", unitFromSuffix: false }]);
  });

  it("ignores invalid particle ID and returns null", () => {
    const params = new URLSearchParams("particle=INVALID");
    const s = decodeCalculatorUrl(params);
    expect(s.particleId).toBeNull();
  });

  it("ignores unrecognised eunit and defaults to MeV", () => {
    const params = new URLSearchParams("eunit=bebok");
    const s = decodeCalculatorUrl(params);
    expect(s.masterUnit).toBe("MeV");
  });

  it("decodes explicit program ID", () => {
    const params = new URLSearchParams("program=4");
    const s = decodeCalculatorUrl(params);
    expect(s.programId).toBe(4);
  });
});
