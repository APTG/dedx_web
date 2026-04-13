# Feature: Export

> **Status:** Final v6 (13 April 2026)
>
> **v6** (13 April 2026): Added `## User Stories` section (four personas:
> researcher → CSV for analysis, student → PDF for lab report, data
> analyst → CSV config modal for locale compatibility, physicist → SVG
> for publication). Removed "authoritative reference" and "normative
> detail" language from `## Scope`.
>
> **v5** (13 April 2026): Seven changes:
> (1) Toolbar order reversed — Share URL is now **rightmost**; PDF and
> CSV buttons appear to its left (`[Export PDF]  [Export CSV ↓]  [Share URL]`).
> (2) Calculator CSV column order changed: `Normalized Energy` first,
> `Typed Value` second, `CSDA Range` fourth, `Stopping Power` last;
> CSV example extended with keV and GeV rows.
> (3) Advanced-mode CSV export opens a **configuration modal** (separator,
> line endings, filename) instead of downloading immediately — new §1.1.
> (4) Plot image export: **PNG is advanced-mode only**; basic mode offers
> SVG only; §4.1 rewritten for clarity.
> (5) Advanced mode PDF metadata block: **BUILD moved to the very bottom**
> (below SYSTEM) — it is the least user-facing field.
> (6) Multi-page PDFs carry **page number footers** in `n / N` format.
> (7) §2 and §5.1/§6.1 button-position descriptions updated to match new
> toolbar order.
>
> **v4** (13 April 2026): Advanced mode PDF layout changed — chart/table
> is now the **first content** after the header (both Plot and Calculator).
> The extended metadata block (BUILD, PARTICLE, MATERIAL, PROGRAMS,
> SETTINGS, SYSTEM) moves to **after** the chart+legend (Plot) or
> after the results table (Calculator). Rationale: users open the PDF to
> see results first; provenance metadata is a reference appendix.
> Fixed leftover bug: Calculator PDF §6.1 button position still said
> "below table" — corrected to app toolbar.
>
> **v3** (13 April 2026): Unified export button placement across pages.
> "Export PDF" and "Export CSV ↓" moved from below-table / controls bar
> to the **app toolbar upper-right**, immediately right of "Share URL"
> (same row on both Calculator and Plot). Rationale: PDF and CSV are
> sharing/archiving actions — the same spirit as Share URL. Image export
> ("Export image ▾" dropdown) stays in the Plot controls bar, adjacent to
> the canvas it exports. Both toolbar buttons are **disabled** (not hidden)
> when no results are available. New §0 documents the shared toolbar. All
> button position tables, wireframes, and acceptance criteria updated.
> `calculator.md` Final v8, `plot.md` Final v5.
>
> **v2** (13 April 2026): Added PDF export for Plot and Calculator (both
> basic and advanced modes). Added external-data CSV rules: always Case B
> (own energy column per series) when any `ext:` series present; `#`
> comment rows before the header for each external source URL. Mixed
> internal + external grid rule: always Case B. PDF content is
> mode-sensitive (basic: date + URL; advanced: full metadata block
> including build info, particle Z/A, material density, interpolation
> settings, browser/OS). Calculator PDF: portrait with page-break column
> split for wide advanced tables. Filename convention updated.
>
> **v1** (13 April 2026): Initial spec — consolidates all export behaviour
> across Calculator (basic and advanced/multi-program mode) and Plot.
> Resolves two open questions from `plot.md`: image export uses a single
> "Export image ▾" dropdown offering PNG and SVG (not two separate buttons);
> Plot CSV uses wide format only (no long/tidy option). Multi-program CSV
> exports raw data columns only (no delta/% columns). Calculator CSV mirrors
> all five on-screen unified table columns including normalized energy.
>
> **Related specs:**
> - Calculator page: [`calculator.md`](calculator.md)
> - Multi-program advanced mode: [`multi-program.md`](multi-program.md)
> - Plot page: [`plot.md`](plot.md)
> - External data: [`external-data.md`](external-data.md)
> - Unit handling (units in CSV headers): [`unit-handling.md`](unit-handling.md)
> - Build info (commit hash, date, branch): [`build-info.md`](build-info.md)
> - Advanced options (interpolation settings): [`advanced-options.md`](advanced-options.md)

---

## User Stories

**As a** researcher,
**I want to** download my stopping-power and range results as a CSV file,
**so that** I can import them directly into Python, R, or Excel for further
analysis without manually transcribing values.

**As a** student preparing a lab report,
**I want to** export a PDF of my calculator results or plot,
**so that** I can include a clean, self-contained document with all the
relevant metadata (particle, material, program, settings) in my submission.

**As a** data analyst working in a non-English locale,
**I want to** choose the CSV separator and line endings before downloading,
**so that** the file opens correctly in my regional spreadsheet application
without needing a manual import-wizard workaround.

**As a** physicist publishing a figure,
**I want to** export the stopping-power plot as an SVG vector file,
**so that** I can embed it in my paper at any resolution without quality loss.

---

## Scope

This spec covers all CSV, image, and PDF export across the dEdx Web
redesign. The export sections in [`calculator.md`](calculator.md),
[`multi-program.md`](multi-program.md), and [`plot.md`](plot.md) contain
brief summaries that point here for the full detail.

| Page / Mode | Export formats |
|-------------|---------------|
| Calculator — basic mode | CSV, PDF |
| Calculator — advanced / multi-program | CSV, PDF |
| Plot | Image (PNG or SVG via dropdown), CSV, PDF |

---

## 0. Export Toolbar — Shared (Both Pages)

**"Export PDF"** and **"Export CSV ↓"** are permanent toolbar buttons in
the **upper-right corner** of the page, immediately **left of** the
**"Share URL"** button — which is always the rightmost button. They appear
on both the Calculator and the Plot pages in identical positions.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  dEdx Web                    [Export PDF]  [Export CSV ↓]  [Share URL]  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Button | No-results state | Results available |
|--------|-----------------|-------------------|
| "Export PDF" | Disabled (greyed out) | Active |
| "Export CSV ↓" | Disabled (greyed out) | Active (basic: direct download; advanced: opens config modal — see §1.1) |

**"No results"** means: no committed (non-preview) rows/series exist yet.
On the Calculator page this means no row has a computed result; on the
Plot page this means no committed series has been added.

**Rationale:** PDF and CSV export are *sharing and archiving* actions —
the same intent as "Share URL". Keeping Share URL as the rightmost action
reflects that it is the primary sharing gesture; PDF/CSV are secondary.
Grouping all three together keeps the content area clean and makes the
sharing cluster discoverable in one place. The image export ("Export
image ▾") is the exception: it is plot-specific and lives in the Plot
controls bar, adjacent to the canvas it captures.

---

## 1. Common CSV Conventions

All exported CSV files share these rules:

| Property | Value |
|----------|-------|
| Encoding | UTF-8 **with BOM** (ensures correct rendering in Windows Excel) |
| Delimiter | Comma (`,`) |
| Line endings | CRLF |
| Quoting | RFC 4180-style: values containing commas, `"`, CR, or LF are wrapped in double quotes; internal `"` characters are escaped by doubling them (`""`); all other values are unquoted |
| First row | Column headers (immediately after any `#` comment rows — see §4.3) |
| Numeric precision | 4 significant figures, matching on-screen display |
| Thousands separator | None (`13920` not `13,920`) |
| CSDA per-cell unit | Value and unit suffix in the same cell (e.g., `7.718 cm`); the column header carries no unit |
| Stopping power unit | Active display unit appears in the column header (e.g., `Stopping Power (keV/µm)`) |

### 1.1 Advanced-Mode CSV Export Configuration Modal

In **advanced mode** (Calculator advanced / multi-program, and Plot
advanced mode), clicking **"Export CSV ↓"** opens a lightweight
configuration modal instead of downloading immediately. Basic mode
always downloads directly with the default settings.

**Modal layout:**

```
┌─────────────────────────────────────────────┐
│  Export CSV                              [✕] │
├─────────────────────────────────────────────┤
│  Separator    ● Comma (,)   ○ Semicolon (;)  │
│               ○ Tab                          │
│                                              │
│  Line endings ● CRLF  ○ LF                   │
│                                              │
│  Filename  [dedx_proton_water_3programs.csv] │
│                                              │
│           [Cancel]  [Download CSV]           │
└─────────────────────────────────────────────┘
```

| Field | Default | Options |
|-------|---------|---------|
| Separator | Comma (`,`) | Comma, Semicolon (`;`), Tab (`\t`) |
| Line endings | CRLF | CRLF, LF |
| Filename | Canonical filename (§7) | Editable — user may type any valid filename |

- The modal pre-fills the filename with the canonical default for the
  current context (e.g., `dedx_proton_water_3programs.csv`).
- A filename extension of `.csv` is always appended if the user omits it.
- "Download CSV" applies the selected settings and downloads; "Cancel"
  closes without downloading; the `✕` icon and pressing `Escape` are
  equivalent to Cancel.
- The last-used separator and line-ending settings are persisted to
  `localStorage` so they are restored on the next export within the same
  browser session.
- Settings chosen in the modal do **not** affect the encoding (always
  UTF-8 with BOM) or quoting rules (always RFC 4180).

---

## 2. Calculator Export — Basic Mode

### Button

Both buttons are in the **app toolbar** (see §0). No buttons appear below
the unified table.

| Property | Detail |
|----------|--------|
| "Export PDF" | App toolbar, upper-right — immediately left of "Export CSV ↓" (see §0) |
| "Export CSV ↓" | App toolbar, upper-right — immediately left of "Share URL" (see §0) |
| Availability | Both **disabled** (greyed out) until at least one row has a computed result; always visible in the toolbar |

### CSV Schema

Five columns — exactly the five columns visible in the unified table:

```csv
"Normalized Energy (MeV/nucl)","Typed Value","Unit","CSDA Range","Stopping Power (keV/µm)"
0.001,1,keV,0.01562 µm,84.30
0.100,100,keV,14.77 µm,32.54
100,100,MeV,7.718 cm,13.92
500,500,MeV,116.1 cm,7.834
2000,2,GeV,5461 cm,3.127
```

Column rules:

| # | Header | Content |
|---|--------|---------|
| 1 | `Normalized Energy (MeV/nucl)` | Numeric value in MeV/nucl (4 sig figs) |
| 2 | `Typed Value` | The exact string the user typed in the input cell |
| 3 | `Unit` | Per-row energy unit (e.g., `MeV`, `keV`, `GeV`, `MeV/nucl`) |
| 4 | `CSDA Range` | Value + auto-scaled SI unit suffix in the same cell (e.g., `7.718 cm`); no fixed unit in header |
| 5 | `Stopping Power ({unit})` | Numeric value in the active display unit (4 sig figs); no unit suffix in cell |

Column 4 substitutes `{unit}` with the active stopping-power unit:
- `keV/µm` for non-gas materials (default)
- `MeV·cm²/g` for gas materials (default)
- Or the user-selected unit if overridden

> **CSV injection note:** The `Typed Value` column stores the raw text the
> user entered. To prevent spreadsheet formula injection (values starting
> with `=`, `+`, `-`, or `@` being evaluated as formulas in Excel/Sheets),
> any such value **must** be prefixed with a single-quote character (`'`)
> before being written to the cell, so it is treated as a text literal.
> The single-quote is not visible after import and does not affect the
> displayed value in compliant spreadsheet applications.

Error/invalid rows (validation failures, out-of-range energies) are
**omitted** — only successfully computed rows appear in the CSV.

### Filename

```
dedx_calculator_{particle}_{material}_{program}.csv
dedx_calculator_{particle}_{material}_{program}.pdf
```

Example: `dedx_calculator_proton_water_icru90.csv`

- `{particle}` — lowercase ASCII particle name (e.g., `proton`, `alpha`, `carbon`)
- `{material}` — lowercase ASCII material name; spaces → underscores
  (e.g., `water`, `silicon`, `polyethylene`)
- `{program}` — program ID as used in the URL (e.g., `icru90`, `pstar`)

---

## 3. Calculator Export — Advanced / Multi-program Mode

### Button

Same "Export PDF" and "Export CSV ↓" buttons in the app toolbar (§0),
identical positions to basic mode. No buttons appear below the comparison
table. In advanced mode, clicking **"Export CSV ↓"** opens the
**CSV configuration modal** (§1.1) instead of downloading immediately.

### CSV Schema

**Wide table format** — one row per energy value; programs appear as
sub-columns grouped by quantity. Column order mirrors the on-screen table,
including any drag-and-drop reordering the user has applied.

```csv
"Energy (MeV)","MeV/nucl","Unit","Stp Power ICRU 90 (keV/µm)","Stp Power PSTAR (keV/µm)","Stp Power Bethe (keV/µm)","CSDA Range ICRU 90","CSDA Range PSTAR","CSDA Range Bethe"
100,100,MeV,13.92,14.01,13.85,7.718 cm,7.801 cm,7.632 cm
500,500,MeV,7.834,7.912,7.799,116.1 cm,117.4 cm,115.8 cm
```

Column rules:

| Column group | Header pattern | Content |
|-------------|---------------|---------|
| Energy | `Energy (MeV)` | Normalized energy in MeV (4 sig figs) |
| Normalized | `MeV/nucl` | Same value in MeV/nucl (identical to Energy for protons; differs for heavier ions) |
| Unit | `Unit` | Per-row energy unit string |
| Stopping power per program | `Stp Power {program} ({unit})` | Numeric value in active display unit (4 sig figs) |
| CSDA range per program | `CSDA Range {program}` | Value + auto-scaled SI unit suffix per cell; no fixed unit in header |

Visibility rules — what columns are included:

| Condition | Effect on CSV |
|-----------|--------------|
| Hidden program column | Excluded from CSV |
| Quantity focus `Both` | Stopping-power columns then CSDA-range columns |
| Quantity focus `STP only` | Stopping-power columns only |
| Quantity focus `CSDA only` | CSDA-range columns only |
| Delta / % hover values | **Not exported** (derivable from raw data) |
| Preview series | **Not exported** |

### Filename

```
dedx_{particle}_{material}_{N}programs.csv
dedx_{particle}_{material}_{N}programs.pdf
```

Example: `dedx_proton_water_3programs.csv`

Where `{N}` is the count of visible (non-hidden) programs.

---

## 4. Plot Export

### 4.1 Image Export (PNG / SVG)

#### Button

The **"Export image ▾"** dropdown button lives in the Plot controls bar
(not in the app toolbar) because it captures the canvas directly.

The **dropdown options differ by mode**:

| Mode | Options shown |
|------|--------------|
| Basic | SVG vector only |
| Advanced | PNG image + SVG vector |

PNG export is an advanced-mode-only feature because it produces a
high-resolution raster snapshot (2× resolution) that is most useful for
advanced users assembling figures. SVG is available in both modes and is
the recommended format for publication.

Wireframe — **basic mode** (controls bar):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [keV/µm · MeV·cm²/g · MeV/cm]  [Log-log · Lin-lin]             [img ▾] │
└──────────────────────────────────────────────────────────────────────────┘
```

Dropdown open in basic mode:
```
                                                      ┌──────────────┐
                                                      │ SVG vector   │
                                                      └──────────────┘
```

Dropdown open in advanced mode:
```
                                                      ┌──────────────┐
                                                      │ PNG image    │
                                                      │ SVG vector   │
                                                      └──────────────┘
```

Selecting an option triggers the download immediately and closes the dropdown.

| Property | Detail |
|----------|--------|
| Label | "Export image ▾" |
| Type | Dropdown button |
| Position | Controls bar above the JSROOT canvas, **right-aligned** — the only export control in the controls bar; PDF and CSV are in the app toolbar (§0) |

#### PNG Export (advanced mode only)

| Property | Detail |
|----------|--------|
| Trigger | Select "PNG image" from the dropdown (advanced mode only) |
| Mechanism | JSROOT canvas snapshot (rasterized from the rendered canvas) |
| Resolution | 2× the CSS canvas dimensions (Retina-quality) |
| Filename | `dedx_plot.png` |
| Includes | All **visible** series lines, axis labels, axis ticks, gridlines |
| Excludes | Hidden series, preview series, sidebar, series list below the canvas, browser chrome |

#### SVG Export (both modes)

| Property | Detail |
|----------|--------|
| Trigger | Select "SVG vector" from the dropdown |
| Mechanism | JSROOT `makeSVG()` (vector output, independent of canvas rendering mode) |
| Filename | `dedx_plot.svg` |
| Includes | All **visible** series lines, axis labels, axis ticks, gridlines |
| Excludes | Hidden series, preview series, sidebar, series list below the canvas, browser chrome |
| Use case | Publication-quality vector figures; further editing in Inkscape / Illustrator |

### 4.2 Plot CSV Export

#### Button

| Property | Detail |
|----------|--------|
| Label | "Export CSV ↓" |
| Position | App toolbar, upper-right — immediately left of "Share URL" (see §0) |
| Advanced mode | Clicking opens the CSV configuration modal (§1.1) |

#### CSV Schema

**Wide format only** — one row per energy point; each series occupies one
or two columns depending on whether energy grids are shared (see §4.3 for
the external-data rule).

---

**Case A — all series share the same energy grid**

Applies only when **no external (`ext:`) series are present** and all
libdedx series happen to share the same tabulated energy points.

```csv
"Energy [MeV/nucl]","Stp ICRU 90 — p in Water (keV/µm)","Stp PSTAR — p in Water (keV/µm)"
0.001,84.30,81.55
0.002,65.10,63.20
```

- A single `Energy [MeV/nucl]` column appears first.
- Each subsequent column is one series' stopping-power values.

---

**Case B — series have different energy grids (or any `ext:` series present)**

This is the typical case when programs have different tabulated energy
bounds, different point counts, or when any external-data series is
included (see §4.3).

```csv
"Energy ICRU 90 [MeV/nucl]","Stp ICRU 90 — p in Water (keV/µm)","Energy PSTAR [MeV/nucl]","Stp PSTAR — α in Al (keV/µm)"
0.001,84.30,0.001,92.14
0.002,65.10,0.002,71.30
```

- Each series gets its own `Energy {program} [MeV/nucl]` column immediately
  before its stopping-power column.
- Rows are aligned by index position. If grids differ in length, the shorter
  series' columns are padded with empty cells in the trailing rows.

---

Stopping-power column header pattern:

```
Stp {program} — {particle} in {material} ({unit})
```

Example: `Stp ICRU 90 — p in Water (keV/µm)`

The unit in the header matches the current Y-axis display unit.

Visibility rules:

| Condition | Effect on CSV |
|-----------|--------------|
| Hidden series (toggled off) | Excluded |
| Preview series | Excluded |

### 4.3 External Data in Plot CSV

When the plot contains one or more series from an external `.webdedx.parquet`
source (identified by the `ext:{label}` program prefix in URL state):

#### Energy column rule

**Always Case B** — the presence of any external series forces Case B
for the entire CSV, including internal libdedx series. This prevents a
confusing mixed layout (shared + separate energy columns in the same file).

#### Column labels

External series use the user-assigned label from the `extdata={label}:…`
URL parameter as the program name in column headers — no `[ext]` tag or
other annotation. The label is user-chosen and self-describing.

```csv
"Energy ICRU 90 (MeV)","Stp ICRU 90 — p in Water (keV/µm)","Energy NIST (MeV)","Stp NIST — p in Water (keV/µm)"
0.001,84.30,0.001,84.11
0.002,65.10,0.005,60.44
```

#### Comment rows (metadata header)

One `#` comment line per distinct external source appears **before** the
column header row. Format:

```
# External source: {label} at {url}
```

Full example with two external sources:

```csv
# External source: NIST at https://example.com/nist.webdedx.parquet
# External source: SRIM at https://example.com/srim.webdedx.parquet
"Energy ICRU 90 (MeV)","Stp ICRU 90 — p in Water (keV/µm)","Energy NIST (MeV)","Stp NIST — p in Water (keV/µm)","Energy SRIM (MeV)","Stp SRIM — p in Water (keV/µm)"
0.001,84.30,0.001,84.11,0.001,83.95
```

Comment rows use `#` (hash + space) prefix — standard in scientific CSV
tools (pandas `comment='#'`, R `comment.char='#'`). Excel ignores
`#`-prefixed rows when importing via the Text Import Wizard.

### Filename

```
dedx_plot_data.csv
dedx_plot.png
dedx_plot.svg
```

---

## 5. PDF Export — Plot

### 5.1 Button

| Property | Detail |
|----------|--------|
| Label | "Export PDF" |
| Position | App toolbar, upper-right — immediately left of "Export CSV ↓" (see §0) |
| Mechanism | jsPDF (client-side) with embedded SVG (via JSROOT `makeSVG()`) |

### 5.2 Content — Basic Mode

The Plot PDF in basic mode is a single-page document containing:

```
┌─────────────────────────────────────────────────────────┐
│  dEdx Web                                               │
│  Generated: 2026-04-13T14:32:00Z                        │
│  URL: https://dedx.example.org/?particle=1&...          │ ← clickable
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Chart SVG — full width]                               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Legend                                                 │
│  ■  ICRU 90 — Proton in Water                           │
│  ■  PSTAR — Proton in Water                             │
└─────────────────────────────────────────────────────────┘
```

| Element | Content |
|---------|---------|
| App name | "dEdx Web" |
| Generated timestamp | ISO 8601 UTC (e.g., `2026-04-13T14:32:00Z`) |
| URL | Full shareable URL of the page at export time — rendered as a clickable hyperlink in the PDF |
| Chart | JSROOT `makeSVG()` output embedded at full page width |
| Legend | One row per visible series: colour swatch + series label |

### 5.3 Content — Advanced Mode

Advanced mode PDF has the same header and chart as §5.2, with an
**extended metadata block appended after the legend** (not before the
chart). The chart is always the first content the reader sees.

```
┌─────────────────────────────────────────────────────────┐
│  dEdx Web — Advanced Mode                               │
│  Generated: 2026-04-13T14:32:00Z                        │
│  URL: https://dedx.example.org/?mode=advanced&...       │ ← clickable
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Chart SVG — full width]                               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Legend                                                 │
│  ■  ICRU 90 — Proton in Water                           │
│  ■  PSTAR — Proton in Water                             │
│  ■  NIST — Proton in Water (ext)                        │
├─────────────────────────────────────────────────────────┤
│  ── Advanced Mode Details ─────────────────────────     │
│                                                         │
│  PARTICLE                                               │
│  Proton  Z=1  A=1                                       │
│                                                         │
│  MATERIAL                                               │
│  Water (liquid)  ρ = 1.000 g/cm³                        │
│                                                         │
│  PROGRAMS                                               │
│  ICRU 90  (built-in)                                    │
│  PSTAR    (built-in)                                    │
│  NIST     (external) https://example.com/nist.parquet   │
│                                                         │
│  SETTINGS (Advanced Options)                            │
│  Interpolation: Log-log / Spline                        │
│  Aggregate state: Condensed                             │
│  (density override, I-value override if active)         │
│                                                         │
│  SYSTEM                                                 │
│  Chrome 124 / macOS 14.0  (from navigator.userAgent)    │
│                                                         │
│  BUILD                                                  │
│  Commit: a1b2c3d · 2026-04-13 · main                   │
└─────────────────────────────────────────────────────────┘
```

The "Advanced Mode Details" section begins with a horizontal rule and
heading so it reads as a reference appendix, not as content competing
with the chart.

Metadata block rules:

| Section | Position | Mode |
|---------|----------|------|
| App name + mode | Header (top) | both |
| Generated timestamp | Header (top) | both |
| URL | Header (top) — clickable hyperlink | both |
| Chart SVG | After header | both |
| Legend | After chart | both |
| **"Advanced Mode Details" divider** | After legend | advanced only |
| **PARTICLE** | Details block — Name, Z (atomic number), A (mass number) | advanced only |
| **MATERIAL** | Details block — Name, phase, density ρ in g/cm³ (override if set) | advanced only |
| **PROGRAMS** | Details block — one row per visible series: label + "(built-in)" or "(external) {url}" | advanced only |
| **SETTINGS** | Details block — active Advanced Options (only non-default values shown) | advanced only |
| **SYSTEM** | Details block — browser and OS from `navigator.userAgent` | advanced only |
| **BUILD** | Details block (bottom) — commit hash · ISO date · branch/tag (from `deploy.json` per `build-info.md`) | advanced only |

If `deploy.json` is absent (local dev), the BUILD section is omitted silently.

The legend may overflow to a second page if there are many series. The
"Advanced Mode Details" block starts on whichever page follows the legend.

### 5.3.1 Page Numbers

All Plot PDF documents include a page-number footer on every page in the
format:

```
Page n / N
```

where `n` is the current page number and `N` is the total page count.
The footer is right-aligned, in a smaller font, and placed in the bottom
margin so it does not overlap content.

### 5.4 Filename

```
dedx_plot_report.pdf
```

---

## 6. PDF Export — Calculator

### 6.1 Button

| Property | Detail |
|----------|--------|
| Label | "Export PDF" |
| Position | App toolbar, upper-right — immediately left of "Export CSV ↓" (see §0) |
| Mechanism | jsPDF + `jspdf-autotable` plugin (client-side, portrait orientation) |

### 6.2 Content — Basic Mode

```
┌────────────────────────────────────────────────────────┐
│  dEdx Web — Calculator                                 │
│  Generated: 2026-04-13T14:32:00Z                       │
│  URL: https://dedx.example.org/?particle=1&...         │ ← clickable
│                                                        │
│  Proton in Water (liquid) — ICRU 90                    │
│                                                        │
│  Typed  │ Norm (MeV/nucl) │ Unit │ STP (keV/µm) │ CSDA │
│  ───────┼─────────────────┼──────┼──────────────┼───── │
│  100    │ 100             │ MeV  │ 13.92        │7.718 cm│
│  500    │ 500             │ MeV  │ 7.834        │116.1 cm│
└────────────────────────────────────────────────────────┘
```

The five-column table mirrors the unified table exactly.

### 6.3 Content — Advanced Mode

The results table comes immediately after the header — the reader sees
data first. The extended metadata block (same fields as §5.3) is appended
**after the table**, beginning with an "Advanced Mode Details" divider.

```
┌────────────────────────────────────────────────────────┐
│  dEdx Web — Calculator (Advanced Mode)                 │
│  Generated: 2026-04-13T14:32:00Z                       │
│  URL: https://dedx.example.org/?mode=advanced&...      │ ← clickable
│                                                        │
│  Proton in Water (liquid) — ICRU 90 / PSTAR / NIST     │
│                                                        │
│  Energy │ MeV/n │ Unit │ Stp ICRU90 │ Stp PSTAR │ …   │
│  ───────┼───────┼──────┼────────────┼───────────┼──── │
│  100    │ 100   │ MeV  │ 13.92      │ 14.01     │ …   │
│  500    │ 500   │ MeV  │ 7.834      │ 7.912     │ …   │
├────────────────────────────────────────────────────────┤
│  ── Advanced Mode Details ───────────────────────────  │
│                                                        │
│  PARTICLE Proton  Z=1  A=1                             │
│  MATERIAL Water (liquid)  ρ = 1.000 g/cm³              │
│  PROGRAMS ICRU 90 (built-in) / PSTAR (built-in) /      │
│           NIST (external) https://…                    │
│  SETTINGS Interpolation: Log-log / Spline              │
│  SYSTEM   Chrome 124 / macOS 14.0                      │
│  BUILD    a1b2c3d · 2026-04-13 · main                  │
└────────────────────────────────────────────────────────┘
```

**Table layout for wide tables** — the advanced comparison table (many
program columns) is split across pages by quantity group:

- **Page 1 (or continuation):** Energy columns + all stopping-power columns.
- **Next page:** Energy columns + all CSDA-range columns.

This prevents the table from becoming unreadable when printed. The
energy identity columns (`Energy (MeV)`, `MeV/nucl`, `Unit`) are
repeated on each page as leading columns.

Visibility rules applied to the table:

- Hidden program columns are excluded.
- Quantity focus (`STP only` / `CSDA only`) suppresses the corresponding page.

All Calculator PDF documents (basic and advanced) include a
**page-number footer** on every page in the format `Page n / N`
(right-aligned, bottom margin). Single-page basic-mode PDFs still carry
the footer for consistency.

### 6.4 Filename

```
dedx_calculator_{particle}_{material}_{program}.pdf    (basic)
dedx_{particle}_{material}_{N}programs.pdf             (advanced)
```

---

## 7. Filename Convention Summary

| Context | CSV filename | PDF filename | Image filename |
|---------|-------------|-------------|----------------|
| Calculator basic | `dedx_calculator_{particle}_{material}_{program}.csv` | `dedx_calculator_{particle}_{material}_{program}.pdf` | — |
| Calculator advanced | `dedx_{particle}_{material}_{N}programs.csv` | `dedx_{particle}_{material}_{N}programs.pdf` | — |
| Plot | `dedx_plot_data.csv` | `dedx_plot_report.pdf` | `dedx_plot.png` / `dedx_plot.svg` |

ASCII-safe filename rules applied to `{particle}` and `{material}`:
- All lowercase.
- Spaces replaced with underscores.
- Non-ASCII characters stripped or transliterated (e.g., `µ` → `u`).
- Total filename length capped at 200 characters.

---

## 8. Accessibility

| Element | Requirement |
|---------|-------------|
| Toolbar "Export PDF" button (both pages) | `aria-label="Download results as PDF"` when on Calculator; `aria-label="Export plot report as PDF"` when on Plot |
| Toolbar "Export CSV ↓" button (both pages) | `aria-label="Download results as CSV"` when on Calculator basic; `aria-label="Configure and download results as CSV"` when in advanced mode; `aria-label="Export visible series data as CSV"` when on Plot basic; `aria-haspopup="dialog"` in advanced mode |
| Both toolbar export buttons (disabled state) | `aria-disabled="true"` when no results available |
| CSV configuration modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the "Export CSV" heading; focus trapped within modal while open; `Escape` closes |
| Plot "Export image ▾" dropdown | `aria-label="Export plot as image"`, `aria-haspopup="true"`, `aria-expanded` toggled |
| Dropdown menu | `role="menu"` |
| Dropdown items ("PNG image", "SVG vector") | `role="menuitem"` |

Keyboard behaviour for the "Export image ▾" dropdown:

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Opens the dropdown |
| `↓` / `↑` | Navigate menu items |
| `Enter` | Select focused item (triggers download, closes dropdown) |
| `Escape` | Closes dropdown without downloading |

---

## 9. Acceptance Checklist

### Export Toolbar
- [ ] "Export PDF" and "Export CSV ↓" buttons are present in the app toolbar (upper-right) on both Calculator and Plot pages; "Share URL" is the rightmost button; the order left-to-right is `[Export PDF]  [Export CSV ↓]  [Share URL]`.
- [ ] Both buttons are **disabled** (greyed out, `aria-disabled="true"`) when no results are available; they become active as soon as at least one result row is present.
- [ ] Button states are independent: disabling/enabling one does not affect the other.

### Advanced-Mode CSV Configuration Modal
- [ ] In Calculator advanced mode and Plot advanced mode, clicking "Export CSV ↓" opens the configuration modal (not a direct download).
- [ ] Modal offers: Separator (Comma / Semicolon / Tab), Line endings (CRLF / LF), Filename (editable, pre-filled with canonical default).
- [ ] "Download CSV" in the modal applies settings and downloads; "Cancel" and `Escape` close without downloading.
- [ ] Last-used separator and line-ending settings are restored from `localStorage` on the next advanced export.
- [ ] Encoding (UTF-8 BOM) and quoting (RFC 4180) are always applied regardless of modal settings.
- [ ] In basic mode on both Calculator and Plot, clicking "Export CSV ↓" downloads directly (no modal).

### Calculator — Basic Mode CSV
- [ ] "Export CSV ↓" toolbar button becomes active when at least one result row is present; clicking downloads directly (no modal in basic mode).
- [ ] CSV contains exactly five columns in this order: `Normalized Energy (MeV/nucl)`, `Typed Value`, `Unit`, `CSDA Range`, `Stopping Power ({unit})`.
- [ ] Stopping Power is the **last** column.
- [ ] CSDA Range is the **fourth** column.
- [ ] Stopping Power column header includes the active unit (e.g., `Stopping Power (keV/µm)`).
- [ ] Stopping Power values are numeric only — no unit suffix in cells.
- [ ] CSDA Range values include the auto-scaled SI unit suffix in each cell (e.g., `7.718 cm`).
- [ ] CSDA Range column header carries no unit.
- [ ] Error/validation rows are omitted from the CSV.
- [ ] CSV uses UTF-8 with BOM, comma delimiter, CRLF line endings.
- [ ] Filename follows `dedx_calculator_{particle}_{material}_{program}.csv`.

### Calculator — Basic Mode PDF
- [ ] "Export PDF" toolbar button becomes active when results are present.
- [ ] PDF contains: app name, generated timestamp (ISO 8601 UTC), clickable page URL, entity summary line, and the five-column table.
- [ ] Table rows match the on-screen unified table (same values, same units).
- [ ] Column order in the PDF table matches the CSV column order: Normalized Energy, Typed Value, Unit, CSDA Range, Stopping Power.
- [ ] Error/validation rows are omitted from the table.
- [ ] Page carries a `Page n / N` footer.
- [ ] Filename follows `dedx_calculator_{particle}_{material}_{program}.pdf`.

### Calculator — Advanced / Multi-program Mode CSV
- [ ] CSV uses wide table format with one row per energy value.
- [ ] Stopping-power columns appear before CSDA-range columns (grouped by quantity).
- [ ] Column order matches on-screen order, including drag-and-drop reordering.
- [ ] Hidden program columns are excluded.
- [ ] Quantity focus `STP only` → only stopping-power columns exported.
- [ ] Quantity focus `CSDA only` → only CSDA-range columns exported.
- [ ] Delta / % columns are NOT included.
- [ ] Stopping-power column headers include program name and unit (e.g., `Stp Power ICRU 90 (keV/µm)`).
- [ ] CSDA-range column headers include program name but no fixed unit.
- [ ] Filename follows `dedx_{particle}_{material}_{N}programs.csv` where `{N}` is the visible program count.

### Calculator — Advanced / Multi-program Mode PDF
- [ ] PDF metadata block order: PARTICLE, MATERIAL, PROGRAMS, SETTINGS, SYSTEM, BUILD — BUILD is last.
- [ ] BUILD section is silently omitted if `deploy.json` is absent.
- [ ] Wide comparison table is split across pages: STP columns on one page, CSDA range columns on the next; energy identity columns repeated on each page.
- [ ] Hidden program columns are excluded from the table.
- [ ] Quantity focus affects PDF table (same visibility rules as CSV).
- [ ] Every page carries a `Page n / N` footer (right-aligned, bottom margin).
- [ ] Filename follows `dedx_{particle}_{material}_{N}programs.pdf`.

### Plot — Image Export
- [ ] "Export image ▾" dropdown button appears in the controls bar, right-aligned — the only export control in the controls bar.
- [ ] In **basic mode**: dropdown offers exactly one item: "SVG vector".
- [ ] In **advanced mode**: dropdown offers two items: "PNG image" and "SVG vector".
- [ ] "PNG image" option is **not present** in basic mode (not greyed out — simply absent).
- [ ] Selecting "PNG image" (advanced only) downloads `dedx_plot.png` at 2× canvas resolution.
- [ ] Selecting "SVG vector" downloads `dedx_plot.svg` via JSROOT `makeSVG()`.
- [ ] Both formats include all visible series, axis labels, ticks, and gridlines.
- [ ] Both formats exclude hidden series, preview series, sidebar, and series list.
- [ ] Keyboard: `Enter`/`Space` opens dropdown; `↓`/`↑` navigates; `Enter` selects and downloads; `Escape` closes without downloading.
- [ ] `aria-expanded` is correctly toggled on the trigger button.

### Plot — PDF Export
- [ ] "Export PDF" toolbar button is active on the Plot page when at least one committed (non-preview) series is present; disabled otherwise.
- [ ] Basic mode PDF contains: app name, generated timestamp (ISO UTC), clickable page URL, chart SVG, legend.
- [ ] Advanced mode PDF additionally contains: PARTICLE (Z, A), MATERIAL (density), PROGRAMS list with ext URLs, SETTINGS (non-default advanced options), SYSTEM (browser/OS), BUILD — in that order within the "Advanced Mode Details" block; BUILD is last.
- [ ] External program entries in PROGRAMS list show their source URL.
- [ ] Legend shows colour swatch + label for each visible committed series.
- [ ] Legend overflows to next page if needed.
- [ ] BUILD block is silently omitted if `deploy.json` is absent.
- [ ] Every page carries a `Page n / N` footer (right-aligned, bottom margin).
- [ ] Filename is `dedx_plot_report.pdf`.

### Plot — CSV Export
- [ ] "Export CSV ↓" toolbar button is active on the Plot page when at least one committed (non-preview) series is present.
- [ ] When no external series are present and all internal series share the same energy grid: single `Energy [MeV/nucl]` column.
- [ ] When any `ext:` series is present (regardless of libdedx grid): always Case B — every series gets its own `Energy {program} [MeV/nucl]` column.
- [ ] When internal series have different grids (no ext): Case B applies.
- [ ] One `# External source: {label} at {url}` comment row per distinct external source, appearing before the column header row.
- [ ] External series column labels use the user-assigned `{label}` directly (no `[ext]` annotation).
- [ ] Stopping-power column headers follow `Stp {program} — {particle} in {material} ({unit})`.
- [ ] Stopping-power unit in headers matches the current Y-axis display unit.
- [ ] Hidden series and preview series are excluded.
- [ ] Shorter series columns padded with empty cells when grids differ in length.
- [ ] CSV uses UTF-8 with BOM, comma delimiter, CRLF line endings.
- [ ] Filename is `dedx_plot_data.csv`.

### Common
- [ ] All CSV files open correctly in Microsoft Excel (UTF-8 BOM recognized, comma-delimited, no truncation, `#` comment rows skipped by Import Wizard).
- [ ] 4 significant figures in CSV match on-screen display values.
- [ ] No thousands separators in numeric cells.
- [ ] All PDF hyperlinks are clickable (test in Adobe Reader and browser PDF viewer).
- [ ] Unicode characters in PDF (µ, ²,·, α) render correctly (requires embedded Unicode font in jsPDF).
