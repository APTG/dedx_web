import { describe, it, expect, vi } from "vitest";
import {
  buildExportLegend,
  chooseLegendCorner,
  legendBoxForCorner,
  type ExportLegendItem,
  type LegendPlacementInput,
} from "$lib/utils/plot-utils";

// Minimal stand-in for JSROOT's class factory: TLegend carries the fPrimitives
// list the builder fills; entries are plain bags it sets fields on.
function makeCreate() {
  return vi.fn((typename: string) => {
    if (typename === "TLegend")
      return { fPrimitives: { arr: [], opt: [] } } as Record<string, unknown>;
    return {} as Record<string, unknown>;
  });
}

function item(label: string, hidden = false): ExportLegendItem {
  return { graph: { fLineColor: 2, label }, label, hidden };
}

interface LegendBox {
  fX1NDC: number;
  fX2NDC: number;
  fY1NDC: number;
  fY2NDC: number;
  fOption: string;
}

describe("buildExportLegend (#797)", () => {
  it("returns null when there are no items", () => {
    expect(buildExportLegend(makeCreate(), [])).toBeNull();
  });

  it("returns null when every item is hidden", () => {
    const items = [item("p in Water", true), item("α in Water", true)];
    expect(buildExportLegend(makeCreate(), items)).toBeNull();
  });

  it("builds one entry per visible series, in order, with line option", () => {
    const items = [item("p in Water"), item("α in Water"), item("C in Water")];
    const legend = buildExportLegend(makeCreate(), items) as {
      fPrimitives: { arr: Array<{ fLabel: string; fOption: string; fObject: unknown }> };
    };
    const entries = legend.fPrimitives.arr;
    expect(entries.map((e) => e.fLabel)).toEqual(["p in Water", "α in Water", "C in Water"]);
    expect(entries.every((e) => e.fOption === "l")).toBe(true);
    // Each entry references the drawn graph so the line sample takes its colour.
    expect(entries[0]!.fObject).toBe(items[0]!.graph);
  });

  it("excludes hidden series but keeps the visible order", () => {
    const items = [item("p in Water"), item("α in Water", true), item("C in Water")];
    const legend = buildExportLegend(makeCreate(), items) as {
      fPrimitives: { arr: Array<{ fLabel: string }> };
    };
    expect(legend.fPrimitives.arr.map((e) => e.fLabel)).toEqual(["p in Water", "C in Water"]);
  });

  it("positions the legend top-right inside the frame using NDC coordinates", () => {
    const legend = buildExportLegend(makeCreate(), [item("p in Water")]) as unknown as LegendBox;
    expect(legend.fOption).toContain("NDC");
    expect(legend.fX2NDC).toBeGreaterThan(legend.fX1NDC);
    expect(legend.fY2NDC).toBeGreaterThan(legend.fY1NDC);
    expect(legend.fX2NDC).toBeLessThanOrEqual(1);
    expect(legend.fY2NDC).toBeLessThanOrEqual(1);
  });

  it("grows the box height with the number of visible entries", () => {
    const one = buildExportLegend(makeCreate(), [item("a")]) as unknown as LegendBox;
    const many = buildExportLegend(makeCreate(), [
      item("a"),
      item("b"),
      item("c"),
      item("d"),
    ]) as unknown as LegendBox;
    // More entries → the box starts lower (smaller fY1NDC), same top edge.
    expect(many.fY1NDC).toBeLessThan(one.fY1NDC);
    expect(many.fY2NDC).toBe(one.fY2NDC);
  });

  it("keeps the historical top-right box when no placement data is supplied", () => {
    const legend = buildExportLegend(makeCreate(), [item("a")]) as unknown as LegendBox;
    const tr = legendBoxForCorner("tr", 1);
    expect(legend.fX1NDC).toBeCloseTo(tr.fX1NDC, 6);
    expect(legend.fX2NDC).toBeCloseTo(tr.fX2NDC, 6);
    expect(legend.fY2NDC).toBeCloseTo(tr.fY2NDC, 6);
  });
});

// A curve that fills one half of the frame, sampled densely so a corner box
// either overlaps it (many points) or is clear (none).
function lineInput(fill: "left" | "right" | "bottom" | "top", log = false): LegendPlacementInput {
  const ranges = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= 100; i++) {
    switch (fill) {
      case "left":
        x.push(25); // a vertical band on the left
        y.push(i);
        break;
      case "right":
        x.push(75);
        y.push(i);
        break;
      case "bottom":
        x.push(i);
        y.push(15); // a horizontal band near the bottom
        break;
      case "top":
        x.push(i);
        y.push(85);
        break;
    }
  }
  return { series: [{ x, y }], ranges, xLog: log, yLog: log };
}

describe("chooseLegendCorner (#797 auto-placement)", () => {
  it("defaults to top-right when there is no data to occlude", () => {
    const empty: LegendPlacementInput = {
      series: [],
      ranges: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
      xLog: false,
      yLog: false,
    };
    expect(chooseLegendCorner(empty, 2)).toBe("tr");
  });

  it("moves left when the data crowds the right side", () => {
    expect(chooseLegendCorner(lineInput("right"), 2)).toBe("tl");
  });

  it("stays top-right when the data crowds the left side", () => {
    expect(chooseLegendCorner(lineInput("left"), 2)).toBe("tr");
  });

  it("moves to the bottom when the data crowds the top", () => {
    // A top band leaves both bottom corners clear; tie-break prefers bottom-right.
    expect(chooseLegendCorner(lineInput("top"), 2)).toBe("br");
  });

  it("maps points through a log scale when choosing a corner", () => {
    // On a log x-axis, x=75 still lands in the right half, so the legend flees left.
    const input = lineInput("right", true);
    input.ranges.xMin = 1;
    input.ranges.yMin = 1;
    expect(chooseLegendCorner(input, 2)).toBe("tl");
  });

  it("places the legend into the chosen corner", () => {
    const legend = buildExportLegend(makeCreate(), [item("a")], lineInput("right")) as unknown as {
      fX1NDC: number;
      fX2NDC: number;
    };
    const tl = legendBoxForCorner("tl", 1);
    expect(legend.fX1NDC).toBeCloseTo(tl.fX1NDC, 6);
    expect(legend.fX2NDC).toBeCloseTo(tl.fX2NDC, 6);
  });
});

describe("legendBoxForCorner (#797)", () => {
  it("anchors each corner inside the frame with a consistent box size", () => {
    const corners = (["tr", "tl", "br", "bl"] as const).map((c) => legendBoxForCorner(c, 2));
    for (const box of corners) {
      expect(box.fX2NDC).toBeGreaterThan(box.fX1NDC);
      expect(box.fY2NDC).toBeGreaterThan(box.fY1NDC);
      expect(box.fX1NDC).toBeGreaterThanOrEqual(0);
      expect(box.fX2NDC).toBeLessThanOrEqual(1);
      expect(box.fY1NDC).toBeGreaterThanOrEqual(0);
      expect(box.fY2NDC).toBeLessThanOrEqual(1);
    }
    // Top boxes share a top edge; right boxes share a right edge.
    expect(corners[0]!.fY2NDC).toBeCloseTo(corners[1]!.fY2NDC, 6);
    expect(corners[0]!.fX2NDC).toBeCloseTo(corners[2]!.fX2NDC, 6);
  });
});
