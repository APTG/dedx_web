import type { StpUnit } from "$lib/wasm/types";

export const COLOR_PALETTE: readonly string[] = [
  "#e41a1c", // red
  "#377eb8", // blue
  "#4daf4a", // green
  "#984ea3", // purple
  "#ff7f00", // orange
  "#a65628", // brown
  "#f781bf", // pink
  "#999999", // grey
  "#17becf", // cyan
];

/** Black is reserved exclusively for the preview series. */
export const PREVIEW_COLOR = "#000000";

/**
 * Resolve the actual color JSROOT uses to draw a series with the given
 * palette `colorIndex`. JSROOT's TGraph painter renders `fLineColor` by
 * looking the index up in its global ROOT color list, so the legend swatch
 * must use the same lookup to stay visually consistent with the drawn line.
 *
 * Lazily imports `jsroot` so we do not bloat the initial bundle. Falls back
 * to the local palette hex if JSROOT is unavailable.
 */
let _jsrootColorsCache: Map<number, string> | null = null;
let _jsrootColorsPromise: Promise<Map<number, string>> | null = null;

export function getJsrootSwatchColors(): Promise<Map<number, string>> {
  if (_jsrootColorsCache) return Promise.resolve(_jsrootColorsCache);
  if (_jsrootColorsPromise) return _jsrootColorsPromise;
  _jsrootColorsPromise = import("jsroot")
    .then((JSROOT) => {
      const map = new Map<number, string>();
      const getColor = (JSROOT as { getColor?: (i: number) => string | undefined }).getColor;
      for (let i = 0; i < COLOR_PALETTE.length; i++) {
        // Mirror the index offset used in jsroot-plot.svelte (`s.colorIndex + 2`).
        const resolved = getColor?.(i + 2);
        const fallback = COLOR_PALETTE[i] ?? PREVIEW_COLOR;
        map.set(i, resolved ?? fallback);
      }
      _jsrootColorsCache = map;
      return map;
    })
    .catch(() => {
      const fallback = new Map<number, string>();
      for (let i = 0; i < COLOR_PALETTE.length; i++) {
        fallback.set(i, COLOR_PALETTE[i] ?? PREVIEW_COLOR);
      }
      return fallback;
    });
  return _jsrootColorsPromise;
}

/**
 * Convert mass stopping power values (MeV·cm²/g) to the target display unit.
 * Each series must supply its own material density for density-dependent units.
 */
export function convertStpForDisplay(
  massStpValues: number[],
  density: number,
  targetUnit: StpUnit,
): number[] {
  switch (targetUnit) {
    case "keV/µm":
      return massStpValues.map((s) => (s * density) / 10);
    case "MeV/cm":
      return massStpValues.map((s) => s * density);
    case "MeV·cm²/g":
      return massStpValues;
  }
}

/**
 * Build the JSROOT draw options string from axis scale settings.
 * Gridlines and ticks are always on.
 */
export function buildDrawOptions(xLog: boolean, yLog: boolean): string {
  const opts: string[] = [];
  if (xLog) opts.push("logx");
  if (yLog) opts.push("logy");
  opts.push("gridx", "gridy", "tickx", "ticky");
  return opts.join(";");
}

interface SeriesForRange {
  result: { energies: number[]; stoppingPowers: number[] };
  density: number;
  visible: boolean;
}

interface AxisRanges {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const DEFAULT_RANGES: AxisRanges = {
  xMin: 0.001,
  xMax: 10000,
  yMin: 0.1,
  yMax: 1000,
};

/**
 * Auto-compute axis ranges from all visible series data.
 * Rounds to powers of 10 (floor for min, ceil for max).
 */
export function computeAxisRanges(
  series: SeriesForRange[],
  preview: SeriesForRange | null,
  stpUnit: StpUnit,
): AxisRanges {
  const allVisible = [
    ...(preview && preview.visible ? [preview] : []),
    ...series.filter((s) => s.visible),
  ];

  if (allVisible.length === 0) return DEFAULT_RANGES;

  let xMinRaw = Infinity;
  let xMaxRaw = -Infinity;
  let yMinRaw = Infinity;
  let yMaxRaw = -Infinity;

  for (const s of allVisible) {
    const { energies, stoppingPowers } = s.result;
    const yData = convertStpForDisplay(stoppingPowers, s.density, stpUnit);

    for (const e of energies) {
      if (e > 0 && e < xMinRaw) xMinRaw = e;
      if (e > xMaxRaw) xMaxRaw = e;
    }
    for (const y of yData) {
      if (y > 0 && y < yMinRaw) yMinRaw = y;
      if (y > yMaxRaw) yMaxRaw = y;
    }
  }

  if (!isFinite(xMinRaw) || !isFinite(xMaxRaw)) return DEFAULT_RANGES;

  return {
    xMin: Math.pow(10, Math.floor(Math.log10(xMinRaw))),
    xMax: Math.pow(10, Math.ceil(Math.log10(xMaxRaw))),
    yMin: Math.pow(10, Math.floor(Math.log10(yMinRaw))),
    yMax: Math.pow(10, Math.ceil(Math.log10(yMaxRaw))),
  };
}
