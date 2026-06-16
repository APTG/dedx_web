import { describe, it, expect } from "vitest";
import { encodePlotUrl, decodePlotUrl, stpUnitToToken, tokenToStpUnit } from "$lib/utils/plot-url";
import type { StpUnit, AdvancedOptions } from "$lib/wasm/types";

describe("stpUnitToToken / tokenToStpUnit", () => {
  it("converts keV/µm to kev-um", () => {
    expect(stpUnitToToken("keV/µm")).toBe("kev-um");
  });

  it("converts MeV/cm to mev-cm", () => {
    expect(stpUnitToToken("MeV/cm")).toBe("mev-cm");
  });

  it("converts MeV·cm²/g to mev-cm2-g", () => {
    expect(stpUnitToToken("MeV·cm²/g")).toBe("mev-cm2-g");
  });

  it("converts kev-um token back to keV/µm", () => {
    expect(tokenToStpUnit("kev-um")).toBe("keV/µm");
  });

  it("converts mev-cm token back to MeV/cm", () => {
    expect(tokenToStpUnit("mev-cm")).toBe("MeV/cm");
  });

  it("converts mev-cm2-g token back to MeV·cm²/g", () => {
    expect(tokenToStpUnit("mev-cm2-g")).toBe("MeV·cm²/g");
  });

  it("returns default keV/µm for invalid token", () => {
    expect(tokenToStpUnit("invalid")).toBe("keV/µm");
  });

  it("returns default keV/µm for empty token", () => {
    expect(tokenToStpUnit("")).toBe("keV/µm");
  });
});

describe("encodePlotUrl", () => {
  it("encodes full state with auto program", () => {
    const input = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [
        { programId: 2, particleId: 1, materialId: 276 },
        { programId: 9, particleId: 6, materialId: 276 },
      ],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
    };
    const params = encodePlotUrl(input);
    expect(params.get("particle")).toBe("1");
    expect(params.get("material")).toBe("276");
    expect(params.get("program")).toBe("auto");
    expect(params.get("series")).toBe("2.1.276~9.6.276");
    expect(params.get("sunit")).toBe("kev-um");
    expect(params.get("xscale")).toBe("log");
    expect(params.get("yscale")).toBe("log");
  });

  it("encodes explicit program ID", () => {
    const input = {
      particleId: 1,
      materialId: 276,
      programId: 2,
      series: [],
      stpUnit: "MeV/cm" as StpUnit,
      xLog: false,
      yLog: true,
    };
    const params = encodePlotUrl(input);
    expect(params.get("program")).toBe("2");
    expect(params.get("sunit")).toBe("mev-cm");
    expect(params.get("xscale")).toBe("lin");
    expect(params.get("yscale")).toBe("log");
  });

  it("encodes inv_stp_branch=both when requested", () => {
    const input = {
      particleId: 1,
      materialId: 276,
      programId: 2,
      series: [],
      stpUnit: "MeV/cm" as StpUnit,
      xLog: false,
      yLog: true,
      invStpBranch: "both" as const,
    };
    const params = encodePlotUrl(input);
    expect(params.get("inv_stp_branch")).toBe("both");
  });

  it("omits series param when empty", () => {
    const input = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
    };
    const params = encodePlotUrl(input);
    expect(params.has("series")).toBe(false);
  });

  it("handles null particleId and materialId", () => {
    const input = {
      particleId: null,
      materialId: null,
      programId: -1,
      series: [],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
    };
    const params = encodePlotUrl(input);
    expect(params.has("particle")).toBe(false);
    expect(params.has("material")).toBe(false);
  });
});

describe("decodePlotUrl", () => {
  it("decodes full state with auto program", () => {
    const sp = new URLSearchParams(
      "particle=1&material=276&program=auto&series=2.1.276,9.6.276&stp_unit=kev-um&xscale=log&yscale=lin",
    );
    const decoded = decodePlotUrl(sp);
    expect(decoded.particleId).toBe(1);
    expect(decoded.materialId).toBe(276);
    expect(decoded.programId).toBe(-1);
    expect(decoded.series).toHaveLength(2);
    expect(decoded.series[0]).toEqual({
      programId: 2,
      particleId: 1,
      materialId: 276,
    });
    expect(decoded.series[1]).toEqual({
      programId: 9,
      particleId: 6,
      materialId: 276,
    });
    expect(decoded.stpUnit).toBe("keV/µm");
    expect(decoded.xLog).toBe(true);
    expect(decoded.yLog).toBe(false);
  });

  it("decodes explicit program ID", () => {
    const sp = new URLSearchParams("program=2");
    const decoded = decodePlotUrl(sp);
    expect(decoded.programId).toBe(2);
  });

  it("decodes the shared sunit param", () => {
    const decoded = decodePlotUrl(new URLSearchParams("program=2&sunit=mev-cm2-g"));
    expect(decoded.stpUnit).toBe("MeV·cm²/g");
  });

  it("falls back to the legacy stp_unit param", () => {
    const decoded = decodePlotUrl(new URLSearchParams("program=2&stp_unit=mev-cm"));
    expect(decoded.stpUnit).toBe("MeV/cm");
  });

  it("prefers sunit over a legacy stp_unit when both are present", () => {
    const decoded = decodePlotUrl(new URLSearchParams("program=2&sunit=mev-cm2-g&stp_unit=kev-um"));
    expect(decoded.stpUnit).toBe("MeV·cm²/g");
  });

  it("decodes inv_stp_branch=both", () => {
    const sp = new URLSearchParams("program=2&inv_stp_branch=both");
    const decoded = decodePlotUrl(sp);
    expect(decoded.invStpBranch).toBe("both");
  });

  it("uses defaults for empty params", () => {
    const sp = new URLSearchParams("");
    const decoded = decodePlotUrl(sp);
    expect(decoded.particleId).toBe(null);
    expect(decoded.materialId).toBe(null);
    expect(decoded.programId).toBe(-1);
    expect(decoded.series).toEqual([]);
    expect(decoded.stpUnit).toBe("keV/µm");
    expect(decoded.xLog).toBe(true);
    expect(decoded.yLog).toBe(true);
  });

  it("silently drops invalid series triplets", () => {
    const sp = new URLSearchParams("series=2.1.276,invalid,9.6.276");
    const decoded = decodePlotUrl(sp);
    expect(decoded.series).toHaveLength(2);
    expect(decoded.series[0]).toEqual({
      programId: 2,
      particleId: 1,
      materialId: 276,
    });
    expect(decoded.series[1]).toEqual({
      programId: 9,
      particleId: 6,
      materialId: 276,
    });
  });

  it("handles missing particle/material", () => {
    const sp = new URLSearchParams("program=auto");
    const decoded = decodePlotUrl(sp);
    expect(decoded.particleId).toBe(null);
    expect(decoded.materialId).toBe(null);
  });

  it("handles lin scale values", () => {
    const sp = new URLSearchParams("xscale=lin&yscale=lin");
    const decoded = decodePlotUrl(sp);
    expect(decoded.xLog).toBe(false);
    expect(decoded.yLog).toBe(false);
  });

  it("treats non-numeric particle/material as null", () => {
    const sp = new URLSearchParams("particle=abc&material=foo");
    const decoded = decodePlotUrl(sp);
    expect(decoded.particleId).toBe(null);
    expect(decoded.materialId).toBe(null);
  });

  it("falls back to -1 (auto) for non-numeric program", () => {
    const sp = new URLSearchParams("program=bogus");
    const decoded = decodePlotUrl(sp);
    expect(decoded.programId).toBe(-1);
  });
});

describe("encodePlotUrl with advanced options", () => {
  it("encodes advanced options when provided", () => {
    const advancedOpts: AdvancedOptions = {
      aggregateState: "gas",
      interpolation: { scale: "linear", method: "cubic" },
      mstarMode: "c",
      densityOverride: 1.5,
      iValueOverride: 75,
    };
    const input = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
      advancedOptions: advancedOpts,
    };
    const params = encodePlotUrl(input);
    expect(params.get("agg_state")).toBe("gas");
    expect(params.get("interp_scale")).toBe("lin-lin");
    expect(params.get("interp_method")).toBe("spline");
    expect(params.get("mstar_mode")).toBe("c");
    expect(params.get("density")).toBe("1.5");
    expect(params.get("ival")).toBe("75");
  });

  it("omits default advanced option values", () => {
    const advancedOpts: AdvancedOptions = {
      aggregateState: "condensed",
      interpolation: { scale: "log", method: "linear" },
      mstarMode: "b",
    };
    const input = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
      advancedOptions: advancedOpts,
    };
    const params = encodePlotUrl(input);
    // "condensed" is default for condensed materials, "log" is default scale, "linear" is default method, "b" is default mstarMode
    // However the encode function encodes aggregateState regardless of default - checking what actually gets encoded
    expect(params.get("agg_state")).toBe("condensed");
    expect(params.get("interp_scale")).toBeNull();
    expect(params.get("interp_method")).toBeNull();
    expect(params.get("mstar_mode")).toBeNull();
  });

  it("omits advancedOptions param entirely when empty object", () => {
    const input = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
      advancedOptions: {},
    };
    const params = encodePlotUrl(input);
    expect(params.has("agg_state")).toBe(false);
    expect(params.has("interp_scale")).toBe(false);
    expect(params.has("interp_method")).toBe(false);
    expect(params.has("mstar_mode")).toBe(false);
    expect(params.has("density")).toBe(false);
    expect(params.has("ival")).toBe(false);
  });
});

describe("decodePlotUrl with advanced options", () => {
  it("decodes all advanced options", () => {
    const sp = new URLSearchParams(
      "particle=1&material=276&program=auto&series=2.1.276" +
        "&stp_unit=kev-um&xscale=log&yscale=log" +
        "&agg_state=gas&interp_scale=lin-lin&interp_method=spline" +
        "&mstar_mode=c&density=1.5&ival=75",
    );
    const decoded = decodePlotUrl(sp);
    expect(decoded.advancedOptions.aggregateState).toBe("gas");
    expect(decoded.advancedOptions.interpolation?.scale).toBe("linear");
    expect(decoded.advancedOptions.interpolation?.method).toBe("cubic");
    expect(decoded.advancedOptions.mstarMode).toBe("c");
    expect(decoded.advancedOptions.densityOverride).toBe(1.5);
    expect(decoded.advancedOptions.iValueOverride).toBe(75);
  });

  it("returns empty advancedOptions when no params present", () => {
    const sp = new URLSearchParams("particle=1&material=276&program=auto");
    const decoded = decodePlotUrl(sp);
    expect(decoded.advancedOptions).toEqual({});
  });

  it("decodes only some advanced options when partially present", () => {
    const sp = new URLSearchParams("agg_state=gas&density=2.5");
    const decoded = decodePlotUrl(sp);
    expect(decoded.advancedOptions.aggregateState).toBe("gas");
    expect(decoded.advancedOptions.densityOverride).toBe(2.5);
    expect(decoded.advancedOptions.interpolation).toBeUndefined();
    expect(decoded.advancedOptions.mstarMode).toBeUndefined();
    expect(decoded.advancedOptions.iValueOverride).toBeUndefined();
  });

  it("ignores invalid density values", () => {
    const sp = new URLSearchParams("density=-5&agg_state=gas");
    const decoded = decodePlotUrl(sp);
    expect(decoded.advancedOptions.densityOverride).toBeUndefined();
    expect(decoded.advancedOptions.aggregateState).toBe("gas");
  });

  it("ignores invalid i-value (exceeds 10000)", () => {
    const sp = new URLSearchParams("ival=15000&density=1.0");
    const decoded = decodePlotUrl(sp);
    expect(decoded.advancedOptions.iValueOverride).toBeUndefined();
    expect(decoded.advancedOptions.densityOverride).toBe(1.0);
  });

  it("decodes lin-lin scale correctly", () => {
    const sp = new URLSearchParams("interp_scale=lin-lin");
    const decoded = decodePlotUrl(sp);
    expect(decoded.advancedOptions.interpolation?.scale).toBe("linear");
  });

  it("ignores default mstar_mode=b", () => {
    const sp = new URLSearchParams("mstar_mode=b");
    const decoded = decodePlotUrl(sp);
    expect(decoded.advancedOptions.mstarMode).toBeUndefined();
  });

  it("decodes all valid mstar modes except default b", () => {
    const modes: Array<{ param: string; expected: "a" | "c" | "d" | "g" | "h" }> = [
      { param: "a", expected: "a" },
      { param: "c", expected: "c" },
      { param: "d", expected: "d" },
      { param: "g", expected: "g" },
      { param: "h", expected: "h" },
    ];
    for (const { param, expected } of modes) {
      const sp = new URLSearchParams(`mstar_mode=${param}`);
      const decoded = decodePlotUrl(sp);
      expect(decoded.advancedOptions.mstarMode).toBe(expected);
    }
  });
});

describe("round-trip encoding/decoding with advanced options", () => {
  it("round-trips all parameters including advanced options", () => {
    const input = {
      particleId: 6,
      materialId: 276,
      programId: 9,
      series: [
        { programId: 2, particleId: 1, materialId: 276 },
        { programId: 9, particleId: 6, materialId: 276 },
      ],
      stpUnit: "MeV·cm²/g" as StpUnit,
      xLog: false,
      yLog: true,
      advancedOptions: {
        aggregateState: "gas",
        interpolation: { scale: "linear", method: "cubic" },
        mstarMode: "d",
        densityOverride: 0.85,
        iValueOverride: 120,
      } as AdvancedOptions,
    };

    const encoded = encodePlotUrl(input);
    const decoded = decodePlotUrl(encoded);

    expect(decoded.particleId).toBe(input.particleId);
    expect(decoded.materialId).toBe(input.materialId);
    expect(decoded.programId).toBe(input.programId);
    expect(decoded.series).toEqual(input.series);
    expect(decoded.stpUnit).toBe(input.stpUnit);
    expect(decoded.xLog).toBe(input.xLog);
    expect(decoded.yLog).toBe(input.yLog);
    expect(decoded.advancedOptions).toEqual(input.advancedOptions);
  });

  it("round-trips with empty advanced options", () => {
    const input = {
      particleId: 1,
      materialId: 276,
      programId: -1,
      series: [],
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
      advancedOptions: {},
    };

    const encoded = encodePlotUrl(input);
    const decoded = decodePlotUrl(encoded);

    expect(decoded.particleId).toBe(input.particleId);
    expect(decoded.materialId).toBe(input.materialId);
    expect(decoded.programId).toBe(input.programId);
    expect(decoded.series).toEqual(input.series);
    expect(decoded.stpUnit).toBe(input.stpUnit);
    expect(decoded.xLog).toBe(input.xLog);
    expect(decoded.yLog).toBe(input.yLog);
    expect(decoded.advancedOptions).toEqual({});
  });
});
