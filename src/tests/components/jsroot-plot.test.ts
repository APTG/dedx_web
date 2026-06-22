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
  settings: { ZoomWheel: true, ZoomTouch: true, DragGraphs: true },
  createTGraph: vi.fn((_n: number, _x: number[], _y: number[]) => ({
    fLineColor: 1,
    fLineWidth: 2,
    fLineStyle: 1,
    fTitle: "",
    InvertBit: vi.fn(),
  })),
  createTMultiGraph: vi.fn((_graphs: unknown[]) => ({
    fGraphs: { Add: vi.fn() },
    fHistogram: null,
    fTitle: "",
  })),
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
});
