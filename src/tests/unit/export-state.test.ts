import { describe, test, expect, beforeEach, vi } from "vitest";
import type { PlotSeries } from "$lib/state/plot.svelte";

// Module-level mocks for dynamic imports used by exportPlotCsv / exportPlotPdf
vi.mock("$lib/export/plot-csv", () => ({
  downloadPlotCsv: vi.fn(),
}));

vi.mock("$lib/export/pdf", () => ({
  generatePlotPdf: vi.fn().mockResolvedValue(undefined),
  buildPdfFilename: vi.fn().mockReturnValue("test.pdf"),
}));

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

describe("exportPlotCsv", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("calls downloadPlotCsv with series and stpUnit when initialized", async () => {
    const { downloadPlotCsv } = await import("$lib/export/plot-csv");
    const exportModule = await import("$lib/state/export.svelte");

    const plotState = {
      series: [makeMockSeries(1, 1, 1, true)],
      stpUnit: "MeV/cm" as const,
    };
    // getSvg is required by initPlotExportState but unused by the CSV path
    exportModule.initPlotExportState(plotState, () => Promise.resolve(null));
    exportModule.exportPlotCsv();

    await vi.waitFor(() => expect(downloadPlotCsv).toHaveBeenCalledOnce());
    expect(downloadPlotCsv).toHaveBeenCalledWith(plotState.series, "MeV/cm");
  });

  test("does nothing when plot state is not initialized", async () => {
    const { downloadPlotCsv } = await import("$lib/export/plot-csv");
    const exportModule = await import("$lib/state/export.svelte");

    // No initPlotExportState call — _plotState remains null; function returns sync
    exportModule.exportPlotCsv();

    expect(downloadPlotCsv).not.toHaveBeenCalled();
  });
});

describe("exportPlotPdf", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("calls generatePlotPdf with svgString and series when getSvg returns a string", async () => {
    const { generatePlotPdf } = await import("$lib/export/pdf");
    const exportModule = await import("$lib/state/export.svelte");

    const testSvg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const plotState = {
      series: [makeMockSeries(1, 1, 1, true)],
      stpUnit: "keV/µm" as const,
    };
    const getSvg = vi.fn().mockResolvedValue(testSvg);

    exportModule.initPlotExportState(plotState, getSvg);
    exportModule.exportPlotPdf();

    await vi.waitFor(() => expect(generatePlotPdf).toHaveBeenCalledOnce());
    expect(generatePlotPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        svgString: testSvg,
        series: plotState.series,
        // exportPlotPdf hardcodes this filename; assert it's forwarded as-is
        filename: "dedx_plot_report.pdf",
      }),
    );
  });

  test("does not call generatePlotPdf when getSvg returns null", async () => {
    const { generatePlotPdf } = await import("$lib/export/pdf");
    const exportModule = await import("$lib/state/export.svelte");

    const plotState = {
      series: [makeMockSeries(1, 1, 1, true)],
      stpUnit: "keV/µm" as const,
    };
    const getSvg = vi.fn().mockResolvedValue(null);

    exportModule.initPlotExportState(plotState, getSvg);
    exportModule.exportPlotPdf();

    // Wait for getSvg to be called, then assert generatePlotPdf was never invoked
    await vi.waitFor(() => expect(getSvg).toHaveBeenCalledOnce());
    expect(generatePlotPdf).not.toHaveBeenCalled();
  });

  test("does nothing when plot state is not initialized", async () => {
    const { generatePlotPdf } = await import("$lib/export/pdf");
    const exportModule = await import("$lib/state/export.svelte");

    // No initPlotExportState call — returns sync before any async operation
    exportModule.exportPlotPdf();

    expect(generatePlotPdf).not.toHaveBeenCalled();
  });
});
