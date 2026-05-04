import { describe, test, expect, vi, beforeEach } from "vitest";
import type { PlotSeries } from "$lib/state/plot.svelte";
import * as pdfModule from "$lib/export/pdf";

// Mock jsPDF
vi.mock("jspdf", () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        internal: {
          pageSize: {
            getWidth: vi.fn().mockReturnValue(297),
            getHeight: vi.fn().mockReturnValue(210),
          },
        },
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        text: vi.fn(),
        textWithLink: vi.fn(),
        setDrawColor: vi.fn(),
        setLineWidth: vi.fn(),
        line: vi.fn(),
        addPage: vi.fn(),
        setPage: vi.fn(),
        save: vi.fn(),
        html: vi.fn(),
        addSvgAsImage: vi.fn(),
        addImage: vi.fn(),
        image: vi.fn(),
        getNumberOfPages: vi.fn().mockReturnValue(1),
        setTextColor: vi.fn(),
        setFillColor: vi.fn(),
        rect: vi.fn(),
      };
    }),
  };
});

// Mock browser APIs required by svgToPng (not available in jsdom).
// The mock Image triggers onload asynchronously so that svgToPng resolves,
// and the canvas mock returns a stable PNG data URL.
function setupSvgToPngMocks() {
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn().mockReturnValue("blob:mock-svg-url"),
    revokeObjectURL: vi.fn(),
  });

  const mockCtx = {
    fillStyle: "" as string,
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(mockCtx),
    toDataURL: vi.fn().mockReturnValue("data:image/png;base64,mockedpng"),
  };
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") return mockCanvas as unknown as HTMLElement;
    return document.createElement.wrappedMethod
      ? (document.createElement.wrappedMethod as typeof document.createElement)(tag)
      : document.createElement(tag);
  });

  // Image mock: triggers onload after the src setter is called.
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_url: string) {
      Promise.resolve().then(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", MockImage);
}

function makeMockSeries(options?: Partial<PlotSeries>): PlotSeries {
  return {
    seriesId: 1,
    programId: 0,
    particleId: 1,
    materialId: 1,
    programName: "ICRU 90",
    particleName: "Proton",
    materialName: "Water",
    density: 1.0,
    result: {
      energyPoints: [],
      stoppingPower: [],
      csdaRange: [],
    },
    label: "ICRU 90 — Proton in Water",
    color: "#FF0000",
    colorIndex: 0,
    visible: true,
    ...options,
  } as PlotSeries;
}

describe("generatePlotPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSvgToPngMocks();
  });

  test("calls jsPDF.save() with 'dedx_plot_report.pdf'", async () => {
    const svgString = '<svg width="100" height="100"><rect/></svg>';
    const series: PlotSeries[] = [
      makeMockSeries({ label: "ICRU 90 — Proton in Water", color: "#FF0000" }),
      makeMockSeries({
        seriesId: 2,
        label: "PSTAR — Proton in Water",
        color: "#00FF00",
      }),
    ];
    const url = "https://dedx.example.org/?particle=1&material=1";

    await pdfModule.generatePlotPdf({
      svgString,
      series,
      url,
      filename: "dedx_plot_report.pdf",
    });

    const { default: jsPDF } = await import("jspdf");
    const mockDoc = (jsPDF as any).mock.results[0].value;
    expect(mockDoc.save).toHaveBeenCalledWith("dedx_plot_report.pdf");
  });

  test("calls jsPDF.text() with 'dEdx Web' in header", async () => {
    const svgString = '<svg width="100" height="100"><rect/></svg>';
    const series: PlotSeries[] = [makeMockSeries()];
    const url = "https://dedx.example.org/?particle=1";

    await pdfModule.generatePlotPdf({
      svgString,
      series,
      url,
      filename: "dedx_plot_report.pdf",
    });

    const { default: jsPDF } = await import("jspdf");
    const mockDoc = (jsPDF as any).mock.results[0].value;
    const textCalls = mockDoc.text.mock.calls;
    const headerTexts = textCalls.slice(0, 5).flat().join(" ");
    expect(headerTexts).toContain("dEdx Web");
  });

  test("includes legend entries for each visible series with colour swatch and label", async () => {
    const svgString = "<svg/>";
    const series: PlotSeries[] = [
      makeMockSeries({ label: "Series One", color: "#FF0000", visible: true }),
      makeMockSeries({
        seriesId: 2,
        label: "Series Two",
        color: "#00FF00",
        visible: true,
      }),
      makeMockSeries({
        seriesId: 3,
        label: "Hidden Series",
        color: "#0000FF",
        visible: false,
      }),
    ];
    const url = "https://dedx.example.org/";

    await pdfModule.generatePlotPdf({
      svgString,
      series,
      url,
      filename: "dedx_plot_report.pdf",
    });

    const { default: jsPDF } = await import("jspdf");
    const mockDoc = (jsPDF as any).mock.results[0].value;
    const textCalls = mockDoc.text.mock.calls.map((c: any[]) => c[0]);

    // Should contain visible series labels in legend
    expect(textCalls).toContain("Series One");
    expect(textCalls).toContain("Series Two");
    // Should NOT contain hidden series label
    expect(textCalls).not.toContain("Hidden Series");

    // Should call rect() for colour swatches (once per visible series)
    const rectCalls = mockDoc.setFillColor ? mockDoc.setFillColor.mock.calls : [];
    // We expect at least 2 setFillColor calls for the 2 visible series
    expect(rectCalls.length).toBeGreaterThanOrEqual(2);
  });

  test("embeds SVG via addImage (not doc.html) to avoid oklch crash", async () => {
    const svgString = '<svg class="plot"><rect/></svg>';
    const series: PlotSeries[] = [makeMockSeries()];
    const url = "https://dedx.example.org/";

    await pdfModule.generatePlotPdf({
      svgString,
      series,
      url,
      filename: "dedx_plot_report.pdf",
    });

    const { default: jsPDF } = await import("jspdf");
    const mockDoc = (jsPDF as any).mock.results[0].value;

    // Must use addImage (canvas-based PNG), never doc.html() which triggers
    // html2canvas and crashes on oklch colors from Tailwind CSS v4.
    expect(mockDoc.addImage).toHaveBeenCalled();
    expect(mockDoc.html).not.toHaveBeenCalled();
  });

  test("svgToPng returns a PNG data URL for a valid SVG string", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect/></svg>';
    const result = await pdfModule.svgToPng(svg, 100, 50);
    // The mock canvas returns a stable base64 PNG URL
    expect(result).toBe("data:image/png;base64,mockedpng");
  });

  test("svgToPng returns null when canvas context is unavailable", async () => {
    // Override the canvas mock to return null context for this test
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(null),
          toDataURL: vi.fn(),
        } as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    const svg = "<svg/>";
    const result = await pdfModule.svgToPng(svg, 100, 50);
    expect(result).toBeNull();
  });

  test("includes page number footer", async () => {
    const svgString = "<svg/>";
    const series: PlotSeries[] = [makeMockSeries()];
    const url = "https://dedx.example.org/";

    await pdfModule.generatePlotPdf({
      svgString,
      series,
      url,
      filename: "dedx_plot_report.pdf",
    });

    const { default: jsPDF } = await import("jspdf");
    const mockDoc = (jsPDF as any).mock.results[0].value;
    const textCalls = mockDoc.text.mock.calls.map((c: any[]) => c[0]);
    const pageFooterTexts = textCalls.filter((t: string) => t && t.includes("Page"));

    expect(pageFooterTexts.length).toBeGreaterThan(0);
    expect(pageFooterTexts[0]).toMatch(/Page \d+ \/ \d+/);
  });

  test("includes ISO 8601 UTC timestamp in header", async () => {
    const svgString = "<svg/>";
    const series: PlotSeries[] = [makeMockSeries()];
    const url = "https://dedx.example.org/";

    await pdfModule.generatePlotPdf({
      svgString,
      series,
      url,
      filename: "dedx_plot_report.pdf",
    });

    const { default: jsPDF } = await import("jspdf");
    const mockDoc = (jsPDF as any).mock.results[0].value;
    const textCalls = mockDoc.text.mock.calls.map((c: any[]) => c[0]);
    const headerTexts = textCalls.slice(0, 5).flat().join(" ");

    // Should contain a timestamp in ISO 8601 format (contains 'T' and 'Z')
    expect(headerTexts).toMatch(/Generated:.*T.*Z/);
  });

  test("includes clickable URL in header", async () => {
    const svgString = "<svg/>";
    const series: PlotSeries[] = [makeMockSeries()];
    const url = "https://dedx.example.org/?particle=1&material=1";

    await pdfModule.generatePlotPdf({
      svgString,
      series,
      url,
      filename: "dedx_plot_report.pdf",
    });

    const { default: jsPDF } = await import("jspdf");
    const mockDoc = (jsPDF as any).mock.results[0].value;
    expect(mockDoc.textWithLink).toHaveBeenCalledWith(
      url,
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ url }),
    );
  });

  test("uses landscape orientation", async () => {
    const svgString = "<svg/>";
    const series: PlotSeries[] = [makeMockSeries()];
    const url = "https://dedx.example.org/";

    await pdfModule.generatePlotPdf({
      svgString,
      series,
      url,
      filename: "dedx_plot_report.pdf",
    });

    const { default: jsPDF } = await import("jspdf");
    // Verify jsPDF was called with landscape orientation
    expect(jsPDF).toHaveBeenCalledWith(expect.objectContaining({ orientation: "landscape" }));
  });
});
