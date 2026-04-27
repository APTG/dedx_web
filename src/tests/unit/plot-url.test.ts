import { describe, it, expect } from "vitest";
import {
  encodePlotUrl,
  decodePlotUrl,
  stpUnitToToken,
  tokenToStpUnit,
} from "$lib/utils/plot-url";
import type { StpUnit } from "$lib/wasm/types";

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
    expect(params.get("series")).toBe("2.1.276,9.6.276");
    expect(params.get("stp_unit")).toBe("kev-um");
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
    expect(params.get("stp_unit")).toBe("mev-cm");
    expect(params.get("xscale")).toBe("lin");
    expect(params.get("yscale")).toBe("log");
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
});
