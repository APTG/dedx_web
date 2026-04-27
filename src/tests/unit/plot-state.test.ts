import { describe, it, expect } from "vitest";
import { createPlotState } from "$lib/state/plot.svelte";
import type { CalculationResult, StpUnit } from "$lib/wasm/types";

const mockResult: CalculationResult = {
  energies: Array.from({ length: 500 }, (_, i) => Math.exp(i * 0.01)),
  stoppingPowers: Array.from({ length: 500 }, () => 5.0),
  csdaRanges: Array.from({ length: 500 }, () => 0.5),
};

const mockSeries = (
  overrides: Partial<{
    programId: number;
    particleId: number;
    materialId: number;
    programName: string;
    particleName: string;
    materialName: string;
    density: number;
  }> = {},
) => ({
  programId: 2,
  particleId: 1,
  materialId: 276,
  programName: "PSTAR",
  particleName: "Proton",
  materialName: "Water (liquid)",
  density: 1.0,
  result: mockResult,
  ...overrides,
});

describe("createPlotState", () => {
  it("has correct initial state", () => {
    const state = createPlotState();
    expect(state.series).toEqual([]);
    expect(state.preview).toBeNull();
    expect(state.stpUnit).toBe("keV/µm");
    expect(state.xLog).toBe(true);
    expect(state.yLog).toBe(true);
    expect(state.nextSeriesId).toBe(1);
  });

  it("addSeries appends with correct structure", () => {
    const state = createPlotState();
    const added = state.addSeries(mockSeries());
    expect(added).toBe(true);
    expect(state.series.length).toBe(1);
    expect(state.series[0].seriesId).toBe(1);
    expect(state.series[0].visible).toBe(true);
    expect(state.series[0].color).toBe("#e41a1c"); // palette index 0
    expect(state.nextSeriesId).toBe(2);
  });

  it("addSeries assigns sequential colors", () => {
    const state = createPlotState();
    state.addSeries(mockSeries());
    state.addSeries(mockSeries({ programId: 9 }));
    expect(state.series[1].color).toBe("#377eb8"); // palette index 1
  });

  it("addSeries detects duplicates", () => {
    const state = createPlotState();
    state.addSeries(mockSeries());
    const initial = state.series.length;
    const added = state.addSeries(mockSeries()); // same triplet
    expect(added).toBe(false);
    expect(state.series.length).toBe(initial);
  });

  it("removeSeries removes by seriesId", () => {
    const state = createPlotState();
    state.addSeries(mockSeries());
    const id = state.series[0].seriesId;
    state.removeSeries(id);
    expect(state.series.find((s) => s.seriesId === id)).toBeUndefined();
  });

  it("removeSeries releases color back to pool", () => {
    const state = createPlotState();
    state.addSeries(mockSeries()); // gets color index 0
    const sid0 = state.series[state.series.length - 1].seriesId;
    state.removeSeries(sid0);
    state.addSeries(mockSeries({ particleId: 6 })); // should get index 0 again
    expect(state.series[state.series.length - 1].color).toBe("#e41a1c");
  });

  it("toggleVisibility toggles visible flag", () => {
    const state = createPlotState();
    state.addSeries(mockSeries());
    const sid = state.series[0].seriesId;
    state.toggleVisibility(sid);
    expect(state.series.find((s) => s.seriesId === sid)?.visible).toBe(false);
    state.toggleVisibility(sid);
    expect(state.series.find((s) => s.seriesId === sid)?.visible).toBe(true);
  });

  it("setStpUnit changes unit", () => {
    const state = createPlotState();
    state.setStpUnit("MeV/cm" as StpUnit);
    expect(state.stpUnit).toBe("MeV/cm");
  });

  it("setAxisScale changes axis scale", () => {
    const state = createPlotState();
    state.setAxisScale("x", false);
    expect(state.xLog).toBe(false);
    state.setAxisScale("y", false);
    expect(state.yLog).toBe(false);
  });

  it("setPreview sets the preview series", () => {
    const state = createPlotState();
    state.setPreview({ ...mockSeries(), result: mockResult, density: 1.0 });
    expect(state.preview).not.toBeNull();
    state.clearPreview();
    expect(state.preview).toBeNull();
  });

  it("resetAll clears all series and resets state", () => {
    const state = createPlotState();
    state.addSeries(mockSeries());
    state.addSeries(mockSeries({ particleId: 6 }));
    state.resetAll();
    expect(state.series).toEqual([]);
    expect(state.preview).toBeNull();
    expect(state.stpUnit).toBe("keV/µm");
    expect(state.xLog).toBe(true);
    expect(state.yLog).toBe(true);
  });

  it("recomputes labels on add (single series → full label)", () => {
    const state = createPlotState();
    state.addSeries(mockSeries());
    expect(state.series[0].label).toBe("Proton in Water (liquid)");
  });

  it("recomputes labels on add (second series, only program varies)", () => {
    const state = createPlotState();
    state.addSeries(mockSeries());
    state.addSeries(mockSeries({ programId: 9, programName: "ICRU 90" }));
    expect(state.series[0].label).toBe("PSTAR");
    expect(state.series[1].label).toBe("ICRU 90");
  });

  it("recomputes labels on remove (back to single series → full label)", () => {
    const state = createPlotState();
    state.addSeries(mockSeries());
    state.addSeries(mockSeries({ programId: 9, programName: "ICRU 90" }));
    const s1id = state.series[0].seriesId;
    state.removeSeries(s1id);
    expect(state.series[0].label).toBe("Proton in Water (liquid)");
  });
});
