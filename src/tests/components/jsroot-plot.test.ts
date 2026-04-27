import { render, screen, cleanup } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

// jsdom polyfills for matchMedia and ResizeObserver
beforeAll(() => {
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
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("jsroot", () => ({
  default: {
    settings: { ZoomWheel: true, ZoomTouch: true },
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
  },
}));

import JsrootPlot from "$lib/components/jsroot-plot.svelte";
import type { StpUnit } from "$lib/wasm/types";

const mockResult = {
  energies: [1, 10, 100],
  stoppingPowers: [5, 5, 5],
  csdaRanges: [0.5, 0.5, 0.5],
};

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

  it("calls JSROOT.draw after mount", async () => {
    const JSROOT = (await import("jsroot")).default;
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
    await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());
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
});
