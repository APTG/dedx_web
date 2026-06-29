import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import { describe, it, expect, vi, afterEach } from "vitest";
import SeriesStrip from "../../routes/plot/series-strip.svelte";
import type { PlotSeries } from "$lib/state/plot.svelte";

afterEach(cleanup);

function makeSeries(overrides: Partial<PlotSeries> = {}): PlotSeries {
  return {
    seriesId: 1,
    programId: 2,
    particleId: 1,
    materialId: 276,
    programName: "PSTAR",
    particleName: "Proton",
    particleMassNumber: 1,
    materialName: "Water",
    density: 1,
    result: { energies: [1, 2], stoppingPowers: [10, 20], csdaRanges: [1, 1] },
    label: "PSTAR — p in Water",
    color: "#e41a1c",
    colorIndex: 0,
    visible: true,
    ...overrides,
  };
}

function baseProps(series: PlotSeries[]) {
  return {
    series,
    preview: null,
    editingSeriesId: null,
    jsrootSwatchColors: null,
    onRemove: vi.fn(),
    onToggleVisibility: vi.fn(),
    onTogglePreview: vi.fn(),
    onSelectForEdit: vi.fn(),
    onDone: vi.fn(),
    onReorder: vi.fn(),
  };
}

describe("SeriesStrip (#793)", () => {
  it("has no 'Add series' control inside the strip", () => {
    render(SeriesStrip, { props: { ...baseProps([makeSeries()]) } });
    expect(screen.queryByTestId("plot-add-series")).toBeNull();
    expect(screen.queryByRole("button", { name: /add/i })).toBeNull();
  });

  it("shows a series count in the header", () => {
    render(SeriesStrip, {
      props: { ...baseProps([makeSeries({ seriesId: 1 }), makeSeries({ seriesId: 2 })]) },
    });
    expect(screen.getByTestId("plot-series-count").textContent).toContain("2 series");
  });

  it("renders eye + trash as buttons with accessible names", () => {
    render(SeriesStrip, { props: { ...baseProps([makeSeries()]) } });
    expect(screen.getByRole("button", { name: /hide series PSTAR — p in Water/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove series PSTAR — p in Water/i })).toBeTruthy();
  });

  it("calls onToggleVisibility when the eye is clicked", async () => {
    const props = baseProps([makeSeries({ seriesId: 7 })]);
    render(SeriesStrip, { props });
    await fireEvent.click(screen.getByRole("button", { name: /hide series/i }));
    expect(props.onToggleVisibility).toHaveBeenCalledWith(7);
  });

  it("calls onRemove when trash is clicked", async () => {
    const props = baseProps([makeSeries({ seriesId: 9 })]);
    render(SeriesStrip, { props });
    await fireEvent.click(screen.getByRole("button", { name: /remove series/i }));
    expect(props.onRemove).toHaveBeenCalledWith(9);
  });

  it("a hidden series shows the show-eye and strikes through its label", () => {
    render(SeriesStrip, { props: { ...baseProps([makeSeries({ visible: false })]) } });
    expect(screen.getByRole("button", { name: /show series/i })).toBeTruthy();
    const label = screen.getByRole("button", { name: /edit series/i });
    expect(label.className).toContain("line-through");
  });

  it("reorders via ArrowUp/ArrowDown on the drag handle", async () => {
    const props = baseProps([
      makeSeries({ seriesId: 1 }),
      makeSeries({ seriesId: 2 }),
      makeSeries({ seriesId: 3 }),
    ]);
    render(SeriesStrip, { props });
    const handles = screen.getAllByRole("button", { name: /reorder series/i });
    await fireEvent.keyDown(handles[1]!, { key: "ArrowUp" });
    expect(props.onReorder).toHaveBeenCalledWith(1, 0);
    await fireEvent.keyDown(handles[1]!, { key: "ArrowDown" });
    expect(props.onReorder).toHaveBeenCalledWith(1, 2);
  });

  it("does not reorder past the ends", async () => {
    const props = baseProps([makeSeries({ seriesId: 1 }), makeSeries({ seriesId: 2 })]);
    render(SeriesStrip, { props });
    const handles = screen.getAllByRole("button", { name: /reorder series/i });
    await fireEvent.keyDown(handles[0]!, { key: "ArrowUp" }); // already first
    await fireEvent.keyDown(handles[1]!, { key: "ArrowDown" }); // already last
    expect(props.onReorder).not.toHaveBeenCalled();
  });

  it("invokes onReorder on drag-and-drop between rows", async () => {
    const props = baseProps([makeSeries({ seriesId: 1 }), makeSeries({ seriesId: 2 })]);
    render(SeriesStrip, { props });
    const handles = screen.getAllByTestId(/plot-series-drag-/);
    const rows = screen.getAllByTestId(/plot-series-row-/);
    await fireEvent.dragStart(handles[0]!);
    await fireEvent.dragOver(rows[1]!);
    await fireEvent.drop(rows[1]!);
    expect(props.onReorder).toHaveBeenCalledWith(0, 1);
  });

  it("renders a dashed line-swatch for external-data series", () => {
    const { container } = render(SeriesStrip, {
      props: { ...baseProps([makeSeries({ programId: "ext-1" as unknown as number })]) },
    });
    const dashed = container.querySelector("path[stroke-dasharray]");
    expect(dashed).not.toBeNull();
  });
});
