import { render, screen, cleanup } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

// $app/paths: base is empty string in tests (no sub-path deployment)
vi.mock("$app/paths", () => ({ base: "" }));

// jsdom polyfills for matchMedia and ResizeObserver; also pre-populate
// globalThis.JSROOT so getJsroot() returns the mock immediately without
// trying to inject a <script> tag (which jsdom cannot execute).
beforeAll(async () => {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  }

  if (!global.ResizeObserver) {
    global.ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof ResizeObserver;
  }

  // vi.mock("jsroot") is hoisted above this beforeAll, so import("jsroot")
  // returns the mock object — assign it so getJsroot() short-circuits.
  (globalThis as Record<string, unknown>).JSROOT = await import("jsroot");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("jsroot", () => ({
  settings: {
    ZoomWheel: true,
    ZoomTouch: true,
    DragGraphs: true,
    ToolBar: "popup",
    ContextMenu: true,
  },
  gStyle: { fPadLeftMargin: 0.1, fPadBottomMargin: 0.1 },
  createTGraph: vi.fn((_n: number, _x: number[], _y: number[]) => ({
    fLineColor: 1,
    fLineWidth: 2,
    fLineStyle: 1,
    fTitle: "",
    InvertBit: vi.fn(),
  })),
  createTMultiGraph: vi.fn((..._graphs: unknown[]) => ({
    fGraphs: { Add: vi.fn() },
    fFunctions: { arr: [] as unknown[], opt: [] as string[], Add: vi.fn() },
    fHistogram: null,
    fTitle: "",
  })),
  create: vi.fn((typename: string) => {
    if (typename === "TLegend") return { fPrimitives: { arr: [], opt: [] } };
    if (typename === "TList") return { arr: [], opt: [], Add: vi.fn() };
    return {};
  }),
  createHistogram: vi.fn(() => ({
    fXaxis: { fTitle: "", fXmin: 0, fXmax: 1, InvertBit: vi.fn() },
    fYaxis: { fTitle: "", InvertBit: vi.fn() },
    fMinimum: 0,
    fMaximum: 1,
    fTitle: "",
  })),
  draw: vi.fn(async () => ({ cleanup: vi.fn() })),
  BIT: vi.fn((n: number) => n),
  resize: vi.fn(),
  cleanup: vi.fn(),
}));

import JsrootPlot from "$lib/components/jsroot-plot.svelte";
import type { PlotSeries } from "$lib/state/plot.svelte";
import type { StpUnit } from "$lib/wasm/types";

const ALPHA_MASS_NUMBER = 4;

function makeSeries(overrides: Partial<PlotSeries>): PlotSeries {
  return {
    seriesId: 1,
    programId: 1,
    particleId: 1,
    materialId: 1,
    programName: "ICRU 90",
    particleName: "p",
    particleMassNumber: 1,
    materialName: "Water",
    density: 1,
    result: {
      energies: [1, 2],
      stoppingPowers: [10, 20],
      csdaRanges: [1, 1],
    },
    label: "ICRU 90 — p in Water",
    color: "#ff0000",
    colorIndex: 0,
    visible: true,
    ...overrides,
  };
}

describe("JsrootPlot", () => {
  it("renders a container div", () => {
    render(JsrootPlot, {
      props: {
        series: [],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
      },
    });
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("shows loading text initially", async () => {
    const { container } = render(JsrootPlot, {
      props: {
        series: [],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
      },
    });
    expect(container.textContent).toContain("Loading plot engine");
  });

  it("calls JSROOT.draw after mount when series data is present", async () => {
    const JSROOT = await import("jsroot");
    render(JsrootPlot, {
      props: {
        series: [makeSeries({})],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
      },
    });
    await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());
  });

  it("does NOT call JSROOT.draw when series is empty and preview is null (ObjectPainter guard)", async () => {
    const JSROOT = await import("jsroot");
    render(JsrootPlot, {
      props: {
        series: [],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
      },
    });
    // Give the effect queue time to flush — JSROOT.draw must NOT be called.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(JSROOT.draw).not.toHaveBeenCalled();
  });

  it("draws framed axes (not the loading placeholder) when every series is hidden (#812 follow-up)", async () => {
    const JSROOT = await import("jsroot");
    const { container } = render(JsrootPlot, {
      props: {
        series: [makeSeries({ visible: false })],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
      },
    });
    // The series is hidden but still configured with real data, so the plot
    // draws an empty framed canvas instead of collapsing to "Loading plot
    // engine…".
    await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());
    await vi.waitFor(() => expect(container.textContent).not.toContain("Loading plot engine"));
  });

  it("has aria-label describing the plot", () => {
    render(JsrootPlot, {
      props: {
        series: [],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
      },
    });
    const canvas = screen.getByRole("img");
    expect(canvas.getAttribute("aria-label")).toContain("Stopping power");
  });

  it("applies the axis title offsets so titles clear their tick labels (#795)", async () => {
    const JSROOT = await import("jsroot");
    const { AXIS_X_TITLE_OFFSET, AXIS_Y_TITLE_OFFSET } = await import("$lib/utils/plot-utils");
    render(JsrootPlot, {
      props: {
        series: [makeSeries({})],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: false,
        axisRanges: { xMin: 1, xMax: 2, yMin: 0, yMax: 2500 },
      },
    });

    await vi.waitFor(() => {
      const hist = vi.mocked(JSROOT.createHistogram).mock.results.at(-1)?.value as {
        fXaxis: { fTitleOffset: number };
        fYaxis: { fTitleOffset: number };
      };
      expect(hist.fXaxis.fTitleOffset).toBe(AXIS_X_TITLE_OFFSET);
      expect(hist.fYaxis.fTitleOffset).toBe(AXIS_Y_TITLE_OFFSET);
    });
  });

  it("widens the pad margins so the pushed-out titles are not clipped (#801 follow-up)", async () => {
    const JSROOT = await import("jsroot");
    const { PAD_LEFT_MARGIN, PAD_BOTTOM_MARGIN } = await import("$lib/utils/plot-utils");
    const gStyle = (JSROOT as unknown as { gStyle: Record<string, number> }).gStyle;
    render(JsrootPlot, {
      props: {
        series: [makeSeries({})],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: false,
        axisRanges: { xMin: 1, xMax: 2, yMin: 0, yMax: 2500 },
      },
    });

    // Margins are applied via gStyle before the draw and stay set while the
    // plot is mounted (restored only on teardown), so the pad reads them.
    await vi.waitFor(() => {
      expect(JSROOT.draw).toHaveBeenCalled();
      expect(gStyle.fPadLeftMargin).toBe(PAD_LEFT_MARGIN);
      expect(gStyle.fPadBottomMargin).toBe(PAD_BOTTOM_MARGIN);
    });
  });

  it("uses MeV for proton-only energy axis", async () => {
    const JSROOT = await import("jsroot");
    render(JsrootPlot, {
      props: {
        series: [makeSeries({ particleId: 1, particleMassNumber: 1 })],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 1, xMax: 2, yMin: 1, yMax: 100 },
      },
    });

    await vi.waitFor(() => {
      const hist = vi.mocked(JSROOT.createHistogram).mock.results.at(-1)?.value as {
        fXaxis: { fTitle: string };
      };
      expect(hist.fXaxis.fTitle).toBe("Energy [MeV]");
    });
  });

  it("uses MeV/nucl for mixed proton and heavy-ion energy axis", async () => {
    const JSROOT = await import("jsroot");
    render(JsrootPlot, {
      props: {
        series: [
          makeSeries({ particleId: 1, particleName: "p", particleMassNumber: 1 }),
          makeSeries({
            seriesId: 2,
            particleId: 2,
            particleName: "α",
            particleMassNumber: ALPHA_MASS_NUMBER,
          }),
        ],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 1, xMax: 2, yMin: 1, yMax: 100 },
      },
    });

    await vi.waitFor(() => {
      const hist = vi.mocked(JSROOT.createHistogram).mock.results.at(-1)?.value as {
        fXaxis: { fTitle: string };
      };
      expect(hist.fXaxis.fTitle).toBe("Energy [MeV/nucl]");
    });
  });

  it("uses MeV and total heavy-ion energies when an electron series is visible", async () => {
    const JSROOT = await import("jsroot");
    render(JsrootPlot, {
      props: {
        series: [
          makeSeries({
            particleId: 2,
            particleName: "α",
            particleMassNumber: ALPHA_MASS_NUMBER,
            result: { energies: [1, 2], stoppingPowers: [10, 20], csdaRanges: [1, 1] },
          }),
          makeSeries({
            seriesId: 2,
            particleId: 1001,
            particleName: "e⁻",
            particleMassNumber: 0,
            result: { energies: [1, 2], stoppingPowers: [5, 6], csdaRanges: [1, 1] },
          }),
        ],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 1, xMax: 8, yMin: 1, yMax: 100 },
      },
    });

    await vi.waitFor(() => {
      const graphCalls = vi.mocked(JSROOT.createTGraph).mock.calls as Array<
        [number, number[], number[]]
      >;
      expect(graphCalls.some((call) => call[1][0] === 4)).toBe(true);
    });
    const calls = (
      vi.mocked(JSROOT.createTGraph).mock.calls as Array<[number, number[], number[]]>
    ).slice(-2);
    // Alpha (A=4) energies convert from 1,2 MeV/nucl to 4,8 total MeV.
    expect(calls[0]?.[1]).toEqual([4, 8]);
    expect(calls[1]?.[1]).toEqual([1, 2]);
    const hist = vi.mocked(JSROOT.createHistogram).mock.results.at(-1)?.value as {
      fXaxis: { fTitle: string };
    };
    expect(hist.fXaxis.fTitle).toBe("Energy [MeV]");
  });

  it("declares touch-action on the canvas so swipe/pinch scroll the page", () => {
    render(JsrootPlot, {
      props: {
        series: [],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
      },
    });
    const canvas = screen.getByRole("img");
    expect(canvas.style.touchAction).toContain("pan-y");
    expect(canvas.style.touchAction).toContain("pinch-zoom");
  });

  it("swallows middle-button mousedown so a middle-drag cannot pan the plot", async () => {
    render(JsrootPlot, {
      props: {
        series: [],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
      },
    });
    const canvas = screen.getByRole("img");
    // JSROOT binds its mousedown handler on a descendant; emulate one and check
    // the container's capture-phase listener stops middle-button events.
    const inner = document.createElement("div");
    canvas.appendChild(inner);
    const innerListener = vi.fn();
    inner.addEventListener("mousedown", innerListener);

    // Wait for the container-binding $effect to attach the capture listener.
    await vi.waitFor(() => {
      const probe = new MouseEvent("mousedown", { button: 1, bubbles: true, cancelable: true });
      inner.dispatchEvent(probe);
      expect(probe.defaultPrevented).toBe(true);
    });

    innerListener.mockClear();
    inner.dispatchEvent(new MouseEvent("mousedown", { button: 1, bubbles: true }));
    expect(innerListener).not.toHaveBeenCalled();

    // Left-button mousedown (rectangular zoom) must still reach JSROOT.
    inner.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true }));
    expect(innerListener).toHaveBeenCalledTimes(1);
  });

  it("disables ZoomTouch and DragGraphs on touch-capable devices even when (pointer: coarse) is false", async () => {
    // Regression test for #774: some mobile browsers return false for (pointer: coarse)
    // even though the device is touch-capable. maxTouchPoints > 0 must also trigger protection.
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false, // coarse query returns false — simulates the affected environment
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    const originalMaxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "maxTouchPoints",
    );
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });

    try {
      const JSROOT = await import("jsroot");
      const settings = JSROOT.settings as { ZoomTouch: boolean; DragGraphs: boolean };
      settings.ZoomTouch = true;
      settings.DragGraphs = true;

      render(JsrootPlot, {
        props: {
          series: [makeSeries({})],
          preview: null,
          stpUnit: "keV/µm" as StpUnit,
          xLog: true,
          yLog: true,
          axisRanges: { xMin: 1, xMax: 2, yMin: 1, yMax: 100 },
        },
      });

      await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());
      expect(settings.ZoomTouch).toBe(false);
      expect(settings.DragGraphs).toBe(false);
    } finally {
      window.matchMedia = original;
      if (originalMaxTouchPointsDescriptor) {
        Object.defineProperty(navigator, "maxTouchPoints", originalMaxTouchPointsDescriptor);
      } else {
        delete (navigator as unknown as Record<string, unknown>)["maxTouchPoints"];
      }
    }
  });

  it("disables ZoomWheel and keeps DragGraphs on fine-pointer (desktop) devices", async () => {
    const JSROOT = await import("jsroot");
    const settings = JSROOT.settings as { ZoomWheel: boolean; DragGraphs: boolean };
    settings.ZoomWheel = true;
    settings.DragGraphs = true;

    render(JsrootPlot, {
      props: {
        series: [makeSeries({})],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 1, xMax: 2, yMin: 1, yMax: 100 },
      },
    });

    await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());
    expect(settings.ZoomWheel).toBe(false);
    // Dragging TGraph points stays available on desktop (mouse only).
    expect(settings.DragGraphs).toBe(true);
  });

  it("disables ZoomTouch and DragGraphs on coarse-pointer (touch) devices", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("coarse"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    try {
      const JSROOT = await import("jsroot");
      const settings = JSROOT.settings as { ZoomTouch: boolean; DragGraphs: boolean };
      settings.ZoomTouch = true;
      settings.DragGraphs = true;

      render(JsrootPlot, {
        props: {
          series: [makeSeries({})],
          preview: null,
          stpUnit: "keV/µm" as StpUnit,
          xLog: true,
          yLog: true,
          axisRanges: { xMin: 1, xMax: 2, yMin: 1, yMax: 100 },
        },
      });

      await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());
      expect(settings.ZoomTouch).toBe(false);
      expect(settings.DragGraphs).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it("sets requestExportSvg to an async function after container is bound", async () => {
    // Capture the $bindable update by defining a setter on the props object.
    // @testing-library/svelte-core uses $state.raw(initialProps), so the Proxy
    // setter writes back to the same object reference — our setter intercepts it.
    let capturedExportFn: (() => Promise<string | null>) | null = null;
    const propsBase = {
      series: [],
      preview: null,
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
      axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
    };
    const props = Object.defineProperty(propsBase, "requestExportSvg", {
      get() {
        return capturedExportFn;
      },
      set(v: (() => Promise<string | null>) | null) {
        capturedExportFn = v;
      },
      enumerable: true,
      configurable: true,
    }) as typeof propsBase & { requestExportSvg?: (() => Promise<string | null>) | null };

    render(JsrootPlot, { props });

    // Wait for the $effect to bind the container and assign requestExportSvg
    await vi.waitFor(() => {
      expect(capturedExportFn).not.toBeNull();
    });
    expect(typeof capturedExportFn).toBe("function");

    // Call the export function — JSROOT.draw mock adds no SVG, so result is null
    const result = await capturedExportFn!();
    expect(result).toBeNull();
  });

  it("requestExportSvg returns an SVG string when JSROOT renders one", async () => {
    const JSROOT = await import("jsroot");
    // Override draw to append an <svg> to the offscreen container
    vi.mocked(JSROOT.draw).mockImplementation(async (el: unknown) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      (el as HTMLElement).appendChild(svg);
      return { cleanup: vi.fn() };
    });

    let capturedExportFn: (() => Promise<string | null>) | null = null;
    const propsBase = {
      series: [],
      preview: null,
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
      axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
    };
    const props = Object.defineProperty(propsBase, "requestExportSvg", {
      get() {
        return capturedExportFn;
      },
      set(v: (() => Promise<string | null>) | null) {
        capturedExportFn = v;
      },
      enumerable: true,
      configurable: true,
    }) as typeof propsBase & { requestExportSvg?: (() => Promise<string | null>) | null };

    render(JsrootPlot, { props });

    await vi.waitFor(() => {
      expect(capturedExportFn).not.toBeNull();
    });

    const result = await capturedExportFn!();
    expect(result).not.toBeNull();
    expect(result).toContain("<svg");
  });

  it("attaches a TLegend to the off-screen export multigraph for visible series (#797)", async () => {
    const JSROOT = await import("jsroot");

    let capturedExportFn: (() => Promise<string | null>) | null = null;
    const propsBase = {
      series: [
        makeSeries({ seriesId: 1, label: "p in Water" }),
        makeSeries({ seriesId: 2, label: "α in Water", visible: false }),
      ],
      preview: null,
      stpUnit: "keV/µm" as StpUnit,
      xLog: true,
      yLog: true,
      axisRanges: { xMin: 1, xMax: 100, yMin: 1, yMax: 1000 },
    };
    const props = Object.defineProperty(propsBase, "requestExportSvg", {
      get() {
        return capturedExportFn;
      },
      set(v: (() => Promise<string | null>) | null) {
        capturedExportFn = v;
      },
      enumerable: true,
      configurable: true,
    }) as typeof propsBase & { requestExportSvg?: (() => Promise<string | null>) | null };

    render(JsrootPlot, { props });
    await vi.waitFor(() => expect(capturedExportFn).not.toBeNull());

    vi.mocked(JSROOT.createTMultiGraph).mockClear();
    await capturedExportFn!();

    // Only the export pad gets a legend (the live draw never does), so exactly
    // one created multigraph carries a non-empty fFunctions list.
    type MgWithLegend = {
      fFunctions: { arr: Array<{ fPrimitives: { arr: Array<{ fLabel: string }> } }> };
    };
    const results = vi.mocked(JSROOT.createTMultiGraph).mock.results as Array<{ value: unknown }>;
    const withLegend = results
      .map((r): MgWithLegend => r.value as MgWithLegend)
      .filter((mg: MgWithLegend) => mg.fFunctions.arr.length > 0);
    expect(withLegend).toHaveLength(1);
    // The single legend lists only the visible series (hidden α excluded).
    expect(
      withLegend[0]!.fFunctions.arr[0]!.fPrimitives.arr.map((e: { fLabel: string }) => e.fLabel),
    ).toEqual(["p in Water"]);
  });

  it("disables JSROOT's native ToolBar and ContextMenu while mounted (#794)", async () => {
    const JSROOT = await import("jsroot");
    const settings = JSROOT.settings as { ToolBar: boolean | string; ContextMenu: boolean };
    settings.ToolBar = "popup";
    settings.ContextMenu = true;

    render(JsrootPlot, {
      props: {
        series: [makeSeries({})],
        preview: null,
        stpUnit: "keV/µm" as StpUnit,
        xLog: true,
        yLog: true,
        axisRanges: { xMin: 1, xMax: 2, yMin: 1, yMax: 100 },
      },
    });

    await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());
    expect(settings.ToolBar).toBe(false);
    expect(settings.ContextMenu).toBe(false);
  });

  it("exposes resetZoom (unzoom xyz) and zoom-out clamped to the full range (#794)", async () => {
    const JSROOT = await import("jsroot");
    const unzoom = vi.fn(async () => true);
    const zoom = vi.fn(async () => true);
    // Frame painter zoomed in to the middle of a [1,100]×[1,1000] full range.
    const framePainter = {
      xmin: 1,
      xmax: 100,
      ymin: 1,
      ymax: 1000,
      scale_xmin: 5,
      scale_xmax: 50,
      scale_ymin: 5,
      scale_ymax: 500,
      // Linear axes keep the arithmetic simple to assert clamping.
      logx: 0,
      logy: 0,
      zoom,
      unzoom,
    };
    vi.mocked(JSROOT.draw).mockImplementation(async () => ({
      cleanup: vi.fn(),
      getFramePainter: () => framePainter,
    }));

    let resetZoomFn: (() => void) | null = null;
    let zoomOutFn: (() => void) | null = null;
    const propsBase = {
      series: [makeSeries({})],
      preview: null,
      stpUnit: "keV/µm" as StpUnit,
      xLog: false,
      yLog: false,
      axisRanges: { xMin: 1, xMax: 100, yMin: 1, yMax: 1000 },
    };
    const props = Object.defineProperties(propsBase, {
      resetZoom: {
        get() {
          return resetZoomFn;
        },
        set(v: (() => void) | null) {
          resetZoomFn = v;
        },
        enumerable: true,
        configurable: true,
      },
      zoomOut: {
        get() {
          return zoomOutFn;
        },
        set(v: (() => void) | null) {
          zoomOutFn = v;
        },
        enumerable: true,
        configurable: true,
      },
    }) as typeof propsBase & {
      resetZoom?: (() => void) | null;
      zoomOut?: (() => void) | null;
    };

    render(JsrootPlot, { props });

    // The controls are exposed on mount but only wire to the frame painter once
    // the async draw resolves — wait for the draw, then drive them.
    await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());

    await vi.waitFor(() => {
      resetZoomFn!();
      expect(unzoom).toHaveBeenCalledWith("xyz");
    });

    zoomOutFn!();
    await vi.waitFor(() => expect(zoom).toHaveBeenCalled());
    // Zoom-out expands the [5,50]×[5,500] view but must never exceed the full
    // [1,100]×[1,1000] data range.
    const [xMin, xMax, yMin, yMax] = vi.mocked(zoom).mock.calls.at(-1) as number[];
    expect(xMin).toBeGreaterThanOrEqual(1);
    expect(xMax).toBeLessThanOrEqual(100);
    expect(yMin).toBeGreaterThanOrEqual(1);
    expect(yMax).toBeLessThanOrEqual(1000);
  });

  it("keeps isZoomed in sync with the frame painter (#812)", async () => {
    const JSROOT = await import("jsroot");
    // A frame painter that starts at full range; zoom()/unzoom() mutate scale_*
    // the way JSROOT does, so isRangeZoomed() flips as the view changes.
    const framePainter = {
      xmin: 1,
      xmax: 100,
      ymin: 1,
      ymax: 1000,
      scale_xmin: 1,
      scale_xmax: 100,
      scale_ymin: 1,
      scale_ymax: 1000,
      logx: 0,
      logy: 0,
      zoom: vi.fn(async (xmin: number, xmax: number, ymin: number, ymax: number) => {
        framePainter.scale_xmin = xmin;
        framePainter.scale_xmax = xmax;
        framePainter.scale_ymin = ymin;
        framePainter.scale_ymax = ymax;
        return true;
      }),
      unzoom: vi.fn(async () => {
        framePainter.scale_xmin = framePainter.xmin;
        framePainter.scale_xmax = framePainter.xmax;
        framePainter.scale_ymin = framePainter.ymin;
        framePainter.scale_ymax = framePainter.ymax;
        return true;
      }),
    };
    vi.mocked(JSROOT.draw).mockImplementation(async () => ({
      cleanup: vi.fn(),
      getFramePainter: () => framePainter,
    }));

    let isZoomedVal: boolean = false;
    let zoomInFn: (() => void) | null = null;
    let resetZoomFn: (() => void) | null = null;
    const propsBase = {
      series: [makeSeries({})],
      preview: null,
      stpUnit: "keV/µm" as StpUnit,
      xLog: false,
      yLog: false,
      axisRanges: { xMin: 1, xMax: 100, yMin: 1, yMax: 1000 },
    };
    const props = Object.defineProperties(propsBase, {
      isZoomed: {
        get() {
          return isZoomedVal;
        },
        set(v: boolean) {
          isZoomedVal = v;
        },
        enumerable: true,
        configurable: true,
      },
      zoomIn: {
        get() {
          return zoomInFn;
        },
        set(v: (() => void) | null) {
          zoomInFn = v;
        },
        enumerable: true,
        configurable: true,
      },
      resetZoom: {
        get() {
          return resetZoomFn;
        },
        set(v: (() => void) | null) {
          resetZoomFn = v;
        },
        enumerable: true,
        configurable: true,
      },
    }) as typeof propsBase & {
      isZoomed?: boolean;
      zoomIn?: (() => void) | null;
      resetZoom?: (() => void) | null;
    };

    render(JsrootPlot, { props });

    await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());
    // Fresh draw sits at full range → nothing to reset.
    await vi.waitFor(() => expect(isZoomedVal).toBe(false));

    // Zooming in shrinks the view → Reset zoom becomes meaningful.
    zoomInFn!();
    await vi.waitFor(() => expect(isZoomedVal).toBe(true));

    // Reset returns to the full range → zoomed flag clears again.
    resetZoomFn!();
    await vi.waitFor(() => expect(isZoomedVal).toBe(false));
  });
});
