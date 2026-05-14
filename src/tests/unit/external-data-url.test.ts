import { describe, it, expect } from "vitest";
import {
  isExternalSourceLabel,
  isExternalEntityLocalId,
  isExtRef,
  parseExtRef,
  formatExtRef,
  parseEntityId,
  formatEntityId,
  parseEntityIdList,
  formatEntityIdList,
} from "$lib/external-data/ids";
import {
  parseExtdataParams,
  appendExtdataParams,
  externalDataQuerySegments,
} from "$lib/external-data/url";
import type { ExternalSourceDescriptor } from "$lib/external-data/types";
import { decodeCalculatorUrl, calculatorUrlQueryString } from "$lib/utils/calculator-url";
import type { CalculatorUrlState } from "$lib/utils/calculator-url";
import { encodePlotUrl, decodePlotUrl, plotUrlQueryString } from "$lib/utils/plot-url";
import type { PlotUrlInput } from "$lib/utils/plot-url";

// ---------------------------------------------------------------------------
// isExternalSourceLabel / isExternalEntityLocalId
// ---------------------------------------------------------------------------

describe("isExternalSourceLabel", () => {
  it("accepts alphanumeric, underscore, hyphen", () => {
    expect(isExternalSourceLabel("srim")).toBe(true);
    expect(isExternalSourceLabel("SRIM-2013")).toBe(true);
    expect(isExternalSourceLabel("my_data")).toBe(true);
    expect(isExternalSourceLabel("a")).toBe(true);
    expect(isExternalSourceLabel("A0_-")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isExternalSourceLabel("")).toBe(false);
  });

  it("rejects strings with spaces, colons, slashes, dots", () => {
    expect(isExternalSourceLabel("my label")).toBe(false);
    expect(isExternalSourceLabel("a:b")).toBe(false);
    expect(isExternalSourceLabel("a/b")).toBe(false);
    expect(isExternalSourceLabel("a.b")).toBe(false);
  });
});

describe("isExternalEntityLocalId", () => {
  it("accepts valid identifiers", () => {
    expect(isExternalEntityLocalId("p")).toBe(true);
    expect(isExternalEntityLocalId("srim-2013")).toBe(true);
    expect(isExternalEntityLocalId("H2O_liquid")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isExternalEntityLocalId("")).toBe(false);
  });

  it("rejects strings with colons", () => {
    expect(isExternalEntityLocalId("a:b")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isExtRef
// ---------------------------------------------------------------------------

describe("isExtRef", () => {
  it("accepts valid ext refs", () => {
    expect(isExtRef("ext:srim:p")).toBe(true);
    expect(isExtRef("ext:srim-2013:H2O")).toBe(true);
    expect(isExtRef("ext:a:b")).toBe(true);
  });

  it("rejects missing parts", () => {
    expect(isExtRef("ext:srim")).toBe(false); // no second colon
    expect(isExtRef("ext::p")).toBe(false); // empty label
    expect(isExtRef("ext:srim:")).toBe(false); // empty localId
    expect(isExtRef("srim:p:q")).toBe(false); // no ext: prefix
    expect(isExtRef("")).toBe(false);
    expect(isExtRef(42)).toBe(false);
    expect(isExtRef(null)).toBe(false);
  });

  it("rejects invalid label chars", () => {
    expect(isExtRef("ext:sri m:p")).toBe(false);
    expect(isExtRef("ext:a.b:p")).toBe(false);
  });

  it("rejects invalid localId chars", () => {
    expect(isExtRef("ext:srim:a b")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseExtRef
// ---------------------------------------------------------------------------

describe("parseExtRef", () => {
  it("parses valid refs", () => {
    expect(parseExtRef("ext:srim:p")).toEqual({ label: "srim", localId: "p" });
    expect(parseExtRef("ext:srim-2013:srim-2013")).toEqual({
      label: "srim-2013",
      localId: "srim-2013",
    });
  });

  it("returns null for invalid refs", () => {
    expect(parseExtRef("ext:srim")).toBeNull();
    expect(parseExtRef("ext::p")).toBeNull();
    expect(parseExtRef("ext:srim:")).toBeNull();
    expect(parseExtRef("plain")).toBeNull();
    expect(parseExtRef("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatExtRef
// ---------------------------------------------------------------------------

describe("formatExtRef", () => {
  it("formats valid label + localId", () => {
    expect(formatExtRef("srim", "p")).toBe("ext:srim:p");
    expect(formatExtRef("my-data", "H2O")).toBe("ext:my-data:H2O");
  });

  it("throws for invalid label", () => {
    expect(() => formatExtRef("", "p")).toThrow();
    expect(() => formatExtRef("a b", "p")).toThrow();
    expect(() => formatExtRef("a:b", "p")).toThrow();
  });

  it("throws for invalid localId", () => {
    expect(() => formatExtRef("srim", "")).toThrow();
    expect(() => formatExtRef("srim", "a b")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseEntityId / formatEntityId
// ---------------------------------------------------------------------------

describe("parseEntityId", () => {
  it("parses positive integers as built-in IDs", () => {
    expect(parseEntityId("1")).toBe(1);
    expect(parseEntityId("276")).toBe(276);
  });

  it("returns null for zero and negative integers", () => {
    expect(parseEntityId("0")).toBeNull();
    expect(parseEntityId("-1")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseEntityId(null)).toBeNull();
  });

  it("parses valid ext refs", () => {
    expect(parseEntityId("ext:srim:p")).toBe("ext:srim:p");
    expect(parseEntityId("ext:my-data:water")).toBe("ext:my-data:water");
  });

  it("returns null for invalid strings", () => {
    expect(parseEntityId("auto")).toBeNull();
    expect(parseEntityId("")).toBeNull();
    expect(parseEntityId("ext:srim")).toBeNull();
    expect(parseEntityId("1.5")).toBeNull();
  });
});

describe("formatEntityId", () => {
  it("formats numbers as strings", () => {
    expect(formatEntityId(9)).toBe("9");
    expect(formatEntityId(276)).toBe("276");
  });

  it("formats ext refs as-is", () => {
    expect(formatEntityId("ext:srim:p")).toBe("ext:srim:p");
  });
});

// ---------------------------------------------------------------------------
// parseEntityIdList / formatEntityIdList
// ---------------------------------------------------------------------------

describe("parseEntityIdList / formatEntityIdList round-trip", () => {
  it("parses a comma-separated list of mixed IDs", () => {
    const list = parseEntityIdList("9,10,ext:srim:srim-2013");
    expect(list).toEqual([9, 10, "ext:srim:srim-2013"]);
  });

  it("drops invalid entries silently", () => {
    const list = parseEntityIdList("9,auto,ext:bad::,276");
    expect(list).toEqual([9, 276]);
  });

  it("formats back to a comma-separated string", () => {
    const ids = [9, "ext:srim:srim-2013" as const, 10];
    expect(formatEntityIdList(ids)).toBe("9,ext:srim:srim-2013,10");
  });

  it("round-trips numeric-only lists", () => {
    const raw = "9,10,11";
    expect(formatEntityIdList(parseEntityIdList(raw))).toBe(raw);
  });

  it("round-trips mixed lists", () => {
    const raw = "9,ext:srim:prog1,10";
    expect(formatEntityIdList(parseEntityIdList(raw))).toBe(raw);
  });
});

// ---------------------------------------------------------------------------
// parseExtdataParams
// ---------------------------------------------------------------------------

describe("parseExtdataParams", () => {
  it("returns empty lists when no extdata param", () => {
    const result = parseExtdataParams(new URLSearchParams("particle=1"));
    expect(result.sources).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses a single extdata param", () => {
    const params = new URLSearchParams();
    params.append("extdata", "srim:https://example.com/store.webdedx");
    const { sources } = parseExtdataParams(params);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toEqual({ label: "srim", url: "https://example.com/store.webdedx" });
  });

  it("preserves declaration order for multiple sources", () => {
    const params = new URLSearchParams();
    params.append("extdata", "alpha:https://a.example.com/");
    params.append("extdata", "beta:https://b.example.com/");
    params.append("extdata", "gamma:https://c.example.com/");
    const { sources } = parseExtdataParams(params);
    expect(sources.map((s) => s.label)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("drops duplicate labels and records an error", () => {
    const params = new URLSearchParams();
    params.append("extdata", "srim:https://first.example.com/");
    params.append("extdata", "srim:https://second.example.com/");
    const { sources, errors } = parseExtdataParams(params);
    expect(sources).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ type: "duplicate-label", label: "srim" });
  });

  it("drops only the duplicate label, keeps other valid sources", () => {
    const params = new URLSearchParams();
    params.append("extdata", "alpha:https://a.example.com/");
    params.append("extdata", "beta:https://b.example.com/");
    params.append("extdata", "beta:https://b2.example.com/");
    const { sources, errors } = parseExtdataParams(params);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.label).toBe("alpha");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ type: "duplicate-label", label: "beta" });
  });

  it("records invalid-label error when value has no colon (no label separator)", () => {
    const params = new URLSearchParams();
    params.append("extdata", "nocolonseparatorhere");
    const { sources, errors } = parseExtdataParams(params);
    expect(sources).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("records invalid-label error when label is empty (value starts with colon)", () => {
    const params = new URLSearchParams();
    params.append("extdata", ":https://example.com/store");
    const { sources, errors } = parseExtdataParams(params);
    expect(sources).toHaveLength(0);
    expect(errors.some((e) => e.type === "invalid-label")).toBe(true);
  });

  it("records invalid-label error for label containing invalid chars", () => {
    const params = new URLSearchParams();
    params.append("extdata", "my label:https://example.com/");
    const { sources, errors } = parseExtdataParams(params);
    expect(sources).toHaveLength(0);
    expect(errors.some((e) => e.type === "invalid-label")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// appendExtdataParams
// ---------------------------------------------------------------------------

describe("appendExtdataParams", () => {
  it("appends extdata params in order", () => {
    const params = new URLSearchParams();
    appendExtdataParams(params, [
      { label: "alpha", url: "https://a.example.com/" },
      { label: "beta", url: "https://b.example.com/" },
    ]);
    const all = params.getAll("extdata");
    expect(all).toHaveLength(2);
    expect(all[0]).toContain("alpha:");
    expect(all[1]).toContain("beta:");
  });
});

// ---------------------------------------------------------------------------
// externalDataQuerySegments
// ---------------------------------------------------------------------------

describe("externalDataQuerySegments", () => {
  it("returns empty array for no sources", () => {
    expect(externalDataQuerySegments([])).toEqual([]);
  });

  it("encodes the URL portion with encodeURIComponent", () => {
    const segs = externalDataQuerySegments([{ label: "srim", url: "https://example.com/store" }]);
    expect(segs).toHaveLength(1);
    // The label colon must be literal; the URL colon must be encoded.
    expect(segs[0]).toBe("extdata=srim:https%3A%2F%2Fexample.com%2Fstore");
  });

  it("keeps the label separator colon literal", () => {
    const segs = externalDataQuerySegments([{ label: "my-data", url: "https://x.com/" }]);
    expect(segs[0]).toMatch(/^extdata=my-data:/);
  });
});

// ---------------------------------------------------------------------------
// calculatorUrlQueryString — canonical order + extdata encoding
// ---------------------------------------------------------------------------

const baseCalcState: CalculatorUrlState = {
  particleId: 1,
  materialId: 276,
  programId: null,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
};

describe("calculatorUrlQueryString — extdata ordering and encoding", () => {
  it("emits urlv first, extdata second, then other params", () => {
    const qs = calculatorUrlQueryString({
      ...baseCalcState,
      externalSources: [{ label: "srim", url: "https://example.com/store.webdedx" }],
    });
    const keys = qs.split("&").map((p) => p.split("=")[0]);
    expect(keys[0]).toBe("urlv");
    expect(keys[1]).toBe("extdata");
    // particle, material, program etc. come after
    expect(keys.indexOf("particle")).toBeGreaterThan(keys.indexOf("extdata"));
  });

  it("emits multiple extdata params in declaration order", () => {
    const qs = calculatorUrlQueryString({
      ...baseCalcState,
      externalSources: [
        { label: "alpha", url: "https://a.example.com/" },
        { label: "beta", url: "https://b.example.com/" },
      ],
    });
    const parts = qs.split("&");
    const extdataParts = parts.filter((p) => p.startsWith("extdata="));
    expect(extdataParts).toHaveLength(2);
    expect(extdataParts[0]).toContain("extdata=alpha:");
    expect(extdataParts[1]).toContain("extdata=beta:");
  });

  it("keeps https%3A in the serialized extdata value", () => {
    const qs = calculatorUrlQueryString({
      ...baseCalcState,
      externalSources: [{ label: "srim", url: "https://example.com/store.webdedx" }],
    });
    expect(qs).toContain("extdata=srim:https%3A");
  });

  it("does not emit extdata when externalSources is empty or absent", () => {
    const qs1 = calculatorUrlQueryString(baseCalcState);
    const qs2 = calculatorUrlQueryString({ ...baseCalcState, externalSources: [] });
    expect(qs1).not.toContain("extdata");
    expect(qs2).not.toContain("extdata");
  });

  it("still emits readable colons and commas in non-extdata params", () => {
    const qs = calculatorUrlQueryString({
      ...baseCalcState,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "500", unit: "keV", unitFromSuffix: true },
      ],
    });
    // energies should contain literal colon separator, not %3A
    expect(qs).toContain("energies=100,500:keV");
  });
});

// ---------------------------------------------------------------------------
// decodeCalculatorUrl — extdata and EntityId for programs
// ---------------------------------------------------------------------------

describe("decodeCalculatorUrl — extdata round-trip", () => {
  it("extracts extdata sources from URL params", () => {
    const raw = new URLSearchParams(
      "urlv=1&extdata=srim:https%3A%2F%2Fexample.com%2Fstore.webdedx&particle=1&material=276&program=auto&energies=100&eunit=MeV",
    );
    const state = decodeCalculatorUrl(raw);
    expect(state.externalSources).toHaveLength(1);
    expect(state.externalSources![0]).toEqual({
      label: "srim",
      url: "https://example.com/store.webdedx",
    });
  });

  it("round-trips extdata through calculatorUrlQueryString", () => {
    const sources: ExternalSourceDescriptor[] = [
      { label: "srim", url: "https://example.com/srim.webdedx" },
      { label: "g4", url: "https://example.com/g4.webdedx" },
    ];
    const state: CalculatorUrlState = { ...baseCalcState, externalSources: sources };
    const qs = calculatorUrlQueryString(state);
    const decoded = decodeCalculatorUrl(new URLSearchParams(qs));
    expect(decoded.externalSources).toEqual(sources);
  });

  it("does not include externalSources when no extdata params present", () => {
    const state = decodeCalculatorUrl(
      new URLSearchParams("urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV"),
    );
    expect(state.externalSources).toBeUndefined();
  });

  it("drops duplicate extdata labels and excludes them from sources", () => {
    const raw = new URLSearchParams();
    raw.append("extdata", "srim:https://first.example.com/");
    raw.append("extdata", "srim:https://second.example.com/");
    raw.append("particle", "1");
    raw.append("material", "276");
    raw.append("program", "auto");
    raw.append("energies", "100");
    raw.append("eunit", "MeV");
    const state = decodeCalculatorUrl(raw);
    expect(state.externalSources ?? []).toHaveLength(0);
  });
});

describe("decodeCalculatorUrl — mixed EntityId programs", () => {
  it("round-trips numeric-only programs", () => {
    const state: CalculatorUrlState = {
      ...baseCalcState,
      isAdvancedMode: true,
      selectedProgramIds: [9, 10],
      quantityFocus: "both",
    };
    const qs = calculatorUrlQueryString(state);
    const decoded = decodeCalculatorUrl(new URLSearchParams(qs));
    expect(decoded.selectedProgramIds).toEqual([9, 10]);
  });

  it("round-trips mixed numeric and external program IDs", () => {
    const state: CalculatorUrlState = {
      ...baseCalcState,
      externalSources: [{ label: "srim", url: "https://example.com/srim.webdedx" }],
      isAdvancedMode: true,
      selectedProgramIds: [9, "ext:srim:srim-2013"],
      hiddenProgramIds: ["ext:srim:srim-2013"],
      quantityFocus: "both",
    };
    const qs = calculatorUrlQueryString(state);
    const decoded = decodeCalculatorUrl(new URLSearchParams(qs));
    expect(decoded.selectedProgramIds).toEqual([9, "ext:srim:srim-2013"]);
    expect(decoded.hiddenProgramIds).toEqual(["ext:srim:srim-2013"]);
  });

  it("ordinary duplicate non-extdata params use last-wins", () => {
    const raw = new URLSearchParams(
      "particle=1&particle=5&material=276&program=auto&energies=100&eunit=MeV",
    );
    const state = decodeCalculatorUrl(raw);
    // last occurrence wins
    expect(state.particleId).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Plot URL — mixed EntityId series round-trip
// ---------------------------------------------------------------------------

const basePlotInput: PlotUrlInput = {
  particleId: 1,
  materialId: 276,
  programId: -1,
  series: [],
  stpUnit: "keV/µm",
  xLog: true,
  yLog: true,
};

describe("Plot URL — mixed EntityId series round-trip", () => {
  it("round-trips numeric-only series", () => {
    const input: PlotUrlInput = {
      ...basePlotInput,
      series: [{ programId: 4, particleId: 1, materialId: 276 }],
    };
    const decoded = decodePlotUrl(encodePlotUrl(input));
    expect(decoded.series).toEqual([{ programId: 4, particleId: 1, materialId: 276 }]);
  });

  it("round-trips pure external series", () => {
    const input: PlotUrlInput = {
      ...basePlotInput,
      externalSources: [{ label: "srim", url: "https://example.com/srim.webdedx" }],
      series: [
        {
          programId: "ext:srim:srim-2013",
          particleId: "ext:srim:p",
          materialId: "ext:srim:water",
        },
      ],
    };
    const decoded = decodePlotUrl(encodePlotUrl(input));
    expect(decoded.externalSources).toEqual(input.externalSources);
    expect(decoded.series).toEqual([
      {
        programId: "ext:srim:srim-2013",
        particleId: "ext:srim:p",
        materialId: "ext:srim:water",
      },
    ]);
  });

  it("round-trips mixed built-in/external series", () => {
    const input: PlotUrlInput = {
      ...basePlotInput,
      externalSources: [{ label: "srim", url: "https://example.com/srim.webdedx" }],
      series: [
        { programId: 4, particleId: 1, materialId: 276 },
        { programId: "ext:srim:srim-2013", particleId: "ext:srim:p", materialId: 276 },
      ],
    };
    const params = encodePlotUrl(input);
    const decoded = decodePlotUrl(params);
    expect(decoded.externalSources).toEqual(input.externalSources);
    expect(decoded.series).toHaveLength(2);
    expect(decoded.series[0]).toEqual({ programId: 4, particleId: 1, materialId: 276 });
    expect(decoded.series[1]).toEqual({
      programId: "ext:srim:srim-2013",
      particleId: "ext:srim:p",
      materialId: 276,
    });
  });

  it("drops invalid triplets (wrong part count)", () => {
    const raw = new URLSearchParams(
      "series=4.1.276.extra,1.2.3&stp_unit=kev-um&xscale=log&yscale=log",
    );
    const decoded = decodePlotUrl(raw);
    // "4.1.276.extra" has 4 parts — dropped. "1.2.3" is valid.
    expect(decoded.series).toHaveLength(1);
    expect(decoded.series[0]).toEqual({ programId: 1, particleId: 2, materialId: 3 });
  });
});

describe("plotUrlQueryString — extdata ordering and encoding", () => {
  it("emits extdata before other params", () => {
    const input: PlotUrlInput = {
      ...basePlotInput,
      externalSources: [{ label: "srim", url: "https://example.com/srim.webdedx" }],
    };
    const qs = plotUrlQueryString(input);
    const keys = qs.split("&").map((p) => p.split("=")[0]);
    expect(keys[0]).toBe("extdata");
  });

  it("keeps https%3A in extdata value", () => {
    const input: PlotUrlInput = {
      ...basePlotInput,
      externalSources: [{ label: "srim", url: "https://example.com/srim.webdedx" }],
    };
    const qs = plotUrlQueryString(input);
    expect(qs).toContain("extdata=srim:https%3A");
  });

  it("round-trips extdata through plotUrlQueryString", () => {
    const sources: ExternalSourceDescriptor[] = [
      { label: "srim", url: "https://example.com/srim.webdedx" },
    ];
    const input: PlotUrlInput = { ...basePlotInput, externalSources: sources };
    const qs = plotUrlQueryString(input);
    const decoded = decodePlotUrl(new URLSearchParams(qs));
    expect(decoded.externalSources).toEqual(sources);
  });

  it("does not duplicate extdata when encodePlotUrl also contains sources", () => {
    const input: PlotUrlInput = {
      ...basePlotInput,
      externalSources: [{ label: "srim", url: "https://example.com/srim.webdedx" }],
    };
    const extdataCount = plotUrlQueryString(input)
      .split("&")
      .filter((part) => part.startsWith("extdata=")).length;
    expect(extdataCount).toBe(1);
  });
});
