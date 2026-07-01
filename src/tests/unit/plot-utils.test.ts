import { describe, it, expect } from "vitest";
import {
  convertStpForDisplay,
  buildDrawOptions,
  computeAxisRanges,
  niceCeil,
  zoomRange,
  ZOOM_STEP_IN,
  ZOOM_STEP_OUT,
  isRangeZoomed,
  COLOR_PALETTE,
  PREVIEW_COLOR,
} from "$lib/utils/plot-utils";
import type { FrameZoomState } from "$lib/utils/plot-utils";
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

  it("uses a nice ceiling and zero floor for linear-Y", () => {
    const series: StubSeries[] = [
      {
        result: { energies: [1, 10, 100], stoppingPowers: [100, 2262, 50] },
        density: 1.0,
        visible: true,
      },
    ];
    const result = computeAxisRanges(series, null, "MeV·cm²/g" as StpUnit, { yLog: false });
    // ~2262 fills the plot at 2500 instead of jumping to 10000, with a 0 floor.
    expect(result.yMin).toBe(0);
    expect(result.yMax).toBe(2500);
  });

  it("keeps power-of-ten Y rounding when yLog is true", () => {
    const series: StubSeries[] = [
      {
        result: { energies: [1, 10, 100], stoppingPowers: [100, 2262, 50] },
        density: 1.0,
        visible: true,
      },
    ];
    const result = computeAxisRanges(series, null, "MeV·cm²/g" as StpUnit, { yLog: true });
    expect(result.yMax).toBe(10000);
  });

  it("re-ranges linear-Y down when the tallest series is hidden", () => {
    const series: StubSeries[] = [
      {
        result: { energies: [1, 10], stoppingPowers: [100, 2262] },
        density: 1.0,
        visible: false,
      },
      {
        result: { energies: [1, 10], stoppingPowers: [100, 420] },
        density: 1.0,
        visible: true,
      },
    ];
    const result = computeAxisRanges(series, null, "MeV·cm²/g" as StpUnit, { yLog: false });
    expect(result.yMax).toBe(500);
  });

  it("honours a manual yMax override over the nice ceiling", () => {
    const series: StubSeries[] = [
      {
        result: { energies: [1, 10, 100], stoppingPowers: [100, 2262, 50] },
        density: 1.0,
        visible: true,
      },
    ];
    const result = computeAxisRanges(series, null, "MeV·cm²/g" as StpUnit, {
      yLog: false,
      yMax: 3000,
      yMin: 10,
    });
    expect(result.yMax).toBe(3000);
    expect(result.yMin).toBe(10);
  });
});

describe("niceCeil", () => {
  it("rounds up to the next 1/2/2.5/5 ×10ⁿ", () => {
    expect(niceCeil(2262)).toBe(2500);
    expect(niceCeil(2500)).toBe(2500);
    expect(niceCeil(2501)).toBe(5000);
    expect(niceCeil(9999)).toBe(10000);
    expect(niceCeil(0.42)).toBe(0.5);
  });

  it("guards non-positive and non-finite inputs", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(Number.NaN)).toBe(1);
    expect(niceCeil(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("zoomRange", () => {
  it("zooming in keeps the linear centre and shrinks the span", () => {
    const r = zoomRange(0, 100, false, ZOOM_STEP_IN);
    expect((r.min + r.max) / 2).toBeCloseTo(50, 6);
    expect(r.max - r.min).toBeCloseTo(100 * ZOOM_STEP_IN, 6);
  });

  it("zooming out keeps the linear centre and grows the span", () => {
    const r = zoomRange(25, 75, false, ZOOM_STEP_OUT);
    expect((r.min + r.max) / 2).toBeCloseTo(50, 6);
    expect(r.max - r.min).toBeCloseTo(50 * ZOOM_STEP_OUT, 6);
  });

  it("interpolates in log space for log axes (geometric centre preserved)", () => {
    const r = zoomRange(1, 100, true, ZOOM_STEP_IN);
    // Geometric centre of [1, 100] is 10; log-space zoom keeps it.
    expect(Math.sqrt(r.min * r.max)).toBeCloseTo(10, 6);
    expect(r.min).toBeGreaterThan(1);
    expect(r.max).toBeLessThan(100);
  });

  it("falls back to linear interpolation when a log bound is non-positive", () => {
    const r = zoomRange(-10, 10, true, ZOOM_STEP_IN);
    expect((r.min + r.max) / 2).toBeCloseTo(0, 6);
  });

  it("zoom in then out by reciprocal steps round-trips to the original range", () => {
    const inR = zoomRange(0, 100, false, ZOOM_STEP_IN);
    const outR = zoomRange(inR.min, inR.max, false, ZOOM_STEP_OUT);
    expect(outR.min).toBeCloseTo(0, 6);
    expect(outR.max).toBeCloseTo(100, 6);
  });
});

describe("isRangeZoomed", () => {
  // Full data range shared by the cases below; scale_* overrides pick the view.
  const full = { xmin: 1, xmax: 100, ymin: 1, ymax: 1000 };
  const make = (over: Partial<FrameZoomState>): FrameZoomState => ({
    ...full,
    scale_xmin: full.xmin,
    scale_xmax: full.xmax,
    scale_ymin: full.ymin,
    scale_ymax: full.ymax,
    logx: 0,
    logy: 0,
    ...over,
  });

  it("is false when the displayed range equals the full range", () => {
    expect(isRangeZoomed(make({}))).toBe(false);
  });

  it("is true when zoomed on the x-axis only", () => {
    expect(isRangeZoomed(make({ scale_xmin: 5, scale_xmax: 50 }))).toBe(true);
  });

  it("is true when zoomed on the y-axis only", () => {
    expect(isRangeZoomed(make({ scale_ymin: 10, scale_ymax: 500 }))).toBe(true);
  });

  it("ignores float noise within the tolerance", () => {
    // A sub-0.01% wobble on a 99-wide span is not a real zoom.
    expect(isRangeZoomed(make({ scale_xmin: 1 + 1e-6, scale_xmax: 100 - 1e-6 }))).toBe(false);
  });

  it("detects a zoom into the low decade of a wide log axis", () => {
    // Linearly 0.001→0.01 is a tiny slice of a [0.001, 10000] span, but in log
    // space it is a full decade — the log-aware comparison must catch it.
    const logFull = {
      xmin: 0.001,
      xmax: 10000,
      ymin: 1,
      ymax: 1000,
      scale_xmin: 0.001,
      scale_xmax: 0.01,
      scale_ymin: 1,
      scale_ymax: 1000,
      logx: 1,
      logy: 1,
    };
    expect(isRangeZoomed(logFull)).toBe(true);
  });

  it("treats a half-initialised frame (non-finite fields) as not zoomed", () => {
    expect(isRangeZoomed(make({ scale_xmin: NaN, scale_xmax: NaN }))).toBe(false);
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
