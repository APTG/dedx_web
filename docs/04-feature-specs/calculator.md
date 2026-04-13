# Feature: Calculator Page

> **Status:** Final v7 (13 April 2026)
>
> **v7** (13 April 2026): Export section updated — "Export PDF" button
> added to the left of "Export CSV ↓"; PDF content is mode-sensitive
> (basic: date + URL; advanced: full metadata block). Export AC updated.
> References [`export.md`](export.md) v2 for normative detail.
>
> **v1** (3 April 2026): Initial draft — energy input textarea, debounced
> live calculation, result table, compact entity selection integration,
> per-line validation, responsive layout, URL state encoding, export button.
>
> **v2** (7 April 2026): Fixed energy-unit recalc contradiction. Aligned
> per-line validation with v1 summary-only approach. Clarified URL
> comma-separated → textarea newline-separated expansion.
>
> **v3** (7 April 2026): Moved detailed energy unit logic to
> [`unit-handling.md`](unit-handling.md). Calculator spec now contains a
> brief summary referencing that spec. Added: particle-dependent unit options
> (including electrons = MeV only), inline unit detection from typed text
> (e.g., "100 keV" auto-switches selector). Updated acceptance criteria.
>
> **v4** (7 April 2026): Unified UI labels from "Ion" to "Particle".
> URL query param renamed `ion` → `particle`. CSV filename uses
> `{particle}`. `EntitySelectionState` field renamed `.ion` →
> `.particle` (type remains `ParticleEntity`).
>
> **v5** (7 April 2026): Major UX redesign. Replaced textarea + separate
> result table with a **unified input/result table** where each row
> shows typed value, normalized energy, per-row unit dropdown, stopping
> power, and CSDA range — all inline. Default stopping power unit changed
> to keV/µm (non-gas) / MeV·cm²/g (gas). CSDA range displayed in
> auto-scaled length units (nm/µm/mm/cm/m). Per-row independent SI prefix
> auto-scaling replaces scientific notation for output. Per-row unit
> detection (mixed units across rows supported). Material phase indicator
> added. URL encoding updated for mixed per-row units. Updated all
> wireframes, state management types, and acceptance criteria.
>
> **v6** (7 April 2026): Stage 1 unit-conversion finalization.
> Aligned with canonical conversion contract in `unit-handling.md`:
> clarified that stopping power does not use SI auto-scaling, tightened
> calculator-vs-plot default-unit split, and made CSV export unit behavior
> explicit and table-consistent.
>
> The Calculator page is the **landing page** and primary use case (~80%
> of users). It provides numeric stopping power and CSDA range lookup for
> user-specified energies. Results update reactively as the user types.
>
> **Related specs:**
> - Entity selection (compact mode): [`entity-selection.md`](entity-selection.md)
> - Unit handling (energy units, SI prefixes, inline detection, output units): [`unit-handling.md`](unit-handling.md)
> - Multi-program advanced behavior (program multi-select, grouped comparison columns, quantity focus): [`multi-program.md`](multi-program.md)
> - Shareable URLs: [`shareable-urls.md`](shareable-urls.md)
> - Advanced options: TODO `advanced-options.md`
> - Export (CSV schema, filename convention, button placement): [`export.md`](export.md)

---

## User Story

**As a** medical physicist,
**I want to** enter one or more energy values and immediately see the
stopping power and CSDA range for my chosen particle and material,
**so that** I get a numeric answer in seconds without navigating away from
the landing page.

**As a** student,
**I want to** see results update live as I type energy values,
**so that** I can explore how stopping power and range change with energy
without pressing a "Calculate" button.

---

## Page Layout Overview

The Calculator page uses the **compact mode** entity selection layout
(searchable dropdown comboboxes) as defined in
[`entity-selection.md` § Compact Mode](entity-selection.md#compact-mode-calculator-page).
The page is a single centered column with two visual sections stacked
vertically:

1. **Entity selection row** — Particle, Material (with phase badge),
   Program comboboxes + energy unit selector.
2. **Unified input/result table** — each row shows: typed energy value |
   → normalized MeV/nucl | per-row unit dropdown | stopping power |
   CSDA range.

The visual centerpiece is the **unified table**. The entity selectors
exist to configure it. Input and output are **combined in one table** —
the user types in the first column and sees results appear in the last
two columns of the same row.

---

## Inputs

### 1. Entity Selection (compact mode)

Defined fully in [`entity-selection.md`](entity-selection.md). The
Calculator page renders the compact mode variant:

| Selector | Default | Notes |
|----------|---------|-------|
| Particle | Proton (H) | Searchable combobox, ~240px on desktop |
| Material | Water (liquid) | Searchable combobox, ~240px on desktop. Shows **phase badge** (see below). |
| Program | Auto-select → resolved | Searchable combobox, ~180px on desktop |

The entity selection component exposes `EntitySelectionState` to the
Calculator page. The Calculator only triggers calculation when
`isComplete === true` (all three entities selected and compatible).

#### Material Phase Badge

When a material is selected, a subtle phase indicator appears next to or
inside the material combobox: "solid", "liquid", or "gas". This is
determined from `MaterialEntity.isGasByDefault`:
- `true` → "gas"
- `false` → "solid" or "liquid" (use the material's known phase if available,
  otherwise "solid/liquid")

The badge serves two purposes:
1. Inform the user about the material's default aggregate state.
2. Explain why the default stopping power unit changes when switching
   between gas and non-gas materials (see [`unit-handling.md`](unit-handling.md) §5.1).

### 2. Energy Unit Selector

| Property | Detail |
|----------|--------|
| Type | Segmented control / radio buttons (not a dropdown — ≤3 options, see §4.2 of project vision) |
| Position | Inline with the entity selection row, after the Program combobox |
| Options | **Particle-dependent.** The selected particle type determines which units are shown: MeV only for proton and electron; MeV + MeV/nucl for heavy ions. See [`unit-handling.md`](unit-handling.md) §2 for the full rules. |
| Default | MeV |
| Master vs. per-row mode | When all rows have plain numbers (no unit suffix), the selector is **active** (master mode). When any row has a typed unit suffix, the selector becomes **greyed out / disabled** (per-row mode). See [`unit-handling.md`](unit-handling.md) §2 "Master vs. Per-Row Mode". |
| Behavior | Changing the unit **does not modify the typed values** — the numeric text stays the same. The values are reinterpreted in the new unit, which **triggers an immediate recalculation**. See Recalculation Triggers table below. |
| Inline unit detection | When the user types a unit suffix in a row (e.g., `100 keV`, `250 GeV/nucl`), the parser detects it after debounce, assigns the row its own unit, and — if this creates mixed units — switches to per-row mode. See [`unit-handling.md`](unit-handling.md) §3 for parsing rules. |

> Full energy unit logic — particle-dependent options, SI prefix handling,
> per-row unit detection, output unit defaults, conversion formulas — lives in
> [`unit-handling.md`](unit-handling.md). The Calculator spec only
> describes how the selector integrates into the page layout and
> reactivity chain.

### 3. Unified Input/Result Table

The energy input and calculation results are **combined in a single table**.
Each row contains an editable input cell on the left and computed results
on the right. This eliminates the need for a separate textarea and result
table.

#### Table Columns

| # | Column | Header label | Editable? | Content |
|---|--------|-------------|-----------|---------|
| 1 | **Typed Value** | "Energy ({unit})" | **Yes** — inline text input | User types an energy value, optionally with a unit suffix (e.g., `100`, `10 keV`) |
| 2 | **Normalized** | "→ MeV/nucl" | No | Computed: the typed value converted to MeV/nucl. Shown in scientific notation for very small/large values. |
| 3 | **Unit** | "Unit" | Via dropdown | Per-row unit dropdown. In master mode: shows the master unit (not interactive). In per-row mode: each row's dropdown is independently selectable. |
| 4 | **Stopping Power** | "Stopping Power ({unit})" | No | `CalculationResult.stoppingPowers[i]`, converted to display unit (keV/µm or MeV·cm²/g — see [`unit-handling.md`](unit-handling.md) §5). |
| 5 | **CSDA Range** | "CSDA Range" | No | `CalculationResult.csdaRanges[i]`, converted to length and auto-scaled with SI prefix (see [`unit-handling.md`](unit-handling.md) §6). Unit shown per-row (e.g., "1.234 µm"). |

#### Stopping Power Column Unit

The column header shows the current stopping power unit:
- **Non-gas materials:** "Stopping Power (keV/µm)"
- **Gas materials:** "Stopping Power (MeV·cm²/g)"

This changes automatically when switching between gas and non-gas materials.
See [`unit-handling.md`](unit-handling.md) §5.1 for the rules.

> **Future:** The column header will become a clickable dropdown to let
> users switch between keV/µm, MeV/cm, and MeV·cm²/g manually.

#### CSDA Range Column Unit

The column header shows "CSDA Range" without a fixed unit — because each
row auto-scales independently to the best SI prefix:

- Row 1 might show `1.234 mm`
- Row 2 might show `45.67 µm`

The unit is displayed **inline with each cell value**, not in the header.
See [`unit-handling.md`](unit-handling.md) §6 for auto-scaling rules.

#### Row Behavior

- **Always-empty-row-at-bottom:** The table always has one empty row at
  the bottom. When the user types a value in the empty row, a new empty
  row appears below it. This creates a natural "append" interaction
  without needing an "Add Row" button.
- **Deleting a row:** When the user clears a row's typed value (backspace
  to empty), the row is removed after a short delay (or on blur),
  unless it's the only row or the last empty row.
- **Row order:** Rows maintain their order as entered. No automatic sorting.
- **Pre-filled on first load:** A single row with `100` is pre-filled,
  showing immediate results.

#### Input Cell Behavior

Each input cell in the "Typed Value" column is an inline `<input>` element:

| Property | Detail |
|----------|--------|
| Type | `<input type="text">` (not `<textarea>`) — single-line per row |
| Accepted formats | Positive numeric values: integers (`100`), decimals (`1.5`), scientific notation (`1e3`, `1.5E-2`). Optionally followed by a unit suffix (e.g., `100 keV`). |
| Parsing | On each input event (debounced 300ms), the value is parsed. A trailing unit suffix is detected per [`unit-handling.md`](unit-handling.md) §3. |
| Paste support | Pasting multi-line text (e.g., a column from Excel) into any input cell creates multiple rows — one per pasted line. |
| Tab / Enter | Pressing **Tab** or **Enter** moves focus to the next row's input cell. If at the last non-empty row, this focuses the always-empty-row at the bottom. |

### 4. Advanced Options (future)

Advanced functionality is controlled by the app-wide Basic/Advanced
toggle in the top-right action bar (see
[`../01-project-vision.md`](../01-project-vision.md) §4.4), not by a
local disclosure below the energy input.

When Advanced mode is active, additional calculator controls may expose:
- Aggregate state override (gas / condensed / default)
- Interpolation mode (log-log / linear)
- MSTAR mode (a–h)
- Density override (g/cm³)
- I-value override (eV)

These map to the `AdvancedOptions` type in the WASM API contract.
Not included in v1 — see TODO `docs/04-feature-specs/advanced-options.md`.

---

## Behavior

### Default State on First Load

When the Calculator page loads for the first time (no URL parameters):

1. WASM initializes and builds the compatibility matrix.
2. Entity selection defaults to: **Proton / Water (liquid) / Auto-select**.
3. The unified table has one pre-filled row with `100` in the typed value column.
4. Energy unit is set to **MeV** (since proton has A=1, only MeV is shown).
5. Material phase badge shows "liquid" next to the Water material.
6. Calculation runs automatically — the row shows results immediately:
   - Typed Value: 100
   - → MeV/nucl: 100
   - Unit: MeV
   - Stopping Power: value in keV/µm (non-gas material)
   - CSDA Range: value in auto-scaled length units (e.g., "7.718 cm")
7. An empty row appears below for the user to type additional values.
8. The user sees a complete, meaningful result **without touching any control**.

> This matches the project vision §3.1: "the user sees a result immediately
> without touching any control."

### Live Calculation (Debounced)

Results update reactively as the user types, without requiring a submit
button. The mechanism:

1. **On every input event** in any row's typed value cell (keystroke, paste, cut):
   - Parse the typed value (number + optional unit suffix).
   - Validate the row independently (see [Per-Row Validation](#per-row-validation)).
   - Check if per-row mode should be activated (see [`unit-handling.md`](unit-handling.md) §3).
2. **Debounce**: wait **300ms** after the last input event before triggering
   calculation. This prevents excessive WASM calls during rapid typing.
3. **If valid energies exist** and `EntitySelectionState.isComplete`:
   - Convert each row's energy from its unit (master or per-row) to MeV/nucl
     using `LibdedxService.convertEnergy()`.
   - Call `LibdedxService.calculate()` with the converted energies.
   - Convert stopping power to display unit (keV/µm or MeV·cm²/g) using
     material density.
   - Convert CSDA range from g/cm² to length (cm) and auto-scale with
     SI prefix.
   - Display results inline in each row's stopping power and CSDA range cells.
4. **If no valid energies exist**: result columns show empty cells.
5. **If entity selection is incomplete**: show a message above the table
   ("Select a particle and material to calculate").

### Recalculation Triggers

The result table recalculates when **any** of these inputs change:

| Trigger | Debounced? | Notes |
|---------|-----------|-------|
| Row input (typed value) | Yes (300ms) | Per-keystroke with debounce |
| Energy unit change (master) | No (immediate) | Energy values reinterpreted in new unit |
| Per-row unit dropdown change | No (immediate) | That row's value reinterpreted in new unit |
| Particle change | No (immediate) | May also change available energy units |
| Material change | No (immediate) | May change default stopping power unit (gas vs non-gas) |
| Program change | No (immediate) | May change energy bounds |
| Advanced options change (future) | No (immediate) | |

For entity/unit changes (non-debounced): if the table already contains
valid energies, recalculate immediately using the new parameters.

### Per-Row Validation

Each row in the unified table is validated independently:

| Condition | Row status | v1 reporting |
|-----------|-----------|------------------|
| Valid positive number (with or without unit suffix) | ✅ Valid | Results shown inline in that row |
| Empty row | ⏭️ Skipped | No results shown; row remains for input |
| Non-numeric text (e.g., "abc") | ❌ Invalid | Row highlighted; tooltip or inline message with reason |
| Unrecognized unit suffix (e.g., "100 bebok") | ❌ Invalid | Row highlighted: "Unrecognized unit 'bebok'" |
| Per-nucleon unit for proton/electron | ❌ Invalid | Row highlighted: "MeV/nucl not available for Proton" |
| Negative number | ❌ Invalid | Row highlighted: "Energy must be positive" |
| Zero | ❌ Invalid | Row highlighted: "Energy must be greater than zero" |
| Exceeds max energy for program/particle | ⚠️ Out of range | Row highlighted with valid range |
| Below min energy for program/particle | ⚠️ Out of range | Row highlighted with valid range |

**Key rules:**
- Invalid and out-of-range rows are **excluded** from the calculation but
  do **not** block valid rows.
- Invalid rows show empty cells in the Normalized, Stopping Power, and
  CSDA Range columns, with a subtle error indicator (red outline or
  background tint on the Typed Value cell).
- A validation summary line appears below the table when any rows have
  errors: "2 of 4 values out of range (valid range: 0.001–10000 MeV/nucl
  for PSTAR + Proton)".
- Range validation happens **after** unit conversion to MeV/nucl (since
  the C API bounds are in MeV/nucl).

### Energy Range Display

Below the unified table, show the valid energy range for the current selection:

```
Valid range: 0.001 – 10000 MeV/nucl (PSTAR, Proton)
```

This updates when the program, particle, or energy unit changes. The range
values are displayed in the user's selected energy unit (converted from
the C API's MeV/nucl).

### Handling Entity Selection Changes

When the user changes particle, material, or program via the compact selectors:

1. The entity selection component handles bidirectional filtering,
   preserve/fallback logic, and Auto-select resolution (per
   `entity-selection.md`).
2. If the energy unit options change (e.g., switching from proton to
   carbon adds "MeV/nucl"), the energy unit selector updates. If the
   previously selected unit is still available, it is preserved. Otherwise,
   default to MeV. In per-row mode, rows with unavailable units show
   validation errors (see [`unit-handling.md`](unit-handling.md) §2).
3. If the material phase changes (gas ↔ non-gas), the default stopping
   power display unit switches (keV/µm ↔ MeV·cm²/g). The material phase
   badge updates.
4. The valid energy range may change — re-validate all rows.
5. Recalculate with the current valid energies and new entity selection.

---

## Output

### Inline Results

Results are shown **inline in the unified table** — there is no separate
result table. Each valid row's Stopping Power and CSDA Range cells are
populated after calculation. See "Unified Input/Result Table" in Inputs §3
for column layout.

#### Number Formatting

- **Stopping power** values use **4 significant figures** with SI prefix
  auto-scaling disabled. Calculator shows the selected stopping-power unit
  directly (`keV/µm` for non-gas, `MeV·cm²/g` for gas) as defined in
  [`unit-handling.md`](unit-handling.md) §5.0 and §6.
- **CSDA range** values use **4 significant figures** with per-row
  independent SI prefix auto-scaling to the best length unit (nm, µm, mm,
  cm, m). The unit is displayed inline with each value (e.g., "1.234 µm").
- **Normalized energy** (→ MeV/nucl column) uses **4 significant figures**.
  Scientific notation is used for very small or very large values
  (|value| < 0.001 or |value| ≥ 10000).
- **Typed values** are displayed exactly as entered by the user (no
  reformatting).
- **Scientific notation is NOT used for output** (stopping power, CSDA
  range). SI prefix auto-scaling replaces it.
- Decimal separator: period (`.`) — consistent with scientific notation
  conventions.

#### Table Styling

- Monospace font for all numeric cells (alignment and readability).
- Right-aligned numeric columns (Normalized, Stopping Power, CSDA Range).
- Left-aligned Typed Value column (user input).
- Alternating row backgrounds (subtle zebra striping) for readability.
- Sticky header row — if the table is long, the column headers remain
  visible while scrolling.
- Horizontal scroll on mobile if the table exceeds viewport width.
- Invalid rows have a subtle red indicator (outline or background tint)
  on the Typed Value cell; result columns are empty.

#### Empty States

| Condition | Display |
|-----------|---------|
| No energies entered (only empty row) | Only the empty input row is shown; no result columns populated |
| All entered values are invalid | Error indicators on each row; summary message below table |
| Entity selection incomplete | Message above table: "Select a particle and material to calculate" |
| WASM not yet loaded | Loading spinner with "Initializing calculation engine…" |
| WASM load failed | Error message with retry button |

### Resolved Program Label

When "Auto-select" is the active program, display the resolved concrete
program below the result table header or inline with the table:

```
Results calculated using ICRU 90 (auto-selected)
```

This ensures the user always knows the data source, per project vision §4.3.

### Export

Two buttons appear below the result table when results are displayed:
**"Export PDF"** (left) and **"Export CSV ↓"** (right). Both are hidden
when no results are available.

**CSV** — 5 columns matching the unified table:
`Typed Value`, `Normalized Energy (MeV/nucl)`, `Unit`,
`Stopping Power ({active unit})`, `CSDA Range`.
Filename: `dedx_calculator_{particle}_{material}_{program}.csv`.

**PDF** — jsPDF-generated report:
- Both modes: app name, generated timestamp (ISO UTC), clickable page URL.
- Advanced mode additionally: build info, particle (Z, A), material density,
  programs list, active Advanced Options, system info (browser + OS).
- Wide advanced tables are split across pages by quantity group.

> Full export spec (CSV schema, PDF content, filename, accessibility):
> [`export.md`](export.md) §2–§3, §6.

---

## Error Handling

### WASM Initialization Failure

- All controls are disabled.
- A full-width error banner is shown: "Failed to load the calculation
  engine. Please refresh the page or try a different browser."
- A "Retry" button attempts `LibdedxService.init()` again.

### Calculation Errors (from LibdedxService.calculate())

Errors from the C library (e.g., `DEDX_ERR_ENERGY_OUT_OF_RANGE`) during
a `calculate()` call:

- If the error applies to specific energy values: those values are marked
  as out-of-range (reported in the validation summary below the table,
  excluded from results). Remaining valid values still produce results.
- If the error is fatal (unexpected C error): show an error message below
  the result table with the human-readable message. Include a "Show details"
  toggle that reveals the C error code (e.g., `LibdedxError code: 103`).
  Per project vision §9.

### Invalid Entity State

- If `EntitySelectionState.isComplete` is `false` (e.g., user cleared the
  particle selection), the result table shows the empty state: "Select a particle and material
  to calculate."
- Calculation does not fire. No WASM calls are made.

### Large Input

- If the user pastes > 200 energy values (creating > 200 rows), show an
  inline warning below the table: "Large input (N values). Calculation may
  be slow."
- Do not block the calculation — it proceeds with debounce. If the WASM
  call takes > 500ms, show a subtle loading indicator on the result columns.

---

## URL State Encoding

This section defines the **basic-mode** Calculator URL contract.
Advanced-mode extensions (`mode`, `programs`, `hidden_programs`,
`qfocus`) are specified in [`multi-program.md`](multi-program.md).

The Calculator page state is encoded in URL query parameters for
shareability. When a user shares a URL, the recipient sees the same
inputs and results for this basic-mode contract.

| Parameter | Example | Notes |
|-----------|---------|-------|
| `particle` | `1` | Particle ID (proton, heavy ion, or electron) |
| `material` | `276` | Material ID |
| `program` | `auto` or `2` | "auto" for Auto-select, numeric for specific |
| `energies` | `100,200:keV,500` | Comma-separated values, with optional per-value unit suffix (see below) |
| `eunit` | `MeV` | Master energy unit (used for values without a per-value unit) |

### Mixed-Unit URL Encoding

When per-row mode is active (mixed units), each energy value in the
`energies` parameter may carry its own unit suffix using a colon separator:

```
?energies=100,200:keV,50:GeV/nucl,300&eunit=MeV
```

Parsing rules:
- `100` → value 100, unit from `eunit` (MeV)
- `200:keV` → value 200, unit keV
- `50:GeV/nucl` → value 50, unit GeV/nucl
- `300` → value 300, unit from `eunit` (MeV)

When encoding the URL from the current table state:
- If all rows use the same unit (master mode): use `eunit` only, no
  per-value suffixes. E.g., `?energies=100,200,500&eunit=MeV`
- If any row has a different unit (per-row mode): append `:unit` to
  values that differ from `eunit`. The `eunit` parameter still encodes
  the base unit for unsuffixed values.

On page load with URL parameters:
1. Parse parameters and set entity selection + energy input.
2. Expand `energies` into table rows, resolving per-value units.
3. If any value has a per-value unit, activate per-row mode.
4. Validate the combination via the compatibility matrix.
5. Calculate and display results.
6. If any parameter is invalid, ignore it and fall back to the default.
7. Unit detection from typed text does **not** fire on URL-populated input
   (the units are already explicit in the URL encoding).

> Full URL encoding spec in [`shareable-urls.md`](shareable-urls.md).
> Advanced-mode URL extensions are defined in
> [`multi-program.md`](multi-program.md).

---

## Responsive Layout

### Desktop (≥900px)

Centered content column, max-width ~720px. Layout as shown in the
[entity-selection.md § Compact Mode desktop wireframe](entity-selection.md#desktop-900px--centered-form-layout).

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Particle: [Proton (H) ▾]   Material: [Water (liquid) ▾] 💧liquid  │  │
│  │  Program: [Auto-select → ICRU 90 ▾]   Energy: (•) MeV             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  Results calculated using ICRU 90 (auto-selected)                          │
│  ┌──────────────┬──────────┬──────┬──────────────────┬──────────────────┐  │
│  │ Energy (MeV) │→ MeV/nucl│ Unit │Stp Power (keV/µm)│ CSDA Range      │  │
│  ├──────────────┼──────────┼──────┼──────────────────┼──────────────────┤  │
│  │ 100          │ 100      │ MeV  │ 45.76            │ 7.718 cm        │  │
│  │ 200          │ 200      │ MeV  │ 27.34            │ 26.27 cm        │  │
│  │ 500          │ 500      │ MeV  │ 13.92            │ 116.1 cm        │  │
│  │ ░░░░░░░░░░░░ │          │      │                  │                  │  │
│  └──────────────┴──────────┴──────┴──────────────────┴──────────────────┘  │
│  Valid range: 0.001–10000 MeV               [Export PDF]  [Export CSV ↓] │
└────────────────────────────────────────────────────────────────────────────┘
```

The `░░░` row is the always-empty-row at the bottom for new input.

**Per-row mode example** (mixed units, master selector greyed out):

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Particle: [Carbon (C) ▾]   Material: [Water (liquid) ▾] 💧liquid  │  │
│  │  Program: [Auto-select → ICRU 90 ▾]   Energy: MeV ░░░░ (disabled) │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────┬──────────┬──────────┬─────────────────┬──────────────┐  │
│  │ Energy       │→ MeV/nucl│ Unit     │Stp Pwr (keV/µm) │ CSDA Range  │  │
│  ├──────────────┼──────────┼──────────┼─────────────────┼──────────────┤  │
│  │ 10 MeV       │ 0.8333   │[MeV   ▾]│ 2876             │ 4.521 µm   │  │
│  │ 500 keV/nucl │ 0.5000   │[MeV/n ▾]│ 22.45            │ 1.234 mm   │  │
│  │ 100          │ 8.333    │[MeV   ▾]│ 1543             │ 123.4 nm   │  │
│  │ ░░░░░░░░░░░░ │          │[MeV   ▾]│                  │             │  │
│  └──────────────┴──────────┴──────────┴─────────────────┴──────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Tablet (600–899px)

Same layout structure but at full viewport width (no centering margins).
Entity selection comboboxes may wrap to two rows. The unified table
remains the same — all 5 columns are shown. The "→ MeV/nucl" column may
be narrower.

### Mobile (<600px)

Single column, full width. The table scrolls horizontally if needed.
The "→ MeV/nucl" and "Unit" columns may be hidden behind a horizontal
scroll or collapsed:

```
┌──────────────────────────────────────┐
│ Particle: [Proton (H)            ▾]  │
│ Material: [Water (liquid)        ▾]  │
│           💧liquid                    │
│ Program:  [Auto-select → ICRU 90 ▾] │
│ Energy:   (•) MeV                    │
│                                      │
│ Results (ICRU 90, auto-selected)     │
│ ← scroll →                          │
│ ┌───────┬────────┬─────┬──────┬─────┐│
│ │Energy │→MeV/n  │Unit │StpPwr│Range ││
│ │(MeV)  │        │     │keV/µm│      ││
│ │ 100   │ 100    │ MeV │45.76 │7.7cm ││
│ └───────┴────────┴─────┴──────┴─────┘│
│          [Export PDF]  [Export CSV ↓] │
└──────────────────────────────────────┘
```

- Entity selectors stack vertically, each full width.
- Result table scrolls horizontally if needed (5 columns may require scrolling).
- Export button right-aligned below the table.

---

## State Management

The Calculator page state is modeled with Svelte 5 runes:

```typescript
/** Calculator page reactive state. */
interface CalculatorState {
  /** From the entity selection component (shared store). */
  entitySelection: EntitySelectionState;

  /** Parsed and validated energy rows. */
  rows: EnergyRow[];

  /** Currently selected master energy unit. */
  energyUnit: EnergyUnit;

  /** True when any row has a per-row unit (mixed units active). */
  perRowUnitsActive: boolean;

  /** Valid energy range for the current program/particle (in MeV/nucl). */
  minEnergy: number;
  maxEnergy: number;

  /** Current stopping power display unit (auto-selected based on material phase). */
  stpDisplayUnit: StpUnit;

  /** Material density in g/cm³ (for unit conversions). */
  materialDensity: number;

  /** Whether the selected material is a gas by default. */
  materialIsGas: boolean;

  /** Calculation result, or null if no valid input / not yet calculated. */
  result: CalculationResult | null;

  /** Calculation error, if any. */
  error: LibdedxError | null;

  /** True while a calculation is in progress (debounce pending or WASM running). */
  isCalculating: boolean;
}

/** A single row in the unified input/result table. */
interface EnergyRow {
  /** Unique row identifier (for keyed rendering). */
  id: string;
  /** Raw text typed by the user in the input cell. */
  rawInput: string;
  /** Parsed numeric value (before unit conversion), or null if invalid. */
  value: number | null;
  /** Detected or selected energy unit for this row. */
  unit: EnergyUnit;
  /** Whether this row's unit was detected from a typed suffix. */
  unitFromSuffix: boolean;
  /** Validation status. */
  status: "valid" | "invalid" | "out-of-range" | "empty";
  /** Human-readable validation message, if applicable. */
  message?: string;
  /** Normalized energy in MeV/nucl (null if invalid). */
  normalizedMevNucl: number | null;
  /** Stopping power in display unit (null if not yet calculated). */
  stoppingPower: number | null;
  /** CSDA range in cm (null if not yet calculated). Before SI prefix auto-scaling. */
  csdaRangeCm: number | null;
}
```

### Derived State (via `$derived`)

```typescript
/** Only the valid energy values, converted to MeV/nucl for the C API. */
const validEnergiesMevNucl: number[] = $derived(
  rows
    .filter(r => r.status === "valid" && r.normalizedMevNucl !== null)
    .map(r => r.normalizedMevNucl!)
);

/** Number of rows with each status, for summary display. */
const validationSummary = $derived({
  valid: rows.filter(r => r.status === "valid").length,
  invalid: rows.filter(r => r.status === "invalid").length,
  outOfRange: rows.filter(r => r.status === "out-of-range").length,
  total: rows.filter(r => r.status !== "empty").length,
});

/** Whether per-row mode should be active. */
const shouldActivatePerRowMode: boolean = $derived(
  rows.some(r => r.unitFromSuffix)
);
```

### Reactivity Chain

```
row.rawInput (input cell)
  → $derived: parse value + detect unit suffix per row
  → $derived: normalize to MeV/nucl per row
  → $derived: validate (range check against min/max)
  → $derived: validEnergiesMevNucl (collect valid rows)
  → $effect (debounced): call LibdedxService.calculate()
  → $derived: convert stoppingPowers to display unit (keV/µm or MeV·cm²/g)
  → $derived: convert csdaRanges to cm, auto-scale SI prefix per row
  → update row.stoppingPower, row.csdaRangeCm

entitySelection changes
  → $effect: update minEnergy/maxEnergy, materialDensity, materialIsGas
  → $derived: update stpDisplayUnit (keV/µm or MeV·cm²/g)
  → re-validate all rows
  → $effect: recalculate immediately (no debounce)
```

---

## Acceptance Criteria

### Default State
- [ ] On first load (no URL params), the page shows: Proton / Water (liquid) / Auto-select / 100 MeV.
- [ ] A result row is visible immediately without user interaction, with stopping power in keV/µm and CSDA range in auto-scaled length.
- [ ] The resolved program name is displayed (e.g., "ICRU 90 (auto-selected)").
- [ ] The material phase badge shows "liquid" for Water.
- [ ] An empty row appears below the pre-filled row for additional input.

### Unified Input/Result Table
- [ ] The table has 5 columns: Typed Value, → MeV/nucl, Unit, Stopping Power, CSDA Range.
- [ ] Each row has an editable input cell in the Typed Value column.
- [ ] Typing a value and waiting 300ms shows results in the same row's Stopping Power and CSDA Range cells.
- [ ] An always-empty-row appears at the bottom of the table for new entries.
- [ ] Clearing a row's typed value removes the row (unless it's the only row or the empty row).
- [ ] Pasting multi-line text into an input cell creates multiple rows.
- [ ] Tab/Enter moves focus to the next row's input cell.

### Energy Input
- [ ] Scientific notation is accepted (e.g., `1e3`, `1.5E-2`).
- [ ] The Typed Value column header dynamically shows the master unit: "Energy (MeV)".
- [ ] A valid energy range label is shown below the table.

### Per-Row Validation
- [ ] Invalid rows show an error indicator on the Typed Value cell and empty result cells.
- [ ] Unrecognized unit suffixes (e.g., "100 bebok") mark the row as invalid with a message.
- [ ] Out-of-range rows show a warning with the valid range.
- [ ] Invalid and out-of-range rows are excluded from calculation; valid rows still produce results.
- [ ] A summary message below the table shows count of excluded values.

### Live Calculation
- [ ] Results update reactively as the user types (debounced at 300ms).
- [ ] Changing particle, material, or program triggers immediate recalculation (no debounce).
- [ ] Changing the master energy unit triggers immediate reinterpretation and recalculation.
- [ ] Changing a per-row unit dropdown triggers immediate recalculation for that row.
- [ ] A subtle loading indicator appears during calculation.

### Output Units — Stopping Power
- [ ] Default stopping power unit is keV/µm for non-gas materials.
- [ ] Default stopping power unit is MeV·cm²/g for gas materials.
- [ ] Switching from a non-gas to a gas material changes the stopping power column header and recalculates.
- [ ] Stopping power values use 4 significant figures with no scientific notation.
- [ ] Numeric fixture check: for a row where backend `stoppingPowers[i] = 25` and `materialDensity = 1.0`, displayed value is `2.5 keV/µm` in non-gas mode and `25 MeV·cm²/g` in gas mode.

### Output Units — CSDA Range
- [ ] CSDA range is displayed in auto-scaled length units (nm, µm, mm, cm, m).
- [ ] Each row independently auto-scales to the best SI prefix.
- [ ] The unit is displayed inline with each cell value (e.g., "1.234 µm").
- [ ] CSDA range values use 4 significant figures.
- [ ] Numeric fixture check: for a row where backend `csdaRanges[i] = 0.2` and `materialDensity = 1.0`, displayed value is `2 mm`.

### Material Phase Badge
- [ ] A phase indicator (gas/solid/liquid) appears next to the material combobox.
- [ ] The badge updates when the material selection changes.

### Energy Unit Selector
- [ ] Available units depend on the selected particle.
- [ ] For proton (A=1) and electron (particle ID 1001), only "MeV" is shown.
- [ ] For heavy ions (A>1), "MeV" and "MeV/nucl" are shown.
- [ ] The selector uses segmented controls / radio buttons, not a dropdown.
- [ ] In master mode (all plain numbers), the selector is active.
- [ ] In per-row mode (any row has a typed unit suffix), the selector is greyed out / disabled.
- [ ] Removing all unit suffixes re-enables the selector.

### Entity Selection Integration
- [ ] Entity selectors use compact mode (searchable dropdown comboboxes).
- [ ] The layout matches the entity-selection.md compact mode wireframes.
- [ ] Entity selection state is shared with the Plot page (persists across navigation).

### Error Handling
- [ ] WASM init failure shows an error banner with a retry button; all controls are disabled.
- [ ] C library errors show a human-readable message with an expandable "Show details" section.
- [ ] When entity selection is incomplete, a message appears above the table.

### Responsive
- [ ] On desktop (≥900px), content is centered with max-width ~720px.
- [ ] On tablet (600–899px), layout fills viewport width.
- [ ] On mobile (<600px), all elements stack vertically; the table scrolls horizontally if needed.

### URL State
- [ ] In basic mode, the calculator state (particle, material, program, energies, unit) is encoded in URL query parameters.
- [ ] Mixed-unit state is encoded using `value:unit` syntax in the `energies` parameter.
- [ ] Loading a URL with valid parameters restores the exact state and shows results.
- [ ] Invalid URL parameters fall back to defaults silently.
- [ ] In advanced mode, URL restoration also respects advanced parameters from [`multi-program.md`](multi-program.md).

### Export
- [ ] "Export PDF" and "Export CSV ↓" buttons appear below the unified table when results are present; both hidden otherwise.
- [ ] CSV contains exactly five columns matching the unified table (see [`export.md`](export.md) §2).
- [ ] `Stopping Power` header unit in CSV matches the active display unit (e.g., `keV/µm` for non-gas, `MeV·cm²/g` for gas).
- [ ] Error/validation rows are omitted from the CSV.
- [ ] PDF is mode-sensitive: basic includes date + URL; advanced adds build info, particle Z/A, material density, programs, settings, system info (see [`export.md`](export.md) §6).

### Performance
- [ ] Debounce interval is 300ms for input.
- [ ] Calculation for ≤50 energy values completes in < 100ms (WASM call).
- [ ] Pasting > 200 values shows a warning but does not block calculation.

### Accessibility
- [ ] Each input cell has an accessible label (via `aria-label` or associated label).
- [ ] Validation errors are announced to screen readers via `aria-live` region.
- [ ] The table uses proper `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` markup.
- [ ] The energy unit selector uses `role="radiogroup"` with `role="radio"` items.
- [ ] All interactive elements are keyboard-accessible (Tab order: selectors → unit → table rows → export).

---

## Dependencies

- **`EntitySelectionState`** and compact mode component from
  [`entity-selection.md`](entity-selection.md)
- **`LibdedxService`** interface from
  [`docs/06-wasm-api-contract.md`](../06-wasm-api-contract.md):
  `calculate()`, `getMinEnergy()`, `getMaxEnergy()`, `convertEnergy()`,
  `getDensity()`, `isGasByDefault()`, `convertStpUnits()`
- **`CalculationResult`**, **`EnergyUnit`**, **`StpUnit`**, **`RangeUnit`**,
  **`AdvancedOptions`** types from the WASM API contract
- **`CompatibilityMatrix`** for energy range bounds
- **Unit handling logic** from [`unit-handling.md`](unit-handling.md):
  per-row unit detection, output unit defaults, SI prefix auto-scaling
- Svelte 5 runes: `$state`, `$derived`, `$effect`
- Tailwind CSS for layout and responsive breakpoints

---

## Open Questions

1. **Always-empty-row vs. Add Row button:** The current design uses an
   always-empty-row at the bottom. This may change after seeing the
   implementation — an explicit "Add Row" button might be clearer.
   *Current decision: always-empty-row. Revisit after prototype.*

2. **Per-line error highlighting:** With individual `<input>` cells per
   row, error highlighting is straightforward (red outline on the cell).
   No overlay or `contenteditable` hack needed. *Resolved by the unified
   table design.*

3. **Debounce timing:** 300ms is a common default. Should this be
   user-configurable (like the old app's "Dynamic / Performance" toggle)?
   *Current decision: fixed at 300ms for v1. No mode toggle.*

4. **"Generate default energies" button:** The old app had a button to
   fill the table with a program-specific default energy grid. Should
   the new app include this?
   *Current decision: defer to a future iteration. The pre-filled "100" is
   sufficient for the immediate-result-on-load requirement.*

5. **Column visibility on mobile:** With 5 columns, horizontal scroll is
   likely on mobile. Should the "→ MeV/nucl" and "Unit" columns be
   hidden by default on small screens?
   *Current decision: show all columns with horizontal scroll. Revisit
   after testing on real devices.*

6. **User-selectable stopping power unit:** Should users be able to
   override the auto-selected stopping power unit (e.g., switch from
   keV/µm to MeV·cm²/g for a solid)?
   *Current decision: auto-selected only in v1. Column header will become
   a dropdown in a future version (see `unit-handling.md` §5).*
