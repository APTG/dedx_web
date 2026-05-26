/**
 * Unit tests for calculator-url.ts encode/decode helpers.
 *
 * Source of truth for v2 param names, allowed values, and migration rules:
 *   docs/04-feature-specs/shareable-urls.md  §2 (schema delta) §7 (migration rules)
 *   docs/decisions/006-url-schema-v2.md  (ADR — justifies hidden= drop, qfocus→qshow rename, and ivalues→lookups rename)
 *
 * NOTE: This file covers the v1 encoder/decoder that is currently in production.
 * v2 introduces uanchor=, qshow=, mode=basic|advanced, calc=forward|range|inverse-stp,
 * runit=, sunit=, istpbranch=, across=, and tip_seen=; renames ivalues= → lookups= (ADR 006 §5);
 * silently drops hidden_programs=. The entity-ID param names (particle=, material=,
 * program=) are unchanged in v2 — see ADR 006 §3 for why the earlier *Id rename
 * proposal was rejected. Behavioural v2 encoder changes land in #555–#561.
 */
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
  quantityFocus: "stp",
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

  it("omits uanchor for the default MeV anchor", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      energyAnchor: "MeV",
    });
    expect(p.has("uanchor")).toBe(false);
  });

  it("encodes non-default uanchor slugs", () => {
    const perNucleon = encodeCalculatorUrl({
      ...defaultState,
      energyAnchor: "MeV/nucl",
    });
    const perAtomicMass = encodeCalculatorUrl({
      ...defaultState,
      energyAnchor: "MeV/u",
    });

    expect(perNucleon.get("uanchor")).toBe("mev-nucl");
    expect(perAtomicMass.get("uanchor")).toBe("mev-u");
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

  it("decodes valid uanchor slugs", () => {
    expect(decodeCalculatorUrl(new URLSearchParams("uanchor=mev")).energyAnchor).toBe("MeV");
    expect(decodeCalculatorUrl(new URLSearchParams("uanchor=mev-nucl")).energyAnchor).toBe(
      "MeV/nucl",
    );
    expect(decodeCalculatorUrl(new URLSearchParams("uanchor=mev-u")).energyAnchor).toBe("MeV/u");
  });

  it("rejects unknown uanchor slugs safely", () => {
    const prototypeKey = decodeCalculatorUrl(new URLSearchParams("uanchor=__proto__"));
    const unknownKey = decodeCalculatorUrl(new URLSearchParams("uanchor=bogus"));

    expect(prototypeKey.energyAnchor).toBeUndefined();
    expect(unknownKey.energyAnchor).toBeUndefined();
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

  it("decodes advanced mode params: mode=advanced&programs=9,2&qshow=stp", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C2&qshow=stp",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).isAdvancedMode).toBe(true);
    expect((s as any).selectedProgramIds).toEqual([9, 2]);
    expect((s as any).quantityFocus).toBe("stp");
  });

  it("decodes advanced mode with hidden_programs parameter (silently dropped in v2)", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C2&hidden_programs=2",
    );
    const s = decodeCalculatorUrl(params);
    expect((s as any).isAdvancedMode).toBe(true);
    // hidden_programs is silently dropped — no hiddenProgramIds in state
    expect((s as any).hiddenProgramIds).toBeUndefined();
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

  it("encodes advanced mode without qshow when quantityFocus is default (stp)", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9, 2],
      quantityFocus: "stp",
    } as any);
    expect(p.get("mode")).toBe("advanced");
    expect(p.get("programs")).toBe("9,2");
    expect(p.has("qshow")).toBe(false); // omitted when default (stp) per ADR 006
    expect(p.has("hidden_programs")).toBe(false);
  });

  it("encodes advanced mode with qshow=range when quantityFocus is range", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9, 2],
      quantityFocus: "range",
    } as any);
    expect(p.get("mode")).toBe("advanced");
    expect(p.get("programs")).toBe("9,2");
    expect(p.get("qshow")).toBe("range");
    expect(p.has("hidden_programs")).toBe(false);
  });

  it("encodes advanced mode without hidden_programs (v2 drops column visibility)", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: true,
      selectedProgramIds: [9, 2],
      quantityFocus: "stp",
    } as any);
    expect(p.get("mode")).toBe("advanced");
    expect(p.get("programs")).toBe("9,2");
    expect(p.has("qshow")).toBe(false); // omitted when default (stp) per ADR 006
    expect(p.has("hidden_programs")).toBe(false);
  });

  it("basic mode does NOT contain mode= or programs= params", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      isAdvancedMode: false,
    } as any);
    expect(p.has("mode")).toBe(false);
    expect(p.has("programs")).toBe(false);
    expect(p.has("hidden_programs")).toBe(false);
    expect(p.has("qshow")).toBe(false);
  });

  it("URL round-trip: encode(decode(url)) normalises qshow=stp to absent (default omission)", () => {
    const originalParams = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C2&qshow=stp",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    // Compare key params that should round-trip
    expect(reEncoded.get("mode")).toBe("advanced");
    expect(reEncoded.get("programs")).toBe("9,2");
    expect(reEncoded.has("qshow")).toBe(false); // stp is default — omitted in canonical form
    expect(reEncoded.get("particle")).toBe("1");
    expect(reEncoded.get("material")).toBe("276");
    expect(reEncoded.get("eunit")).toBe("MeV");
  });

  it("URL round-trip with hidden_programs: silently dropped, not re-emitted", () => {
    const originalParams = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9%2C2&hidden_programs=2&qshow=stp",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("mode")).toBe("advanced");
    expect(reEncoded.get("programs")).toBe("9,2");
    // hidden_programs is dropped — not re-emitted
    expect(reEncoded.has("hidden_programs")).toBe(false);
    expect(reEncoded.has("qshow")).toBe(false); // stp is default — omitted in canonical form
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

  it("URL round-trip with partial params: encode(decode(url)) normalises qshow=stp to absent", () => {
    const originalParams = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qshow=stp&density=1.5",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("mode")).toBe("advanced");
    expect(reEncoded.get("programs")).toBe("9");
    expect(reEncoded.has("qshow")).toBe(false); // stp is default — omitted in canonical form
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
  // Inverse lookup URL params (imode, lookups, iunit)
  // ──────────────────────────────────────────────────────────────────────────

  it("decodes imode=csda, lookups with mixed per-row suffixes, iunit=cm", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=csda&lookups=7.718:cm,45:um,0.2&iunit=cm",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBe("csda");
    expect((decoded as any).iunit).toBe("cm");
    expect((decoded as any).lookups).toEqual([
      { rawInput: "7.718", unit: "cm", unitFromSuffix: true },
      { rawInput: "45", unit: "um", unitFromSuffix: true },
      { rawInput: "0.2", unit: "cm", unitFromSuffix: false },
    ]);
  });

  it("decodes imode=stp, lookups without per-row suffixes, iunit=kev-um", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=stp&lookups=45.76,10.00&iunit=kev-um",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBe("stp");
    expect((decoded as any).iunit).toBe("kev-um");
    expect((decoded as any).lookups).toEqual([
      { rawInput: "45.76", unit: "kev-um", unitFromSuffix: false },
      { rawInput: "10.00", unit: "kev-um", unitFromSuffix: false },
    ]);
  });

  it("decodes imode=csda with invalid iunit (km) → defaults to cm", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=csda&lookups=7.718&iunit=km",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBe("csda");
    expect((decoded as any).iunit).toBe("cm"); // invalid unit defaults to cm
    expect((decoded as any).lookups).toEqual([
      { rawInput: "7.718", unit: "cm", unitFromSuffix: false },
    ]);
  });

  it("decodes imode=stp with invalid iunit → defaults to kev-um", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=stp&lookups=45.76&iunit=invalid-unit",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBe("stp");
    expect((decoded as any).iunit).toBe("kev-um"); // invalid unit defaults to kev-um
  });

  it("no imode param → imode is undefined (Forward tab active)", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBeUndefined();
    expect((decoded as any).lookups).toBeUndefined();
    expect((decoded as any).iunit).toBeUndefined();
  });

  it("imode=invalid is silently ignored → undefined", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&imode=invalid",
    );
    const decoded = decodeCalculatorUrl(params);
    expect((decoded as any).imode).toBeUndefined();
  });

  it("encodes imode=csda, lookups with mixed per-row suffixes, iunit=cm", () => {
    const p = encodeCalculatorUrl({
      ...baseState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      imode: "csda",
      lookups: [
        { rawInput: "7.718", unit: "cm", unitFromSuffix: true },
        { rawInput: "45", unit: "um", unitFromSuffix: true },
        { rawInput: "0.2", unit: "cm", unitFromSuffix: false },
      ],
      iunit: "cm",
    } as any);
    expect(p.get("imode")).toBe("csda");
    expect(p.get("lookups")).toBe("7.718:cm,45:um,0.2");
    expect(p.get("iunit")).toBe("cm");
  });

  it("encodes imode=stp, lookups without per-row suffixes, iunit=kev-um", () => {
    const p = encodeCalculatorUrl({
      ...baseState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
      imode: "stp",
      lookups: [
        { rawInput: "45.76", unit: "kev-um", unitFromSuffix: false },
        { rawInput: "10.00", unit: "kev-um", unitFromSuffix: false },
      ],
      iunit: "kev-um",
    } as any);
    expect(p.get("imode")).toBe("stp");
    expect(p.get("lookups")).toBe("45.76,10.00");
    expect(p.get("iunit")).toBe("kev-um");
  });

  it("does not emit imode/lookups/iunit when imode is undefined", () => {
    const p = encodeCalculatorUrl({
      ...baseState,
      isAdvancedMode: true,
      selectedProgramIds: [9],
      quantityFocus: "both",
    } as any);
    expect(p.has("imode")).toBe(false);
    expect(p.has("lookups")).toBe(false);
    expect(p.has("iunit")).toBe(false);
  });

  it("URL round-trip: imode=csda with mixed per-row suffixes (v2 lookups=)", () => {
    const originalParams = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=csda&lookups=7.718:cm,45:um,0.2&iunit=cm",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("imode")).toBe("csda");
    expect(reEncoded.get("lookups")).toBe("7.718:cm,45:um,0.2");
    expect(reEncoded.get("iunit")).toBe("cm");
  });

  it("URL round-trip: imode=stp with master unit only (v2 lookups=)", () => {
    const originalParams = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100&eunit=MeV&mode=advanced&programs=9&qfocus=both&imode=stp&lookups=45.76,10.00&iunit=kev-um",
    );
    const decoded = decodeCalculatorUrl(originalParams);
    const reEncoded = encodeCalculatorUrl(decoded);

    expect(reEncoded.get("imode")).toBe("stp");
    expect(reEncoded.get("lookups")).toBe("45.76,10.00");
    expect(reEncoded.get("iunit")).toBe("kev-um");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Duplicate params — last wins (§3.2)
// ──────────────────────────────────────────────────────────────────────────

describe("duplicate params — last wins (§3.2)", () => {
  it("duplicate particle uses last value", () => {
    const params = new URLSearchParams(
      "particle=1&particle=2&material=276&program=auto&energies=100&eunit=MeV",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.particleId).toBe(2);
  });

  it("duplicate material uses last value", () => {
    const params = new URLSearchParams(
      "particle=1&material=100&material=276&program=auto&energies=100&eunit=MeV",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.materialId).toBe(276);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Unknown params dropped from canonical URL
// ──────────────────────────────────────────────────────────────────────────

describe("unknown params dropped from canonical URL", () => {
  it("unknown foo=bar is absent from encoded output", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&foo=bar&unknown=xyz",
    );
    const state = decodeCalculatorUrl(params);
    const encoded = encodeCalculatorUrl(state);
    const encodedStr = encoded.toString();
    expect(encodedStr).not.toContain("foo=");
    expect(encodedStr).not.toContain("unknown=");
    expect(encodedStr).toContain("urlv=2");
    expect(encodedStr).toContain("particle=1");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// v1 → v2 migration fixtures (shareable-urls.md §7)
//
// These tests anchor the v1→v2 migration mapping that the schema doc
// describes. The current v1 decoder is what's being tested here — once the
// v2 encoder/decoder lands in #555–#561, these fixtures will be updated to
// assert the v2 canonical output and v2 migration behaviour.
//
// NOTE: v2 keeps the param names particle=, material=, program= verbatim
// (the earlier rename to *Id was reverted, see ADR 006 §3). The only v1
// param renames in v2 are around eunit→uanchor, qfocus→qshow, imode→mode,
// and the silent drop of hidden_programs=.
//
// Source of truth: docs/04-feature-specs/shareable-urls.md §7 (migration rules)
//                  docs/decisions/006-url-schema-v2.md (justification)
// ──────────────────────────────────────────────────────────────────────────

describe("v1 → v2 migration fixture (shareable-urls.md §7)", () => {
  it("particle= retains its v1 name in v2 (no rename — see ADR 006 §3)", () => {
    const params = new URLSearchParams(
      "particle=6&material=276&program=auto&energies=10&eunit=MeV/nucl",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.particleId).toBe(6);
  });

  it("material= retains its v1 name in v2 (no rename — see ADR 006 §3)", () => {
    const params = new URLSearchParams(
      "particle=1&material=104&program=auto&energies=100&eunit=MeV",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.materialId).toBe(104);
  });

  it("program= retains its v1 name in v2 (no rename — see ADR 006 §3)", () => {
    const params = new URLSearchParams("particle=1&material=276&program=9&energies=100&eunit=MeV");
    const state = decodeCalculatorUrl(params);
    expect(state.programId).toBe(9);
  });

  it("v1 eunit= round-trips through the current decoder (v2 will map to uanchor=, shareable-urls.md §3.6)", () => {
    // The current v1 decoder keeps eunit as masterUnit. The v2 decoder will
    // map MeV→MeV / MeV/nucl→MeV/nucl / MeV/u→MeV/u and emit uanchor= in
    // canonical output (implementation in #555).
    const params = new URLSearchParams(
      "particle=1&material=276&program=auto&energies=100&eunit=MeV/nucl",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.masterUnit).toBe("MeV/nucl");
  });

  it("v2 decoder maps qshow=range (replaces v1 qfocus=csda — shareable-urls.md §7)", () => {
    // v2 migration: qfocus=csda is dropped; qshow=range is the new canonical form.
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&programs=9,2&energies=100&eunit=MeV&mode=advanced&qshow=range",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.quantityFocus).toBe("range");
  });

  it("legacy qfocus=csda migrates to quantityFocus=range (ADR 006 migration rule)", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=csda",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.quantityFocus).toBe("range");
  });

  it("legacy qfocus=stp migrates to quantityFocus=stp (ADR 006 migration rule)", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=stp",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.quantityFocus).toBe("stp");
  });

  it("legacy qfocus=both migrates to default quantityFocus (ADR 006 migration rule)", () => {
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.quantityFocus).toBeUndefined(); // both → omit (default)
  });

  it("v2 decoder silently drops hidden_programs= (shareable-urls.md §2)", () => {
    // v2 decoder behaviour: hidden_programs= is silently dropped.
    const params = new URLSearchParams(
      "urlv=2&particle=1&material=276&programs=9,2&energies=100&eunit=MeV&mode=advanced&hidden_programs=2&qshow=stp",
    );
    const state = decodeCalculatorUrl(params);
    expect((state as any).hiddenProgramIds).toBeUndefined();
  });

  it("inline :unit suffix in energies= round-trips (shareable-urls.md §3.5)", () => {
    // This syntax is shared between v1 and v2 — the :unit suffix grammar is unchanged
    const params = new URLSearchParams("energies=100,10:keV,2:GeV&eunit=MeV");
    const state = decodeCalculatorUrl(params);
    expect(state.rows[0]).toEqual({ rawInput: "100", unit: "MeV", unitFromSuffix: false });
    expect(state.rows[1]).toEqual({ rawInput: "10", unit: "keV", unitFromSuffix: true });
    expect(state.rows[2]).toEqual({ rawInput: "2", unit: "GeV", unitFromSuffix: true });
  });

  it("istpbranch=both round-trips through encode/decode", () => {
    const state = decodeCalculatorUrl(
      new URLSearchParams(
        "particle=1&material=276&programs=9&mode=advanced&qfocus=both&imode=stp&lookups=30&iunit=kev-um&istpbranch=both",
      ),
    );
    expect(state.imode).toBe("stp");
    expect(state.istpBranchState).toBe("both");
    const encoded = encodeCalculatorUrl({
      ...baseState,
      imode: "stp",
      lookups: [{ rawInput: "30", unit: "kev-um", unitFromSuffix: false }],
      iunit: "kev-um",
      istpBranchState: "both",
    });
    expect(encoded.get("istpbranch")).toBe("both");
    expect(encoded.get("imode")).toBe("stp");
  });

  it("istpbranch defaults to hi when absent", () => {
    const state = decodeCalculatorUrl(
      new URLSearchParams(
        "particle=1&material=276&mode=advanced&imode=stp&lookups=30&iunit=kev-um",
      ),
    );
    expect(state.istpBranchState).toBe("hi");
  });

  it("istpbranch=hi is not emitted in URL (hi is the default)", () => {
    const encoded = encodeCalculatorUrl({
      ...baseState,
      imode: "stp",
      lookups: [{ rawInput: "30", unit: "kev-um", unitFromSuffix: false }],
      iunit: "kev-um",
      istpBranchState: "hi",
    });
    expect(encoded.get("istpbranch")).toBeNull();
  });

  it("istpbranch not emitted when imode is csda even if state is both", () => {
    const encoded = encodeCalculatorUrl({
      ...baseState,
      imode: "csda",
      lookups: [{ rawInput: "7.718", unit: "cm", unitFromSuffix: false }],
      iunit: "cm",
      istpBranchState: "both",
    });
    expect(encoded.get("istpbranch")).toBeNull();
  });

  it("v1 ivalues= is accepted as backward-compat fallback for lookups= (ADR 006 §4)", () => {
    // v2 renames the inverse-lookup input list from ivalues= to lookups=.
    // Old bookmarks with ivalues= continue to work — the decoder checks
    // lookups= first, then falls back to ivalues=.
    const params = new URLSearchParams(
      "urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=csda&ivalues=7.718:cm,45:um&iunit=cm",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.imode).toBe("csda");
    expect(state.lookups).toEqual([
      { rawInput: "7.718", unit: "cm", unitFromSuffix: true },
      { rawInput: "45", unit: "um", unitFromSuffix: true },
    ]);
  });
});

// ─── Multi-particle URL encoding/decoding (issue #599) ────────────────────────
// Spec: docs/04-feature-specs/shareable-urls.md §3.1 canonical example:
//   particles=1,2,6&across=particles

const advancedBase: CalculatorUrlState = {
  particleId: 1,
  materialId: 276,
  programId: 9,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
  isAdvancedMode: true,
};

describe("encodeCalculatorUrl — multi-particle (across=particle)", () => {
  it("emits particles= and across=particle when selectedParticleIds is set", () => {
    const p = encodeCalculatorUrl({
      ...advancedBase,
      across: "particle",
      selectedParticleIds: [1, 2, 6],
    });
    expect(p.get("across")).toBe("particle");
    expect(p.get("particles")).toBe("1,2,6");
  });

  it("omits across= and particles= when across is undefined", () => {
    const p = encodeCalculatorUrl(advancedBase);
    expect(p.has("across")).toBe(false);
    expect(p.has("particles")).toBe(false);
  });

  it("omits particles= when selectedParticleIds is empty", () => {
    const p = encodeCalculatorUrl({
      ...advancedBase,
      across: "particle",
      selectedParticleIds: [],
    });
    expect(p.has("particles")).toBe(false);
  });

  it("does not emit particles= when across=material", () => {
    const p = encodeCalculatorUrl({
      ...advancedBase,
      across: "material",
      selectedParticleIds: [1, 2, 6],
    });
    expect(p.get("across")).toBe("material");
    expect(p.has("particles")).toBe(false);
  });

  it("round-trips the canonical spec example URL", () => {
    // Spec example: particles=1,2,6&across=particles
    const p = encodeCalculatorUrl({
      ...advancedBase,
      across: "particle",
      selectedParticleIds: [1, 2, 6],
    });
    const qs = p.toString();
    expect(qs).toContain("particles=1%2C2%2C6");
    expect(qs).toContain("across=particle");
  });
});

describe("decodeCalculatorUrl — multi-particle (across=particle)", () => {
  it("decodes particles= and across=particle", () => {
    const params = new URLSearchParams(
      "urlv=2&mode=advanced&particle=1&particles=1,2,6&material=276&program=9&energies=100&eunit=MeV&across=particle",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.isAdvancedMode).toBe(true);
    expect(state.across).toBe("particle");
    expect(state.selectedParticleIds).toEqual([1, 2, 6]);
    expect(state.particleId).toBe(1);
  });

  it("ignores particles= when across is absent", () => {
    const params = new URLSearchParams(
      "urlv=2&mode=advanced&particle=1&particles=1,2,6&material=276&program=9&energies=100&eunit=MeV",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.across).toBeUndefined();
    expect(state.selectedParticleIds).toBeUndefined();
  });

  it("ignores particles= in basic mode (across= requires mode=advanced)", () => {
    const params = new URLSearchParams(
      "urlv=2&particle=1&particles=1,2,6&material=276&program=9&energies=100&eunit=MeV&across=particle",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.isAdvancedMode).toBe(false);
    expect(state.across).toBeUndefined();
    expect(state.selectedParticleIds).toBeUndefined();
  });

  it("filters out-of-range Z values from particles=", () => {
    const params = new URLSearchParams(
      "urlv=2&mode=advanced&particle=1&particles=0,1,2,119&material=276&program=9&energies=100&eunit=MeV&across=particle",
    );
    const state = decodeCalculatorUrl(params);
    // Z=0 and Z=119 are out-of-range [1..118] and should be dropped.
    expect(state.selectedParticleIds).toEqual([1, 2]);
  });

  it("returns undefined selectedParticleIds when particles= is absent", () => {
    const params = new URLSearchParams(
      "urlv=2&mode=advanced&particle=1&material=276&program=9&energies=100&eunit=MeV&across=particle",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.across).toBe("particle");
    expect(state.selectedParticleIds).toBeUndefined();
  });

  it("decodes across=material without touching selectedParticleIds", () => {
    const params = new URLSearchParams(
      "urlv=2&mode=advanced&particle=1&material=276&program=9&energies=100&eunit=MeV&across=material",
    );
    const state = decodeCalculatorUrl(params);
    expect(state.across).toBe("material");
    expect(state.selectedParticleIds).toBeUndefined();
  });
});
