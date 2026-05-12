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

const baseState: CalculatorUrlState = {
  particleId: 1,
  materialId: 276,
  programId: null,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
  isAdvancedMode: true,
  selectedProgramIds: [9],
  quantityFocus: "both",
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

  it("encodes advanced options agg_state when it differs from materialIsGas", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { aggregateState: "gas" },
      materialIsGas: false, // material is condensed, but override to gas
    } as any);
    expect(p.get("agg_state")).toBe("gas");
  });

  it("does NOT encode agg_state when it matches materialIsGas (not an override)", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { aggregateState: "condensed" },
      materialIsGas: false, // matches
    } as any);
    expect(p.has("agg_state")).toBe(false);
  });

  it("encodes interp_scale=lin-lin when interpolation.scale is linear", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { interpolation: { scale: "linear", method: "linear" } },
      materialIsGas: false,
    } as any);
    expect(p.get("interp_scale")).toBe("lin-lin");
  });

  it("does NOT encode interp_scale when default (log)", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { interpolation: { scale: "log", method: "linear" } },
      materialIsGas: false,
    } as any);
    expect(p.has("interp_scale")).toBe(false);
  });

  it("encodes interp_method=spline when interpolation.method is cubic", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { interpolation: { scale: "log", method: "cubic" } },
      materialIsGas: false,
    } as any);
    expect(p.get("interp_method")).toBe("spline");
  });

  it("does NOT encode interp_method when default (linear)", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { interpolation: { scale: "log", method: "linear" } },
      materialIsGas: false,
    } as any);
    expect(p.has("interp_method")).toBe(false);
  });

  it("encodes mstar_mode when not default 'b'", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { mstarMode: "c" },
      materialIsGas: false,
    } as any);
    expect(p.get("mstar_mode")).toBe("c");
  });

  it("does NOT encode mstar_mode when default 'b'", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { mstarMode: "b" },
      materialIsGas: false,
    } as any);
    expect(p.has("mstar_mode")).toBe(false);
  });

  it("encodes density override", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { densityOverride: 1.5 },
      materialIsGas: false,
    } as any);
    expect(p.get("density")).toBe("1.5");
  });

  it("encodes i-value override", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      advancedOptions: { iValueOverride: 85.5 },
      materialIsGas: false,
    } as any);
    expect(p.get("ival")).toBe("85.5");
  });

  it("URL round-trip: encode(decode(url)) preserves all advanced options", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&agg_state=gas&interp_scale=lin-lin&interp_method=spline&mstar_mode=a&density=1.5&ival=85.5",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("mode")).toBe("advanced");
    expect(reEncoded.get("agg_state")).toBe("gas");
    expect(reEncoded.get("interp_scale")).toBe("lin-lin");
    expect(reEncoded.get("interp_method")).toBe("spline");
    expect(reEncoded.get("mstar_mode")).toBe("a");
    expect(reEncoded.get("density")).toBe("1.5");
    expect(reEncoded.get("ival")).toBe("85.5");
  });

  it("URL round-trip with partial params: encode(decode(url)) preserves only density", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&density=1.5",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("mode")).toBe("advanced");
    expect(reEncoded.get("programs")).toBe("9");
    expect(reEncoded.get("qfocus")).toBe("both");
    expect(reEncoded.get("density")).toBe("1.5");
    // Other advanced options should NOT be present
    expect(reEncoded.has("agg_state")).toBe(false);
    expect(reEncoded.has("interp_scale")).toBe(false);
    expect(reEncoded.has("interp_method")).toBe(false);
    expect(reEncoded.has("mstar_mode")).toBe(false);
    expect(reEncoded.has("ival")).toBe(false);
  });

  it("decodeCalculatorUrl returns advancedOptions only in advanced mode", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&agg_state=gas",
    );
    const decoded = decodeCalculatorUrl(params);
    // Without mode=advanced, agg_state is ignored
    expect(decoded.advancedOptions).toBeUndefined();
  });

  it("decodeCalculatorUrl parses all advanced options correctly", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&agg_state=condensed&interp_scale=lin-lin&interp_method=spline&mstar_mode=c&density=2.0&ival=100",
    );
    const decoded = decodeCalculatorUrl(params);
    expect(decoded.isAdvancedMode).toBe(true);
    expect(decoded.advancedOptions?.aggregateState).toBe("condensed");
    expect(decoded.advancedOptions?.interpolation?.scale).toBe("linear");
    expect(decoded.advancedOptions?.interpolation?.method).toBe("cubic");
    expect(decoded.advancedOptions?.mstarMode).toBe("c");
    expect(decoded.advancedOptions?.densityOverride).toBe(2.0);
    expect(decoded.advancedOptions?.iValueOverride).toBe(100);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Inverse lookup URL params (imode, ivalues, iunit)
  // ──────────────────────────────────────────────────────────────────────────

  it("decodes imode=csda, ivalues with mixed per-row suffixes, iunit=cm", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=csda&ivalues=7.718:cm,45:um,0.2&iunit=cm",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBe("csda");
    expect((decoded as any).iunit).toBe("cm");
    expect((decoded as any).ivalues).toEqual([
      { rawInput: "7.718", unit: "cm", unitFromSuffix: true },
      { rawInput: "45", unit: "um", unitFromSuffix: true },
      { rawInput: "0.2", unit: "cm", unitFromSuffix: false },
    ]);
  });

  it("decodes imode=stp, ivalues without per-row suffixes, iunit=kev-um", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=stp&ivalues=45.76,10.00&iunit=kev-um",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBe("stp");
    expect((decoded as any).iunit).toBe("kev-um");
    expect((decoded as any).ivalues).toEqual([
      { rawInput: "45.76", unit: "kev-um", unitFromSuffix: false },
      { rawInput: "10.00", unit: "kev-um", unitFromSuffix: false },
    ]);
  });

  it("decodes imode=csda with invalid iunit (km) → defaults to cm", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=csda&ivalues=7.718&iunit=km",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBe("csda");
    expect((decoded as any).iunit).toBe("cm"); // invalid unit defaults to cm
    expect((decoded as any).ivalues).toEqual([
      { rawInput: "7.718", unit: "cm", unitFromSuffix: false },
    ]);
  });

  it("decodes imode=stp with invalid iunit → defaults to kev-um", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=stp&ivalues=45.76&iunit=invalid-unit",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBe("stp");
    expect((decoded as any).iunit).toBe("kev-um"); // invalid unit defaults to kev-um
  });

  it("no imode param → imode is undefined (Forward tab active)", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBeUndefined();
    expect((decoded as any).ivalues).toBeUndefined();
    expect((decoded as any).iunit).toBeUndefined();
  });

  it("imode=invalid is silently ignored → undefined", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&imode=invalid",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBeUndefined();
  });

  it("encodes imode=csda, ivalues with mixed per-row suffixes, iunit=cm", () => {
    const p = encodeCalculatorUrl({
      ...baseState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      imode: "csda",
      ivalues: [
        { rawInput: "7.718", unit: "cm", unitFromSuffix: true },
        { rawInput: "45", unit: "um", unitFromSuffix: true },
        { rawInput: "0.2", unit: "cm", unitFromSuffix: false },
      ],
      iunit: "cm",
    } as any);
    expect(p.get("imode")).toBe("csda");
    expect(p.get("ivalues")).toBe("7.718:cm,45:um,0.2");
    expect(p.get("iunit")).toBe("cm");
  });

  it("encodes imode=stp, ivalues without per-row suffixes, iunit=kev-um", () => {
    const p = encodeCalculatorUrl({
      ...baseState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      imode: "stp",
      ivalues: [
        { rawInput: "45.76", unit: "kev-um", unitFromSuffix: false },
        { rawInput: "10.00", unit: "kev-um", unitFromSuffix: false },
      ],
      iunit: "kev-um",
    } as any);
    expect(p.get("imode")).toBe("stp");
    expect(p.get("ivalues")).toBe("45.76,10.00");
    expect(p.get("iunit")).toBe("kev-um");
  });

  it("does not emit imode/ivalues/iunit when imode is undefined", () => {
    const p = encodeCalculatorUrl({
      ...baseState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
    } as any);
    expect(p.has("imode")).toBe(false);
    expect(p.has("ivalues")).toBe(false);
    expect(p.has("iunit")).toBe(false);
  });

  it("URL round-trip: imode=csda with mixed per-row suffixes", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=csda&ivalues=7.718:cm,45:um,0.2&iunit=cm",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("imode")).toBe("csda");
    expect(reEncoded.get("ivalues")).toBe("7.718:cm,45:um,0.2");
    expect(reEncoded.get("iunit")).toBe("cm");
  });

  it("URL round-trip: imode=stp with master unit only", () => {
    const originalParams = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=stp&ivalues=45.76,10.00&iunit=kev-um",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("imode")).toBe("stp");
    expect(reEncoded.get("ivalues")).toBe("45.76,10.00");
    expect(reEncoded.get("iunit")).toBe("kev-um");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Duplicate params — last wins (§3.2)
// ──────────────────────────────────────────────────────────────────────────

describe("duplicate params — last wins (§3.2)", () => {
  it("duplicate particle uses last value", () => {
    const params = new URLSearchParams("particle=1&particle=2&material=276&program=auto&energies=100&eunit=MeV");
    const state = decodeCalculatorUrl(params);
    expect(state.particleId).toBe(2);
  });

  it("duplicate material uses last value", () => {
    const params = new URLSearchParams("particle=1&material=100&material=276&program=auto&energies=100&eunit=MeV");
    const state = decodeCalculatorUrl(params);
    expect(state.materialId).toBe(276);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Unknown params dropped from canonical URL
// ──────────────────────────────────────────────────────────────────────────

describe("unknown params dropped from canonical URL", () => {
  it("unknown foo=bar is absent from encoded output", () => {
    const params = new URLSearchParams("urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&foo=bar&unknown=xyz");
    const state = decodeCalculatorUrl(params);
    const encoded = encodeCalculatorUrl(state);
    const encodedStr = encoded.toString();
    expect(encodedStr).not.toContain("foo=");
    expect(encodedStr).not.toContain("unknown=");
    expect(encodedStr).toContain("urlv=1");
    expect(encodedStr).toContain("particle=1");
  });
});
