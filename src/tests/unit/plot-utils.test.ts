import { describe, it, expect } from "vitest";
import {
  convertStpForDisplay,
  buildDrawOptions,
  computeAxisRanges,
  COLOR_PALETTE,
  PREVIEW_COLOR,
} from "$lib/utils/plot-utils";
import type { StpUnit } from "$lib/wasm/types";

describe("convertStpForDisplay", () => {
  it("converts to keV/µm correctly (density 1.0)", () => {
    expect(convertStpForDisplay([25], 1.0, "keV/µm")).toEqual([2.5]);
  });

  it("converts to keV/µm correctly (density 0.0012)", () => {
    expect(convertStpForDisplay([25], 0.0012, "keV/µm")).toEqual([0.003]);
  });

  it("converts to MeV/cm correctly (density 1.0)", () => {
    expect(convertStpForDisplay([25], 1.0, "MeV/cm")).toEqual([25.0]);
  });

  it("converts to MeV/cm correctly (density 0.0012)", () => {
    expect(convertStpForDisplay([25], 0.0012, "MeV/cm")).toEqual([0.03]);
  });

  it("returns mass STP unchanged for MeV·cm²/g", () => {
    expect(convertStpForDisplay([25], 1.0, "MeV·cm²/g")).toEqual([25]);
  });

  it("handles multiple values for MeV·cm²/g", () => {
    expect(convertStpForDisplay([10, 20], 2.0, "MeV·cm²/g")).toEqual([10, 20]);
  });

  it("returns empty array for empty input", () => {
    expect(convertStpForDisplay([], 1.0, "keV/µm")).toEqual([]);
  });
});

describe("buildDrawOptions", () => {
  it("returns log-log options when both axes are log", () => {
    expect(buildDrawOptions(true, true)).toBe("logx;logy;gridx;gridy;tickx;ticky");
  });

  it("returns linear x, log y options", () => {
    expect(buildDrawOptions(false, true)).toBe("logy;gridx;gridy;tickx;ticky");
  });

  it("returns log x, linear y options", () => {
    expect(buildDrawOptions(true, false)).toBe("logx;gridx;gridy;tickx;ticky");
  });

  it("returns fully linear options", () => {
    expect(buildDrawOptions(false, false)).toBe("gridx;gridy;tickx;ticky");
  });
});

describe("computeAxisRanges", () => {
  interface StubSeries {
    result: { energies: number[]; stoppingPowers: number[] };
    density: number;
    visible: boolean;
  }

  it("uses defaults when no series are visible", () => {
    const result = computeAxisRanges([], null, "keV/µm" as StpUnit);
    expect(result).toEqual({
      xMin: 0.001,
      xMax: 10000,
      yMin: 0.1,
      yMax: 1000,
    });
  });

  it("computes ranges from single visible series", () => {
    const series: StubSeries[] = [
      {
        result: { energies: [1, 10, 100], stoppingPowers: [5, 5, 5] },
        density: 1.0,
        visible: true,
      },
    ];
    const result = computeAxisRanges(series, null, "MeV·cm²/g" as StpUnit);
    expect(result).toEqual({
      xMin: 1,
      xMax: 100,
      yMin: 1,
      yMax: 10,
    });
  });

  it("excludes hidden series", () => {
    const series: StubSeries[] = [
      {
        result: { energies: [1, 100], stoppingPowers: [5, 5] },
        density: 1.0,
        visible: false,
      },
    ];
    const result = computeAxisRanges(series, null, "MeV·cm²/g" as StpUnit);
    expect(result).toEqual({
      xMin: 0.001,
      xMax: 10000,
      yMin: 0.1,
      yMax: 1000,
    });
  });
});

describe("COLOR_PALETTE and PREVIEW_COLOR", () => {
  it("has 9 colors in the palette", () => {
    expect(COLOR_PALETTE.length).toBe(9);
  });

  it("has correct first color (red)", () => {
    expect(COLOR_PALETTE[0]).toBe("#e41a1c");
  });

  it("has correct second color (blue)", () => {
    expect(COLOR_PALETTE[1]).toBe("#377eb8");
  });

  it("has black as PREVIEW_COLOR", () => {
    expect(PREVIEW_COLOR).toBe("#000000");
  });

  it("ensures all palette colors differ from PREVIEW_COLOR", () => {
    expect(COLOR_PALETTE.every((c) => c !== PREVIEW_COLOR)).toBe(true);
  });
});
