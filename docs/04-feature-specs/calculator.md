# Feature: Calculator Page

> **Status:** Final v10 (13 July 2026)
>
> **v10** (13 July 2026 — Stage 8, issue #840): Basic mode now shares the
> Energy →/Range →/STP → tab strip with Advanced mode (previously Advanced-
> only, per `inverse-lookups.md` §1) — each tab renders a simplified
> single-row hero card in Basic mode instead of the Advanced multi-row table.
> "+ Add row" moved to Advanced-only; Basic mode is always exactly one row in
> all three tabs. New Basic-mode Range → and STP → hero cards: unit-anchor
> strip (Range only) with no per-row "Unit" column or "per-row mode active"
> text; STP output/input fixed to the material-phase unit (keV/µm non-gas,
> MeV·cm²/g gas), bypassing the Advanced STP-unit override; STP → keeps the
> high-/low-energy branch reveal. `calc=`/`lookups=`/`runit=`/`sunit=`/
> `istpbranch=` are no longer Advanced-mode-only in the URL contract (see
> `shareable-urls.md`).
>
> **v9** (25 May 2026 — Stage 8, issue #563): Aligned to shipped behaviour.
> Advanced mode tabs renamed Energy → / Range → / STP → ([ADR 013](../decisions/013-mode-tab-naming.md)).
> Standalone energy-unit selector removed; replaced by unit-anchor strip
> ([ADR 008](../decisions/008-drop-unit-button-between-picker-and-results.md)).
> Inline unit grammar documented ([ADR 010](../decisions/010-inline-unit-grammar.md)).
> No autofocus on cold load ([ADR 009](../decisions/009-no-autofocus-on-cold-load.md)).
> URL examples updated to v2 (`urlv=2`): `eunit=` → `uanchor=`; `qfocus=` →
> `qshow=`; `hidden_programs=` removed; all per-row energy suffix tokens
> extended to the 15-token cross-product. Cross-linked to ADRs 007–013.
>
> **v8** (13 April 2026): Export buttons moved from below the unified table
> to the **app toolbar** (upper-right, left of "Share URL"), consistent
> with Plot page and `export.md` v3 §0. Buttons are disabled when no
> results are present (not hidden). Wireframes and Export AC updated.
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
>
> - Entity selection (compact mode): [`entity-selection.md`](entity-selection.md)
> - Unit handling (energy units, SI prefixes, inline detection, output units): [`unit-handling.md`](unit-handling.md)
> - Multi-program advanced behavior (program multi-select, grouped comparison columns, quantity focus): [`multi-program.md`](multi-program.md)
> - Shareable URLs: [`shareable-urls.md`](shareable-urls.md)
> - Advanced options: [`advanced-options.md`](advanced-options.md)
> - Export (CSV schema, filename convention, button placement): [`export.md`](export.md)

---

## Table of Contents

- [User Story](#user-story)
- [Page Layout Overview](#page-layout-overview)
- [Inputs](#inputs)
  - [1. Entity Selection (compact mode)](#1-entity-selection-compact-mode)
  - [2. Energy Unit Selector](#2-energy-unit-selector)
  - [3. Unified Input/Result Table](#3-unified-inputresult-table)
  - [4. Advanced Options (future)](#4-advanced-options-future)
- [Behavior](#behavior)
  - [Default State on First Load](#default-state-on-first-load)
  - [Live Calculation (Debounced)](#live-calculation-debounced)
  - [Recalculation Triggers](#recalculation-triggers)
  - [Per-Row Validation](#per-row-validation)
  - [Energy Range Display](#energy-range-display)
  - [Handling Entity Selection Changes](#handling-entity-selection-changes)
- [Output](#output)
  - [Inline Results](#inline-results)
  - [Resolved Program Label](#resolved-program-label)
  - [Export](#export)
- [Error Handling](#error-handling)
  - [WASM Initialization Failure](#wasm-initialization-failure)
  - [Calculation Errors (from LibdedxService.calculate())](#calculation-errors-from-libdedxservicecalculate)
  - [Invalid Entity State](#invalid-entity-state)
  - [Large Input](#large-input)
- [URL State Encoding](#url-state-encoding)
  - [Mixed-Unit URL Encoding](#mixed-unit-url-encoding)
- [Responsive Layout](#responsive-layout)
  - [Desktop (≥900px)](#desktop-900px)
  - [Tablet (600–899px)](#tablet-600899px)
  - [Mobile (<600px)](#mobile-600px)
- [State Management](#state-management)
  - [Derived State (via `$derived`)](#derived-state-via-derived)
  - [Reactivity Chain](#reactivity-chain)
- [Acceptance Criteria](#acceptance-criteria)
  - [Default State](#default-state)
  - [Unified Input/Result Table](#unified-inputresult-table-1)
  - [Energy Input](#energy-input)
  - [Per-Row Validation](#per-row-validation-1)
  - [Live Calculation](#live-calculation)
  - [Output Units — Stopping Power](#output-units--stopping-power)
  - [Output Units — CSDA Range](#output-units--csda-range)
  - [Material Phase Badge](#material-phase-badge)
  - [Energy Unit Selector](#energy-unit-selector)
  - [Entity Selection Integration](#entity-selection-integration)
  - [Error Handling](#error-handling-1)
  - [Responsive](#responsive)
  - [URL State](#url-state)
  - [Export](#export-1)
  - [Performance](#performance)
  - [Accessibility](#accessibility)
- [Dependencies](#dependencies)

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

## Defaults

On cold load (no URL parameters):

| Setting     | Default value                                                                              |
| ----------- | ------------------------------------------------------------------------------------------ |
| Particle    | Proton (H)                                                                                 |
| Material    | Water (liquid)                                                                             |
| Program     | Auto-select → resolved (e.g., ICRU 90)                                                     |
| Energy rows | One pre-filled row with `100` (MeV)                                                        |
| Mode        | Basic                                                                                      |
| Autofocus   | None — no input is auto-focused ([ADR 009](../decisions/009-no-autofocus-on-cold-load.md)) |
| Results     | Appear immediately without user interaction                                                |

---

## Modes

### Basic / Advanced toggle

The app-wide Basic/Advanced toggle (top-right action bar) switches how much
control surface is shown (entity comparison, Advanced Options, per-row units,
Add Row) — not which calculation directions are available. **Since issue
#840, the Energy →/Range →/STP → tab strip below is shared between Basic and
Advanced mode**: the active tab and its row(s) are the same state in both
modes, so switching modes mid-session (or opening a shared link) keeps you on
the same tab.

- **Basic** mode renders each tab as a simplified single-row "hero card" (see
  [Basic-mode tab layouts](#basic-mode-tab-layouts) below) — one input, its
  output(s), no per-row units, no Add Row.
- **Advanced** mode renders the full table for each tab (per-row units, unit
  dropdowns, multiple rows, Add Row).

### Energy →/Range →/STP → tabs

> **Stage 8 update:** tabs renamed from Forward/Range/Inverse STP to the
> arrow-notation scheme below. See
> [ADR 013](../decisions/013-mode-tab-naming.md).
>
> **Issue #840:** the tab strip itself is no longer Advanced-only (see
> [Basic / Advanced toggle](#basic--advanced-toggle) above) — only the
> full multi-row table (vs. the Basic single-row card) is mode-dependent.

| Tab | Label    | Desktop sublabel        | Mobile glyph (< 400 px) | `calc=` URL token |
| --- | -------- | ----------------------- | ----------------------- | ----------------- |
| 1   | Energy → | → Range, Stopping Power | E→                      | `forward`         |
| 2   | Range →  | → Energy, STP           | R→                      | `range`           |
| 3   | STP →    | → Energy, Range         | S→                      | `inverse-stp`     |

The arrow suffix makes the **input → output** direction immediately clear
without physics-domain knowledge:

- **Energy →** — the user types energies and reads stopping power + CSDA range.
  This is the default tab.
- **Range →** — the user types CSDA range values and reads the energy that
  produces each range (inverse CSDA range lookup), plus the stopping power at
  that energy (recovered with a forward calc — issue #673).
- **STP →** — the user types stopping-power values and reads the energy on the
  high-energy branch (falling side of the Bragg peak), each energy paired with
  the CSDA range at that energy. A second low-energy result reveals
  automatically when a row has two solutions
  ([ADR 012](../decisions/012-inverse-stp-sticky-high-e-default.md), issue #673).

All three tabs are available in **both** Basic and Advanced mode (issue
#840) — only the layout differs; see below.

### Basic-mode tab layouts

Each tab's Basic-mode card always shows exactly one row — Add Row, per-row
units, and unit dropdowns are Advanced-only (issue #840):

- **Energy →** — unchanged from the pre-#840 Basic hero row (see
  [Basic single-energy hero row](#basic-single-energy-hero-row-issue-823)
  below): one energy input, CSDA range and stopping power outputs.
- **Range →** — a unit-anchor strip (nm/µm/mm/cm/m, same options as Advanced)
  sits above a hero card with one range input (typed unit suffix supported,
  e.g. `5 mm`) and two outputs: Energy and Stopping Power. Unlike Advanced,
  there is no per-row "Unit" column (only one row exists) and no
  "per-row mode active" indicator. The stopping-power output unit is
  **fixed** to keV/µm for solid/liquid materials or MeV·cm²/g for gases —
  computed directly from the material's phase, independent of the Advanced
  STP-unit dropdown / `sunit=` override.
- **STP →** — one stopping-power input, its unit **fixed** the same way as
  Range → (no dropdown — Advanced offers keV/µm, MeV/cm, MeV·cm²/g; Basic
  always uses the material-phase default). Output is a high-energy-branch
  card (Energy + Range) always shown, and — only when the input resolves to
  two Bragg-peak solutions — a second low-energy-branch card revealed below
  it with the same two fields.

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

| Selector | Default                | Notes                                                                      |
| -------- | ---------------------- | -------------------------------------------------------------------------- |
| Particle | Proton (H)             | Searchable combobox, ~240px on desktop                                     |
| Material | Water (liquid)         | Searchable combobox, ~240px on desktop. Shows **phase badge** (see below). |
| Program  | Auto-select → resolved | Searchable combobox, ~180px on desktop                                     |

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

### 2. Unit-Anchor Strip (Energy Unit Selector)

> **Stage 8 update:** The standalone energy-unit selector between the picker
> and the results table is removed. It is replaced by the **unit-anchor strip**
> — a pill radiogroup rendered in the table toolbar area.
> See [ADR 008](../decisions/008-drop-unit-button-between-picker-and-results.md).

| Property                | Detail                                                                                                                                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type                    | Pill radiogroup (`unit-anchor-strip.svelte`) — not a dropdown                                                                                                                                                                                                                          |
| Position                | Basic mode: inside the table toolbar (above or inline with the column headers). Advanced mode: rendered in the Advanced toolbar above the tab strip.                                                                                                                                   |
| Options                 | **Particle-dependent.** MeV only for proton; MeV + MeV/nucl + MeV/u for heavy ions. In Advanced mode, MeV/u is also available for proton with an `(≠MeV)` badge. See [`unit-handling.md`](unit-handling.md) §2.                                                                        |
| Default                 | MeV                                                                                                                                                                                                                                                                                    |
| Master vs. per-row mode | When all rows have plain numbers (no unit suffix), the strip is **active** (master mode). When any row has a typed unit suffix, the strip becomes **greyed out / disabled** (per-row mode). See [`unit-handling.md`](unit-handling.md) §2 "Master vs. Per-Row Mode".                   |
| Behavior                | Changing the anchor unit **does not modify the typed values** — the numeric text stays the same. The values are reinterpreted in the new unit, triggering an immediate recalculation. See Recalculation Triggers table below.                                                          |
| Inline unit detection   | When the user types a unit suffix in a row (e.g., `100 keV`, `250 GeV/nucl`), the inline-unit parser ([ADR 010](../decisions/010-inline-unit-grammar.md)) detects it after debounce and assigns the row its own unit. See [`unit-handling.md`](unit-handling.md) §3 for parsing rules. |
| URL parameter           | `uanchor=MeV` (v2). Replaces v1 `eunit=`. See [`shareable-urls.md`](shareable-urls.md) §3.                                                                                                                                                                                             |

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

| #   | Column             | Header label              | Editable?                   | Content                                                                                                                                                                       |
| --- | ------------------ | ------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Typed Value**    | "Energy ({unit})"         | **Yes** — inline text input | User types an energy value, optionally with a unit suffix (e.g., `100`, `10 keV`)                                                                                             |
| 2   | **Normalized**     | "→ MeV/nucl"              | No                          | Computed: the typed value converted to MeV/nucl. Shown in scientific notation for very small/large values.                                                                    |
| 3   | **Unit**           | "Unit"                    | Via dropdown                | Per-row unit dropdown. In master mode: shows the master unit (not interactive). In per-row mode: each row's dropdown is independently selectable.                             |
| 4   | **Stopping Power** | "Stopping Power ({unit})" | No                          | `CalculationResult.stoppingPowers[i]`, converted to display unit (keV/µm or MeV·cm²/g — see [`unit-handling.md`](unit-handling.md) §5).                                       |
| 5   | **CSDA Range**     | "CSDA Range"              | No                          | `CalculationResult.csdaRanges[i]`, converted to length and auto-scaled with SI prefix (see [`unit-handling.md`](unit-handling.md) §6). Unit shown per-row (e.g., "1.234 µm"). |

#### Stopping Power Column Unit

The column header is a **dropdown** (issue #670): it reads
`STP ({unit}) ▾` (single-entity) / `Stopping Power ({unit}) ▾` (multi-entity)
and offers `keV/µm`, `MeV/cm`, `MeV·cm²/g` — the same set and order as the plot
page. Picking a unit converts and re-renders every STP cell at display time
(no recalculation); the CSDA Range column is untouched.

Default (no explicit choice) follows the aggregate state, so existing links
render unchanged:

- **Non-gas materials:** "Stopping Power (keV/µm)"
- **Gas materials:** "Stopping Power (MeV·cm²/g)"

An explicit choice is encoded in the URL via the shared `sunit=` param (see
[`shareable-urls.md`](shareable-urls.md) §3.9) and shared with the plot page.
On mobile the menu renders as a bottom sheet (≥44 px rows). See
[`unit-handling.md`](unit-handling.md) §5.1 for the conversion rules.

#### CSDA Range Column Unit

The column header shows "CSDA Range" without a fixed unit — because each
row auto-scales independently to the best SI prefix:

- Row 1 might show `1.234 mm`
- Row 2 might show `45.67 µm`

The unit is displayed **inline with each cell value**, not in the header.
See [`unit-handling.md`](unit-handling.md) §6 for auto-scaling rules.

#### Row Behavior

> **Issue #840:** the always-empty-row / Add Row growth described below is
> **Advanced-mode-only**. Basic mode's table is always exactly one row —
> see [Basic-mode tab layouts](#basic-mode-tab-layouts).

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

| Property         | Detail                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type             | `<input type="text">` (not `<textarea>`) — single-line per row                                                                                              |
| Accepted formats | Positive numeric values: integers (`100`), decimals (`1.5`), scientific notation (`1e3`, `1.5E-2`). Optionally followed by a unit suffix (e.g., `100 keV`). |
| Parsing          | On each input event (debounced 300ms), the value is parsed. A trailing unit suffix is detected per [`unit-handling.md`](unit-handling.md) §3.               |
| Paste support    | Pasting multi-line text (e.g., a column from Excel) into any input cell creates multiple rows — one per pasted line.                                        |
| Tab / Enter      | Pressing **Tab** or **Enter** moves focus to the next row's input cell. If at the last non-empty row, this focuses the always-empty-row at the bottom.      |

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
Not included in v1 — see [`advanced-options.md`](advanced-options.md).

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

| Trigger                          | Debounced?     | Notes                                                   |
| -------------------------------- | -------------- | ------------------------------------------------------- |
| Row input (typed value)          | Yes (300ms)    | Per-keystroke with debounce                             |
| Energy unit change (master)      | No (immediate) | Energy values reinterpreted in new unit                 |
| Per-row unit dropdown change     | No (immediate) | That row's value reinterpreted in new unit              |
| Particle change                  | No (immediate) | May also change available energy units                  |
| Material change                  | No (immediate) | May change default stopping power unit (gas vs non-gas) |
| Program change                   | No (immediate) | May change energy bounds                                |
| Advanced options change (future) | No (immediate) |                                                         |

For entity/unit changes (non-debounced): if the table already contains
valid energies, recalculate immediately using the new parameters.

### Per-Row Validation

Each row in the unified table is validated independently:

| Condition                                           | Row status      | v1 reporting                                           |
| --------------------------------------------------- | --------------- | ------------------------------------------------------ |
| Valid positive number (with or without unit suffix) | ✅ Valid        | Results shown inline in that row                       |
| Empty row                                           | ⏭️ Skipped      | No results shown; row remains for input                |
| Non-numeric text (e.g., "abc")                      | ❌ Invalid      | Row highlighted; tooltip or inline message with reason |
| Unrecognized unit suffix (e.g., "100 bebok")        | ❌ Invalid      | Row highlighted: "Unrecognized unit 'bebok'"           |
| Per-nucleon unit for proton/electron                | ❌ Invalid      | Row highlighted: "MeV/nucl not available for Proton"   |
| Negative number                                     | ❌ Invalid      | Row highlighted: "Energy must be positive"             |
| Zero                                                | ❌ Invalid      | Row highlighted: "Energy must be greater than zero"    |
| Exceeds max energy for program/particle             | ⚠️ Out of range | Row highlighted with valid range                       |
| Below min energy for program/particle               | ⚠️ Out of range | Row highlighted with valid range                       |

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

The valid energy range for the current selection is shown **inline with the
"Calculated with …" annotation** as a single compact row below the results
(see § Resolved Program Label), instead of on its own line:

```
Calculated with PSTAR (auto-selected) · valid range 0.001 – 10000 MeV/nucl for proton
```

Merging the two lines avoids repeating the program name — it is already named
by the annotation — and reclaims a row of vertical space (#816 follow-up). The
range is program- and particle-specific, so the particle is named ("for
proton") while the program is named once, by the annotation. It updates when
the program, particle, or energy unit changes; the values are displayed in the
user's selected energy unit (converted from the C API's MeV/nucl).

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
result table. Each valid row's CSDA Range and Stopping Power cells are
populated after calculation. See "Unified Input/Result Table" in Inputs §3
for column layout.

#### Basic single-energy hero row (issue #823)

**Basic mode's Energy → tab is always this three-cell "hero row"** that reads
left-to-right as **input → results**: the kinetic-energy input, then CSDA
range, then stopping power (dE/dx). This gives the energy input the visual
weight issue #665 asked for and puts cause→effect on one line, replacing the
earlier stacked "narrow input above a results card" layout. (Prior to issue
#840, this layout only applied when the table held a single row and a second
row switched it to a multi-row table; Basic mode is now always exactly one
row, so the hero row is unconditional — see
[Basic-mode tab layouts](#basic-mode-tab-layouts).)

A light, two-tone tint separates **what you type in** from **what comes out**:
the input cell is **orange** (`border-orange-200 / bg-orange-50` + dark orange
variants), the two result cells are a delicate **cool tint** (`border-sky-200 /
bg-sky-50` + dark sky variants). Orange stays the energy/active accent; the cool
tint is used only to mark computed results.

- **① Kinetic energy** — the input cell. A bold (not uppercased) `muted` label
  reads **"Kinetic energy (MeV)"** — the unit shown is the master anchor
  (`MeV`, or `MeV/nucl` for heavy ions). The value sits in a **normal bordered
  text input** (`bg-background`, rounded, large `font-mono`) that is wide enough
  for long values (e.g. `0.1234546`). When the user types their own unit suffix
  (`10 keV`), the row's `unitFromSuffix` flips and the label's `(MeV)` qualifier
  is **dropped** (→ just "Kinetic energy"), so the label never contradicts the
  typed unit. There is **no** separate unit pill/button beside the number.
  Focusing the input reveals the inline hint _"type a unit too — e.g. `10 keV`"_
  inside the (orange) cell; invalid / out-of-range flips the label, input border,
  and message to the `destructive` red treatment. The proton ↔ heavy-ion "unit
  changed" ghost note is preserved.
  Below the input a **fixed-height slot** always reserves space for the hint /
  error message, so the cell does **not** grow (and shove the row) when the hint
  appears on focus.
- **② CSDA range** (left) and **③ stopping power** (right) — the result cells,
  each with its quantity label + existing `HelpHint` above a large `font-mono`
  value. All three cells are equal height and each value line is pinned to the
  **bottom** (`mt-auto`) above an identical fixed-height slot; the plain result
  values carry a transparent border + matching vertical padding so they share the
  **same line box as the boxed input**. As a result **all three value lines —
  the input and both results — land on one baseline**, and the two result numbers
  stay aligned even when one label wraps to more lines than the other (e.g. the
  long "Stopping Power (keV/µm)" label on a narrow screen). Cell padding is kept
  **compact** (`px-4 py-3`, input/value `py-1.5`) so the cells don't feel empty.
  A subtle `→` connector sits between the input and the results on desktop.
- **All three cells are the same size** — the row is `items-stretch`, so the
  result cells match the (taller) input cell rather than shrinking to their own
  content; combined with the reserved hint slot the sizes stay stable as the user
  focuses/types.
- **Desktop** (`sm`+) lays the input cell, connector, and the two result cells
  on one flex row, the energy cell wider (`flex-[1.4]`) as the focal point.
  **Mobile** stacks: the full-width energy input on top, the two result cells
  side-by-side below.
- The particle/material selectors are unchanged. **Since issue #840, "+ Add
  row" is Advanced-only** — Basic mode's Energy → tab never grows past this
  one hero row (the Advanced multi-row table, whose columns are ordered
  **Energy | CSDA Range | Stopping Power** i.e. range left / dE/dx right
  matching the hero, is unaffected).
- A **shared/restored URL always renders this hero layout in Basic mode**: the
  URL-load path restores only the first energy value (`autoAdd = false`); any
  additional values in an `energies=` list are dropped when `mode=basic` (they
  are preserved when `mode=advanced`).
- The program annotation ("Calculated with … (auto-selected)") still renders
  below the results (unchanged, page-level).

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
- **Extreme magnitude fallback**: when values are physically nonsensical
  (NaN, Infinity, or subnormal magnitudes), scientific notation overrides
  the no-scientific-notation rule:
  - NaN / Infinity → `"—"` (em-dash).
  - `|magnitude| ≥ 15` OR `magnitude < −(sigFigs + 5)` → `toPrecision(sigFigs)`
    (scientific notation).
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

| Condition                                                                 | Display                                                                                                                             |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| No energies entered (only empty row)                                      | Only the empty input row is shown; no result columns populated                                                                      |
| All entered values are invalid                                            | Error indicators on each row; summary message below table                                                                           |
| Entity selection incomplete — electron selected                           | Message above table: "Electron (ESTAR) is not yet supported by libdedx v1.4.0."                                                     |
| Entity selection incomplete — particle + material selected but no program | Message above table: "No program supports **{particle}** in **{material}**. Change the particle or material selection to continue." |
| Entity selection incomplete — neither selected                            | Message above table: "Select a particle and material to calculate."                                                                 |
| WASM not yet loaded                                                       | Loading spinner with "Initializing calculation engine…"                                                                             |
| WASM load failed                                                          | Error message with retry button                                                                                                     |

### Resolved Program Label

A single compact "Calculated with …" row below the results names the program
that produced the numbers and — inline, after a "·" separator — the valid
energy range for the current program + particle:

```
Calculated with ICRU 90 (auto-selected) · valid range 0.001 – 10000 MeV/nucl for proton
```

This ensures the user always knows the data source, per project vision §4.3.
It is rendered by the shared `program-annotation.svelte` component (the program
name is bold). The "(auto-selected)" qualifier is driven by the **live
selection state**, so it stays accurate in both modes: it is shown whenever the
active program is Auto-select and dropped when the user has explicitly chosen a
program in Advanced mode.

**Basic mode has no program selector and always auto-selects (issue #816).**
The Program tab is Advanced-only; in Basic mode the program is auto-selected
behind the scenes and this annotation is the only place its identity appears.
Because Basic mode always auto-selects, a program the user pinned in Advanced
mode is **discarded when they switch back to Basic** — a Basic → Advanced →
Basic round-trip returns to Auto-select rather than silently keeping a hidden
explicit choice the user can no longer see. See
[`entity-selection.md`](entity-selection.md) § Basic vs Advanced mode.

### Export

**"Export PDF"** and **"Export CSV ↓"** are in the **app toolbar**
(upper-right, immediately left of "Share URL" — which is always the
rightmost button), present on all pages.
Both buttons are **disabled** (greyed out) when no results are available
and become active as soon as at least one result row is computed. No
export buttons appear below the table.

**CSV** — 5 columns matching the unified table:
`Normalized Energy (MeV/nucl)`, `Typed Value`, `Unit`,
`CSDA Range`, `Stopping Power ({active unit})`.
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
- In advanced multi-program mode, an out-of-range input for one selected
  program must not leave stale comparison values visible or block other
  in-range programs. The out-of-range program's cells show the
  per-program error marker defined in [`multi-program.md`](multi-program.md),
  while in-range programs recalculate for the current input.
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

> **v2 URL schema is canonical (`urlv=2`).** See
> [`shareable-urls.md`](shareable-urls.md) for the full contract. This section
> summarises the basic-mode parameters. Advanced-mode extensions (`programs`,
> `qshow`, `across`) are specified in [`multi-program.md`](multi-program.md).

The Calculator page state is encoded in URL query parameters for
shareability. When a user shares a URL, the recipient sees the same
inputs and results.

| Parameter  | Example           | Notes                                                                                                     |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| `urlv`     | `2`               | Schema version. Always `2` in canonical output.                                                           |
| `mode`     | `basic`           | `basic` or `advanced`. Absent = `basic`.                                                                  |
| `particle` | `1`               | Particle ID (proton, heavy ion, or electron)                                                              |
| `material` | `276`             | Material ID                                                                                               |
| `program`  | `auto` or `2`     | `auto` for Auto-select, numeric ID for a specific program                                                 |
| `energies` | `100,200:keV,500` | Comma-separated values with optional per-value unit suffix (see below)                                    |
| `uanchor`  | `MeV`             | Master energy unit anchor (replaces v1 `eunit=`). Omitted when MeV (default).                             |
| `calc`     | `forward`         | Calculator operation: `forward` (Energy →), `range` (Range →), `inverse-stp` (STP →). Absent = `forward`. |

> **Issue #840:** `calc=` (and its companion `lookups=`/`runit=`/`sunit=`/
> `istpbranch=` params) are no longer Advanced-mode-only — they now apply in
> Basic mode too, rendering the simplified single-row card described in
> [Basic-mode tab layouts](#basic-mode-tab-layouts) instead of the Advanced
> table. This section is a summary; [`shareable-urls.md`](shareable-urls.md)
> and its formal companion are authoritative, including a note there on the
> as-shipped `imode=`/`iunit=` param names for this field.

### Mixed-Unit URL Encoding

When per-row mode is active (mixed units), each energy value in the
`energies` parameter may carry its own unit suffix using a colon separator:

```
?urlv=2&energies=100,200:keV,50:GeV/nucl,300&uanchor=MeV
```

Parsing rules:

- `100` → value 100, unit from `uanchor` (MeV)
- `200:keV` → value 200, unit keV
- `50:GeV/nucl` → value 50, unit GeV/nucl
- `300` → value 300, unit from `uanchor` (MeV)

When encoding the URL from the current table state:

- If all rows use the same unit (master mode): use `uanchor` only, no
  per-value suffixes. E.g., `?urlv=2&energies=100,200,500&uanchor=MeV`
- If any row has a different unit (per-row mode): append `:unit` to
  values that differ from `uanchor`. The `uanchor` parameter still encodes
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
│  [Advanced-mode wireframe; "Calculated with ..." row shown below the table]│
│  ┌──────────────┬──────────┬──────┬──────────────────┬──────────────────┐  │
│  │ Energy (MeV) │→ MeV/nucl│ Unit │Stp Power (keV/µm)│ CSDA Range      │  │
│  ├──────────────┼──────────┼──────┼──────────────────┼──────────────────┤  │
│  │ 100          │ 100      │ MeV  │ 45.76            │ 7.718 cm        │  │
│  │ 200          │ 200      │ MeV  │ 27.34            │ 26.27 cm        │  │
│  │ 500          │ 500      │ MeV  │ 13.92            │ 116.1 cm        │  │
│  │ ░░░░░░░░░░░░ │          │      │                  │                  │  │
│  └──────────────┴──────────┴──────┴──────────────────┴──────────────────┘  │
│  Calculated with ICRU 90 (auto-selected) · valid range 0.001–10000 MeV     │
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
└──────────────────────────────────────┘
```

- Entity selectors stack vertically, each full width.
- Result table scrolls horizontally if needed (5 columns may require scrolling).
- Export buttons ("Export PDF", "Export CSV ↓") are in the app toolbar, not below the table.

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
    .filter((r) => r.status === "valid" && r.normalizedMevNucl !== null)
    .map((r) => r.normalizedMevNucl!),
);

/** Number of rows with each status, for summary display. */
const validationSummary = $derived({
  valid: rows.filter((r) => r.status === "valid").length,
  invalid: rows.filter((r) => r.status === "invalid").length,
  outOfRange: rows.filter((r) => r.status === "out-of-range").length,
  total: rows.filter((r) => r.status !== "empty").length,
});

/** Whether per-row mode should be active. */
const shouldActivatePerRowMode: boolean = $derived(rows.some((r) => r.unitFromSuffix));
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
- [ ] The resolved program name and valid range share one row (e.g., "Calculated with ICRU 90 (auto-selected) · valid range 0.001 – 10000 MeV/nucl for proton").
- [ ] The material phase badge shows "liquid" for Water.
- [ ] An empty row appears below the pre-filled row for additional input.

### Unified Input/Result Table

- [ ] The table has 5 columns: Typed Value, → MeV/nucl, Unit, CSDA Range, Stopping Power.
- [ ] Each row has an editable input cell in the Typed Value column.
- [ ] Typing a value and waiting 300ms shows results in the same row's CSDA Range and Stopping Power cells.
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

- [ ] "Export PDF" and "Export CSV ↓" buttons are present in the app toolbar (upper-right, left of "Share URL") on all pages; both disabled until at least one result row is present.
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
   _Current decision: always-empty-row. Revisit after prototype._

2. **Per-line error highlighting:** With individual `<input>` cells per
   row, error highlighting is straightforward (red outline on the cell).
   No overlay or `contenteditable` hack needed. _Resolved by the unified
   table design._

3. **Debounce timing:** 300ms is a common default. Should this be
   user-configurable (like the old app's "Dynamic / Performance" toggle)?
   _Current decision: fixed at 300ms for v1. No mode toggle._

4. **"Generate default energies" button:** The old app had a button to
   fill the table with a program-specific default energy grid. Should
   the new app include this?
   _Current decision: defer to a future iteration. The pre-filled "100" is
   sufficient for the immediate-result-on-load requirement._

5. **Column visibility on mobile:** With 5 columns, horizontal scroll is
   likely on mobile. Should the "→ MeV/nucl" and "Unit" columns be
   hidden by default on small screens?
   _Current decision: show all columns with horizontal scroll. Revisit
   after testing on real devices._

6. **User-selectable stopping power unit:** Should users be able to
   override the auto-selected stopping power unit (e.g., switch from
   keV/µm to MeV·cm²/g for a solid)?
   _Current decision: auto-selected only in v1. Column header will become
   a dropdown in a future version (see `unit-handling.md` §5)._
