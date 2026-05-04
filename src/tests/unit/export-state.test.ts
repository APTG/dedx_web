import { describe, test, expect, beforeEach, vi } from "vitest";
import type { PlotSeries } from "$lib/state/plot.svelte";

function makeMockSeries(
  programId: number,
  particleId: number,
  materialId: number,
  visible: boolean,
  pointCount: number = 10,
): PlotSeries {
  return {
    seriesId: 1,
    programId,
    particleId,
    materialId,
    programName: `Program${programId}`,
    particleName: "Proton",
    materialName: "Water",
    density: 1.0,
    visible,
    label: "Test Series",
    color: "#000000",
    colorIndex: 0,
    result: {
      energies: new Array(pointCount).fill(0).map((_, i) => i * 0.1),
      stoppingPowers: new Array(pointCount).fill(0).map((_, i) => i * 10),
      csdaRanges: new Array(pointCount).fill(0).map((_, i) => i * 0.01),
    },
  };
}

describe("initPlotExportState", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("canExport.value === true when state has one visible series", async () => {
    const mockPlotState = {
      series: [makeMockSeries(1, 1, 1, true)],
      stpUnit: "keV/µm" as const,
    };

    const exportModule = await import("$lib/state/export.svelte");
    exportModule.initPlotExportState(mockPlotState, () => Promise.resolve(null));

    expect(exportModule.canExport.value).toBe(true);
  });

  test("canExport.value === false when no visible series exist", async () => {
    const mockPlotState = {
      series: [makeMockSeries(1, 1, 1, false)],
      stpUnit: "keV/µm" as const,
    };

    const exportModule = await import("$lib/state/export.svelte");
    exportModule.initPlotExportState(mockPlotState, () => Promise.resolve(null));

    expect(exportModule.canExport.value).toBe(false);
  });

  test("canExport.value === false when series array is empty", async () => {
    const mockPlotState = {
      series: [],
      stpUnit: "keV/µm" as const,
    };

    const exportModule = await import("$lib/state/export.svelte");
    exportModule.initPlotExportState(mockPlotState, () => Promise.resolve(null));

    expect(exportModule.canExport.value).toBe(false);
  });

  test("canExport.value === true when at least one series is visible among many", async () => {
    const mockPlotState = {
      series: [
        makeMockSeries(1, 1, 1, false),
        makeMockSeries(2, 1, 1, true),
        makeMockSeries(3, 1, 1, false),
      ],
      stpUnit: "keV/µm" as const,
    };

    const exportModule = await import("$lib/state/export.svelte");
    exportModule.initPlotExportState(mockPlotState, () => Promise.resolve(null));

    expect(exportModule.canExport.value).toBe(true);
  });
});
