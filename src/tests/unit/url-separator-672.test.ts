/**
 * Regression battery for issue #672 — "link bad formatting".
 *
 * Shareable URLs used a literal comma as the list-item separator (`energies`,
 * `particles`, `programs`, `materials`, `lookups`, `mat_elements`, `series`).
 * Messenger/email auto-linkifiers are heuristic and terminate an auto-link at
 * the first comma (it is normally sentence punctuation), so any multi-item
 * shared link was truncated when pasted into Signal/iMessage/etc.
 *
 * The fix switches the canonical separator to `~` (RFC 3986 *unreserved*, never
 * dropped by linkifiers) while the decoders still accept the legacy `,` so every
 * previously shared/bookmarked link keeps working. These tests are the
 * regression lock for that contract.
 */
import { describe, it, expect } from "vitest";
import {
  encodeCalculatorUrl,
  decodeCalculatorUrl,
  calculatorUrlQueryString,
  CALCULATOR_URL_VERSION,
  type CalculatorUrlState,
} from "$lib/utils/calculator-url";
import {
  encodePlotUrl,
  decodePlotUrl,
  plotUrlQueryString,
  type PlotUrlInput,
} from "$lib/utils/plot-url";
import { parseEntityIdList, formatEntityIdList } from "$lib/external-data/ids";
import type { StpUnit } from "$lib/wasm/types";

const calcBase: CalculatorUrlState = {
  particleId: 1,
  materialId: 276,
  programId: null,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
};

/**
 * Mimics the "stop at the first comma" heuristic that messenger/email
 * linkifiers apply: an auto-linked URL is the run of non-whitespace characters
 * that does not include a comma. This is the exact behaviour that truncated
 * shared links in #672.
 */
function autolink(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s,]+/);
  return m ? m[0] : null;
}

describe("issue #672 — encoders never emit a bare comma", () => {
  it("calculatorUrlQueryString contains no comma / %2C for a multi-row state", () => {
    const qs = calculatorUrlQueryString({
      ...calcBase,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "200", unit: "MeV", unitFromSuffix: false },
        { rawInput: "500", unit: "keV", unitFromSuffix: true },
      ],
    });
    expect(qs).toContain("energies=100~200~500:keV");
    expect(qs).not.toContain(",");
    expect(qs).not.toContain("%2C");
    expect(qs).not.toContain("%7E");
  });

  it("calculatorUrlQueryString contains no comma for an advanced multi-program + multi-particle state", () => {
    const qs = calculatorUrlQueryString({
      ...calcBase,
      isAdvancedMode: true,
      across: "particle",
      selectedParticleIds: [1, 2, 6],
      selectedProgramIds: [9, 2, 101],
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "200", unit: "MeV", unitFromSuffix: false },
      ],
    });
    expect(qs).toContain("particles=1~2~6");
    expect(qs).toContain("programs=9~2~101");
    expect(qs).not.toContain(",");
    expect(qs).not.toContain("%2C");
  });

  it("calculatorUrlQueryString contains no comma for an inverse-lookup state", () => {
    const qs = calculatorUrlQueryString({
      ...calcBase,
      imode: "csda",
      iunit: "cm",
      lookups: [
        { rawInput: "7.72", unit: "cm", unitFromSuffix: true },
        { rawInput: "45", unit: "um", unitFromSuffix: true },
      ],
    });
    expect(qs).toContain("lookups=7.72:cm~45:um");
    expect(qs).not.toContain(",");
    expect(qs).not.toContain("%2C");
  });

  it("calculatorUrlQueryString contains no comma for a custom-compound state", () => {
    const qs = calculatorUrlQueryString({
      ...calcBase,
      isAdvancedMode: true,
      materialId: null,
      materialIsCustom: true,
      matName: "PMMA",
      matDensity: 1.19,
      matElements: [
        { atomicNumber: 1, atomCount: 8 },
        { atomicNumber: 6, atomCount: 5 },
        { atomicNumber: 8, atomCount: 2 },
      ],
    });
    expect(qs).toContain("mat_elements=1:8~6:5~8:2");
    expect(qs).not.toContain(",");
    expect(qs).not.toContain("%2C");
  });

  it("plotUrlQueryString contains no comma for a multi-series state", () => {
    const input: PlotUrlInput = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [
        { programId: 9, particleId: 1, materialId: 276 },
        { programId: 2, particleId: 1, materialId: 276 },
      ],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
    };
    const qs = plotUrlQueryString(input);
    expect(qs).toContain("series=9.1.276~2.1.276");
    expect(qs).not.toContain(",");
    expect(qs).not.toContain("%2C");
    expect(qs).not.toContain("%7E");
  });
});

describe("issue #672 — decoders accept the legacy comma separator (backward compat)", () => {
  it("decodes a legacy comma energies list to the same rows as the ~ form", () => {
    const legacy = decodeCalculatorUrl(new URLSearchParams("energies=100,200,500:keV&eunit=MeV"));
    const canonical = decodeCalculatorUrl(
      new URLSearchParams("energies=100~200~500:keV&eunit=MeV"),
    );
    expect(legacy.rows).toEqual(canonical.rows);
    expect(legacy.rows).toHaveLength(3);
  });

  it("tolerates a mix of comma and ~ separators in energies", () => {
    const s = decodeCalculatorUrl(new URLSearchParams("energies=100,200~300&eunit=MeV"));
    expect(s.rows.map((r) => r.rawInput)).toEqual(["100", "200", "300"]);
  });

  it("decodes legacy comma programs / particles lists in advanced mode", () => {
    const s = decodeCalculatorUrl(
      new URLSearchParams(
        "urlv=2&mode=advanced&particle=1&particles=1,2,6&material=276&program=9&programs=9,2,101&energies=100&across=particles",
      ),
    );
    expect(s.selectedParticleIds).toEqual([1, 2, 6]);
    expect(s.selectedProgramIds).toEqual([9, 2, 101]);
  });

  it("decodes legacy comma lookups lists", () => {
    const s = decodeCalculatorUrl(new URLSearchParams("imode=csda&lookups=7.72:cm,45:um&iunit=cm"));
    expect(s.lookups?.map((l) => l.rawInput)).toEqual(["7.72", "45"]);
  });

  it("decodes legacy comma series lists on the plot page", () => {
    const legacy = decodePlotUrl(new URLSearchParams("series=9.1.276,2.1.276"));
    const canonical = decodePlotUrl(new URLSearchParams("series=9.1.276~2.1.276"));
    expect(legacy.series).toEqual(canonical.series);
    expect(legacy.series).toHaveLength(2);
  });

  it("parseEntityIdList accepts both separators and re-emits the ~ form", () => {
    expect(parseEntityIdList("9,2,101")).toEqual(parseEntityIdList("9~2~101"));
    expect(formatEntityIdList(parseEntityIdList("9,2,101"))).toBe("9~2~101");
  });
});

describe("issue #672 — round-trip stability with the new separator", () => {
  it("round-trips multi-row energies through encode→decode", () => {
    const state: CalculatorUrlState = {
      ...calcBase,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "200", unit: "MeV", unitFromSuffix: false },
        { rawInput: "500", unit: "keV", unitFromSuffix: true },
      ],
    };
    const decoded = decodeCalculatorUrl(encodeCalculatorUrl(state));
    expect(decoded.rows).toEqual(state.rows);
  });

  it("round-trips a multi-series plot through encode→decode", () => {
    const input: PlotUrlInput = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [
        { programId: 9, particleId: 1, materialId: 276 },
        { programId: 2, particleId: 6, materialId: 3 },
      ],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
    };
    const decoded = decodePlotUrl(encodePlotUrl(input));
    expect(decoded.series).toEqual(input.series);
  });

  it("a tilde injected into a row's rawInput cannot corrupt tokenization", () => {
    // `100~200` is not a valid energy and is dropped, so it can never leak a
    // bare separator into the encoded list (isUrlSafeNumeric guard).
    const p = encodeCalculatorUrl({
      ...calcBase,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "100~200", unit: "MeV", unitFromSuffix: false },
        { rawInput: "300", unit: "MeV", unitFromSuffix: false },
      ],
    });
    expect(p.get("energies")).toBe("100~300");
  });

  it("a separator-bearing lookup rawInput is dropped, not injected (guard parity with energies)", () => {
    // Same URL-safety guard must apply to inverse-lookup rows so a stray `,`/`~`
    // can't reintroduce the linkifier truncation or corrupt tokenization.
    const p = encodeCalculatorUrl({
      ...calcBase,
      imode: "csda",
      iunit: "cm",
      lookups: [
        { rawInput: "7.72", unit: "cm", unitFromSuffix: true },
        { rawInput: "1,000", unit: "cm", unitFromSuffix: true },
        { rawInput: "45~9", unit: "cm", unitFromSuffix: true },
        { rawInput: "20", unit: "cm", unitFromSuffix: true },
      ],
    });
    expect(p.get("lookups")).toBe("7.72:cm~20:cm");
  });
});

describe("issue #672 — linkifier survives the canonical URL intact", () => {
  it("a comma-terminating linkifier captures the entire ~ URL but truncates the comma URL", () => {
    const origin = "https://dedx.example/calculator?";
    const canonical =
      origin +
      calculatorUrlQueryString({
        ...calcBase,
        rows: [
          { rawInput: "100", unit: "MeV", unitFromSuffix: false },
          { rawInput: "200", unit: "MeV", unitFromSuffix: false },
          { rawInput: "500", unit: "MeV", unitFromSuffix: false },
        ],
      });

    // The whole canonical URL is one link (no comma to trip the heuristic).
    expect(autolink(canonical)).toBe(canonical);

    // The pre-#672 comma form would have been cut off at the first comma,
    // exactly the bug reported in the screenshot.
    const commaUrl = canonical.replaceAll("~", ",");
    expect(autolink(commaUrl)).not.toBe(commaUrl);
    expect(autolink(commaUrl)!.length).toBeLessThan(commaUrl.length);
  });
});

describe("issue #672 — v2 → v3 canonical-form upgrade", () => {
  it("the current canonical version is v3", () => {
    expect(CALCULATOR_URL_VERSION).toBe(3);
    expect(encodeCalculatorUrl(calcBase).get("urlv")).toBe("3");
  });

  it("loading a urlv=2 comma URL yields correct state and re-encodes to urlv=3 with ~", () => {
    const v2 = new URLSearchParams(
      "urlv=2&particle=1&material=276&program=auto&energies=100,200,500&eunit=MeV",
    );
    const state = decodeCalculatorUrl(v2);
    expect(state.rows.map((r) => r.rawInput)).toEqual(["100", "200", "500"]);

    const reEncoded = calculatorUrlQueryString(state);
    expect(reEncoded).toContain("urlv=3");
    expect(reEncoded).toContain("energies=100~200~500");
    expect(reEncoded).not.toContain(",");
  });

  it("plot URLs carry the urlv version signal so old clients can detect v3", () => {
    // Without this, an older client opening a v3 `~`-series plot link would
    // silently drop the series instead of showing the unsupported-link banner.
    const input: PlotUrlInput = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [
        { programId: 9, particleId: 1, materialId: 276 },
        { programId: 2, particleId: 1, materialId: 276 },
      ],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
    };
    expect(encodePlotUrl(input).get("urlv")).toBe("3");
    const qs = plotUrlQueryString(input);
    expect(qs.startsWith("urlv=3&")).toBe(true);
    expect(qs).toContain("series=9.1.276~2.1.276");
  });
});
