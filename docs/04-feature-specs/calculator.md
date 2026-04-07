# Feature: Calculator Page

> **Status:** Draft v4 (7 April 2026)
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
> The Calculator page is the **landing page** and primary use case (~80%
> of users). It provides numeric stopping power and CSDA range lookup for
> user-specified energies. Results update reactively as the user types.
>
> **Related specs:**
> - Entity selection (compact mode): [`entity-selection.md`](entity-selection.md)
> - Unit handling (energy units, SI prefixes, inline detection): [`unit-handling.md`](unit-handling.md)
> - Shareable URLs: TODO `shareable-urls.md`
> - Advanced options: TODO `advanced-options.md`
> - Export: TODO `export.md`

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
The page is a single centered column with three visual sections stacked
vertically:

1. **Entity selection row** — Particle, Material, Program comboboxes + energy
   unit selector.
2. **Energy input** — multi-line textarea.
3. **Result table** — energies × stopping power × CSDA range.

The visual centerpiece is the **result table**. The entity selectors and
energy input exist to configure it.

---

## Inputs

### 1. Entity Selection (compact mode)

Defined fully in [`entity-selection.md`](entity-selection.md). The
Calculator page renders the compact mode variant:

| Selector | Default | Notes |
|----------|---------|-------|
| Particle | Proton (H) | Searchable combobox, ~240px on desktop |
| Material | Water (liquid) | Searchable combobox, ~240px on desktop |
| Program | Auto-select → resolved | Searchable combobox, ~180px on desktop |

The entity selection component exposes `EntitySelectionState` to the
Calculator page. The Calculator only triggers calculation when
`isComplete === true` (all three entities selected and compatible).

### 2. Energy Unit Selector

| Property | Detail |
|----------|--------|
| Type | Segmented control / radio buttons (not a dropdown — ≤3 options, see §4.2 of project vision) |
| Position | Inline with the entity selection row, after the Program combobox |
| Options | **Particle-dependent.** The selected particle type determines which units are shown: MeV only for proton and electron; MeV + MeV/nucl for heavy ions. See [`unit-handling.md`](unit-handling.md) §2 for the full rules. |
| Default | MeV |
| Behavior | Changing the unit **does not modify the textarea content** — the numeric text stays the same. The values are reinterpreted in the new unit, which **triggers an immediate recalculation**. See Recalculation Triggers table below. |
| Inline unit detection | When the user types a unit suffix in the textarea (e.g., `100 keV`, `250 GeV/nucl`), the parser detects it after debounce, strips the suffix, converts the value, and auto-switches the unit selector. See [`unit-handling.md`](unit-handling.md) §3 for parsing rules. |

> Full energy unit logic — particle-dependent options, SI prefix handling,
> inline unit detection, conversion formulas — lives in
> [`unit-handling.md`](unit-handling.md). The Calculator spec only
> describes how the selector integrates into the page layout and
> reactivity chain.

### 3. Energy Input

| Property | Detail |
|----------|--------|
| Type | `<textarea>` — multi-line text input |
| Label | "Energy ({unit})" — dynamically shows the selected unit, e.g., "Energy (MeV)" |
| Placeholder | `"Enter energies, one per line\ne.g.:\n100\n200\n500"` |
| Parsing rules | One energy value per line. Leading/trailing whitespace trimmed. Empty lines ignored. |
| Accepted formats | Positive numeric values: integers (`100`), decimals (`1.5`), scientific notation (`1e3`, `1.5E-2`). |
| Default content | `100` (pre-filled on first load, so the default state shows a result immediately) |
| Separator | Newline (`\n`). Comma-separated values on a single line are **not** supported in v1 (simplifies parsing; each line = one value). |
| Minimum rows | 5 visible rows (CSS `min-height` or `rows` attribute) |
| Maximum | No hard limit on line count, but debounce protects performance. Soft limit: warn if > 200 values. |
| Resize | Vertically resizable by the user (`resize: vertical`) |

### 4. Advanced Options (future)

An "Advanced" toggle/disclosure section below the energy input will expose:
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
3. Energy input is pre-filled with `100`.
4. Energy unit is set to **MeV** (since proton has A=1, only MeV is shown).
5. Calculation runs automatically — the result table shows immediately:
   - Energy: 100 MeV
   - Stopping power: value from `LibdedxService.calculate()`
   - CSDA range: value from `LibdedxService.calculate()`
6. The user sees a complete, meaningful result **without touching any control**.

> This matches the project vision §3.1: "the user sees a result immediately
> without touching any control."

### Live Calculation (Debounced)

Results update reactively as the user types, without requiring a submit
button. The mechanism:

1. **On every input event** in the energy textarea (keystroke, paste, cut):
   - Parse the textarea content into individual lines.
   - Validate each line independently (see [Per-Line Validation](#per-line-validation)).
   - Collect all valid energy values.
2. **Debounce**: wait **300ms** after the last input event before triggering
   calculation. This prevents excessive WASM calls during rapid typing.
3. **If valid energies exist** and `EntitySelectionState.isComplete`:
   - Convert energies from the selected `EnergyUnit` to MeV/nucl using
     `LibdedxService.convertEnergy()`.
   - Call `LibdedxService.calculate()` with the converted energies.
   - Display results in the table.
4. **If no valid energies exist**: clear the result table (show empty state).
5. **If entity selection is incomplete**: show a message in the result area
   ("Select a particle and material to calculate").

### Recalculation Triggers

The result table recalculates when **any** of these inputs change:

| Trigger | Debounced? | Notes |
|---------|-----------|-------|
| Energy textarea input | Yes (300ms) | Per-keystroke with debounce |
| Energy unit change | No (immediate) | Energy values reinterpreted in new unit |
| Particle change | No (immediate) | May also change available energy units |
| Material change | No (immediate) | |
| Program change | No (immediate) | May change energy bounds |
| Advanced options change (future) | No (immediate) | |

For entity/unit changes (non-debounced): if the textarea already contains
valid energies, recalculate immediately using the new parameters.

### Per-Line Validation

Each line in the energy textarea is validated independently:

| Condition | Line status | v1 reporting |
|-----------|-----------|------------------|
| Valid positive number | ✅ Valid | Included in results (no indicator) |
| Empty or whitespace-only | ⏭️ Skipped | Ignored silently |
| Non-numeric text (e.g., "abc") | ❌ Invalid | Listed in summary below textarea (line number + reason) |
| Negative number | ❌ Invalid | Listed in summary: "Energy must be positive" |
| Zero | ❌ Invalid | Listed in summary: "Energy must be greater than zero" |
| Exceeds max energy for program/particle | ⚠️ Out of range | Listed in summary with valid range |
| Below min energy for program/particle | ⚠️ Out of range | Listed in summary with valid range |

> **v1 implementation note:** Validation feedback is shown as a **summary
> message below the textarea**, not as per-line inline highlighting inside
> the `<textarea>` element. The summary lists problematic line numbers and
> reasons. Per-line inline highlighting (via an overlay or `contenteditable`)
> is deferred to a future iteration — see Open Questions §3.

**Key rules:**
- Invalid lines are **excluded** from the calculation but do **not** block
  valid lines. If the user enters `100\nabc\n200`, the result table shows
  results for 100 and 200.
- Out-of-range lines are also excluded from the calculation. An inline
  message below the textarea summarizes: "2 of 4 values out of range
  (valid range: 0.001–10000 MeV/nucl for PSTAR + Proton)".
- The valid energy range is obtained from `LibdedxService.getMinEnergy()`
  and `LibdedxService.getMaxEnergy()` using the resolved program and
  selected particle.
- Range validation happens **after** unit conversion to MeV/nucl (since
  the C API bounds are in MeV/nucl).

### Energy Range Display

Below the textarea, show the valid energy range for the current selection:

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
   default to MeV.
3. The valid energy range may change — re-validate all energy lines.
4. Recalculate with the current valid energies and new entity selection.

---

## Output

### Result Table

The result table is the primary output. It appears below the energy input
and is the visual centerpiece of the page.

#### Columns

| Column | Header label | Data source | Unit display |
|--------|-------------|-------------|--------------|
| Energy | "Energy ({unit})" | User input (echo back) | User's selected energy unit |
| Stopping Power | "Stopping Power ({unit})" | `CalculationResult.stoppingPowers` | Default: MeV·cm²/g |
| CSDA Range | "CSDA Range ({unit})" | `CalculationResult.csdaRanges` | Default: g/cm² |

> TODO: Output unit selectors for stopping power and CSDA range columns
> will be specified in `unit-handling.md`. For v1, display in native C
> output units (MeV·cm²/g and g/cm²). Future: add clickable unit headers
> or dropdown selectors in the column headers to switch units, with
> auto-scaling to human-readable magnitudes per project vision §4.1.

#### Row Mapping

Each row in the result table corresponds to one valid energy value from
the textarea, in the order they appear. The mapping is:

```
energies[i] → stoppingPowers[i], csdaRanges[i]
```

Invalid and out-of-range lines are **not** shown in the result table.

#### Number Formatting

- Stopping power and CSDA range values use **4 significant figures**.
- Scientific notation for very small or very large values (|value| < 0.001
  or |value| ≥ 10000): e.g., `1.234e-3`, `1.234e+4`.
- Energy values are displayed as entered by the user (no reformatting),
  to maintain the visual link between input and output.
- Decimal separator: period (`.`) — consistent with scientific notation
  conventions.
- No thousands separator in the table (use monospace font for alignment).

#### Table Styling

- Monospace font for all numeric cells (alignment and readability).
- Right-aligned numeric columns.
- Alternating row backgrounds (subtle zebra striping) for readability.
- Sticky header row — if the table is long, the column headers remain
  visible while scrolling.
- Horizontal scroll on mobile if the table exceeds viewport width
  (3 columns should fit on most phones, but unit labels can be long).

#### Empty States

| Condition | Display |
|-----------|---------|
| No energies entered | "Enter energy values above to see results" |
| All entered values are invalid | "No valid energy values. Enter positive numbers, one per line." |
| Entity selection incomplete | "Select a particle and material to calculate" |
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

A **"Export CSV"** button appears below the result table when results are
displayed. Clicking it downloads the current table content as a CSV file.

- Filename: `dedx_calculator_{particle}_{material}_{program}.csv`
  (e.g., `dedx_calculator_proton_water_icru90.csv`)
- Format: UTF-8 with BOM, comma delimiter (per project vision §4.6).
- Columns match the result table: Energy, Stopping Power, CSDA Range,
  with units in the header row.

> Full export spec in TODO `docs/04-feature-specs/export.md`.

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
  as out-of-range (reported in the validation summary below the textarea,
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

### Textarea Overflow

- If the user pastes > 200 energy values, show an inline warning:
  "Large input (N values). Calculation may be slow."
- Do not block the calculation — it proceeds with debounce. If the WASM
  call takes > 500ms, show a subtle loading indicator on the result table.

---

## URL State Encoding

The Calculator page state is fully encoded in URL query parameters for
shareability. When a user shares a URL, the recipient sees the exact same
inputs and results.

| Parameter | Example | Notes |
|-----------|---------|-------|
| `particle` | `1` | Particle ID (proton, heavy ion, or electron) |
| `material` | `276` | Material ID |
| `program` | `auto` or `2` | "auto" for Auto-select, numeric for specific |
| `energies` | `100,200,500` | Comma-separated energy values (URL encoding only) |
| `eunit` | `MeV` | Energy unit |

**URL ↔ textarea format:** The `energies` parameter uses commas as a
delimiter because commas are URL-safe and compact. On page load, the
comma-separated values are expanded into **newline-separated lines** in
the textarea (one value per line). Conversely, when encoding the URL
from the current textarea state, newline-separated values are joined
with commas. The textarea itself never accepts commas as separators
during interactive editing — only newlines.

On page load with URL parameters:
1. Parse parameters and set entity selection + energy input.
2. Expand `energies` comma-separated string into newline-separated textarea content.
3. Validate the combination via the compatibility matrix.
4. Calculate and display results.
5. If any parameter is invalid, ignore it and fall back to the default.

> Full URL encoding spec in TODO `docs/04-feature-specs/shareable-urls.md`.

---

## Responsive Layout

### Desktop (≥900px)

Centered content column, max-width ~720px. Layout as shown in the
[entity-selection.md § Compact Mode desktop wireframe](entity-selection.md#desktop-900px--centered-form-layout).

```
┌────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Particle: [Proton (H) ▾]   Material: [Water (liquid)      ▾]   │  │
│  │  Program: [Auto-select → ICRU 90 ▾]   Energy: (•) MeV         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Energy (MeV)                     Valid range: 0.001–10000 MeV  │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  100                                                       │  │  │
│  │  │                                                            │  │  │
│  │  │                                                            │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Results calculated using ICRU 90 (auto-selected)                │  │
│  │  ┌────────────┬───────────────────────┬─────────────────────┐   │  │
│  │  │ Energy     │ Stopping Power        │ CSDA Range          │   │  │
│  │  │ (MeV)      │ (MeV·cm²/g)          │ (g/cm²)             │   │  │
│  │  ├────────────┼───────────────────────┼─────────────────────┤   │  │
│  │  │ 100        │ 4.576                 │ 7.718               │   │  │
│  │  └────────────┴───────────────────────┴─────────────────────┘   │  │
│  │                                                  [Export CSV ↓] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Tablet (600–899px)

Same layout structure but at full viewport width (no centering margins).
Entity selection comboboxes may wrap to two rows. All other elements
remain the same.

### Mobile (<600px)

Single column, full width:

```
┌──────────────────────────────────────┐
│ Particle: [Proton (H)            ▾]  │
│ Material: [Water (liquid)        ▾]  │
│ Program:  [Auto-select → ICRU 90 ▾] │
│ Energy:   (•) MeV                    │
│                                      │
│ Energy (MeV)                         │
│ Valid range: 0.001–10000 MeV         │
│ ┌──────────────────────────────────┐ │
│ │ 100                              │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Results (ICRU 90, auto-selected)     │
│ ┌──────────────────────────────────┐ │
│ │ Energy │ Stp Power │ CSDA Range  │ │
│ │ (MeV)  │(MeV·cm²/g)│ (g/cm²)    │ │
│ │ 100    │ 4.576     │ 7.718       │ │
│ └──────────────────────────────────┘ │
│                       [Export CSV ↓] │
└──────────────────────────────────────┘
```

- Entity selectors stack vertically, each full width.
- Energy input is full width.
- Result table scrolls horizontally if needed (unlikely with 3 columns).
- Export button right-aligned below the table.

---

## State Management

The Calculator page state is modeled with Svelte 5 runes:

```typescript
/** Calculator page reactive state. */
interface CalculatorState {
  /** From the entity selection component (shared store). */
  entitySelection: EntitySelectionState;

  /** Raw textarea content (unparsed string). */
  rawInput: string;

  /** Parsed and validated energy lines. */
  parsedEnergies: ParsedEnergyLine[];

  /** Currently selected energy unit. */
  energyUnit: EnergyUnit;

  /** Valid energy range for the current program/particle (in MeV/nucl). */
  minEnergy: number;
  maxEnergy: number;

  /** Calculation result, or null if no valid input / not yet calculated. */
  result: CalculationResult | null;

  /** Calculation error, if any. */
  error: LibdedxError | null;

  /** True while a calculation is in progress (debounce pending or WASM running). */
  isCalculating: boolean;
}

/** A single parsed line from the energy textarea. */
interface ParsedEnergyLine {
  /** Original text from the line. */
  raw: string;
  /** Line number (0-based). */
  lineIndex: number;
  /** Parsed numeric value in the user's selected unit, or null if invalid. */
  value: number | null;
  /** Validation status. */
  status: "valid" | "invalid" | "out-of-range" | "empty";
  /** Human-readable validation message, if applicable. */
  message?: string;
}
```

### Derived State (via `$derived`)

```typescript
/** Only the valid energy values, converted to MeV/nucl for the C API. */
const validEnergiesMevNucl: number[] = $derived(/* ... */);

/** Number of lines with each status, for summary display. */
const validationSummary = $derived({
  valid: parsedEnergies.filter(e => e.status === "valid").length,
  invalid: parsedEnergies.filter(e => e.status === "invalid").length,
  outOfRange: parsedEnergies.filter(e => e.status === "out-of-range").length,
  total: parsedEnergies.filter(e => e.status !== "empty").length,
});
```

### Reactivity Chain

```
rawInput (textarea)
  → $derived: parsedEnergies (parse + validate each line)
  → $derived: validEnergiesMevNucl (filter valid + convert units)
  → $effect (debounced): call LibdedxService.calculate()
  → $state: result (updates table)

entitySelection changes
  → $effect: update minEnergy/maxEnergy
  → re-derive parsedEnergies (range validation may change)
  → re-derive validEnergiesMevNucl
  → $effect: recalculate immediately (no debounce)
```

---

## Acceptance Criteria

### Default State
- [ ] On first load (no URL params), the page shows: Proton / Water (liquid) / Auto-select / 100 MeV.
- [ ] A result row is visible immediately without user interaction.
- [ ] The resolved program name is displayed (e.g., "ICRU 90 (auto-selected)").

### Energy Input
- [ ] The energy textarea accepts one positive number per line.
- [ ] Empty lines and whitespace-only lines are silently ignored.
- [ ] Scientific notation is accepted (e.g., `1e3`, `1.5E-2`).
- [ ] The textarea label dynamically shows the selected unit: "Energy (MeV)".
- [ ] A valid energy range label is shown below the textarea, derived from `getMinEnergy()` / `getMaxEnergy()`.

### Per-Line Validation
- [ ] Invalid lines (non-numeric, negative, zero) are reported in a summary below the textarea with line numbers and reasons.
- [ ] Out-of-range lines are reported in the summary with the valid range shown.
- [ ] Invalid and out-of-range lines are excluded from the calculation; valid lines still produce results.
- [ ] A summary message shows the count of excluded values (e.g., "2 of 5 values out of range").

### Live Calculation
- [ ] Results update reactively as the user types in the textarea (debounced at 300ms).
- [ ] Changing particle, material, or program triggers immediate recalculation (no debounce).
- [ ] Changing the energy unit triggers immediate reinterpretation and recalculation.
- [ ] A subtle loading indicator appears on the result table during calculation.

### Result Table
- [ ] The table has three columns: Energy, Stopping Power, CSDA Range, each with unit in the header.
- [ ] Numeric values use 4 significant figures and scientific notation for extreme values.
- [ ] Numeric cells use a monospace font and are right-aligned.
- [ ] The table has a sticky header row.
- [ ] The resolved program source is shown above or inline with the table.

### Energy Unit Selector
- [ ] Available units depend on the selected particle (read from `ParticleEntity.id` and `ParticleEntity.massNumber`).
- [ ] For proton (A=1) and electron (particle ID 1001), only "MeV" is shown.
- [ ] For heavy ions (A>1), "MeV" and "MeV/nucl" are shown.
- [ ] The selector uses segmented controls / radio buttons, not a dropdown.
- [ ] Changing the unit does not alter the textarea content but reinterprets the values.
- [ ] Typing a unit suffix in the textarea (e.g., `100 keV`) auto-switches the unit selector after debounce (see `unit-handling.md`).

### Entity Selection Integration
- [ ] Entity selectors use compact mode (searchable dropdown comboboxes).
- [ ] The layout matches the entity-selection.md compact mode wireframes.
- [ ] Entity selection state is shared with the Plot page (persists across navigation).

### Error Handling
- [ ] WASM init failure shows an error banner with a retry button; all controls are disabled.
- [ ] C library errors show a human-readable message with an expandable "Show details" section.
- [ ] When entity selection is incomplete, the result area shows "Select a particle and material to calculate."

### Responsive
- [ ] On desktop (≥900px), content is centered with max-width ~720px.
- [ ] On tablet (600–899px), layout fills viewport width.
- [ ] On mobile (<600px), all elements stack vertically; comboboxes are full-width.

### URL State
- [ ] The full calculator state (particle, material, program, energies, unit) is encoded in URL query parameters.
- [ ] Loading a URL with valid parameters restores the exact state and shows results.
- [ ] Invalid URL parameters fall back to defaults silently.

### Export
- [ ] An "Export CSV" button appears when results are displayed.
- [ ] The CSV file contains the same columns as the result table, with units in headers.

### Performance
- [ ] Debounce interval is 300ms for textarea input.
- [ ] Calculation for ≤50 energy values completes in < 100ms (WASM call).
- [ ] Pasting > 200 values shows a warning but does not block calculation.

### Accessibility
- [ ] The textarea has a visible `<label>` associated via `for`/`id`.
- [ ] Validation errors are announced to screen readers via `aria-live` region.
- [ ] The result table uses proper `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` markup.
- [ ] The energy unit selector uses `role="radiogroup"` with `role="radio"` items.
- [ ] All interactive elements are keyboard-accessible (Tab order: selectors → unit → textarea → table → export).

---

## Dependencies

- **`EntitySelectionState`** and compact mode component from
  [`entity-selection.md`](entity-selection.md)
- **`LibdedxService`** interface from
  [`docs/06-wasm-api-contract.md`](../06-wasm-api-contract.md):
  `calculate()`, `getMinEnergy()`, `getMaxEnergy()`, `convertEnergy()`
- **`CalculationResult`**, **`EnergyUnit`**, **`AdvancedOptions`** types
  from the WASM API contract
- **`CompatibilityMatrix`** for energy range bounds
- Svelte 5 runes: `$state`, `$derived`, `$effect`
- Tailwind CSS for layout and responsive breakpoints

---

## Open Questions

1. **Output unit selectors:** Should stopping power and CSDA range columns
   have unit selectors in v1, or defer to the `unit-handling.md` spec?
   *Current decision: defer to `unit-handling.md`. v1 displays native C
   units (MeV·cm²/g and g/cm²).*

2. **Textarea vs. structured input:** The old app used a textarea; ATIMA
   uses individual input fields. Textarea is more flexible for bulk input
   (paste a column from Excel). Keep textarea for v1.
   *Current decision: textarea.*

3. **Per-line error highlighting implementation:** How to highlight
   individual lines in a `<textarea>`? Options: (a) overlay a transparent
   line-highlight layer, (b) use a `contenteditable` div with per-line
   spans, (c) show errors only in a summary below. Option (c) is simplest
   for v1; (a) or (b) can be added later.
   *Current decision: use option (c) for v1 — summary below textarea +
   list of problematic line numbers. Revisit per-line highlighting in a
   future iteration.*

4. **Debounce timing:** 300ms is a common default. Should this be
   user-configurable (like the old app's "Dynamic / Performance" toggle)?
   *Current decision: fixed at 300ms for v1. No mode toggle.*

5. **"Generate default energies" button:** The old app had a button to
   fill the textarea with a program-specific default energy grid. Should
   the new app include this?
   *Current decision: defer to a future iteration. The pre-filled "100" is
   sufficient for the immediate-result-on-load requirement.*
