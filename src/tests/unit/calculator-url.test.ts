import { describe, it, expect } from "vitest";
import {
  encodeCalculatorUrl,
  decodeCalculatorUrl,
  CALCULATOR_URL_VERSION,
} from "$lib/utils/calculator-url";
import type { CalculatorUrlState } from "$lib/utils/calculator-url";

const defaultState: CalculatorUrlState = {
  particleId: 1,
  materialId: 276,
  programId: null,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
};

describe("encodeCalculatorUrl", () => {
  it("encodes urlv, particle, material, program=auto, energies, eunit", () => {
    const p = encodeCalculatorUrl(defaultState);
    expect(p.get("urlv")).toBe(String(CALCULATOR_URL_VERSION));
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

  it("re-parses inline-unit rawInput so '500 keV' becomes '500:keV' (no %20 in URL)", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        // Row whose unit lives inside rawInput rather than the suffix flag
        { rawInput: "500 keV", unit: "MeV", unitFromSuffix: false },
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

  it("drops invalid/unparseable rows so commas in rawInput cannot corrupt tokenization", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        // `1,000` would otherwise inject an extra comma into the energies list.
        { rawInput: "1,000", unit: "MeV", unitFromSuffix: false },
        { rawInput: "200", unit: "MeV", unitFromSuffix: false },
      ],
    });
    expect(p.get("energies")).toBe("100,200");
  });

  it("does not emit explicit :unit when row's parsed unit equals masterUnit", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      masterUnit: "MeV",
      rows: [{ rawInput: "100 MeV", unit: "MeV", unitFromSuffix: true }],
    });
    expect(p.get("energies")).toBe("100");
  });
});

describe("calculatorUrlQueryString", () => {
  it("emits ':' literally (not %3A) so URLs stay human-readable", async () => {
    const { calculatorUrlQueryString } = await import("$lib/utils/calculator-url");
    const qs = calculatorUrlQueryString({
      ...defaultState,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "500", unit: "keV", unitFromSuffix: true },
      ],
    });
    expect(qs).toContain("500:keV");
    expect(qs).not.toContain("%3A");
    expect(qs).not.toContain("%2C");
  });
});

describe("decodeCalculatorUrl", () => {
  it("decodes basic params", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100,200&eunit=MeV",
    );
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

  it("ignores SI-prefixed eunit (master must be base unit only)", () => {
    // Per shareable-urls.md §4.1, eunit ∈ {MeV, MeV/nucl, MeV/u}.
    const params = new URLSearchParams("eunit=keV");
    const s = decodeCalculatorUrl(params);
    expect(s.masterUnit).toBe("MeV");
  });

  it("decodes explicit program ID", () => {
    const params = new URLSearchParams("program=4");
    const s = decodeCalculatorUrl(params);
    expect(s.programId).toBe(4);
  });

  it("rejects unknown :unit suffix and treats whole token as plain rawInput", () => {
    const params = new URLSearchParams("energies=100:bebok");
    const s = decodeCalculatorUrl(params);
    expect(s.rows[0]).toEqual({
      rawInput: "100:bebok",
      unit: "MeV",
      unitFromSuffix: false,
    });
  });

  it("decodes advanced mode params: mode=advanced&programs=9,2&qfocus=stp", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C2&qfocus=stp",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).isAdvancedMode).toBe(true);
    expect((s as any).selectedProgramIds).toEqual([9, 2]);
    expect((s as any).quantityFocus).toBe("stp");
  });

  it("decodes advanced mode with hidden_programs parameter", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C2&hidden_programs=2&qfocus=both",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).isAdvancedMode).toBe(true);
    expect((s as any).hiddenProgramIds).toEqual([2]);
  });

  it("decodes advanced mode with invalid program IDs (no crash, IDs parsed as integers)", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C999&qfocus=both",
    );
    const s = decodeCalculatorUrl(params);
    // Decoder parses all positive integers; validation against available programs happens at state level
    // Invalid ID 999 is parsed but will be filtered out when restoring multi-program state
    expect((s as any).selectedProgramIds).toEqual([9, 999]);
  });

  it("encodes advanced mode with mode=advanced&programs=9%2C2&qfocus=both", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9, 2],
      hiddenProgramIds: [],
      quantityFocus: "both",
    } as any);
    expect(p.get("mode")).toBe("advanced");
    expect(p.get("programs")).toBe("9,2");
    expect(p.get("qfocus")).toBe("both");
  });

  it("encodes advanced mode with hidden_programs", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9, 2],
      hiddenProgramIds: [2],
      quantityFocus: "stp",
    } as any);
    expect(p.get("mode")).toBe("advanced");
    expect(p.get("programs")).toBe("9,2");
    expect(p.get("hidden_programs")).toBe("2");
    expect(p.get("qfocus")).toBe("stp");
  });

  it("basic mode does NOT contain mode= or programs= params", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: false,
    } as any);
    expect(p.has("mode")).toBe(false);
    expect(p.has("programs")).toBe(false);
    expect(p.has("hidden_programs")).toBe(false);
    expect(p.has("qfocus")).toBe(false);
  });

  it("URL round-trip: encode(decode(url)) === url for advanced mode", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C2&qfocus=both",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    // Compare key params that should round-trip
    expect(reEncoded.get("mode")).toBe("advanced");
    expect(reEncoded.get("programs")).toBe("9,2");
    expect(reEncoded.get("qfocus")).toBe("both");
    expect(reEncoded.get("particle")).toBe("1");
    expect(reEncoded.get("material")).toBe("276");
    expect(reEncoded.get("eunit")).toBe("MeV");
  });

  it("URL round-trip with hidden_programs: encode(decode(url)) preserves hidden", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C2&hidden_programs=2&qfocus=stp",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("mode")).toBe("advanced");
    expect(reEncoded.get("programs")).toBe("9,2");
    expect(reEncoded.get("hidden_programs")).toBe("2");
    expect(reEncoded.get("qfocus")).toBe("stp");
  });
});
