# Feature: Export

> **Status:** Final v1 (13 April 2026)
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
> - Unit handling (units in CSV headers): [`unit-handling.md`](unit-handling.md)

---

## Scope

This spec is the **authoritative reference** for all CSV and image export
across the dEdx Web redesign. The export sections in
[`calculator.md`](calculator.md), [`multi-program.md`](multi-program.md),
and [`plot.md`](plot.md) contain brief summaries that point here for
normative detail.

| Page / Mode | Export formats |
|-------------|---------------|
| Calculator — basic mode | CSV |
| Calculator — advanced / multi-program | CSV |
| Plot | Image (PNG or SVG via dropdown) + CSV |

---

## 1. Common CSV Conventions

All exported CSV files share these rules:

| Property | Value |
|----------|-------|
| Encoding | UTF-8 **with BOM** (ensures correct rendering in Windows Excel) |
| Delimiter | Comma (`,`) |
| Line endings | CRLF |
| Quoting | Values containing commas or `"` are double-quoted; all other values unquoted |
| First row | Column headers |
| Numeric precision | 4 significant figures, matching on-screen display |
| Thousands separator | None (`13920` not `13,920`) |
| CSDA per-cell unit | Value and unit suffix in the same cell (e.g., `7.718 cm`); the column header carries no unit |
| Stopping power unit | Active display unit appears in the column header (e.g., `Stopping Power (keV/µm)`) |

---

## 2. Calculator Export — Basic Mode

### Button

| Property | Detail |
|----------|--------|
| Label | "Export CSV ↓" |
| Position | Right-aligned below the unified input/result table |
| Visibility | Shown when at least one row has a computed result |
| Disabled state | Not applicable — button is hidden if there are no results |

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
```

Example: `dedx_calculator_proton_water_icru90.csv`

- `{particle}` — lowercase ASCII particle name (e.g., `proton`, `alpha`, `carbon`)
- `{material}` — lowercase ASCII material name; spaces → underscores
  (e.g., `water`, `silicon`, `polyethylene`)
- `{program}` — program ID as used in the URL (e.g., `icru90`, `pstar`)

---

## 3. Calculator Export — Advanced / Multi-program Mode

### Button

Same "Export CSV ↓" button, right-aligned below the comparison table.
The label is identical to basic mode.

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
| Position | Controls bar above the JSROOT canvas, **right-aligned** — immediately left of "Export CSV ↓" |
| Options | "PNG image" / "SVG vector" |

Wireframe (controls bar, collapsed dropdown):

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [keV/µm · MeV·cm²/g · MeV/cm]  [Log-log · Lin-lin]  [image ▾] [CSV ↓] │
└─────────────────────────────────────────────────────────────────────────┘
```

Wireframe (dropdown open):

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [keV/µm · MeV·cm²/g · MeV/cm]  [Log-log · Lin-lin]  [image ▾] [CSV ↓] │
│                                                        ┌─────────────┐  │
│                                                        │ PNG image   │  │
│                                                        │ SVG vector  │  │
│                                                        └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
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
| Excludes | Hidden series, sidebar, series list below the canvas, browser chrome |

#### SVG Export

| Property | Detail |
|----------|--------|
| Trigger | Select "SVG vector" from the dropdown |
| Mechanism | JSROOT `makeSVG()` (vector output, independent of canvas rendering mode) |
| Filename | `dedx_plot.svg` |
| Includes | All **visible** series lines, axis labels, axis ticks, gridlines |
| Excludes | Hidden series, sidebar, series list below the canvas, browser chrome |
| Use case | Publication-quality vector figures; further editing in Inkscape / Illustrator |

Both formats exclude the preview series.

### 4.2 Plot CSV Export

#### Button

| Property | Detail |
|----------|--------|
| Label | "Export CSV ↓" |
| Position | Controls bar above the JSROOT canvas, **right-aligned** — immediately right of "Export image ▾" |

#### CSV Schema

**Wide format only** — one row per energy point; each series occupies one
or two columns depending on whether energy grids are shared.

---

**Case A — all series share the same energy grid**

This is common when all series use the same program (identical tabulated
energy points) or when the energy grids happen to coincide.

```csv
"Energy (MeV)","Stp ICRU 90 — p in Water (keV/µm)","Stp PSTAR — p in Water (keV/µm)"
0.001,84.30,81.55
0.002,65.10,63.20
```

- A single `Energy (MeV)` column appears first.
- Each subsequent column is one series' stopping-power values.

---

**Case B — series have different energy grids**

This is the typical case when different programs have different tabulated
energy bounds or different numbers of points.

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

### Filename

```
dedx_plot_data.csv
```

---

## 5. Filename Convention Summary

| Context | Filename pattern | Example |
|---------|-----------------|---------|
| Calculator basic | `dedx_calculator_{particle}_{material}_{program}.csv` | `dedx_calculator_proton_water_icru90.csv` |
| Calculator advanced | `dedx_{particle}_{material}_{N}programs.csv` | `dedx_proton_water_3programs.csv` |
| Plot CSV | `dedx_plot_data.csv` | `dedx_plot_data.csv` |
| Plot PNG | `dedx_plot.png` | `dedx_plot.png` |
| Plot SVG | `dedx_plot.svg` | `dedx_plot.svg` |

ASCII-safe filename rules applied to `{particle}` and `{material}`:
- All lowercase.
- Spaces replaced with underscores.
- Non-ASCII characters stripped or transliterated (e.g., `µ` → `u`).
- Total filename length capped at 200 characters.

---

## 6. Accessibility

| Element | Requirement |
|---------|-------------|
| Calculator "Export CSV ↓" button | `aria-label="Download results as CSV"` |
| Plot "Export image ▾" dropdown | `aria-label="Export plot as image"`, `aria-haspopup="true"`, `aria-expanded` toggled |
| Dropdown menu | `role="menu"` |
| Dropdown items ("PNG image", "SVG vector") | `role="menuitem"` |
| Plot "Export CSV ↓" button | `aria-label="Export visible series data as CSV"` |

Keyboard behaviour for the "Export image ▾" dropdown:

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Opens the dropdown |
| `↓` / `↑` | Navigate menu items |
| `Enter` | Select focused item (triggers download, closes dropdown) |
| `Escape` | Closes dropdown without downloading |

---

## 7. Acceptance Checklist

### Calculator — Basic Mode

- [ ] "Export CSV ↓" button appears below the unified table when at least one result row is present.
- [ ] Button is hidden (not just disabled) when no results are available.
- [ ] CSV contains exactly five columns: `Typed Value`, `Normalized Energy (MeV/nucl)`, `Unit`, `Stopping Power ({unit})`, `CSDA Range`.
- [ ] Stopping Power column header includes the active unit (e.g., `Stopping Power (keV/µm)`).
- [ ] Stopping Power values are numeric only — no unit suffix in cells.
- [ ] CSDA Range values include the auto-scaled SI unit suffix in each cell (e.g., `7.718 cm`).
- [ ] CSDA Range column header carries no unit.
- [ ] Error/validation rows are omitted from the CSV.
- [ ] CSV uses UTF-8 with BOM, comma delimiter, CRLF line endings.
- [ ] Filename follows `dedx_calculator_{particle}_{material}_{program}.csv`.

### Calculator — Advanced / Multi-program Mode

- [ ] CSV uses wide table format with one row per energy value.
- [ ] Stopping-power columns appear before CSDA-range columns (grouped by quantity).
- [ ] Column order matches on-screen order, including drag-and-drop reordering.
- [ ] Hidden program columns are excluded from the CSV.
- [ ] Quantity focus `STP only` → only stopping-power columns exported.
- [ ] Quantity focus `CSDA only` → only CSDA-range columns exported.
- [ ] Quantity focus `Both` → both groups exported.
- [ ] Delta / % columns are NOT included.
- [ ] Stopping-power column headers include program name and unit (e.g., `Stp Power ICRU 90 (keV/µm)`).
- [ ] CSDA-range column headers include program name but no fixed unit.
- [ ] Filename follows `dedx_{particle}_{material}_{N}programs.csv` where `{N}` is the visible program count.

### Plot — Image Export

- [ ] "Export image ▾" dropdown button appears in the controls bar, right of axis controls.
- [ ] Dropdown offers exactly two items: "PNG image" and "SVG vector".
- [ ] Selecting "PNG image" downloads a PNG file named `dedx_plot.png` at 2× canvas resolution.
- [ ] Selecting "SVG vector" downloads an SVG file named `dedx_plot.svg` via JSROOT `makeSVG()`.
- [ ] Both formats include all visible series lines, axis labels, axis ticks, and gridlines.
- [ ] Both formats exclude hidden series, the preview series, the sidebar, and the series list.
- [ ] Keyboard: `Enter`/`Space` opens dropdown; `↓`/`↑` navigates; `Enter` selects and downloads; `Escape` closes without downloading.
- [ ] `aria-expanded` is set correctly on the trigger button.

### Plot — CSV Export

- [ ] "Export CSV ↓" button appears in the controls bar, immediately right of "Export image ▾".
- [ ] CSV uses wide format: one row per energy point.
- [ ] When all visible series share the same energy grid, a single `Energy (MeV)` column appears first.
- [ ] When series have different energy grids, each series gets its own `Energy {program} (MeV)` column before its stopping-power column.
- [ ] Stopping-power column headers follow the pattern `Stp {program} — {particle} in {material} ({unit})`.
- [ ] Stopping-power unit in headers matches the current Y-axis display unit.
- [ ] Hidden series are excluded.
- [ ] Preview series is excluded.
- [ ] Shorter series columns are padded with empty cells when grids differ in length.
- [ ] CSV uses UTF-8 with BOM, comma delimiter, CRLF line endings.
- [ ] Filename is `dedx_plot_data.csv`.

### Common

- [ ] All CSV files open correctly in Microsoft Excel (UTF-8 BOM recognized, comma-delimited, no truncation).
- [ ] 4 significant figures match on-screen display values.
- [ ] No thousands separators in numeric cells.
