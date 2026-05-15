# Feature: Plot Page (Interactive Stopping-Power-vs-Energy Chart)

> **Status:** Final v5 (13 April 2026)
>
> **v5** (13 April 2026): Export layout updated per `export.md` v3 §0.
> "Export PDF" and "Export CSV ↓" moved from controls bar to the **app
> toolbar** (upper-right, left of "Share URL"). Controls bar now contains
> only the image export control ("Export image ▾" dropdown). Wireframes
> and Export section and AC updated. "Export image ▾" stays adjacent to
> the canvas it exports.
>
> **v4** (13 April 2026): Controls bar updated — "Export PDF" button added
> between "Export image ▾" and "Export CSV ↓". Export section updated to
> document external-data CSV rules (always Case B with ext series; `#`
> comment rows) per [`export.md`](export.md) v2.
>
> **v3** (13 April 2026): Export section updated to align with
> [`export.md`](export.md) Final v1. "Export PNG" single button replaced
> by "Export image ▾" dropdown offering PNG and SVG. CSV column layout
> documented as wide-format only. Open Questions #5 and #6 resolved.
>
> **v2** (7 April 2026): Stage 1 unit-conversion finalization.
> Clarified that Plot uses user-selected global stopping-power units
> (not phase auto-switch) while keeping the same density-based formulas
> as Calculator. Normalized URL unit tokens and added numeric conversion
> acceptance examples.
>
> The Plot page lets users build and compare multiple stopping-power-vs-energy
> curves on an interactive JSROOT chart. Each curve ("series") is a
> (program, particle, material) triplet evaluated over the program's full
> valid energy range.
>
> **Related specs:**
>
> - Entity selection (full panel mode): [`entity-selection.md`](entity-selection.md)
> - Unit handling (stopping power units, energy units): [`unit-handling.md`](unit-handling.md)
> - Calculator (shared patterns): [`calculator.md`](calculator.md)
> - Export (image + CSV, full spec): [`export.md`](export.md)
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

| Region                | Content                                                                         | Width (desktop)             |
| --------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| **Sidebar** (left)    | Entity selection panels (Particle, Material, Program) + "Add Series" button     | ~30% (`minmax(360px, 3fr)`) |
| **Main area** (right) | Controls bar (unit + axis controls + export) + JSROOT plot canvas + series list | ~70% (`7fr`)                |

On tablet and mobile, the sidebar folds above the main area (see
Responsive Layout).

---

## Inputs

### 1. Entity Selection (full panel mode)

Defined fully in [`entity-selection.md`](entity-selection.md). The Plot
page renders the full panel mode variant: three always-visible scrollable
list panels in the sidebar (Particle, Material, Program) with text
filter inputs, bidirectional filtering, and greyed-out unavailable items.

| Selector | Default                | Notes                                                   |
| -------- | ---------------------- | ------------------------------------------------------- |
| Particle | Proton (H)             | Scrollable list panel with text filter                  |
| Material | Water (liquid)         | Split panel: Elements + Compounds sub-lists             |
| Program  | Auto-select → resolved | Scrollable list panel, grouped (Tabulated / Analytical) |

The entity selection component exposes `EntitySelectionState` to the
Plot page. The "Add Series" button is enabled only when
`isComplete === true`.

### 2. "Add Series" Button

| Property       | Detail                                                                                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Position       | Below the entity selection panels in the sidebar, full sidebar width                                                                                                                                                                                                                                      |
| Label          | "＋ Add Series"                                                                                                                                                                                                                                                                                           |
| Enabled        | When `EntitySelectionState.isComplete === true`                                                                                                                                                                                                                                                           |
| Disabled state | Greyed out with tooltip: "Select a particle and material to add a series"                                                                                                                                                                                                                                 |
| Behavior       | Adds the current (resolvedProgramId, particle, material) triplet as a new series to the plot. See § Add Series Flow.                                                                                                                                                                                      |
| Soft limit     | When 10 series already exist, show an inline warning below the button: "10 series displayed. Adding more may reduce readability." The button remains enabled.                                                                                                                                             |
| Post-add hint  | After the first 1–2 "Add Series" clicks (tracked across sessions via `localStorage`), show a brief inline hint below the button: _"Change particle, material, or program to compare."_ The hint dismisses on the next user interaction with any entity selector. Suppressed permanently after 2 showings. |

### 3. Series List

The series list appears in the **main area, below the JSROOT canvas**.
It displays all added series and the preview series (if any). Placing
it below the canvas keeps it spatially close to the plot it describes
and always visible alongside the chart. The sidebar stays focused on
entity selection + "Add Series".

Each series entry shows:

| Element               | Detail                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Color swatch**      | 16×16px square filled with the series' assigned color, followed by a short line sample (~24px) in the series' line style (solid for committed, dashed for preview) |
| **Label**             | Auto-generated context-aware label (see § Smart Series Labels)                                                                                                     |
| **Visibility toggle** | Eye icon button — toggles the series on/off on the plot. Hidden series have reduced opacity (~0.4) in the list.                                                    |
| **Remove button**     | × icon button — removes the series from the plot and list. Not shown for the preview series.                                                                       |

The series list is scrollable if it exceeds a maximum height of ~200px.

### 4. Stopping Power Unit Selector

| Property   | Detail                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type       | Segmented control (3 options) in the controls bar, above the plot canvas                                                                                                                      |
| Position   | Left side of the controls bar, inline with axis controls                                                                                                                                      |
| Options    | `keV/µm`, `MeV/cm`, `MeV·cm²/g`                                                                                                                                                               |
| Default    | `keV/µm`                                                                                                                                                                                      |
| Behavior   | Changing the unit re-converts all series' Y-axis data and updates the plot. The Y-axis label updates to reflect the chosen unit.                                                              |
| Conversion | Uses material density per series. See [`unit-handling.md`](unit-handling.md) §5.2 for formulas. Each series may use a different material with a different density — conversion is per-series. |

> **Note:** Unlike the Calculator page (which auto-switches between
> keV/µm and MeV·cm²/g based on gas vs non-gas), the Plot page uses a
> single user-chosen unit for all series. The user picks the unit that
> makes sense for their comparison. Default is keV/µm.
>
> **Math consistency contract:** Plot and Calculator use the same
> conversion formulas from [`unit-handling.md`](unit-handling.md) §5.2.
> The only intentional difference is default behavior selection.
>
> **Design note:** A segmented control (not a `<select>` dropdown) is
> used for consistency with the axis scale controls and the project's
> own design principle (§4.2 in the project vision): prefer segmented
> controls when there are 2–5 mutually exclusive options.

### 5. Energy X-Axis Units

The Plot page does not expose an energy-unit selector. Instead, the X-axis
unit is derived from the currently visible plot series (including the preview
series on the canvas):

| Visible particle mix                 | X-axis label        | X data displayed                                                                                            |
| ------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Protons only (A = 1)                 | `Energy [MeV]`      | Native plot energies; MeV and MeV/nucl are numerically identical for protons.                               |
| Any electron series                  | `Energy [MeV]`      | Electron energies are already MeV; ion energies are multiplied by their mass number A to display total MeV. |
| Any heavy ion and no electron series | `Energy [MeV/nucl]` | Native plot energies, matching libdedx ion plot data.                                                       |

Hidden series are ignored for this derivation. CSV export uses the same
energy-unit derivation for exported energy column headers and values, excluding
the preview series as usual.

Electron support follows the WASM/API capability contract: built-in ESTAR
electron calculations are unavailable in libdedx v1.4.0, so built-in electrons
remain unavailable in the selector. If a compatible external electron series is
loaded, the Plot page applies the electron rule above.

### 6. Axis Scale Controls

Always visible in the main area, above the plot canvas, inline with the
stopping power unit selector.

| Control      | Type                          | Options       | Default |
| ------------ | ----------------------------- | ------------- | ------- |
| X-axis scale | Segmented control (2 options) | **Log** · Lin | **Log** |
| Y-axis scale | Segmented control (2 options) | **Log** · Lin | **Log** |

Changing an axis scale immediately redraws the JSROOT plot with the new
scale. For log scale, JSROOT uses `logx` / `logy` draw options.

> **Design note:** These controls are always visible (not hidden in a
> collapsible section) because axis scale is a frequent interaction during
> data exploration. Segmented controls (not toggles) make the current
> state unambiguous at a glance.

### 7. "Reset All" Link

A small text link below the "Add Series" button: "Reset all".

**When 0–1 committed series exist:** Executes immediately:

1. Clears all series from the plot and series list.
2. Resets entity selection to defaults (Proton / Water / Auto-select).
3. The preview series regenerates for the new default selection.

**When ≥2 committed series exist:** Shows a confirmation dialog first:
"Remove all _N_ series and reset selections?" with **Cancel** and
**Reset** buttons. Only proceeds on "Reset" confirmation.

---

## Behavior

### Default State on First Load

When the Plot page loads for the first time (no URL parameters):

1. WASM initializes and builds the compatibility matrix.
2. Entity selection defaults to: **Proton / Water (liquid) / Auto-select**.
3. The JSROOT canvas renders with axes, gridlines, and labels — but
   **no committed series**. A **preview series** (dashed black line)
   appears on the canvas showing the stopping-power curve for the
   default entity selection. The preview is a transient hint, not a
   committed data series.
4. The preview series also appears at the top of the series list
   (labelled "Preview" in italics, no remove button).
5. The stopping power unit selector defaults to **keV/µm**.
6. The axis scale controls default to **Log / Log**.
7. The user sees a preview of what they'd get by clicking "Add Series"
   — but the canvas has no committed series until the user acts.

> This matches the project vision §3.2: "selectors pre-filled with
> auto-select / proton / liquid water, but **no data plotted** until the
> user adds the first series." The preview series is intentionally
> excluded from this definition — it is an ephemeral visual hint, not
> "plotted data." The first true data series appears only when the user
> clicks "Add Series."

### Preview Series

The preview series provides live visual feedback of the current entity
selection on the plot canvas, before the user commits it as a series.

| Property                     | Detail                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| When shown                   | Whenever `EntitySelectionState.isComplete === true`                                                                                                                |
| When hidden                  | When entity selection is incomplete (any selector cleared)                                                                                                         |
| Visual style                 | **Dashed line**, black color (`#000`), line width 1                                                                                                                |
| Updates                      | Recalculates whenever the entity selection changes (program, particle, or material). No debounce — entity changes are discrete events.                             |
| Series list entry            | Shown at the top of the series list in _italics_: "Preview — {label}". No remove button. Visibility toggle available.                                              |
| Data                         | Fetched via `LibdedxService.getPlotData()` with `pointCount: 500`, `logScale: true`                                                                                |
| Does not persist             | The preview series is not included in URL encoding or CSV export.                                                                                                  |
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
   list. Visibility state is **not** persisted in the URL — a shared
   URL always restores all series as visible.

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

| Trigger                      | What happens                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Entity selection change      | Preview series recalculates                                                             |
| "Add Series" click           | Preview promoted to committed series                                                    |
| Stopping power unit change   | All series Y-data re-converted (per-series density); plot redraws; Y-axis label updates |
| Visible particle mix changes | X-axis unit/label and X values are re-derived from visible series and preview           |
| Axis scale change            | Plot redraws with new JSROOT draw options (logx/logy)                                   |
| Series visibility toggle     | Plot redraws showing/hiding the affected line                                           |
| Series removal               | Plot redraws without the removed line                                                   |

---

## Smart Series Labels

Series labels are auto-generated based on what distinguishes the plotted
series from each other. The algorithm inspects all committed series and
determines the **minimum distinguishing fields**:

### Algorithm

Given the set of committed series, determine which entity fields vary:

```typescript
const programs = new Set(series.map((s) => s.programId));
const particles = new Set(series.map((s) => s.particleId));
const materials = new Set(series.map((s) => s.materialId));

const programVaries = programs.size > 1;
const particleVaries = particles.size > 1;
const materialVaries = materials.size > 1;
```

Build the label from varying fields only:

| Varies                  | Label format                             | Example                     |
| ----------------------- | ---------------------------------------- | --------------------------- |
| Nothing (single series) | `"{particle} in {material}"`             | "Proton in Water (liquid)"  |
| Only program            | `"{program}"`                            | "ICRU 90", "PSTAR"          |
| Only particle           | `"{particle}"`                           | "Proton", "Carbon"          |
| Only material           | `"{material}"`                           | "Water (liquid)", "PMMA"    |
| Program + particle      | `"{program} — {particle}"`               | "ICRU 90 — Proton"          |
| Program + material      | `"{program} — {material}"`               | "ICRU 90 — Water"           |
| Particle + material     | `"{particle} in {material}"`             | "Proton in Water"           |
| All three vary          | `"{program} — {particle} in {material}"` | "ICRU 90 — Proton in Water" |

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

| Index | Color  | Hex       |
| ----- | ------ | --------- |
| 0     | Red    | `#e41a1c` |
| 1     | Blue   | `#377eb8` |
| 2     | Green  | `#4daf4a` |
| 3     | Purple | `#984ea3` |
| 4     | Orange | `#ff7f00` |
| 5     | Brown  | `#a65628` |
| 6     | Pink   | `#f781bf` |
| 7     | Grey   | `#999999` |
| 8     | Cyan   | `#17becf` |

After index 8, wrap around to index 0 (colors may repeat for >9 series).

When a series is removed, its color index is released. The next added
series takes the lowest available color index.

> **Note:** Black (`#000`) is reserved exclusively for the preview series
> (dashed line). Committed series always start at index 0 (red), so
> every "Add Series" click produces an immediately obvious visual change
> — the new solid red/blue/green line is clearly distinct from the
> dashed black preview.

---

## Plot Data Generation

Each series' data is generated via `LibdedxService.getPlotData()`:

```typescript
const result: CalculationResult = service.getPlotData({
  programId: series.programId,
  particleId: series.particleId,
  materialId: series.materialId,
  pointCount: 500,
  logScale: true,
});
```

| Parameter    | Value  | Rationale                                                                                        |
| ------------ | ------ | ------------------------------------------------------------------------------------------------ |
| `pointCount` | 500    | Sufficient for visually smooth curves across 3–6 decades of energy                               |
| `logScale`   | `true` | Log-spaced points ensure even coverage on a log-scale X-axis; avoids clustering at high energies |

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
  targetUnit: StpUnit,
): number[] {
  switch (targetUnit) {
    case "keV/µm":
      return massStpValues.map((s) => (s * density) / 10);
    case "MeV/cm":
      return massStpValues.map((s) => s * density);
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
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): TMultiGraph {
  const visible = [...(preview?.visible ? [preview] : []), ...series.filter((s) => s.visible)];

  const graphs = visible.map((s) => {
    const yData = convertStpForDisplay(s.result.stoppingPowers, s.density, stpUnit);
    const tgraph = JSROOT.createTGraph(s.result.energies.length, s.result.energies, yData);
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

Zoom and pan are enabled via click-drag interactions on the canvas.

### Disabled Interactions

- **Mouse wheel zoom: disabled.** Scrolling the mouse wheel over the
  plot must **not** zoom the axes — it should scroll the page normally.
  JSROOT's wheel-zoom feature must be explicitly disabled to prevent
  the plot from hijacking page scroll.
- **Touch interactions on mobile/tablet: disabled.** On touch devices
  (< 900px or `pointer: coarse`), JSROOT's touch-based zoom/pan must
  be disabled to ensure normal page scrolling. Pinch-to-zoom and
  touch-drag on the canvas must pass through to the browser's native
  scroll/zoom behavior. Users can still interact with the plot via
  the axis scale controls and the JSROOT toolbar (if available).

These restrictions ensure the plot never traps the user's scroll or
touch gestures. On desktop, click-drag zoom and shift-drag pan remain
available as deliberate interactions.

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

| Parameter  | Example                   | Notes                                                               |
| ---------- | ------------------------- | ------------------------------------------------------------------- |
| `particle` | `1`                       | Current entity selection — particle ID (shared with Calculator URL) |
| `material` | `276`                     | Current entity selection — material ID                              |
| `program`  | `auto` or `2`             | Current entity selection — program                                  |
| `series`   | `2.1.276,9.6.276,2.1.104` | Comma-separated series triplets: `programId.particleId.materialId`  |
| `stp_unit` | `kev-um`                  | Stopping power unit token: `kev-um`, `mev-cm`, `mev-cm2-g`          |
| `xscale`   | `log`                     | X-axis scale: `log` or `lin`                                        |
| `yscale`   | `log`                     | Y-axis scale: `log` or `lin`                                        |

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
6. Set stopping power unit from `stp_unit` (default keV/µm if missing):

- `kev-um` → `keV/µm`
- `mev-cm` → `MeV/cm`
- `mev-cm2-g` → `MeV·cm²/g`

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

Export controls are split between two locations:

| Control      | Location                    | Type            | Label            |
| ------------ | --------------------------- | --------------- | ---------------- |
| Image export | Controls bar, right-aligned | Dropdown button | "Export image ▾" |
| PDF export   | App toolbar, upper-right    | Button          | "Export PDF"     |
| CSV export   | App toolbar, upper-right    | Button          | "Export CSV ↓"   |

The image export sits next to the canvas it captures. PDF and CSV are
sharing/archiving actions and live in the toolbar beside "Share URL"
(see [`export.md`](export.md) §0).

### Export image ▾

A dropdown button offering two formats:

- **PNG image** — 2× resolution raster snapshot via JSROOT canvas API.
  Filename: `dedx_plot.png`.
- **SVG vector** — publication-quality vector output via JSROOT `makeSVG()`.
  Filename: `dedx_plot.svg`.

Both formats capture all **visible** series, axis labels, gridlines, and
axis ticks. Both exclude hidden series, the preview series, the sidebar,
and the series list below the canvas.

> Full image export spec (keyboard behaviour, `aria-*` contract):
> [`export.md`](export.md) §4.1.

### Export PDF

A jsPDF-generated report containing the chart SVG and metadata.

- **Basic mode:** app name, generated timestamp, clickable page URL, chart image, legend.
- **Advanced mode:** additionally includes build info (commit hash · date · branch),
  particle (Z, A), material (density), programs list with external source URLs,
  active Advanced Options settings, and system info (browser + OS from `navigator.userAgent`).

> Full PDF content spec and layout: [`export.md`](export.md) §5.

### Export CSV ↓

Exports all **visible** series data as a wide-format CSV file
(`dedx_plot_data.csv`, UTF-8 with BOM, comma-delimited).

- A single `Energy [MeV/nucl]` column appears first when all series share the
  same energy grid **and no external (`ext:`) series are present**;
  otherwise each series gets its own `Energy {program} [MeV/nucl]` column
  immediately before its stopping-power column.
- When any external series is present, **always** uses the per-series
  energy column layout (Case B), regardless of whether internal series
  share a grid.
- One `# External source: {label} at {url}` comment row per distinct
  external source appears before the column header row.
- Stopping-power column header pattern:
  `Stp {program} — {particle} in {material} ({unit})`
- Hidden series and the preview series are excluded.

> Full CSV schema, external-data rules, and comment-row format:
> [`export.md`](export.md) §4.2–§4.3.

---

## Responsive Layout

### Desktop (≥900px) — Sidebar + Canvas

```
┌── SIDEBAR (≈30%) ────────────────────┐ ┌── MAIN (≈70%) ────────────────────────────────┐
│                                      │ │                                                │
│ ┌───────────┐ ┌────────────────────┐ │ │ Stp: (•)keV/µm (○)MeV/cm (○)MeV·cm²/g        │
│ │ ① Particle│ │ ② Target Material  │ │ │ X: (•)Log (○)Lin   Y: (•)Log (○)Lin                [img▾] │
│ │ [Filter ] │ │ [Filter...       ] │ │ │                                                │
│ │ ┌───────┐ │ │ ┌────────┬───────┐ │ │ │ ┌──────────────────────────────────────────┐   │
│ │ │Proton │ │ │ │ELEMENTS│COMPNDS│ │ │ │ │                                          │   │
│ │ │Alpha  │ │ │ │ 1 H    │276 H₂O│ │ │ │ │          JSROOT Plot Canvas              │   │
│ │ │Lithium│ │ │ │ 2 He   │99 A150│ │ │ │ │                                          │   │
│ │ │...  ↕ │ │ │ │...  ↕  │...  ↕ │ │ │ │ │                                          │   │
│ │ └───────┘ │ │ └────────┴───────┘ │ │ │ └──────────────────────────────────────────┘   │
│ └───────────┘ └────────────────────┘ │ │                                                │
│                                      │ │ ┌─ Series ──────────────────────────────────┐   │
│ ┌──────────────────────────────────┐ │ │ │ ── Preview — Proton in Water         👁   │   │
│ │ ③ Program  Auto-select → ICRU 90│ │ │ │ ■ ICRU 90 — Proton in Water      👁  ×   │   │
│ │ [Filter... ]                     │ │ │ │ ■ PSTAR — Proton in Water        👁  ×   │   │
│ │ ┌──────────────────────────────┐ │ │ │ └──────────────────────────────────────────┘   │
│ │ │ ── Tabulated ──              │ │ │ └────────────────────────────────────────────────┘
│ │ │ ASTAR · PSTAR · ICRU49 · …  │ │ │
│ │ │ ── Analytical ──             │ │ │
│ │ │ Bethe-Bloch · Bethe-Ext     │ │ │
│ │ └──────────────────────────────┘ │ │
│ └──────────────────────────────────┘ │
│                                      │
│         [ ＋ Add Series ]             │
│         [ Reset all ]                │
└──────────────────────────────────────┘
```

- Page grid: `grid-template-columns: minmax(360px, 3fr) 7fr`.
- Entity panel layout within the sidebar follows
  [`entity-selection.md` § Desktop wireframe](entity-selection.md#desktop-900px--sidebar--canvas).
- The JSROOT canvas has `min-height: 400px; height: min(60vh, 600px)`.
- The controls bar above the canvas contains: stopping power unit
  segmented control (left), axis scale controls (center-left), and the
  image export control right-aligned ("Export image ▾" dropdown). "Export
  PDF" and "Export CSV ↓" are in the app toolbar (upper-right), not in
  the controls bar.
- The series list sits below the canvas in the main area, acting as the
  plot legend.

### Tablet (600–899px) — Stacked

The sidebar folds **above** the main area. Entity panels remain in their
sub-grid layout (Particle + Material side-by-side, Program below). The
"Add Series" button and "Reset all" link sit between the panels and the
canvas:

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
├────────────────────────────────────────────────┤
│ Stp: (•)keV/µm (○)MeV/cm (○)MeV·cm²/g        │
│ X: (•)Log (○)Lin  Y: (•)Log (○)Lin                 [img▾] │
│ ┌────────────────────────────────────────────┐ │
│ │            JSROOT Plot Canvas               │ │
│ └────────────────────────────────────────────┘ │
│ ┌─ Series ─────────────────────────────────┐  │
│ │ ■ ICRU 90 — Proton in Water  👁  ×       │  │
│ └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

Entity panel list heights reduced to ~250px for Particle/Material,
~120px for Program.

### Mobile (<600px) — Fully Stacked, Collapsed Panels

On mobile, entity selection panels are **collapsed by default** behind
an expandable accordion or a "Select entities" button that opens a
bottom sheet. This ensures the series list, controls, and canvas are
visible in the initial viewport without scrolling past ~800px of entity
panels. The user taps to open entity selection when needed.

```
┌──────────────────────────────────────┐
│ ▶ Select Entities                    │
│   (Proton / Water / Auto-select)     │
│ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │
│ ╎ (collapsed — tap to expand)      ╎ │
│ ╎ ① Particle  ② Material          ╎ │
│ ╎ ③ Program                        ╎ │
│ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │
├──────────────────────────────────────┤
│ [ ＋ Add Series ]   [ Reset all ]    │
├──────────────────────────────────────┤
│ Stp: (•)keV/µm (○)MeV/cm (○)MeV·cm²/g│
│ X: Log/Lin  Y: Log/Lin  [img▾]       │
│ ┌──────────────────────────────────┐ │
│ │        JSROOT Plot Canvas        │ │
│ │    (touch zoom/pan disabled)     │ │
│ └──────────────────────────────────┘ │
│ Series:                              │
│ ■ ICRU 90 — Proton in Water  👁 ×   │
│ ■ PSTAR — Proton in Water    👁 ×   │
└──────────────────────────────────────┘
```

On mobile, the JSROOT canvas uses `height: 50vh` (at least 300px).

The collapsed entity header shows the current selection summary
(e.g., "Proton / Water / Auto-select") so the user can see what's
selected without expanding. When expanded, the panels stack vertically
as full-width sections (same as before but inside the accordion/sheet).

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
const visibleSeries: PlotSeries[] = $derived(state.series.filter((s) => s.visible));

/** Whether the "Add Series" button should be enabled. */
const canAddSeries: boolean = $derived(state.entitySelection.isComplete);

/** Whether the current entity selection duplicates an existing series. */
const isDuplicate: boolean = $derived(
  state.series.some(
    (s) =>
      s.programId === state.entitySelection.resolvedProgramId &&
      s.particleId === state.entitySelection.particle?.id &&
      s.materialId === state.entitySelection.material?.id,
  ),
);

/** JSROOT draw options string. */
const drawOptions: string = $derived(buildDrawOptions(state.xLog, state.yLog));

/** Auto-computed axis ranges from visible data. */
const axisRanges = $derived(computeAxisRanges(visibleSeries, state.preview, state.stpUnit));
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
- The stopping power unit segmented control uses `role="radiogroup"` with
  `role="radio"` items, matching the axis scale controls.
- Color swatches have an `aria-label` (e.g., "Red, solid line") and a
  visually-hidden text span describing the series color and line style.
  Do **not** rely solely on `title` for accessibility.
- Export controls have descriptive `aria-label` attributes per
  [`export.md`](export.md) §8: "Export plot as image" (dropdown),
  "Export plot report as PDF" (PDF button),
  "Export visible series data as CSV" (CSV button).

---

## Acceptance Criteria

### Default State

- [ ] On first load (no URL params), entity selection shows Proton / Water (liquid) / Auto-select.
- [ ] The JSROOT canvas renders with log-log axes and gridlines even though no committed series exist.
- [ ] A preview series (dashed black line) appears on the canvas showing Proton in Water stopping power.
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
- [ ] After the first 1–2 "Add Series" clicks (tracked via `localStorage`), a brief inline hint appears: "Change particle, material, or program to compare." Dismissed on next entity interaction. Suppressed after 2 showings.

### Series List

- [ ] The series list appears in the main area, below the JSROOT canvas.
- [ ] Each series entry shows: 16×16px color swatch with line sample, auto-generated label, visibility toggle, remove button.
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

- [ ] Series colors are assigned sequentially: red, blue, green, purple, orange, brown, pink, grey, cyan.
- [ ] Black is reserved exclusively for the preview series.
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
- [ ] Zoom (click-drag) and pan (shift-drag) work on desktop.
- [ ] Double-click resets zoom to auto-computed axis ranges.
- [ ] Mouse wheel scrolling over the plot scrolls the page, not the plot axes.
- [ ] On mobile/tablet (touch devices), touch gestures on the canvas scroll the page — JSROOT touch zoom/pan is disabled.
- [ ] The canvas resizes correctly when the browser window is resized.
- [ ] No JSROOT-rendered legend on the canvas (the series list below the canvas serves as the legend).
- [ ] Axis font sizes use JSROOT defaults (do not set explicit `fLabelSize`/`fTitleSize` overrides).

### Axis Scale Controls

- [ ] X- and Y-axis scale controls are always visible (not collapsed).
- [ ] Switching between Log and Lin immediately redraws the plot.
- [ ] Default is Log / Log.
- [ ] Controls use segmented control style (not toggles or checkboxes).

### Stopping Power Unit

- [ ] A segmented control offers keV/µm, MeV/cm, MeV·cm²/g.
- [ ] Default is keV/µm.
- [ ] Changing the unit re-converts all series' Y-data and redraws the plot.
- [ ] The Y-axis label updates to reflect the selected unit.
- [ ] Conversion uses each series' own material density (per-series conversion).
- [ ] Unit selection does not auto-switch when current entity selection changes between gas and non-gas materials.
- [ ] Numeric fixture check: for two visible series with `stoppingPowers[i] = 25`, densities 1.0 and 0.0012, `keV/µm` values are 2.5 and 0.003 respectively.

### URL State

- [ ] Committed series are encoded as `programId.particleId.materialId` triplets in a `series` URL parameter.
- [ ] Entity selection, stopping power unit, and axis scales are encoded in the URL.
- [ ] Loading a URL with valid `series` restores the series and renders them on the plot.
- [ ] Invalid series triplets in the URL are silently skipped.
- [ ] The URL updates (replaceState) on each state change.
- [ ] `stp_unit` only accepts canonical tokens: `kev-um`, `mev-cm`, `mev-cm2-g`.

### Export

- [ ] "Export image ▾" dropdown appears in the controls bar, right-aligned — the only export control in the controls bar.
- [ ] "Export PDF" and "Export CSV ↓" appear in the app toolbar (upper-right, left of "Share URL"), with "Share URL" as the rightmost toolbar item, consistent with the Calculator page.
- [ ] In basic mode, "Export image ▾" offers only "SVG vector" (see [`export.md`](export.md) §4.1).
- [ ] In advanced mode, "Export image ▾" offers "PNG image" and "SVG vector" (see [`export.md`](export.md) §4.1).
- [ ] In advanced mode, selecting "PNG image" downloads `dedx_plot.png` at 2× canvas resolution.
- [ ] Selecting "SVG vector" downloads `dedx_plot.svg` via JSROOT `makeSVG()`.
- [ ] Both image formats exclude hidden series, preview series, sidebar, and series list.
- [ ] "Export PDF" downloads `dedx_plot_report.pdf` via jsPDF with mode-appropriate metadata (see [`export.md`](export.md) §5).
- [ ] "Export CSV ↓" exports all visible series as wide-format CSV (`dedx_plot_data.csv`) — see [`export.md`](export.md) §4.2–§4.3.
- [ ] CSV uses UTF-8 with BOM, comma delimiter, CRLF.
- [ ] When any `ext:` series is present, all series use per-series energy columns (Case B).
- [ ] `# External source:` comment rows appear before the column header row for each ext source.
- [ ] Hidden series and preview series are excluded from CSV and PDF exports.

### Responsive

- [ ] On desktop (≥900px), sidebar (~30%, min 360px) and canvas (~70%) are side-by-side.
- [ ] On tablet (600–899px), sidebar folds above the canvas.
- [ ] On mobile (<600px), entity panels are collapsed by default (accordion / bottom sheet); canvas, controls, and series list are visible without scrolling past panels.
- [ ] The series list is visible on all breakpoints (acts as the legend).

### Reset All

- [ ] "Reset all" with 0–1 series executes immediately (no confirmation).
- [ ] "Reset all" with ≥2 series shows a confirmation dialog before proceeding.
- [ ] Confirmation dialog text: "Remove all N series and reset selections?" with Cancel / Reset buttons.

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
- [ ] Stopping power unit segmented control uses `role="radiogroup"`.
- [ ] Export controls have descriptive `aria-label` attributes (see [`export.md`](export.md) §9).

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
   _Deferred to architecture/tech-stack docs._

2. **JSROOT SVG vs Canvas rendering:** JSROOT can render to SVG (better
   for vector export) or Canvas (better for performance with many points).
   With 500 points × 10 series, Canvas may be preferred.
   _Deferred to implementation — test both._

3. ~~**Touch interactions on mobile:**~~ Resolved — touch zoom/pan
   disabled on mobile/tablet to preserve native page scrolling.
   Mouse wheel zoom also disabled on all devices.

4. **Series persistence across page navigation:** Should the series list
   survive navigating away from the Plot page and back? Current design
   says yes (page-level store). If the user reloads the page, series are
   lost unless the URL was bookmarked.
   _Current decision: series persist in the page-level store within a
   session and in the URL across sessions._

5. ~~**PNG export quality:** JSROOT's `makeSVG()` produces vector output
   that can be rasterized at any resolution. Should we offer SVG export
   in addition to PNG?~~ Resolved in [`export.md`](export.md) v1:
   single "Export image ▾" dropdown offering PNG and SVG.

6. ~~**CSV column layout for many series:** With 10 series × 2 columns
   each = 20 columns — this may be unwieldy. Should we offer a "long
   format" CSV option (one row per data point per series)?~~
   Resolved in [`export.md`](export.md) v1: wide format only.
