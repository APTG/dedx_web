import type { StpUnit } from "$lib/wasm/types";

export type PlotEnergyAxisUnit = "MeV" | "MeV/nucl";

/** A 1-D axis range `[min, max]` used by the zoom helpers. */
export interface AxisRange {
  min: number;
  max: number;
}

/**
 * Compute a new axis range zoomed toward its centre by `factor` (the fraction
 * of the current span to keep): `factor < 1` zooms in, `factor > 1` zooms out.
 * For log axes the interpolation runs in log10 space so the centre stays put
 * visually. Used by the toolbar − / + buttons (#794).
 */
export function zoomRange(min: number, max: number, isLog: boolean, factor: number): AxisRange {
  if (isLog && min > 0 && max > 0) {
    const lmin = Math.log10(min);
    const lmax = Math.log10(max);
    const centre = (lmin + lmax) / 2;
    const half = ((lmax - lmin) / 2) * factor;
    return { min: 10 ** (centre - half), max: 10 ** (centre + half) };
  }
  const centre = (min + max) / 2;
  const half = ((max - min) / 2) * factor;
  return { min: centre - half, max: centre + half };
}

/** Fraction of the visible span kept by a single − / + zoom step (#794). */
export const ZOOM_STEP_IN = 0.6;
export const ZOOM_STEP_OUT = 1 / ZOOM_STEP_IN;

const ELECTRON_PARTICLE_ID = 1001;

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

// ── Export legend (#797) ──────────────────────────────────────────────────
// The on-screen plot uses the custom HTML series strip as its legend, which
// can't be captured into a ROOT export. So the off-screen export pad gets its
// own in-canvas TLegend, mirroring the strip: one entry per visible series,
// same colour (taken from the graph) and label, in strip order.

/** One legend entry: the drawn TGraph plus its strip label. */
export interface ExportLegendItem {
  /** The JSROOT TGraph object — supplies the line colour/style for the sample. */
  graph: unknown;
  /** Human-readable series name, as shown in the HTML strip. */
  label: string;
  /** Hidden series are excluded from the legend (already excluded from curves). */
  hidden?: boolean;
}

// Default top-right placement inside the frame (pad NDC). Proton-in-water peaks
// on the left, so top-right is usually clear (epic open question 1). When the
// caller passes sample data, the legend is instead auto-placed into the emptiest
// corner (see `chooseLegendCorner`); top-right stays the tie-break default and
// the no-data fallback so behaviour is unchanged when no points are supplied.
const LEGEND_X1_NDC = 0.62;
const LEGEND_X2_NDC = 0.9;
const LEGEND_Y2_NDC = 0.88;
const LEGEND_ROW_NDC = 0.055;
const LEGEND_Y1_MIN_NDC = 0.4;

/** Box width in pad NDC — kept equal to the historical top-right width. */
const LEGEND_BOX_W_NDC = LEGEND_X2_NDC - LEGEND_X1_NDC; // 0.28
/** Gap between the legend box and the frame edge it hugs (pad NDC). */
const LEGEND_INSET_NDC = 0.02;
/** Cap the box height so a long series list can't overrun the frame. */
const LEGEND_MAX_H_NDC = 0.5;

/** JSROOT pad right/top margins — we only widen left/bottom (PAD_*_MARGIN), so
 *  these stay at JSROOT's gStyle defaults; used to derive the frame in NDC. */
const PAD_RIGHT_MARGIN_DEFAULT = 0.1;
const PAD_TOP_MARGIN_DEFAULT = 0.1;

/** The four inside-frame anchors the export legend can occupy. */
export type LegendCorner = "tr" | "tl" | "br" | "bl";

/** A legend rectangle in pad NDC. */
export interface LegendBoxNDC {
  fX1NDC: number;
  fX2NDC: number;
  fY1NDC: number;
  fY2NDC: number;
}

/** Visible-series sample data + axis context, used to auto-place the legend. */
export interface LegendPlacementInput {
  /** Per-series sample points, in the same display units as the axis ranges. */
  series: ReadonlyArray<{ x: readonly number[]; y: readonly number[] }>;
  ranges: { xMin: number; xMax: number; yMin: number; yMax: number };
  xLog: boolean;
  yLog: boolean;
}

/** The drawable plot area (frame) in pad NDC, inside the export pad margins. */
function exportFrameNDC(): { left: number; right: number; bottom: number; top: number } {
  return {
    left: PAD_LEFT_MARGIN,
    right: 1 - PAD_RIGHT_MARGIN_DEFAULT,
    bottom: PAD_BOTTOM_MARGIN,
    top: 1 - PAD_TOP_MARGIN_DEFAULT,
  };
}

/** Fraction [0,1] of a value across an axis, honouring log scale. NaN if the
 *  value/bounds are invalid for the scale (e.g. non-positive on a log axis). */
function axisFraction(value: number, min: number, max: number, isLog: boolean): number {
  if (isLog) {
    if (!(value > 0) || !(min > 0) || !(max > 0)) return NaN;
    return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  }
  return (value - min) / (max - min);
}

/**
 * The legend rectangle anchored to a given frame corner, sized for `rows`
 * entries. Horizontally flush to the frame side, inset vertically; `"tr"` with
 * a small row count reproduces the historical top-right box exactly.
 */
export function legendBoxForCorner(corner: LegendCorner, rows: number): LegendBoxNDC {
  const frame = exportFrameNDC();
  const h = Math.min(LEGEND_MAX_H_NDC, LEGEND_ROW_NDC * Math.max(1, rows));
  const isTop = corner === "tr" || corner === "tl";
  const isRight = corner === "tr" || corner === "br";
  const fX1NDC = isRight ? frame.right - LEGEND_BOX_W_NDC : frame.left;
  const fX2NDC = isRight ? frame.right : frame.left + LEGEND_BOX_W_NDC;
  const fY2NDC = isTop ? frame.top - LEGEND_INSET_NDC : frame.bottom + LEGEND_INSET_NDC + h;
  const fY1NDC = isTop ? frame.top - LEGEND_INSET_NDC - h : frame.bottom + LEGEND_INSET_NDC;
  return { fX1NDC, fX2NDC, fY1NDC, fY2NDC };
}

/** Map every in-frame sample point to pad NDC (off-frame points are dropped). */
function placementPointsNDC(input: LegendPlacementInput): Array<{ x: number; y: number }> {
  const frame = exportFrameNDC();
  const out: Array<{ x: number; y: number }> = [];
  for (const s of input.series) {
    const n = Math.min(s.x.length, s.y.length);
    for (let i = 0; i < n; i++) {
      const fx = axisFraction(s.x[i]!, input.ranges.xMin, input.ranges.xMax, input.xLog);
      const fy = axisFraction(s.y[i]!, input.ranges.yMin, input.ranges.yMax, input.yLog);
      if (!Number.isFinite(fx) || !Number.isFinite(fy)) continue;
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) continue;
      out.push({
        x: frame.left + fx * (frame.right - frame.left),
        y: frame.bottom + fy * (frame.top - frame.bottom),
      });
    }
  }
  return out;
}

/**
 * Pick the emptiest corner for a `rows`-entry legend: the candidate box that
 * overlaps the fewest drawn sample points. Ties resolve to top-right first
 * (then top-left, bottom-right, bottom-left), so the proton-in-water default
 * stays top-right and the choice only moves when a curve would be occluded
 * (epic open question 1).
 */
export function chooseLegendCorner(input: LegendPlacementInput, rows: number): LegendCorner {
  const points = placementPointsNDC(input);
  const order: LegendCorner[] = ["tr", "tl", "br", "bl"];
  let best: LegendCorner = "tr";
  let bestCount = Infinity;
  for (const corner of order) {
    const box = legendBoxForCorner(corner, rows);
    let count = 0;
    for (const p of points) {
      if (p.x >= box.fX1NDC && p.x <= box.fX2NDC && p.y >= box.fY1NDC && p.y <= box.fY2NDC) count++;
    }
    if (count < bestCount) {
      bestCount = count;
      best = corner;
    }
  }
  return best;
}

/**
 * Build a ROOT TLegend object from the visible series, for the export pad only.
 * Pure: `create` is JSROOT's class factory (injected so this is unit-testable
 * without the JSROOT bundle). Returns `null` when there are no visible series.
 *
 * When `placement` sample data is supplied the legend is auto-placed into the
 * emptiest frame corner; without it the legend keeps the fixed top-right box.
 */
export function buildExportLegend(
  create: (typename: string) => Record<string, unknown>,
  items: ExportLegendItem[],
  placement?: LegendPlacementInput,
): Record<string, unknown> | null {
  const visible = items.filter((it) => !it.hidden);
  if (visible.length === 0) return null;

  const legend = create("TLegend");
  if (placement) {
    const box = legendBoxForCorner(chooseLegendCorner(placement, visible.length), visible.length);
    legend.fX1NDC = box.fX1NDC;
    legend.fX2NDC = box.fX2NDC;
    legend.fY1NDC = box.fY1NDC;
    legend.fY2NDC = box.fY2NDC;
  } else {
    legend.fX1NDC = LEGEND_X1_NDC;
    legend.fX2NDC = LEGEND_X2_NDC;
    legend.fY2NDC = LEGEND_Y2_NDC;
    legend.fY1NDC = Math.max(LEGEND_Y1_MIN_NDC, LEGEND_Y2_NDC - LEGEND_ROW_NDC * visible.length);
  }
  legend.fOption = "brNDC";
  legend.fBorderSize = 1;

  const primitives = legend.fPrimitives as { arr: unknown[]; opt: string[] };
  for (const it of visible) {
    const entry = create("TLegendEntry");
    entry.fObject = it.graph;
    entry.fLabel = it.label;
    entry.fOption = "l"; // 'l' = line sample, matches the drawn curve
    primitives.arr.push(entry);
    primitives.opt.push("");
  }
  return legend;
}

/** Black is reserved exclusively for the preview series. */
export const PREVIEW_COLOR = "#000000";

/**
 * Axis-title offsets (in JSROOT `fTitleOffset` units, multiples of the tick
 * label height). JSROOT's defaults are too small for our tick-label font, so
 * the titles ("Energy [MeV]", "Stopping Power […]") collide with their tick
 * numbers — most visibly in log-X and linear-Y modes.
 *
 * Tuned empirically against a real JSROOT render across all four X/Y
 * log×lin combinations and several landscape container sizes: the default
 * (~1.0) and 1.2 still overlap the X tick numbers in log-X, while 1.4 is the
 * first value that clears every combination. 1.6 keeps a safety margin for
 * font/aspect-ratio variation. JSROOT reads `axis.fTitleOffset` directly when
 * drawing the title (TAxisPainter), so these are honoured; the histogram is
 * rebuilt on every (re)draw — see `buildMultigraph` in jsroot-plot.svelte —
 * so the offsets are re-applied after each redraw and on the export pad.
 */
export const AXIS_X_TITLE_OFFSET = 1.6;
export const AXIS_Y_TITLE_OFFSET = 1.6;

/**
 * Pad margins (as fractions of the pad width/height) reserved around the frame
 * for tick labels and axis titles. JSROOT's defaults (~0.1) only leave room for
 * the tick numbers, not the pushed-out titles: with `AXIS_*_TITLE_OFFSET = 1.6`
 * the rotated Y title and the X title sit right at the SVG edge and get clipped
 * (the top of the "S" in "Stopping Power", the descender of the "y" in
 * "Energy"). Enlarging the left and bottom margins shifts the whole frame — and
 * the titles that hang off it — inward, so the titles get a little breathing
 * space inside the SVG instead of being cut off from outside. Applied via
 * `gStyle` before each draw (see `jsroot-plot.svelte`) so every freshly created
 * pad reads them; top/right keep JSROOT's defaults since nothing is clipped
 * there and the tick labels stay clear of the canvas edge.
 */
export const PAD_LEFT_MARGIN = 0.14;
export const PAD_BOTTOM_MARGIN = 0.14;

/**
 * Round `x` up to the next 1, 2, 2.5, or 5 times a power of ten.
 *
 * Used for linear-Y auto-ranging so the curve fills the plot height instead of
 * leaving most of it blank (e.g. a proton-in-water peak at ~2262 → 2500 rather
 * than JSROOT's default ~10000). The 2.5 step is what gives 2262 → 2500 and
 * 0.42 → 0.5 (see #796 acceptance criteria). Non-positive / non-finite inputs
 * fall back to 1 so the axis is always drawable.
 */
export function niceCeil(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return p * n;
}

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

/**
 * Minimal series shape needed to derive Plot energy-axis units.
 * `particleId` identifies libdedx electrons; `particleMassNumber` classifies
 * protons and heavier ions. Both are optional so older tests and fallback data
 * default safely to MeV/nucl rather than being misclassified as protons.
 */
interface SeriesForEnergyAxis {
  particleId?: number | string;
  particleMassNumber?: number | undefined;
  visible: boolean;
}

function isElectronSeries(series: SeriesForEnergyAxis): boolean {
  // External or legacy fixtures may provide only one of these fields, so either
  // the libdedx electron ID or the electron-only A=0 mass number is sufficient.
  // If both are missing, fall through to the non-electron default.
  return series.particleId === ELECTRON_PARTICLE_ID || series.particleMassNumber === 0;
}

function isProtonSeries(series: SeriesForEnergyAxis): boolean {
  return series.particleMassNumber === 1;
}

export function getPlotEnergyAxisUnit(series: SeriesForEnergyAxis[]): PlotEnergyAxisUnit {
  const visibleSeries = series.filter((s) => s.visible);
  // Empty/proton/electron displays are all total-energy MeV; heavier ions
  // without electrons keep libdedx's native per-nucleon energy grid.
  if (visibleSeries.length === 0) return "MeV";
  if (visibleSeries.some(isElectronSeries)) return "MeV";
  if (visibleSeries.every(isProtonSeries)) return "MeV";
  return "MeV/nucl";
}

export function getPlotEnergyAxisLabel(series: SeriesForEnergyAxis[]): string {
  return `Energy [${getPlotEnergyAxisUnit(series)}]`;
}

export function convertEnergyForDisplay(
  energies: number[],
  series: Pick<SeriesForEnergyAxis, "particleMassNumber">,
  axisUnit: PlotEnergyAxisUnit,
): number[] {
  if (axisUnit === "MeV/nucl") return energies;
  // Undefined mass number, electrons (A=0), and protons (A=1) already display
  // in MeV; heavier ions need E_total = E_per_nucl × A.
  const multiplier =
    series.particleMassNumber !== undefined && series.particleMassNumber > 1
      ? series.particleMassNumber
      : 1;
  return multiplier === 1 ? energies : energies.map((energy) => energy * multiplier);
}

interface SeriesForRange {
  result: { energies: number[]; stoppingPowers: number[] };
  particleId?: number | string;
  particleMassNumber?: number | undefined;
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
 * Optional Y-axis ranging controls.
 *
 * `yLog` selects the rounding strategy: log-Y keeps the power-of-ten rounding,
 * linear-Y uses a "nice ceiling" (`niceCeil`) with a zero floor so the curve
 * fills the plot height. `yMin` / `yMax` are manual overrides from the Advanced
 * panel — when present they win verbatim and skip the auto-range entirely. The
 * Advanced-panel UI that supplies them is #798; this only reads them.
 */
interface RangeOptions {
  yLog?: boolean;
  yMin?: number | undefined;
  yMax?: number | undefined;
}

/**
 * Auto-compute axis ranges from all visible series data.
 *
 * X is always rounded to powers of 10 (floor for min, ceil for max). Y depends
 * on `opts.yLog`: log-Y rounds to powers of 10 like X; linear-Y rounds the max
 * up to the next nice ceiling (1/2/2.5/5 ×10ⁿ) and floors the min to 0. A
 * manual `opts.yMin` / `opts.yMax` overrides the corresponding auto bound.
 */
export function computeAxisRanges(
  series: SeriesForRange[],
  preview: SeriesForRange | null,
  stpUnit: StpUnit,
  opts: RangeOptions = {},
): AxisRanges {
  const allVisible = [
    ...(preview && preview.visible ? [preview] : []),
    ...series.filter((s) => s.visible),
  ];

  if (allVisible.length === 0) return DEFAULT_RANGES;
  const energyAxisUnit = getPlotEnergyAxisUnit(allVisible);

  let xMinRaw = Infinity;
  let xMaxRaw = -Infinity;
  let yMinRaw = Infinity;
  let yMaxRaw = -Infinity;

  for (const s of allVisible) {
    const { energies, stoppingPowers } = s.result;
    const xData = convertEnergyForDisplay(energies, s, energyAxisUnit);
    const yData = convertStpForDisplay(stoppingPowers, s.density, stpUnit);

    for (const e of xData) {
      if (e > 0 && e < xMinRaw) xMinRaw = e;
      if (e > xMaxRaw) xMaxRaw = e;
    }
    for (const y of yData) {
      if (y > 0 && y < yMinRaw) yMinRaw = y;
      if (y > yMaxRaw) yMaxRaw = y;
    }
  }

  if (!isFinite(xMinRaw) || !isFinite(xMaxRaw)) return DEFAULT_RANGES;

  // Linear-Y: fill the plot with a nice ceiling and a zero floor. Log-Y keeps
  // power-of-ten rounding. Manual overrides (Advanced panel, #798) win verbatim.
  const autoYMin = opts.yLog === false ? 0 : Math.pow(10, Math.floor(Math.log10(yMinRaw)));
  const autoYMax =
    opts.yLog === false ? niceCeil(yMaxRaw) : Math.pow(10, Math.ceil(Math.log10(yMaxRaw)));

  return {
    xMin: Math.pow(10, Math.floor(Math.log10(xMinRaw))),
    xMax: Math.pow(10, Math.ceil(Math.log10(xMaxRaw))),
    yMin: opts.yMin ?? autoYMin,
    yMax: opts.yMax ?? autoYMax,
  };
}
