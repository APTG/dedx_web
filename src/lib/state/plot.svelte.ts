import type { CalculationResult, StpUnit } from "$lib/wasm/types";
import { computeSeriesLabels } from "$lib/utils/series-labels";
import { COLOR_PALETTE, PREVIEW_COLOR } from "$lib/utils/plot-utils";
import { allocateColor, releaseColor } from "$lib/utils/series-labels";

export interface PlotSeriesData {
  programId: number;
  particleId: number;
  materialId: number;
  programName: string;
  particleName: string;
  materialName: string;
  density: number;
  result: CalculationResult;
}

export interface PlotSeries extends PlotSeriesData {
  seriesId: number;
  label: string;
  color: string;
  colorIndex: number;
  visible: boolean;
}

export interface PlotState {
  series: PlotSeries[];
  preview: PlotSeries | null;
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
  nextSeriesId: number;

  addSeries(data: PlotSeriesData): boolean;
  removeSeries(seriesId: number): void;
  toggleVisibility(seriesId: number): void;
  setPreview(data: PlotSeriesData): void;
  clearPreview(): void;
  togglePreviewVisibility(): void;
  setStpUnit(unit: StpUnit): void;
  setAxisScale(axis: "x" | "y", log: boolean): void;
  resetAll(): void;
}

export function createPlotState(): PlotState {
  let series = $state<PlotSeries[]>([]);
  let preview = $state<PlotSeries | null>(null);
  let stpUnit = $state<StpUnit>("keV/µm");
  let xLog = $state(true);
  let yLog = $state(true);
  let nextSeriesId = $state(1);
  // eslint-disable-next-line prefer-const -- $state needed for Svelte reactivity
  let availableColorIndices = $state<Set<number>>(
    new Set(COLOR_PALETTE.map((_, i) => i)),
  );

  function recomputeLabels(): void {
    const labels = computeSeriesLabels(series);
    series = series.map((s, i) => ({ ...s, label: labels[i] ?? s.label }));
  }

  function addSeries(data: PlotSeriesData): boolean {
    const isDuplicate = series.some(
      (s) =>
        s.programId === data.programId &&
        s.particleId === data.particleId &&
        s.materialId === data.materialId,
    );
    if (isDuplicate) return false;

    const colorIndex = allocateColor(availableColorIndices);
    const newSeries: PlotSeries = {
      ...data,
      seriesId: nextSeriesId,
      label: "",
      color: COLOR_PALETTE[colorIndex] ?? PREVIEW_COLOR,
      colorIndex,
      visible: true,
    };
    series = [...series, newSeries];
    nextSeriesId = nextSeriesId + 1;
    recomputeLabels();
    return true;
  }

  function removeSeries(seriesId: number): void {
    const target = series.find((s) => s.seriesId === seriesId);
    if (!target) return;
    releaseColor(availableColorIndices, target.colorIndex);
    series = series.filter((s) => s.seriesId !== seriesId);
    recomputeLabels();
  }

  function toggleVisibility(seriesId: number): void {
    series = series.map((s) =>
      s.seriesId === seriesId ? { ...s, visible: !s.visible } : s,
    );
  }

  function setPreview(data: PlotSeriesData): void {
    preview = {
      ...data,
      seriesId: 0,
      label: "",
      color: PREVIEW_COLOR,
      colorIndex: -1,
      visible: true,
    };
  }

  function clearPreview(): void {
    preview = null;
  }

  function togglePreviewVisibility(): void {
    if (preview) {
      preview = { ...preview, visible: !preview.visible };
    }
  }

  function setStpUnit(unit: StpUnit): void {
    stpUnit = unit;
  }

  function setAxisScale(axis: "x" | "y", log: boolean): void {
    if (axis === "x") xLog = log;
    else yLog = log;
  }

  function resetAll(): void {
    for (const s of series) {
      releaseColor(availableColorIndices, s.colorIndex);
    }
    series = [];
    preview = null;
    stpUnit = "keV/µm";
    xLog = true;
    yLog = true;
    nextSeriesId = 1;
  }

  return {
    get series() {
      return series;
    },
    get preview() {
      return preview;
    },
    get stpUnit() {
      return stpUnit;
    },
    get xLog() {
      return xLog;
    },
    get yLog() {
      return yLog;
    },
    get nextSeriesId() {
      return nextSeriesId;
    },
    addSeries,
    removeSeries,
    toggleVisibility,
    setPreview,
    clearPreview,
    togglePreviewVisibility,
    setStpUnit,
    setAxisScale,
    resetAll,
  };
}
