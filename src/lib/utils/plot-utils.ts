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
