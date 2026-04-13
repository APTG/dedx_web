# Feature: Export

> **Status:** Final v2 (13 April 2026)
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

## Scope

This spec is the **authoritative reference** for all CSV, image, and PDF
export across the dEdx Web redesign. The export sections in
[`calculator.md`](calculator.md), [`multi-program.md`](multi-program.md),
and [`plot.md`](plot.md) contain brief summaries that point here for
normative detail.

| Page / Mode | Export formats |
|-------------|---------------|
| Calculator — basic mode | CSV, PDF |
| Calculator — advanced / multi-program | CSV, PDF |
| Plot | Image (PNG or SVG via dropdown), CSV, PDF |

---

## 1. Common CSV Conventions

All exported CSV files share these rules:

| Property | Value |
|----------|-------|
| Encoding | UTF-8 **with BOM** (ensures correct rendering in Windows Excel) |
| Delimiter | Comma (`,`) |
| Line endings | CRLF |
| Quoting | Values containing commas or `"` are double-quoted; all other values unquoted |
| First row | Column headers (immediately after any `#` comment rows — see §4.3) |
| Numeric precision | 4 significant figures, matching on-screen display |
| Thousands separator | None (`13920` not `13,920`) |
| CSDA per-cell unit | Value and unit suffix in the same cell (e.g., `7.718 cm`); the column header carries no unit |
| Stopping power unit | Active display unit appears in the column header (e.g., `Stopping Power (keV/µm)`) |

---

## 2. Calculator Export — Basic Mode

### Button

| Property | Detail |
|----------|--------|
| "Export CSV ↓" | Right-aligned below the unified input/result table |
| "Export PDF" | Left of "Export CSV ↓", same row |
| Visibility | Both buttons shown when at least one row has a computed result; hidden otherwise |

### CSV Schema

Five columns — exactly the five columns visible in the unified table:

```csv
"Typed Value","Normalized Energy (MeV/nucl)","Unit","Stopping Power (keV/µm)","CSDA Range"
100,100,MeV,13.92,7.718 cm
500,500,MeV,7.834,116.1 cm
```

Column rules:

| # | Header | Content |
|---|--------|---------|
| 1 | `Typed Value` | The exact string the user typed in the input cell |
| 2 | `Normalized Energy (MeV/nucl)` | Numeric value in MeV/nucl (4 sig figs) |
| 3 | `Unit` | Per-row energy unit (e.g., `MeV`, `keV`, `MeV/nucl`) |
| 4 | `Stopping Power ({unit})` | Numeric value in the active display unit (4 sig figs); no unit suffix in cell |
| 5 | `CSDA Range` | Value + auto-scaled SI unit suffix in the same cell (e.g., `7.718 cm`); no fixed unit in header |

Column 4 substitutes `{unit}` with the active stopping-power unit:
- `keV/µm` for non-gas materials (default)
- `MeV·cm²/g` for gas materials (default)
- Or the user-selected unit if overridden

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

Same "Export PDF" and "Export CSV ↓" buttons, right-aligned below the
comparison table, in identical positions to basic mode.

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

| Property | Detail |
|----------|--------|
| Label | "Export image ▾" |
| Type | Dropdown button |
| Position | Controls bar above the JSROOT canvas, **right-aligned** — leftmost of the three export controls |
| Options | "PNG image" / "SVG vector" |

Wireframe (controls bar):

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [keV/µm · MeV·cm²/g · MeV/cm]  [Log-log · Lin-lin]  [img ▾] [PDF] [CSV ↓]  │
└───────────────────────────────────────────────────────────────────────────────┘
```

Dropdown (open):

```
                                                      ┌──────────────┐
                                                      │ PNG image    │
                                                      │ SVG vector   │
                                                      └──────────────┘
```

Selecting an option triggers the download immediately and closes the dropdown.

#### PNG Export

| Property | Detail |
|----------|--------|
| Trigger | Select "PNG image" from the dropdown |
| Mechanism | JSROOT canvas snapshot (rasterized from the rendered canvas) |
| Resolution | 2× the CSS canvas dimensions (Retina-quality) |
| Filename | `dedx_plot.png` |
| Includes | All **visible** series lines, axis labels, axis ticks, gridlines |
| Excludes | Hidden series, preview series, sidebar, series list below the canvas, browser chrome |

#### SVG Export

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
| Position | Controls bar, **right-aligned** — rightmost of the three export controls |

#### CSV Schema

**Wide format only** — one row per energy point; each series occupies one
or two columns depending on whether energy grids are shared (see §4.3 for
the external-data rule).

---

**Case A — all series share the same energy grid**

Applies only when **no external (`ext:`) series are present** and all
libdedx series happen to share the same tabulated energy points.

```csv
"Energy (MeV)","Stp ICRU 90 — p in Water (keV/µm)","Stp PSTAR — p in Water (keV/µm)"
0.001,84.30,81.55
0.002,65.10,63.20
```

- A single `Energy (MeV)` column appears first.
- Each subsequent column is one series' stopping-power values.

---

**Case B — series have different energy grids (or any `ext:` series present)**

This is the typical case when programs have different tabulated energy
bounds, different point counts, or when any external-data series is
included (see §4.3).

```csv
"Energy ICRU 90 (MeV)","Stp ICRU 90 — p in Water (keV/µm)","Energy PSTAR (MeV)","Stp PSTAR — α in Al (keV/µm)"
0.001,84.30,0.001,92.14
0.002,65.10,0.002,71.30
```

- Each series gets its own `Energy {program} (MeV)` column immediately
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
| Position | Controls bar, **right-aligned** — between "Export image ▾" and "Export CSV ↓" |
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

Advanced mode PDF includes everything in §5.2 **plus** a metadata block
between the header and the chart:

```
┌─────────────────────────────────────────────────────────┐
│  dEdx Web — Advanced Mode                               │
│  Generated: 2026-04-13T14:32:00Z                        │
│  URL: https://dedx.example.org/?mode=advanced&...       │
│                                                         │
│  BUILD                                                  │
│  Commit: a1b2c3d · 2026-04-13 · main                   │
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
├─────────────────────────────────────────────────────────┤
│  [Chart SVG]                                            │
├─────────────────────────────────────────────────────────┤
│  Legend                                                 │
│  ■  ICRU 90 — Proton in Water                           │
│  ■  PSTAR — Proton in Water                             │
│  ■  NIST — Proton in Water (ext)                        │
└─────────────────────────────────────────────────────────┘
```

Metadata block rules:

| Section | Content | Mode |
|---------|---------|------|
| App name + mode | "dEdx Web" / "dEdx Web — Advanced Mode" | both |
| Generated timestamp | ISO 8601 UTC | both |
| URL | Full shareable URL — clickable hyperlink | both |
| **BUILD** | Commit hash · ISO date · branch/tag (from `deploy.json` per `build-info.md`) | advanced only |
| **PARTICLE** | Name, Z (atomic number), A (mass number) | advanced only |
| **MATERIAL** | Name, phase, density ρ in g/cm³ (override value if set, otherwise built-in) | advanced only |
| **PROGRAMS** | One row per visible series: label + "(built-in)" or "(external) {url}" | advanced only |
| **SETTINGS** | Active Advanced Options: interpolation axis/method, aggregate state, density override, I-value override (only if non-default values are active) | advanced only |
| **SYSTEM** | Browser and OS parsed from `navigator.userAgent` | advanced only |

If `deploy.json` is absent (local dev), the BUILD section is omitted silently.

The legend may overflow to a second page if there are many series.

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
| Position | Below the unified table (basic) or comparison table (advanced), left of "Export CSV ↓" |
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

Advanced mode PDF includes the same extended metadata block as the Plot
PDF (§5.3) — build info, particle Z/A, material density, programs list,
settings, system info — above the comparison table.

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
| Calculator "Export CSV ↓" button | `aria-label="Download results as CSV"` |
| Calculator "Export PDF" button | `aria-label="Download results as PDF"` |
| Plot "Export image ▾" dropdown | `aria-label="Export plot as image"`, `aria-haspopup="true"`, `aria-expanded` toggled |
| Dropdown menu | `role="menu"` |
| Dropdown items ("PNG image", "SVG vector") | `role="menuitem"` |
| Plot "Export PDF" button | `aria-label="Export plot report as PDF"` |
| Plot "Export CSV ↓" button | `aria-label="Export visible series data as CSV"` |

Keyboard behaviour for the "Export image ▾" dropdown:

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Opens the dropdown |
| `↓` / `↑` | Navigate menu items |
| `Enter` | Select focused item (triggers download, closes dropdown) |
| `Escape` | Closes dropdown without downloading |

---

## 9. Acceptance Checklist

### Calculator — Basic Mode CSV
- [ ] "Export CSV ↓" button appears below the unified table when at least one result row is present; hidden otherwise.
- [ ] CSV contains exactly five columns: `Typed Value`, `Normalized Energy (MeV/nucl)`, `Unit`, `Stopping Power ({unit})`, `CSDA Range`.
- [ ] Stopping Power column header includes the active unit (e.g., `Stopping Power (keV/µm)`).
- [ ] Stopping Power values are numeric only — no unit suffix in cells.
- [ ] CSDA Range values include the auto-scaled SI unit suffix in each cell (e.g., `7.718 cm`).
- [ ] CSDA Range column header carries no unit.
- [ ] Error/validation rows are omitted from the CSV.
- [ ] CSV uses UTF-8 with BOM, comma delimiter, CRLF line endings.
- [ ] Filename follows `dedx_calculator_{particle}_{material}_{program}.csv`.

### Calculator — Basic Mode PDF
- [ ] "Export PDF" button appears to the left of "Export CSV ↓" when results are present; hidden otherwise.
- [ ] PDF contains: app name, generated timestamp (ISO 8601 UTC), clickable page URL, entity summary line, and the five-column table.
- [ ] Table rows match the on-screen unified table (same values, same units).
- [ ] Error/validation rows are omitted from the table.
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
- [ ] PDF metadata block includes: build info (commit hash · date · branch), particle (Z, A), material (density), programs list, active Advanced Options settings, system info (browser + OS).
- [ ] BUILD section is silently omitted if `deploy.json` is absent.
- [ ] Wide comparison table is split across pages: STP columns on one page, CSDA range columns on the next; energy identity columns repeated on each page.
- [ ] Hidden program columns are excluded from the table.
- [ ] Quantity focus affects PDF table (same visibility rules as CSV).
- [ ] Filename follows `dedx_{particle}_{material}_{N}programs.pdf`.

### Plot — Image Export
- [ ] "Export image ▾" dropdown button appears in the controls bar, leftmost of the three export controls.
- [ ] Dropdown offers exactly two items: "PNG image" and "SVG vector".
- [ ] Selecting "PNG image" downloads `dedx_plot.png` at 2× canvas resolution.
- [ ] Selecting "SVG vector" downloads `dedx_plot.svg` via JSROOT `makeSVG()`.
- [ ] Both formats include all visible series, axis labels, ticks, and gridlines.
- [ ] Both formats exclude hidden series, preview series, sidebar, and series list.
- [ ] Keyboard: `Enter`/`Space` opens dropdown; `↓`/`↑` navigates; `Enter` selects and downloads; `Escape` closes without downloading.
- [ ] `aria-expanded` is correctly toggled on the trigger button.

### Plot — PDF Export
- [ ] "Export PDF" button appears in the controls bar, between "Export image ▾" and "Export CSV ↓".
- [ ] Basic mode PDF contains: app name, generated timestamp (ISO UTC), clickable page URL, chart SVG, legend.
- [ ] Advanced mode PDF additionally contains: BUILD block, PARTICLE (Z, A), MATERIAL (density), PROGRAMS list with ext URLs, SETTINGS (non-default advanced options), SYSTEM (browser/OS).
- [ ] External program entries in PROGRAMS list show their source URL.
- [ ] Legend shows colour swatch + label for each visible committed series.
- [ ] Legend overflows to next page if needed.
- [ ] BUILD block is silently omitted if `deploy.json` is absent.
- [ ] Filename is `dedx_plot_report.pdf`.

### Plot — CSV Export
- [ ] "Export CSV ↓" button appears in the controls bar, rightmost of the three export controls.
- [ ] When no external series are present and all internal series share the same energy grid: single `Energy (MeV)` column.
- [ ] When any `ext:` series is present (regardless of libdedx grid): always Case B — every series gets its own `Energy {program} (MeV)` column.
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
