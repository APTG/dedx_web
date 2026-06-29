import { describe, it, expect, vi } from "vitest";
import { buildExportLegend, type ExportLegendItem } from "$lib/utils/plot-utils";

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
});
