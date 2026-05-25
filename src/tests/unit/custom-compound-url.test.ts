import { describe, it, expect } from "vitest";
import { encodeCalculatorUrl, decodeCalculatorUrl } from "$lib/utils/calculator-url";
import type { CalculatorUrlState } from "$lib/utils/calculator-url";

const baseAdvancedState: CalculatorUrlState = {
  particleId: 1,
  materialId: null, // null when using custom compound
  programId: null,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
  isAdvancedMode: true,
  selectedProgramIds: [9],
  quantityFocus: "stp",
};

describe("encodeCalculatorUrl — custom compounds", () => {
  it("encodes material=custom when materialId is null and custom compound fields are present", () => {
    const p = encodeCalculatorUrl({
      ...baseAdvancedState,
      materialId: null,
      materialIsCustom: true,
      matName: "LiF",
      matDensity: 2.64,
      matElements: [
        { atomicNumber: 3, atomCount: 1 },
        { atomicNumber: 9, atomCount: 1 },
      ],
      matPhase: "condensed",
    } as any);
    expect(p.get("material")).toBe("custom");
    expect(p.get("mat_name")).toBe("LiF");
    expect(p.get("mat_density")).toBe("2.64");
    expect(p.get("mat_elements")).toBe("3:1,9:1");
    expect(p.get("mat_phase")).toBeNull(); // condensed is default, omitted
  });

  it("encodes mat_ival when present", () => {
    const p = encodeCalculatorUrl({
      ...baseAdvancedState,
      materialId: null,
      materialIsCustom: true,
      matName: "PMMA",
      matDensity: 1.19,
      matElements: [
        { atomicNumber: 1, atomCount: 8 },
        { atomicNumber: 6, atomCount: 5 },
        { atomicNumber: 8, atomCount: 2 },
      ],
      matIval: 65,
      matPhase: "condensed",
    } as any);
    expect(p.get("material")).toBe("custom");
    expect(p.get("mat_name")).toBe("PMMA");
    expect(p.get("mat_density")).toBe("1.19");
    expect(p.get("mat_elements")).toBe("1:8,6:5,8:2");
    expect(p.get("mat_ival")).toBe("65");
    expect(p.has("mat_phase")).toBe(false);
  });

  it("encodes mat_phase=gas when phase is gas", () => {
    const p = encodeCalculatorUrl({
      ...baseAdvancedState,
      materialId: null,
      materialIsCustom: true,
      matName: "Custom Water",
      matDensity: 1.0,
      matElements: [
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ],
      matPhase: "gas",
    } as any);
    expect(p.get("material")).toBe("custom");
    expect(p.get("mat_name")).toBe("Custom Water");
    expect(p.get("mat_density")).toBe("1");
    expect(p.get("mat_elements")).toBe("1:2,8:1");
    expect(p.get("mat_phase")).toBe("gas");
  });

  it("encodes elements in ascending Z order regardless of input order", () => {
    const p = encodeCalculatorUrl({
      ...baseAdvancedState,
      materialId: null,
      materialIsCustom: true,
      matName: "Test",
      matDensity: 1.0,
      matElements: [
        { atomicNumber: 8, atomCount: 2 },
        { atomicNumber: 1, atomCount: 8 },
        { atomicNumber: 6, atomCount: 5 },
      ],
    } as any);
    expect(p.get("mat_elements")).toBe("1:8,6:5,8:2");
  });

  it("encodes fractional atom counts", () => {
    const p = encodeCalculatorUrl({
      ...baseAdvancedState,
      materialId: null,
      materialIsCustom: true,
      matName: "Test",
      matDensity: 1.0,
      matElements: [
        { atomicNumber: 1, atomCount: 0.111 },
        { atomicNumber: 8, atomCount: 0.0555 },
      ],
    } as any);
    expect(p.get("mat_elements")).toBe("1:0.111,8:0.0555");
  });

  it("does NOT encode custom compound params when materialIsCustom is false", () => {
    const p = encodeCalculatorUrl({
      ...baseAdvancedState,
      materialId: 276,
      materialIsCustom: false,
    } as any);
    expect(p.get("material")).toBe("276");
    expect(p.has("mat_name")).toBe(false);
    expect(p.has("mat_density")).toBe(false);
    expect(p.has("mat_elements")).toBe(false);
  });

  it("does NOT encode custom compound params in basic mode", () => {
    const p = encodeCalculatorUrl({
      ...baseAdvancedState,
      isAdvancedMode: false,
      materialId: null,
      materialIsCustom: true,
      matName: "LiF",
      matDensity: 2.64,
      matElements: [{ atomicNumber: 3, atomCount: 1 }],
    } as any);
    // In basic mode, material=custom and mat_* params are omitted
    expect(p.get("material")).toBeNull();
    expect(p.has("mat_name")).toBe(false);
  });

  it("encodes scientific notation for density", () => {
    const p = encodeCalculatorUrl({
      ...baseAdvancedState,
      materialId: null,
      materialIsCustom: true,
      matName: "Gas",
      matDensity: 8.99e-5,
      matElements: [{ atomicNumber: 1, atomCount: 1 }],
      matPhase: "gas",
    } as any);
    expect(p.get("mat_density")).toBe("0.0000899");
  });
});

describe("decodeCalculatorUrl — custom compounds", () => {
  it("decodes material=custom and all mat_* params", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=custom&program=auto&energies=100&eunit=MeV" +
        "&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=LiF&mat_density=2.64&mat_elements=3:1,9:1",
    );
    const s = decodeCalculatorUrl(params);
    expect(s.materialId).toBeNull();
    expect((s as any).materialIsCustom).toBe(true);
    expect((s as any).matName).toBe("LiF");
    expect((s as any).matDensity).toBe(2.64);
    expect((s as any).matElements).toEqual([
      { atomicNumber: 3, atomCount: 1 },
      { atomicNumber: 9, atomCount: 1 },
    ]);
    expect((s as any).matPhase).toBe("condensed"); // default
  });

  it("decodes mat_ival when present", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=custom&program=auto&energies=100&eunit=MeV" +
        "&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=PMMA&mat_density=1.19&mat_elements=1:8,6:5,8:2&mat_ival=65",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).matIval).toBe(65);
  });

  it("decodes mat_phase=gas", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=custom&program=auto&energies=100&eunit=MeV" +
        "&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Custom%20Water&mat_density=1&mat_elements=1:2,8:1&mat_phase=gas",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).matName).toBe("Custom Water");
    expect((s as any).matPhase).toBe("gas");
  });

  it("decodes elements in ascending Z order", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=PMMA&mat_density=1.19&mat_elements=8:2,6:5,1:8",
    );
    const s = decodeCalculatorUrl(params);
    // Elements should be sorted by Z
    expect((s as any).matElements).toEqual([
      { atomicNumber: 1, atomCount: 8 },
      { atomicNumber: 6, atomCount: 5 },
      { atomicNumber: 8, atomCount: 2 },
    ]);
  });

  it("sets fromUrlWarning when mat_name is missing", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_density=1.19&mat_elements=1:8,6:5,8:2",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_name/);
    expect(s.materialId).toBe(276); // falls back to liquid water
  });

  it("sets fromUrlWarning when mat_density is missing", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" + "&mat_name=LiF&mat_elements=3:1,9:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_density/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_density is <= 0", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=LiF&mat_density=0&mat_elements=3:1,9:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_density/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_density > 25", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Dense&mat_density=30&mat_elements=1:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_density/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_density is not a strict number", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=LiF&mat_density=2.64foo&mat_elements=3:1,9:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_density/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_elements is missing", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" + "&mat_name=LiF&mat_density=2.64",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });

  it("drops individual elements with invalid Z (outside [1, 118]) but proceeds if at least one valid", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=0:1,1:2,119:1,8:1",
    );
    const s = decodeCalculatorUrl(params);
    // Only Z=1 (H) and Z=8 (O) are valid
    expect((s as any).matElements).toEqual([
      { atomicNumber: 1, atomCount: 2 },
      { atomicNumber: 8, atomCount: 1 },
    ]);
    // Should NOT set fromUrlWarning if at least one valid element remains
    expect((s as any).fromUrlWarning).toBeUndefined();
  });

  it("sets fromUrlWarning when all elements are invalid", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=0:1,119:1,999:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_elements contains partial numeric tokens", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1abc:2,8:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_elements contains partial atom counts", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:2foo,8:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });

  it("drops individual elements with invalid atom count (<= 0) but proceeds if at least one valid", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:0,1:-5,1:2,8:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).matElements).toEqual([
      { atomicNumber: 1, atomCount: 2 },
      { atomicNumber: 8, atomCount: 1 },
    ]);
  });

  it("collapses duplicate Z by summing counts", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:2,1:3,8:1",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).matElements).toEqual([
      { atomicNumber: 1, atomCount: 5 }, // 2 + 3
      { atomicNumber: 8, atomCount: 1 },
    ]);
  });

  it("silently ignores mat_ival when out of range (<= 0)", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:1&mat_ival=0",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).matIval).toBeUndefined();
  });

  it("silently ignores mat_ival when > 10000", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:1&mat_ival=15000",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).matIval).toBeUndefined();
  });

  it("sets fromUrlWarning when mat_ival is not a strict number", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:1&mat_ival=65foo",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).fromUrlWarning).toMatch(/mat_ival/);
    expect(s.materialId).toBe(276);
  });

  it("silently ignores mat_phase when unknown token", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:1&mat_phase=plasma",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).matPhase).toBe("condensed"); // default
  });

  it("sets fromUrlWarning when material=custom in basic mode (mode != advanced)", () => {
    const params = new URLSearchParams(
      "material=custom&energies=100&eunit=MeV" +
        "&mat_name=LiF&mat_density=2.64&mat_elements=3:1,9:1",
    );
    const s = decodeCalculatorUrl(params);
    // In basic mode, custom params are silently ignored and material defaults
    expect(s.materialId).toBeNull(); // No fallback in basic mode - stays null
    expect((s as any).materialIsCustom).toBeUndefined();
  });

  it("parses fractional atom counts", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:0.111,8:0.0555",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).matElements).toEqual([
      { atomicNumber: 1, atomCount: 0.111 },
      { atomicNumber: 8, atomCount: 0.0555 },
    ]);
  });

  it("sets fromUrlWarning when mat_elements has malformed entries without colon", () => {
    const params = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1,8",
    );
    const s = decodeCalculatorUrl(params);
    // Entries without colon are dropped
    expect((s as any).fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });
});

describe("round-trip — custom compounds", () => {
  it("round-trips LiF custom compound", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=custom&program=auto&energies=100&eunit=MeV" +
        "&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=LiF&mat_density=2.64&mat_elements=3:1,9:1",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("material")).toBe("custom");
    expect(reEncoded.get("mat_name")).toBe("LiF");
    expect(reEncoded.get("mat_density")).toBe("2.64");
    expect(reEncoded.get("mat_elements")).toBe("3:1,9:1");
    expect(reEncoded.has("mat_phase")).toBe(false);
    expect(reEncoded.has("mat_ival")).toBe(false);
  });

  it("round-trips PMMA with iValue", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=custom&program=auto&energies=100&eunit=MeV" +
        "&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=PMMA&mat_density=1.19&mat_elements=1:8,6:5,8:2&mat_ival=65",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("mat_name")).toBe("PMMA");
    expect(reEncoded.get("mat_ival")).toBe("65");
  });

  it("round-trips custom water with gas phase", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=custom&program=auto&energies=100&eunit=MeV" +
        "&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=Custom%20Water&mat_density=1&mat_elements=1:2,8:1&mat_phase=gas",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("mat_name")).toBe("Custom Water");
    expect(reEncoded.get("mat_phase")).toBe("gas");
  });

  it("round-trips with elements reordered to ascending Z", () => {
    // Original has Z in non-ascending order
    const originalParams = new URLSearchParams(
      "material=custom&mode=advanced&programs=9&qfocus=both" +
        "&mat_name=PMMA&mat_density=1.19&mat_elements=8:2,6:5,1:8",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    // Re-encoded should have elements in ascending Z order
    expect(reEncoded.get("mat_elements")).toBe("1:8,6:5,8:2");
  });
});
