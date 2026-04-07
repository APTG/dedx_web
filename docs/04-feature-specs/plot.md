# Feature: Plot Page (Interactive Stopping-Power-vs-Energy Chart)

> **Status:** Draft v1 (7 April 2026)
>
> The Plot page lets users build and compare multiple stopping-power-vs-energy
> curves on an interactive JSROOT chart. Each curve ("series") is a
> (program, particle, material) triplet evaluated over the program's full
> valid energy range.
>
> **Related specs:**
> - Entity selection (full panel mode): [`entity-selection.md`](entity-selection.md)
> - Unit handling (stopping power units, energy units): [`unit-handling.md`](unit-handling.md)
> - Calculator (shared patterns): [`calculator.md`](calculator.md)
> - WASM API contract: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
> - Project vision §3.2, §4.1, §4.5, §10: [`../01-project-vision.md`](../01-project-vision.md)

---

## User Story

**As a** radiation physicist,
**I want to** overlay stopping-power curves from different programs,
particles, and materials on a single interactive plot,
**so that** I can visually compare data sources and identify discrepancies
for my publication or analysis.

**As a** student,
**I want to** see how stopping power varies with energy for different
particles and materials,
**so that** I can build intuition about charged-particle interactions
with matter.

---

## Page Layout Overview

The Plot page uses the **full panel mode** entity selection layout
(always-visible scrollable list panels in a sidebar) as defined in
[`entity-selection.md` § Full Panel Mode](entity-selection.md#full-panel-mode-plot-page).

The page is split into two regions:

| Region | Content | Width (desktop) |
|--------|---------|-----------------|
| **Sidebar** (left) | Entity selection panels (Particle, Material, Program) + "Add Series" button + series list | ~40% (`minmax(360px, 2fr)`) |
| **Main area** (right) | Axis controls + JSROOT plot canvas + export buttons | ~60% (`3fr`) |

On tablet and mobile, the sidebar folds above the main area (see
Responsive Layout).

---

## Inputs

### 1. Entity Selection (full panel mode)

Defined fully in [`entity-selection.md`](entity-selection.md). The Plot
page renders the full panel mode variant: three always-visible scrollable
list panels in the sidebar (Particle, Material, Program) with text
filter inputs, bidirectional filtering, and greyed-out unavailable items.

| Selector | Default | Notes |
|----------|---------|-------|
| Particle | Proton (H) | Scrollable list panel with text filter |
| Material | Water (liquid) | Split panel: Elements + Compounds sub-lists |
| Program | Auto-select → resolved | Scrollable list panel, grouped (Tabulated / Analytical) |

The entity selection component exposes `EntitySelectionState` to the
Plot page. The "Add Series" button is enabled only when
`isComplete === true`.

### 2. "Add Series" Button

| Property | Detail |
|----------|--------|
| Position | Below the entity selection panels in the sidebar, full sidebar width |
| Label | "＋ Add Series" |
| Enabled | When `EntitySelectionState.isComplete === true` |
| Disabled state | Greyed out with tooltip: "Select a particle and material to add a series" |
| Behavior | Adds the current (resolvedProgramId, particle, material) triplet as a new series to the plot. See § Add Series Flow. |
| Soft limit | When 10 series already exist, show an inline warning below the button: "10 series displayed. Adding more may reduce readability." The button remains enabled. |

### 3. Series List

The series list appears in the sidebar, below the "Add Series" button.
It displays all added series and the preview series (if any).

Each series entry shows:

| Element | Detail |
|---------|--------|
| **Color swatch** | Small square (12×12px) filled with the series' assigned color |
| **Label** | Auto-generated context-aware label (see § Smart Series Labels) |
| **Visibility toggle** | Eye icon button — toggles the series on/off on the plot. Hidden series have reduced opacity (~0.4) in the list. |
| **Remove button** | × icon button — removes the series from the plot and list. Not shown for the preview series. |

The series list is scrollable if it exceeds the available sidebar height.

### 4. Stopping Power Unit Selector

| Property | Detail |
|----------|--------|
| Type | Dropdown (`<select>`) in the main area, above the plot canvas |
| Position | Top-left of the main area, inline with axis controls |
| Options | `keV/µm`, `MeV/cm`, `MeV·cm²/g` |
| Default | `keV/µm` |
| Behavior | Changing the unit re-converts all series' Y-axis data and updates the plot. The Y-axis label updates to reflect the chosen unit. |
| Conversion | Uses material density per series. See [`unit-handling.md`](unit-handling.md) §5.2 for formulas. Each series may use a different material with a different density — conversion is per-series. |

> **Note:** Unlike the Calculator page (which auto-switches between
> keV/µm and MeV·cm²/g based on gas vs non-gas), the Plot page uses a
> single user-chosen unit for all series. The user picks the unit that
> makes sense for their comparison. Default is keV/µm.

### 5. Axis Scale Controls

Always visible in the main area, above the plot canvas, inline with the
stopping power unit selector.

| Control | Type | Options | Default |
|---------|------|---------|---------|
| X-axis scale | Segmented control (2 options) | **Log** · Lin | **Log** |
| Y-axis scale | Segmented control (2 options) | **Log** · Lin | **Log** |

Changing an axis scale immediately redraws the JSROOT plot with the new
scale. For log scale, JSROOT uses `logx` / `logy` draw options.

> **Design note:** These controls are always visible (not hidden in a
> collapsible section) because axis scale is a frequent interaction during
> data exploration. Segmented controls (not toggles) make the current
> state unambiguous at a glance.

### 6. "Reset All" Link

A small text link below the "Add Series" button: "Reset all". Clicking it:
1. Clears all series from the plot and series list.
2. Resets entity selection to defaults (Proton / Water / Auto-select).
3. The preview series regenerates for the new default selection.

---

## Behavior

### Default State on First Load

When the Plot page loads for the first time (no URL parameters):

1. WASM initializes and builds the compatibility matrix.
2. Entity selection defaults to: **Proton / Water (liquid) / Auto-select**.
3. The JSROOT canvas is rendered **empty** — no data series plotted.
4. A **preview series** appears on the canvas as a dashed line (see
   § Preview Series), showing the stopping-power curve for the default
   entity selection.
5. The preview series also appears at the top of the series list
   (labelled "Preview" in italics, no remove button).
6. The stopping power unit selector defaults to **keV/µm**.
7. The axis scale controls default to **Log / Log**.
8. The user sees a preview of what they'd get by clicking "Add Series"
   — but the canvas has no committed series until the user acts.

> This matches the project vision §3.2: "selectors pre-filled with
> auto-select / proton / liquid water, but no data plotted until the user
> adds the first series." The preview series provides immediate visual
> feedback without committing a series.

### Preview Series

The preview series provides live visual feedback of the current entity
selection on the plot canvas, before the user commits it as a series.

| Property | Detail |
|----------|--------|
| When shown | Whenever `EntitySelectionState.isComplete === true` |
| When hidden | When entity selection is incomplete (any selector cleared) |
| Visual style | **Dashed line**, black color (`#000`), line width 1.5 |
| Updates | Recalculates whenever the entity selection changes (program, particle, or material). No debounce — entity changes are discrete events. |
| Series list entry | Shown at the top of the series list in *italics*: "Preview — {label}". No remove button. Visibility toggle available. |
| Data | Fetched via `LibdedxService.getPlotData()` with `pointCount: 500`, `logScale: true` |
| Does not persist | The preview series is not included in URL encoding or CSV export. |
| Relationship to "Add Series" | Clicking "Add Series" promotes the current preview into a committed series (solid line, assigned color) and generates a new preview for the same entity selection. |

### Add Series Flow

When the user clicks "Add Series":

1. **Duplicate check:** If a series with the same (resolvedProgramId,
   particleId, materialId) triplet already exists in the committed series
   list, show a brief toast notification: "This series is already plotted."
   Do not add a duplicate.
2. **Create series:** Copy the current preview series data into a new
   committed series entry with:
   - A unique `seriesId` (incrementing integer, starting at 1).
   - An auto-assigned color from the palette (see § Color Palette).
   - An auto-generated label (see § Smart Series Labels).
   - `visible: true`.
   - The `CalculationResult` data from the preview.
   - The entity IDs: `programId`, `particleId`, `materialId`.
   - The material density (for unit conversion).
3. **Update plot:** The new series appears on the JSROOT canvas as a
   solid line with its assigned color. The preview series remains
   (dashed, black) showing the same or next entity selection.
4. **Update series list:** The new series appears in the list below the
   preview entry.
5. **Recompute labels:** All series labels are recomputed — the smart
   labeling algorithm may simplify or expand labels as the set of series
   changes (see § Smart Series Labels).

### Remove Series

Clicking the × button on a series entry:

1. Removes the series from the committed list.
2. Removes its line from the JSROOT canvas.
3. Returns its color to the available pool (colors can be reused).
4. Recomputes all remaining series labels (they may simplify).
5. If this was the last committed series, the plot shows only the
   preview series (or is empty if entity selection is incomplete).

### Toggle Series Visibility

Clicking the eye icon on a series entry:

1. Toggles the series' `visible` flag.
2. If hidden: the line is removed from the JSROOT canvas; the series
   list entry shows at reduced opacity (~0.4).
3. If shown: the line reappears on the canvas; the list entry returns
   to full opacity.
4. Hidden series are excluded from CSV export but remain in the series
   list and URL encoding.

### Entity Selection Changes

When the user changes particle, material, or program in the sidebar:

1. The entity selection component handles bidirectional filtering,
   preserve/fallback, and Auto-select resolution (per
   [`entity-selection.md`](entity-selection.md)).
2. The preview series recalculates for the new entity combination.
3. **Committed series are not affected** — they keep their original data.
4. The entity selection state is shared with the Calculator page
   (persists across navigation via shared store).

### Recalculation Triggers

| Trigger | What happens |
|---------|-------------|
| Entity selection change | Preview series recalculates |
| "Add Series" click | Preview promoted to committed series |
| Stopping power unit change | All series Y-data re-converted (per-series density); plot redraws; Y-axis label updates |
| Axis scale change | Plot redraws with new JSROOT draw options (logx/logy) |
| Series visibility toggle | Plot redraws showing/hiding the affected line |
| Series removal | Plot redraws without the removed line |

---

## Smart Series Labels

Series labels are auto-generated based on what distinguishes the plotted
series from each other. The algorithm inspects all committed series and
determines the **minimum distinguishing fields**:

### Algorithm

Given the set of committed series, determine which entity fields vary:

```typescript
const programs = new Set(series.map(s => s.programId));
const particles = new Set(series.map(s => s.particleId));
const materials = new Set(series.map(s => s.materialId));

const programVaries = programs.size > 1;
const particleVaries = particles.size > 1;
const materialVaries = materials.size > 1;
```

Build the label from varying fields only:

| Varies | Label format | Example |
|--------|-------------|---------|
| Nothing (single series) | `"{particle} in {material}"` | "Proton in Water (liquid)" |
| Only program | `"{program}"` | "ICRU 90", "PSTAR" |
| Only particle | `"{particle}"` | "Proton", "Carbon" |
| Only material | `"{material}"` | "Water (liquid)", "PMMA" |
| Program + particle | `"{program} — {particle}"` | "ICRU 90 — Proton" |
| Program + material | `"{program} — {material}"` | "ICRU 90 — Water" |
| Particle + material | `"{particle} in {material}"` | "Proton in Water" |
| All three vary | `"{program} — {particle} in {material}"` | "ICRU 90 — Proton in Water" |

When a series uses "Auto-select", display the **resolved** program name
(e.g., "ICRU 90"), not "Auto-select".

The preview series label follows the same format, prefixed with "Preview — ".

**Recomputation:** Labels are recomputed whenever a series is added or
removed. This means adding a second series with a different program may
cause the first series' label to change from "Proton in Water" to
"ICRU 90" (only program varies now).

---

## Color Palette

Series colors are assigned sequentially from a fixed palette. The palette
uses common, easily distinguishable colors:

| Index | Color | Hex |
|-------|-------|-----|
| 0 | Black | `#000000` |
| 1 | Red | `#e41a1c` |
| 2 | Blue | `#377eb8` |
| 3 | Green | `#4daf4a` |
| 4 | Purple | `#984ea3` |
| 5 | Orange | `#ff7f00` |
| 6 | Brown | `#a65628` |
| 7 | Pink | `#f781bf` |
| 8 | Grey | `#999999` |
| 9 | Cyan | `#17becf` |

After index 9, wrap around to index 0 (colors may repeat for >10 series).

When a series is removed, its color index is released. The next added
series takes the lowest available color index.

> **Note:** The preview series always uses black (`#000`) with a dashed
> line style, independent of the palette. Committed series index 0 also
> uses black but with a solid line — the dashed vs solid distinction
> prevents confusion.

---

## Plot Data Generation

Each series' data is generated via `LibdedxService.getPlotData()`:

```typescript
const result: CalculationResult = service.getPlotData({
  programId: series.resolvedProgramId,
  particleId: series.particleId,
  materialId: series.materialId,
  pointCount: 500,
  logScale: true,
});
```

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `pointCount` | 500 | Sufficient for visually smooth curves across 3–6 decades of energy |
| `logScale` | `true` | Log-spaced points ensure even coverage on a log-scale X-axis; avoids clustering at high energies |

The returned `CalculationResult` contains:
- `energies: number[]` — 500 energy values in MeV/nucl (X-axis data)
- `stoppingPowers: number[]` — mass stopping powers in MeV·cm²/g (Y-axis raw data)
- `csdaRanges: number[]` — CSDA ranges in g/cm² (not used in v1 plot)

The Y-axis display data is derived by converting `stoppingPowers` from
MeV·cm²/g to the user-selected stopping power unit using the series'
material density:

```typescript
// Per series, using that series' material density
function convertStpForDisplay(
  massStpValues: number[],
  density: number,
  targetUnit: StpUnit
): number[] {
  switch (targetUnit) {
    case "keV/µm":
      return massStpValues.map(s => s * density / 10);
    case "MeV/cm":
      return massStpValues.map(s => s * density);
    case "MeV·cm²/g":
      return massStpValues; // no conversion needed
  }
}
```

> **Important:** Each series may have a different material density. When
> the user selects keV/µm or MeV/cm (density-dependent units), each
> series' data is converted using its own material's density. This means
> cross-material comparisons in keV/µm reflect actual linear energy
> deposition rates, not mass stopping powers.

---

## JSROOT Integration

### Component: `JsrootPlot.svelte`

A Svelte 5 component that manages the JSROOT lifecycle. It renders a
`<div>` container and uses JSROOT's JavaScript API to draw and update
the plot.

### Lifecycle

```
Component mount ($effect)
  → JSROOT.draw(container, multigraph, drawOptions)

Series or settings change ($effect)
  → JSROOT.cleanup(container)
  → JSROOT.redraw(container, multigraph, drawOptions)

Component destroy ($effect cleanup)
  → JSROOT.cleanup(container)

Window resize ($effect with resize observer)
  → JSROOT.resize(container)
```

### TMultiGraph Construction

All visible series (preview + committed) are combined into a single
JSROOT `TMultiGraph`:

```typescript
function buildMultigraph(
  series: PlotSeries[],
  preview: PlotSeries | null,
  stpUnit: StpUnit,
  xMin: number, xMax: number,
  yMin: number, yMax: number
): TMultiGraph {
  const visible = [
    ...(preview?.visible ? [preview] : []),
    ...series.filter(s => s.visible),
  ];

  const graphs = visible.map(s => {
    const yData = convertStpForDisplay(
      s.result.stoppingPowers, s.density, stpUnit
    );
    const tgraph = JSROOT.createTGraph(
      s.result.energies.length,
      s.result.energies,
      yData
    );
    tgraph.fLineColor = s.jsrootColorIndex;
    tgraph.fLineWidth = s === preview ? 1 : 2;
    tgraph.fLineStyle = s === preview ? 2 : 1; // 2 = dashed, 1 = solid
    tgraph.fTitle = "";
    // Disable graph dragging (kNotEditable bit 18)
    tgraph.InvertBit(JSROOT.BIT(18));
    return tgraph;
  });

  const mg = JSROOT.createTMultiGraph(...graphs);

  // Set axis labels and ranges via a histogram frame
  const hist = JSROOT.createHistogram("TH1F", 20);
  hist.fXaxis.fTitle = "Energy [MeV/nucl]";
  hist.fXaxis.fXmin = xMin;
  hist.fXaxis.fXmax = xMax;
  hist.fYaxis.fTitle = `Stopping Power [${stpUnit}]`;
  hist.fMinimum = yMin;
  hist.fMaximum = yMax;
  // Center axis labels
  hist.fXaxis.InvertBit(JSROOT.BIT(12));
  hist.fYaxis.InvertBit(JSROOT.BIT(12));
  hist.fTitle = "";
  mg.fHistogram = hist;

  return mg;
}
```

### Draw Options

Constructed from the current axis scale settings:

```typescript
function buildDrawOptions(xLog: boolean, yLog: boolean): string {
  const opts: string[] = [];
  if (xLog) opts.push("logx");
  if (yLog) opts.push("logy");
  opts.push("gridx", "gridy", "tickx", "ticky");
  return opts.join(";");
}
```

Gridlines are always on (matching the default log-log scientific plot
style). Tick marks on all axes.

### Axis Ranges

Axis ranges are auto-computed from the visible series data:

- **X-axis:** The union of all visible series' energy ranges, rounded to
  powers of 10 (e.g., 0.001–10000 MeV/nucl). Computed as:
  ```
  xMin = 10^floor(log10(min(all visible energies)))
  xMax = 10^ceil(log10(max(all visible energies)))
  ```
- **Y-axis:** Same power-of-10 rounding applied to the converted
  stopping power values.

If no series are visible, use default placeholder ranges (0.001–10000
for X, 0.1–1000 for Y).

### Container Sizing

The JSROOT container div uses:
- `width: 100%` of the main area.
- `height: min(60vh, 600px)` on desktop; `height: 50vh` on mobile.
- The container must have explicit dimensions before `JSROOT.draw()` is
  called (JSROOT requires a sized container).

### JSROOT Loading

JSROOT is loaded dynamically (it is a large library). The component
shows a loading spinner ("Loading plot engine…") until JSROOT is ready.
Use dynamic `import()` or a script tag — architecture TBD.

### Interactive Features (JSROOT built-in)

JSROOT provides built-in interactivity:
- **Zoom:** Click-drag on the canvas to zoom into a region.
- **Pan:** Right-click-drag (or shift+drag) to pan.
- **Reset zoom:** Double-click to reset to the auto-computed axis ranges.
- **Tooltip:** Hovering over a line shows the (x, y) value at that point.

These are enabled by default in JSROOT and require no additional
configuration.

---

## Shared State

### Entity Selection (shared with Calculator)

The entity selection state (`EntitySelectionState`) is shared between the
Calculator page and the Plot page via a shared runes-based store. Changing
the particle on the Calculator page and navigating to the Plot page shows
the same particle pre-selected.

Both pages read and write the same store. The full panel mode (Plot) and
compact mode (Calculator) are different visual renderings of the same
underlying state.

### Plot-Page-Only State

The following state is specific to the Plot page and does **not** persist
to the Calculator page:

- Series list (committed series)
- Preview series
- Stopping power unit selection
- Axis scale settings (log/lin)

This state **does** persist in the URL for shareability (see § URL State
Encoding), and survives navigation away from and back to the Plot page
within the same session (via a page-level store that outlives the route
component).

---

## URL State Encoding

The Plot page state is fully encoded in URL query parameters for
shareability.

### Parameters

| Parameter | Example | Notes |
|-----------|---------|-------|
| `particle` | `1` | Current entity selection — particle ID (shared with Calculator URL) |
| `material` | `276` | Current entity selection — material ID |
| `program` | `auto` or `2` | Current entity selection — program |
| `series` | `2.1.276,9.6.276,2.1.104` | Comma-separated series triplets: `programId.particleId.materialId` |
| `stp_unit` | `keV/um` | Stopping power unit: `keV/um`, `MeV/cm`, `MeV.cm2/g` |
| `xscale` | `log` | X-axis scale: `log` or `lin` |
| `yscale` | `log` | Y-axis scale: `log` or `lin` |

### Series Encoding

Each committed series is encoded as a `programId.particleId.materialId`
triplet using dot separators. Multiple series are comma-separated.

For "Auto-select" series, the **resolved** program ID is encoded (not -1).
This ensures the URL is self-contained — the recipient sees the same
program even if auto-selection rules change.

```
series=2.1.276,9.6.276
```
→ Series 1: PSTAR (2), Proton (1), Water (276)
→ Series 2: ICRU 90 (9), Carbon (6), Water (276)

### URL → State (on page load)

1. Parse `series` parameter into an array of triplets.
2. For each triplet, validate the (program, particle, material)
   combination via the compatibility matrix.
3. Fetch plot data for each valid triplet via `getPlotData()`.
4. Invalid triplets are silently ignored (partial load is OK).
5. Set entity selection from `particle`, `material`, `program` params.
6. Set stopping power unit from `stp_unit` (default keV/µm if missing).
7. Set axis scales from `xscale`, `yscale` (default log if missing).

### State → URL (on state change)

The URL is updated (via `replaceState`, not `pushState` — no new history
entry for every change) whenever:
- A series is added or removed.
- Entity selection changes.
- Stopping power unit changes.
- Axis scale changes.

The preview series is not encoded in the URL.

---

## Export

Two export buttons appear in the main area, below the JSROOT canvas:

### Export PNG

| Property | Detail |
|----------|--------|
| Button label | "Export PNG" |
| Behavior | Captures the current JSROOT canvas as a PNG image using JSROOT's built-in `JSROOT.toJSON()` → `JSROOT.makeSVG()` or canvas snapshot API. |
| Filename | `dedx_plot.png` |
| Resolution | 2× canvas pixel dimensions (Retina-quality) |
| Includes | All visible series, axis labels, gridlines. Does **not** include the sidebar or series list. |

### Export CSV

| Property | Detail |
|----------|--------|
| Button label | "Export CSV" |
| Behavior | Exports all **visible** series data as a CSV file. |
| Filename | `dedx_plot_data.csv` |
| Format | UTF-8 with BOM, comma delimiter |
| Columns | See below |

CSV column layout — each series gets two columns (energy is shared as
the first column only if all series have the same energy grid, otherwise
each series has its own energy column):

**Same energy grid** (all series use log-spaced 500 points over the same
range — unlikely for different programs):
```csv
Energy [MeV/nucl], Stp Power [keV/µm] (ICRU 90 - Proton in Water), Stp Power [keV/µm] (PSTAR - Proton in Water)
0.001, 543.2, 541.8
0.00112, 530.1, 528.7
...
```

**Different energy grids** (typical — different programs have different
energy bounds):
```csv
Energy [MeV/nucl] (ICRU 90 - Proton in Water), Stp Power [keV/µm] (ICRU 90 - Proton in Water), Energy [MeV/nucl] (PSTAR - Proton in Water), Stp Power [keV/µm] (PSTAR - Proton in Water)
0.001, 543.2, 0.001, 541.8
...
```

The stopping power values are exported in the currently selected display
unit (as shown on the Y-axis).

Hidden (toggled-off) series are excluded from the CSV.

---

## Responsive Layout

### Desktop (≥900px) — Sidebar + Canvas

```
┌─── SIDEBAR (≈40% width) ──────────────────────┐ ┌── MAIN (≈60%) ──────────────┐
│                                                │ │                              │
│ ┌─────────────┐ ┌────────────────────────────┐ │ │ Stp Unit: [keV/µm ▾]        │
│ │ ① Particle  │ │ ② Target Material          │ │ │ X: (•)Log ( )Lin             │
│ │ [Filter.. ] │ │ [Filter...               ] │ │ │ Y: (•)Log ( )Lin             │
│ │ ┌─────────┐ │ │ ┌──────────┬─────────────┐ │ │ │                              │
│ │ │ Proton  │ │ │ │ ELEMENTS │ COMPOUNDS   │ │ │ │ ┌──────────────────────────┐ │
│ │ │ Alpha   │ │ │ │ 1  H     │ 276 Water   │ │ │ │ │                          │ │
│ │ │ Lithium │ │ │ │ 2  He    │ 99  A-150   │ │ │ │ │    JSROOT Plot Canvas    │ │
│ │ │ ...  ↕  │ │ │ │ ...  ↕   │ ...   ↕     │ │ │ │ │                          │ │
│ │ └─────────┘ │ │ └──────────┴─────────────┘ │ │ │ │                          │ │
│ └─────────────┘ └────────────────────────────┘ │ │ │                          │ │
│                                                │ │ └──────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │ │                              │
│ │ ③ Program        Auto-select → ICRU 90    │ │ │ [Export PNG]  [Export CSV]   │
│ │ [Filter... ]                               │ │ └──────────────────────────────┘
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ ── Tabulated ──                        │ │ │
│ │ │ ASTAR · PSTAR · MSTAR · ICRU49 · …    │ │ │
│ │ │ ── Analytical ──                       │ │ │
│ │ │ Bethe-Bloch · Bethe-Ext               │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│               [ ＋ Add Series ]                 │
│               [ Reset all ]                    │
│                                                │
│ ┌─ Series ─────────────────────────────────┐  │
│ │ - - Preview — Proton in Water       👁   │  │
│ │ ■ ICRU 90 — Proton in Water     👁  ×   │  │
│ │ ■ PSTAR — Proton in Water       👁  ×   │  │
│ └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

- Page grid: `grid-template-columns: minmax(360px, 2fr) 3fr`.
- Entity panel layout within the sidebar follows
  [`entity-selection.md` § Desktop wireframe](entity-selection.md#desktop-900px--sidebar--canvas).
- The JSROOT canvas has `min-height: 400px; height: min(60vh, 600px)`.
- Export buttons are right-aligned below the canvas.

### Tablet (600–899px) — Stacked

The sidebar folds **above** the main area. Entity panels remain in their
sub-grid layout (Particle + Material side-by-side, Program below). The
series list sits between the panels and the canvas:

```
┌────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌────────────────────────────┐ │
│ │ ① Particle  │ │ ② Material                 │ │
│ │ [Filter]    │ │ [Filter]                   │ │
│ │ Proton ↕    │ │ Elem ↕  │  Comp ↕          │ │
│ └─────────────┘ └────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │ ③ Program   Auto → ICRU  [Filter] ↕       │ │
│ └────────────────────────────────────────────┘ │
│ [ ＋ Add Series ]    [ Reset all ]              │
│ ┌─ Series ─────────────────────────────────┐  │
│ │ ■ ICRU 90 — Proton in Water  👁  ×       │  │
│ └──────────────────────────────────────────┘  │
├────────────────────────────────────────────────┤
│ Stp: [keV/µm ▾]   X: (•)Log ( )Lin           │
│                    Y: (•)Log ( )Lin           │
│ ┌────────────────────────────────────────────┐ │
│ │            JSROOT Plot Canvas               │ │
│ └────────────────────────────────────────────┘ │
│              [Export PNG]  [Export CSV]         │
└────────────────────────────────────────────────┘
```

Entity panel list heights reduced to ~250px for Particle/Material,
~120px for Program.

### Mobile (<600px) — Fully Stacked

All panels stack vertically. The series list acts as the legend (no
JSROOT-rendered legend needed). The plot canvas becomes touch-zoomable.

```
┌──────────────────────────────────────┐
│ ① Particle                           │
│ [Filter...                        ]  │
│ ┌──────────────────────────────────┐ │
│ │ Proton · Alpha · Carbon  ↕       │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ ② Target Material                    │
│ [Filter...                        ]  │
│ ┌────────────┬───────────────────┐   │
│ │ ELEMENTS   │ COMPOUNDS         │   │
│ │ ...  ↕     │ ...    ↕          │   │
│ └────────────┴───────────────────┘   │
├──────────────────────────────────────┤
│ ③ Program  Auto → ICRU              │
│ [Filter]  PSTAR · ASTAR ↕           │
├──────────────────────────────────────┤
│ [ ＋ Add Series ]   [ Reset all ]    │
├──────────────────────────────────────┤
│ Series:                              │
│ ■ ICRU 90 — Proton in Water  👁 ×   │
│ ■ PSTAR — Proton in Water    👁 ×   │
├──────────────────────────────────────┤
│ Stp: [keV/µm ▾]  X: Log/Lin        │
│                   Y: Log/Lin        │
│ ┌──────────────────────────────────┐ │
│ │        JSROOT Plot Canvas        │ │
│ │      (touch zoom/pan enabled)    │ │
│ └──────────────────────────────────┘ │
│       [Export PNG] [Export CSV]      │
└──────────────────────────────────────┘
```

On mobile, the JSROOT canvas uses `height: 50vh` (at least 300px).

---

## State Management

The Plot page state is modeled with Svelte 5 runes:

```typescript
/** A committed data series on the plot. */
interface PlotSeries {
  /** Unique series identifier (incrementing integer). */
  seriesId: number;
  /** The program ID (resolved, not -1). */
  programId: number;
  /** The particle ID. */
  particleId: number;
  /** The material ID. */
  materialId: number;
  /** Display label (auto-generated, recomputed on series list changes). */
  label: string;
  /** Assigned color hex string (from palette). */
  color: string;
  /** JSROOT color index (fLineColor). */
  jsrootColorIndex: number;
  /** Whether the series is currently visible on the plot. */
  visible: boolean;
  /** The calculation result (500 points). */
  result: CalculationResult;
  /** Material density in g/cm³ (for stopping power unit conversion). */
  density: number;
  /** Entity names for label generation. */
  programName: string;
  particleName: string;
  materialName: string;
}

/** Plot page reactive state. */
interface PlotState {
  /** From the entity selection component (shared store). */
  entitySelection: EntitySelectionState;

  /** The preview series (or null if entity selection is incomplete). */
  preview: PlotSeries | null;

  /** Committed data series. */
  series: PlotSeries[];

  /** Next series ID to assign. */
  nextSeriesId: number;

  /** Current stopping power display unit. */
  stpUnit: StpUnit;

  /** X-axis logarithmic scale. */
  xLog: boolean;

  /** Y-axis logarithmic scale. */
  yLog: boolean;

  /** Whether JSROOT is loaded and ready. */
  jsrootReady: boolean;

  /** Error from JSROOT loading or plot data generation. */
  error: string | null;
}
```

### Derived State (via `$derived`)

```typescript
/** All visible series (for JSROOT rendering). */
const visibleSeries: PlotSeries[] = $derived(
  state.series.filter(s => s.visible)
);

/** Whether the "Add Series" button should be enabled. */
const canAddSeries: boolean = $derived(
  state.entitySelection.isComplete
);

/** Whether the current entity selection duplicates an existing series. */
const isDuplicate: boolean = $derived(
  state.series.some(s =>
    s.programId === state.entitySelection.resolvedProgramId &&
    s.particleId === state.entitySelection.particle?.id &&
    s.materialId === state.entitySelection.material?.id
  )
);

/** JSROOT draw options string. */
const drawOptions: string = $derived(
  buildDrawOptions(state.xLog, state.yLog)
);

/** Auto-computed axis ranges from visible data. */
const axisRanges = $derived(
  computeAxisRanges(visibleSeries, state.preview, state.stpUnit)
);
```

### Reactivity Chain

```
entitySelection changes
  → $effect: fetch preview plot data via getPlotData()
  → update state.preview

"Add Series" click
  → promote preview → state.series
  → $derived: recompute labels for all series
  → $effect: rebuild TMultiGraph + JSROOT.redraw()

stpUnit change
  → $derived: re-convert Y data for all series
  → $effect: rebuild TMultiGraph + JSROOT.redraw()

xLog / yLog change
  → $derived: rebuild draw options string
  → $effect: JSROOT.redraw() with new options

series visibility toggle
  → $derived: visibleSeries updates
  → $effect: rebuild TMultiGraph + JSROOT.redraw()

series removal
  → update state.series
  → $derived: recompute labels, recompute visibleSeries
  → $effect: rebuild TMultiGraph + JSROOT.redraw()
```

---

## Error Handling

### WASM Initialization Failure

Same as Calculator page: all controls disabled, error banner with retry
button.

### JSROOT Loading Failure

- Show an error message in the canvas area: "Failed to load the plot
  engine. Please refresh the page."
- Entity selection and series management remain functional (the user can
  still add/remove series — they just won't be rendered).

### Plot Data Fetch Error

If `getPlotData()` throws a `LibdedxError` for a specific series:

- **Preview series:** Show the error inline below the "Add Series" button:
  "Cannot plot: {error message}". The "Add Series" button is disabled.
- **Committed series (from URL load):** Skip the failed series silently.
  Show a toast: "Could not load series {label}: {error message}".

### Invalid Entity Selection

When entity selection is incomplete (`isComplete === false`):
- The preview series is null (no dashed line on the canvas).
- The "Add Series" button is disabled.
- The canvas shows either the existing committed series or an empty plot
  with placeholder axis ranges.

---

## Accessibility

- The JSROOT canvas `<div>` has `role="img"` and an `aria-label`
  describing the plot contents (e.g., "Stopping power vs energy plot
  with 3 data series").
- The series list uses `role="list"` with `role="listitem"` per entry.
- Visibility toggle buttons have `aria-label`: "Hide series {label}" /
  "Show series {label}" and `aria-pressed` state.
- Remove buttons have `aria-label`: "Remove series {label}".
- The "Add Series" button has `aria-disabled="true"` when disabled, with
  a descriptive `aria-label`.
- Axis scale segmented controls use `role="radiogroup"` with
  `role="radio"` items.
- The stopping power unit selector has an associated `<label>`.
- Color swatches have a `title` attribute with the color name for
  screen readers.
- Export buttons describe their action: "Export plot as PNG image",
  "Export visible series data as CSV".

---

## Acceptance Criteria

### Default State
- [ ] On first load (no URL params), entity selection shows Proton / Water (liquid) / Auto-select.
- [ ] The JSROOT canvas renders with empty axes (log-log, gridlines on).
- [ ] A preview series (dashed black line) appears showing Proton in Water stopping power.
- [ ] The preview series appears in the series list in italics with "Preview — " prefix.
- [ ] The stopping power unit selector defaults to keV/µm.
- [ ] The axis scale controls default to Log / Log and are always visible.
- [ ] No committed series exist until the user clicks "Add Series".

### Entity Selection
- [ ] Full panel mode is used (scrollable list panels, not dropdown comboboxes).
- [ ] Three panels displayed in the sidebar: Particle, Material, Program.
- [ ] Entity selection state is shared with the Calculator page (persists across navigation).
- [ ] Changing entity selection updates the preview series.

### Preview Series
- [ ] A dashed black line appears on the canvas when entity selection is complete.
- [ ] The preview disappears when entity selection is incomplete (any selector cleared).
- [ ] The preview updates immediately when entity selection changes.
- [ ] The preview is not included in URL encoding or CSV export.
- [ ] The preview has a visibility toggle in the series list but no remove button.

### Add Series
- [ ] Clicking "Add Series" adds the current entity selection as a committed series with a solid line and assigned color.
- [ ] The "Add Series" button is disabled when entity selection is incomplete.
- [ ] Adding a duplicate (same program + particle + material) shows a toast and does not add.
- [ ] At 10 series, a soft warning is shown but the button remains enabled.
- [ ] Each new series receives the next available color from the palette.

### Series List
- [ ] Each series entry shows: color swatch, auto-generated label, visibility toggle, remove button.
- [ ] Clicking the visibility toggle hides/shows the series line on the canvas.
- [ ] Hidden series show at reduced opacity in the list.
- [ ] Clicking remove (×) removes the series from the list and canvas.
- [ ] The preview series has no remove button.

### Smart Labels
- [ ] When all series share the same particle and material but differ by program, labels show only the program name.
- [ ] When all series share the same program and material but differ by particle, labels show only the particle name.
- [ ] When multiple fields vary, labels include all varying fields.
- [ ] Labels use the resolved program name (not "Auto-select").
- [ ] Labels recompute when series are added or removed.

### Color Palette
- [ ] Series colors are assigned sequentially: black, red, blue, green, purple, orange, brown, pink, grey, cyan.
- [ ] When a series is removed, its color index becomes available for reuse.
- [ ] The preview series always uses black dashed regardless of the palette state.

### Plot Data
- [ ] Each series uses 500 log-spaced energy points from `getPlotData()`.
- [ ] Stopping power values are converted to the selected display unit using per-series material density.

### JSROOT Canvas
- [ ] The plot renders using JSROOT `TMultiGraph` with proper axis labels.
- [ ] X-axis label: "Energy [MeV/nucl]".
- [ ] Y-axis label: "Stopping Power [{unit}]" — updates when unit changes.
- [ ] Axis ranges auto-compute from visible data, rounded to powers of 10.
- [ ] Zoom (click-drag), pan (shift-drag), and reset (double-click) work.
- [ ] The canvas resizes correctly when the browser window is resized.
- [ ] No JSROOT-rendered legend on the canvas (the sidebar series list serves as the legend).

### Axis Scale Controls
- [ ] X- and Y-axis scale controls are always visible (not collapsed).
- [ ] Switching between Log and Lin immediately redraws the plot.
- [ ] Default is Log / Log.
- [ ] Controls use segmented control style (not toggles or checkboxes).

### Stopping Power Unit
- [ ] A dropdown selector offers keV/µm, MeV/cm, MeV·cm²/g.
- [ ] Default is keV/µm.
- [ ] Changing the unit re-converts all series' Y-data and redraws the plot.
- [ ] The Y-axis label updates to reflect the selected unit.
- [ ] Conversion uses each series' own material density (per-series conversion).

### URL State
- [ ] Committed series are encoded as `programId.particleId.materialId` triplets in a `series` URL parameter.
- [ ] Entity selection, stopping power unit, and axis scales are encoded in the URL.
- [ ] Loading a URL with valid `series` restores the series and renders them on the plot.
- [ ] Invalid series triplets in the URL are silently skipped.
- [ ] The URL updates (replaceState) on each state change.

### Export
- [ ] "Export PNG" captures the JSROOT canvas as a PNG image.
- [ ] "Export CSV" exports all visible series data with energy and stopping power columns.
- [ ] CSV uses UTF-8 with BOM, comma delimiter.
- [ ] CSV column headers include the unit and series label.
- [ ] Hidden series are excluded from CSV export.

### Responsive
- [ ] On desktop (≥900px), sidebar (~40%) and canvas (~60%) are side-by-side.
- [ ] On tablet (600–899px), sidebar folds above the canvas.
- [ ] On mobile (<600px), all elements stack vertically; the canvas is at least 300px tall.
- [ ] The series list is visible on all breakpoints (acts as the legend).

### Error Handling
- [ ] WASM init failure shows an error banner with retry; all controls disabled.
- [ ] JSROOT loading failure shows an error in the canvas area.
- [ ] Plot data errors for preview show inline error below "Add Series".
- [ ] Plot data errors for URL-loaded series show a toast and skip.

### Performance
- [ ] Plot data generation (500 points) completes in < 200ms per series.
- [ ] Adding a series and redrawing the plot takes < 500ms.
- [ ] JSROOT redraw on axis scale change is < 200ms.

### Accessibility
- [ ] Canvas has `role="img"` with descriptive `aria-label`.
- [ ] Series list uses proper list roles.
- [ ] All buttons have descriptive `aria-label` attributes.
- [ ] Axis scale controls use `role="radiogroup"`.
- [ ] Export buttons describe their action.

---

## Dependencies

- **`EntitySelectionState`** and full panel mode component from
  [`entity-selection.md`](entity-selection.md)
- **`LibdedxService`** interface from
  [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md):
  `getPlotData()`, `getDensity()`, `getMinEnergy()`, `getMaxEnergy()`
- **`CalculationResult`**, **`StpUnit`**, **`ProgramEntity`**,
  **`ParticleEntity`**, **`MaterialEntity`** types from the WASM API
  contract
- **`CompatibilityMatrix`** for entity validation
- **JSROOT** library (dynamically loaded)
- **Unit handling** from [`unit-handling.md`](unit-handling.md) §5.2
  for stopping power conversion formulas
- Svelte 5 runes: `$state`, `$derived`, `$effect`
- Tailwind CSS for layout and responsive breakpoints

---

## Open Questions

1. **JSROOT version and import strategy:** JSROOT 7.x supports ES module
   imports. Should we use a CDN, npm package, or vendor the library?
   *Deferred to architecture/tech-stack docs.*

2. **JSROOT SVG vs Canvas rendering:** JSROOT can render to SVG (better
   for vector export) or Canvas (better for performance with many points).
   With 500 points × 10 series, Canvas may be preferred.
   *Deferred to implementation — test both.*

3. **Touch interactions on mobile:** JSROOT's built-in zoom/pan uses
   mouse events. Touch support may need explicit configuration or a
   JSROOT option. *Verify during implementation.*

4. **Series persistence across page navigation:** Should the series list
   survive navigating away from the Plot page and back? Current design
   says yes (page-level store). If the user reloads the page, series are
   lost unless the URL was bookmarked.
   *Current decision: series persist in the page-level store within a
   session and in the URL across sessions.*

5. **PNG export quality:** JSROOT's `makeSVG()` produces vector output
   that can be rasterized at any resolution. Should we offer SVG export
   in addition to PNG? *Deferred to `export.md` spec.*

6. **CSV column layout for many series:** With 10 series × 2 columns
   each = 20 columns — this may be unwieldy. Should we offer a "long
   format" CSV option (one row per data point per series)?
   *Deferred to `export.md` spec.*
