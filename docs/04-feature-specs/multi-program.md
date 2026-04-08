# Feature: Multi-Program Comparison Mode

> **Status:** Draft v1 (8 April 2026)
>
> **v1** (8 April 2026): Full draft. Multi-program comparison is an
> advanced-mode feature that adds per-program columns to the Calculator's
> unified table. Columns can be shown/hidden (Excel-style). Default
> program is visually highlighted. Uses `calculateMulti()` from the WASM
> contract. URL encodes advanced mode, selected programs, and column
> visibility. Partial-failure handling, responsive layout, export, and
> accessibility specified.
>
> **Related specs:**
> - Calculator page: [`calculator.md`](calculator.md)
> - Entity selection: [`entity-selection.md`](entity-selection.md)
> - Unit handling: [`unit-handling.md`](unit-handling.md)
> - Plot page: [`plot.md`](plot.md)
> - WASM API contract: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
> - Product vision §4.4 (Basic/Advanced mode): [`../01-project-vision.md`](../01-project-vision.md)

---

## User Story

**As a** radiation physicist,
**I want to** run the same calculation across multiple stopping-power
programs at once and see the results side by side,
**so that** I can compare data sources and identify discrepancies without
re-entering inputs.

**As a** student,
**I want to** show and hide individual program columns to focus on the
ones I care about,
**so that** I can explore differences between models without being
overwhelmed by a wide table.

---

## Related Specs / Dependencies

- Reuses Calculator compact entity-selection layout and unified table
  structure from [`calculator.md`](calculator.md).
- Reuses energy parsing, normalization, and output-unit rules from
  [`unit-handling.md`](unit-handling.md).
- Keeps terminology and compatibility assumptions aligned with
  [`entity-selection.md`](entity-selection.md).
- Uses `LibdedxService.calculateMulti()` from the
  [WASM API contract](../06-wasm-api-contract.md).
- Governed by the Basic/Advanced mode principle in
  [`01-project-vision.md`](../01-project-vision.md) §4.4.

---

## Scope

### In Scope

- Advanced-mode toggle behavior on the Calculator page.
- Multi-program selection UI in advanced mode.
- Per-program comparison columns for stopping power and CSDA range.
- Excel-style show/hide column mechanism.
- Visual highlighting of the default (auto-selected) program.
- Partial-success/partial-failure rendering.
- URL encoding for advanced mode, selected programs, and column visibility.
- CSV export with comparison columns.
- Responsive behavior for the wider comparison table.

### Out of Scope

- Plot-page multi-program overlays (handled by adding multiple series
  in [`plot.md`](plot.md)).
- Other advanced-mode features (MSTAR modes, aggregate state, density
  override, inverse lookups) — those are separate specs.
- PDF export specifics (deferred to the future `export.md` spec).

---

## Inputs

### 1. Advanced Mode Toggle

| Property | Detail |
|----------|--------|
| Type | Toggle switch or segmented control: **Basic** · **Advanced** |
| Position | Right end of the entity selection row, after the energy unit selector |
| Default | **Basic** (off) |
| Persistence | URL parameter `mode=advanced` when on; absent or `mode=basic` when off |
| Behavior | Switching to Advanced reveals the program multi-select and comparison columns. Switching back to Basic hides them and shows only the default program's results. |

When a shared URL contains `mode=advanced`, the recipient's page opens
in advanced mode with all specified programs and column visibility
restored.

### 2. Entity Selection

Particle and Material selectors are unchanged from Calculator compact
mode. The Program selector changes behavior depending on the mode:

| Mode | Program selector behavior |
|------|--------------------------|
| **Basic** | Single-select combobox (unchanged from Calculator). Auto-select resolves to one program. |
| **Advanced** | The single-select combobox is replaced by (or augmented with) a **multi-select program picker**. The user can check/uncheck compatible programs. Auto-select is always included and resolved to the default program. |

#### Multi-Select Program Picker (Advanced Mode)

| Property | Detail |
|----------|--------|
| Type | Dropdown with checkboxes (multi-select combobox) |
| Position | Same location as the single-select Program combobox |
| Items | All programs compatible with the current particle + material, grouped by category (Tabulated / Analytical) as in [`entity-selection.md`](entity-selection.md) |
| Incompatible items | Greyed out with a tooltip: "Not available for {particle} in {material}" |
| Default selection | The auto-selected program is checked and **cannot be unchecked** (it is the reference program) |
| Additional selections | The user checks additional programs to compare |
| Selection order | The auto-selected program is always first. Additional programs appear in selection order. |
| Maximum | No hard limit. A soft warning appears at 6 programs: "Showing many programs. Consider hiding some columns for readability." |

### 3. Energy Input

Unchanged from Calculator. The unified input/result table rows, per-row
unit suffix detection, paste behavior, and debounce timing all remain
identical. The only change is that the result columns expand when
additional programs are selected.

---

## State Model

### Core State

```typescript
interface MultiProgramState {
  /** Whether advanced mode is active. */
  advancedMode: boolean;

  /**
   * Selected program IDs in advanced mode.
   * In basic mode this is always [resolvedProgramId].
   * The first element is always the auto-selected (default) program.
   */
  selectedProgramIds: number[];

  /**
   * Column visibility per program. Key = programId, value = visible.
   * Hidden columns are not removed — they exist in state but are
   * not rendered (like hidden columns in a spreadsheet).
   */
  columnVisibility: Map<number, boolean>;

  /**
   * Results keyed by programId. Each entry is either a
   * CalculationResult or a LibdedxError (for partial failure).
   */
  comparisonResults: Map<number, CalculationResult | LibdedxError>;
}
```

### Derived State

```typescript
/** Ordered list of visible program IDs for rendering. */
const visibleProgramIds: number[] = $derived(
  selectedProgramIds.filter(id => columnVisibility.get(id) !== false)
);

/** The auto-selected (default/reference) program ID. */
const defaultProgramId: number = $derived(selectedProgramIds[0]);

/** True if any selected program returned an error. */
const hasAnyFailedProgram: boolean = $derived(
  [...comparisonResults.values()].some(r => r instanceof LibdedxError)
);
```

### URL Persistence

| Parameter | Example | Notes |
|-----------|---------|-------|
| `mode` | `advanced` | Present only when advanced mode is on. Absent = basic. |
| `programs` | `2,7,12` | Comma-separated program IDs. First is the default. Present only in advanced mode. |
| `phide` | `7,12` | Comma-separated program IDs whose columns are hidden. Absent = all visible. |

These extend the existing Calculator URL parameters (`particle`,
`material`, `program`, `energies`, `eunit`). In advanced mode, `program`
is replaced by `programs`. Example:

```
?particle=6&material=276&programs=2,7,12&phide=12&energies=100,200&eunit=MeV&mode=advanced
```

Restoration rules:
- If `mode=advanced` is present but `programs` is absent, use only the
  auto-selected program (effectively single-program advanced mode).
- If any program ID in `programs` is invalid or incompatible with the
  current particle/material, silently drop it and show a brief toast.
- If all program IDs are invalid, fall back to auto-select only.
- If `mode` is absent or `mode=basic`, ignore `programs` and `phide`
  entirely and display standard single-program Calculator.

---

## Behavior

### Default Behavior (Basic Mode)

The Calculator opens in basic mode. The page looks and behaves exactly
as specified in [`calculator.md`](calculator.md) — single program,
five-column unified table, no comparison columns. There is no visible
indication of multi-program capability except the "Advanced" toggle.

### Entering Advanced Mode

1. The user clicks the **Advanced** toggle.
2. The Program combobox transforms into a multi-select picker.
3. The auto-selected program is pre-checked and highlighted as the
   default.
4. The unified table remains unchanged until the user checks additional
   programs.

### Adding Comparison Programs

1. The user checks one or more additional programs in the picker.
2. For each newly selected program, **two new columns** appear in the
   unified table:
   - "Stp Power ({program name})" — stopping power for that program.
   - "CSDA Range ({program name})" — CSDA range for that program.
3. Calculation fires via `LibdedxService.calculateMulti()` with all
   selected program IDs.
4. Results populate the new columns for all valid rows.
5. The default program's columns retain their original position and are
   visually highlighted (see § Visual Highlighting).

### Column Layout

The unified table in advanced mode extends horizontally:

| # | Column | Notes |
|---|--------|-------|
| 1 | **Typed Value** | Unchanged — editable input |
| 2 | **→ MeV/nucl** | Unchanged — normalized energy |
| 3 | **Unit** | Unchanged — per-row unit |
| 4 | **Stp Power ({default program})** | **Highlighted** — default program stopping power |
| 5 | **CSDA Range ({default program})** | **Highlighted** — default program CSDA range |
| 6 | Stp Power ({program 2}) | Additional program |
| 7 | CSDA Range ({program 2}) | Additional program |
| 8 | Stp Power ({program 3}) | Additional program |
| 9 | CSDA Range ({program 3}) | Additional program |
| … | … | One pair per additional program |

Column pairs are ordered by selection order: the default program
first, then additional programs in the order the user checked them.

### Column Show/Hide

Users can show or hide any program's column pair, like hiding columns
in a spreadsheet. This keeps the table manageable when many programs
are selected.

| Property | Detail |
|----------|--------|
| Trigger | Right-click (context menu) on any program column header, or a dedicated **"Columns…"** button in the table toolbar |
| Menu | Checklist of all selected programs. Each entry has a checkbox. Checked = visible, unchecked = hidden. |
| Default program | Always checked; the checkbox is disabled (cannot be hidden). |
| Visual cue for hidden columns | A thin vertical "collapsed" indicator between visible columns, like Excel's hidden-column marker. Clicking it re-shows the hidden column(s). |
| Keyboard | The "Columns…" button is focusable and opens the checklist on Enter/Space. Arrow keys navigate the checklist. |
| URL persistence | Hidden program IDs are listed in the `phide` URL parameter. |

### Calculation Flow

1. Parse and validate rows exactly as in Calculator.
2. Normalize energies to MeV/nucl per [`unit-handling.md`](unit-handling.md).
3. Call `LibdedxService.calculateMulti()` with:
   - `programIds`: all selected program IDs
   - `particleId`, `materialId`: from entity selection
   - `energies`: normalized MeV/nucl array
   - `options`: reserved for future `AdvancedOptions` compatibility
4. Receive `Map<number, CalculationResult | LibdedxError>`.
5. Distribute results into the per-program columns.
6. Hidden columns still receive data (calculated but not rendered) so
   that showing a hidden column is instant — no recalculation needed.
7. Live debounced recalculation applies to all selected programs
   simultaneously (same 300ms debounce as Calculator).

### Partial Success / Partial Failure

One failing program does not block the others. Per the WASM contract,
`calculateMulti()` returns `CalculationResult | LibdedxError` per
program.

| Scenario | Behavior |
|----------|----------|
| Program succeeds | Its columns show numeric results normally. |
| Program fails | Its columns show "—" (em dash) in every row. A tooltip on the column header shows the error message from `LibdedxError`. A subtle error icon (⚠) appears in the header. |
| All programs fail | All result columns show "—". A banner above the table states: "All programs returned errors for the current selection." |
| Program fails, then input changes | On the next recalculation, the failed program is retried automatically. If it succeeds, its columns update normally. |

Failed programs remain selected. The user can uncheck them in the
picker if they want to remove them.

### Returning to Basic Mode

1. The user clicks the **Advanced** toggle to switch back to Basic.
2. All comparison columns are removed.
3. The table returns to the standard five-column Calculator layout.
4. Only the default program's results are shown.
5. The `programs`, `phide`, and `mode` URL parameters are removed.
6. Typed values, row order, unit state, and focus are preserved.

### Removing a Comparison Program

1. The user unchecks a program in the multi-select picker.
2. Its column pair is removed from the table immediately.
3. Its color returns to the hidden-column indicator if applicable.
4. Remaining columns shift left.
5. If only the default program remains, the table looks identical to
   basic mode (but advanced mode is still technically on).

---

## Output

### Result Semantics

All result values use the same physical semantics as Calculator:
- Stopping power from `CalculationResult.stoppingPowers` in MeV·cm²/g,
  converted to the current display unit per
  [`unit-handling.md`](unit-handling.md) §5.
- CSDA range from `CalculationResult.csdaRanges` in g/cm², converted
  to auto-scaled length per [`unit-handling.md`](unit-handling.md) §6.

Every program column pair uses the **same display unit** as the default
program. There is no per-program unit override — all columns are
directly comparable at a glance.

### Visual Highlighting of the Default Program

The default (auto-selected) program's columns are visually distinct:

| Element | Treatment |
|---------|-----------|
| Column header | **Bold** program name + "(default)" label |
| Header background | Subtle accent tint (e.g., light blue `bg-blue-50`) |
| Cell background | Same subtle tint, slightly lighter than header |
| Column border | Left border 2px accent color to visually separate the default block |

Additional program columns use the standard table styling (no tint,
normal-weight header text).

---

## Rendering / UI Layout

### Desktop Wireframe (≥900px, Advanced Mode, 3 Programs)

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  Particle: [Carbon (C) ▾]  Material: [Water ▾] 💧liquid                                      │
│  Programs: [☑ ICRU 90 ☑ PSTAR ☑ MSTAR ▾]  Energy: (•) MeV  [Basic · ●Advanced]              │
│                                                                                               │
│  [Columns…]                                                                                   │
│  ┌────────┬────────┬─────┬═══════════════════════╦═══════════════════════╤─────────────────────┐
│  │Energy  │→MeV/n  │Unit ║ Stp Pwr    │CSDA Range ║ Stp Pwr  │CSDA Range│Stp Pwr  │CSDA Range│
│  │(MeV)   │        │     ║ ICRU 90 ◆  │ICRU 90 ◆  ║ PSTAR    │PSTAR     │MSTAR    │MSTAR     │
│  ├────────┼────────┼─────╠════════════╪═══════════╬══════════╪══════════╪═════════╪══════════┤
│  │ 100    │ 8.333  │ MeV ║  1543      │ 123.4 nm  ║  1501    │ 120.1 nm │ 1522    │ 122.0 nm │
│  │ 200    │ 16.67  │ MeV ║  998.2     │ 456.7 nm  ║  987.5   │ 451.2 nm │ 995.1   │ 454.9 nm │
│  │ ░░░░░░ │        │     ║            │           ║          │          │         │          │
│  └────────┴────────┴─────╚════════════╧═══════════╩══════════╧══════════╧═════════╧══════════┘
│  Valid range: 0.001–10000 MeV                                              [Export CSV ↓]     │
└───────────────────────────────────────────────────────────────────────────────────────────────┘

  ◆ = default program (highlighted columns)
  ║ = visual separator for default program block
```

The table scrolls horizontally when column count exceeds viewport
width. The first three columns (Typed Value, → MeV/nucl, Unit) are
sticky (frozen) on horizontal scroll so the user always sees which
energy row they are looking at.

### Desktop Wireframe (Hidden Column Example)

If the user hides the MSTAR columns:

```
│  │Energy  │→MeV/n  │Unit ║ Stp Pwr    │CSDA Range ║ Stp Pwr  │CSDA Range│▐│
│  │(MeV)   │        │     ║ ICRU 90 ◆  │ICRU 90 ◆  ║ PSTAR    │PSTAR     │▐│
```

The `▐` represents the thin collapsed-column indicator. Hovering shows
a tooltip: "MSTAR (hidden) — click to show". Clicking it restores the
MSTAR column pair.

### Tablet (600–899px)

Same layout at full viewport width. The table scrolls horizontally.
The "Columns…" button becomes essential for managing visibility because
screen space is limited. Entity selectors may wrap to two rows.

### Mobile (<600px)

- Entity selectors stack vertically.
- The Advanced toggle and Programs multi-select also stack vertically.
- The table scrolls horizontally. The first column (Typed Value) is
  sticky.
- The "→ MeV/nucl" and "Unit" columns may be hidden by default on
  mobile to save space — only the Typed Value and result columns show.
- The "Columns…" button is prominently placed above the table.
- If more than 2 programs are visible, a hint suggests: "Hide some
  program columns for a better mobile experience."

### Loading / Empty / Error States

| State | Display |
|-------|---------|
| No valid rows | All result columns empty. Standard Calculator validation messaging. |
| No additional programs selected | Table shows only the default program columns (identical to basic mode). |
| Calculation in progress | Subtle shimmer/skeleton animation on result cells. Input cells remain editable. |
| Some programs still loading | Show results for completed programs; show skeleton for pending ones. |
| All programs failed | All result cells show "—". Banner above table. |

---

## Validation and Error Handling

### Input Validation

Unchanged from Calculator. Per-row parsing, suffix detection, range
validation, and row-level error display are identical. Invalid rows
are excluded from the `calculateMulti()` call. Invalid rows show
"—" across all program columns.

### Program Selection Validation

- At least one program (the default) is always selected — the user
  cannot deselect it.
- Duplicate program IDs are impossible because the picker uses
  checkboxes on a deduplicated list.
- Incompatible programs are greyed out in the picker (already filtered
  by the entity selection compatibility matrix).

### Error Presentation

- Per-program errors are shown via the "—" + tooltip pattern described
  in § Partial Success / Partial Failure.
- `LibdedxError.message` is shown in the tooltip. The numeric error
  code is not displayed in the UI but is logged to the browser console.
- If the user hovers or focuses the error icon in the column header,
  the full error message is displayed in a popover.

---

## Interaction With Unit-Handling Rules

- Energy parsing and normalization are identical to
  [`unit-handling.md`](unit-handling.md). Multi-program mode does not
  introduce any new energy-unit behavior.
- The stopping power display unit is **shared** across all program
  columns. If the material is non-gas, all columns show keV/µm. If
  gas, all show MeV·cm²/g. This ensures direct visual comparability.
- CSDA range auto-scaling is per-row as usual. Within a single row,
  all program columns use the **same SI prefix** — the prefix is
  determined by the default program's value for that row. This
  prevents confusing situations where one column says "µm" and another
  says "nm" for the same energy.
- Per-row unit mode works normally. Each row's energy is parsed and
  normalized once, then the same normalized value is sent to all
  programs via `calculateMulti()`.

---

## Interaction With URL State

The multi-program URL parameters extend (not replace) the Calculator
URL contract:

| Parameter | When present | Format | Example |
|-----------|-------------|--------|---------|
| `mode` | Advanced mode is on | `advanced` | `mode=advanced` |
| `programs` | Advanced mode is on | Comma-separated program IDs | `programs=2,7,12` |
| `phide` | Any columns are hidden | Comma-separated hidden program IDs | `phide=12` |

In basic mode, the standard `program` parameter is used (single ID or
`auto`). In advanced mode, `program` is replaced by `programs`.

Restoration rules:
- `mode=advanced` without `programs` → advanced mode with only the
  default program.
- Invalid program IDs in `programs` → silently dropped; toast shown.
- All IDs invalid → fall back to default program only.
- `phide` references a program not in `programs` → ignored silently.
- Missing `mode` or `mode=basic` → ignore `programs` and `phide`.

---

## Interaction With Export

### CSV Export (Advanced Mode)

The "Export CSV" button exports the **visible** columns only (hidden
columns are excluded, matching the visual table).

CSV schema — **wide table** format (one row per energy, program columns
side by side):

```csv
"Energy (MeV)","MeV/nucl","Unit","Stp Power ICRU 90 (keV/µm)","CSDA Range ICRU 90 (cm)","Stp Power PSTAR (keV/µm)","CSDA Range PSTAR (cm)"
100,8.333,MeV,1543,0.00012340,1501,0.00012010
200,16.67,MeV,998.2,0.00045670,987.5,0.00044120
```

Rules:
- Column headers include the program name and unit.
- CSDA range is exported in cm (not auto-scaled) for machine readability.
  This matches the Calculator export convention from
  [`calculator.md`](calculator.md).
- Stopping power unit matches the current display unit.
- Hidden program columns are **not** exported.
- Filename pattern: `dedx_{particle}_{material}_{N}programs.csv`
  (e.g., `dedx_Carbon_Water_3programs.csv`).

### Basic Mode Export

Unchanged from Calculator — single program, five-column CSV.

---

## Accessibility

- The Advanced toggle uses `role="switch"` with `aria-checked`.
- The multi-select program picker uses `role="listbox"` with
  `aria-multiselectable="true"`. Each item uses `role="option"` with
  `aria-selected`.
- Per-program column headers use `scope="col"` and include the program
  name for screen readers. The default program header also includes
  `aria-label="... (default program)"`.
- The "Columns…" button opens a dialog or popover with checkboxes.
  Focus is trapped in the popover while open.
- Hidden columns are announced: when a column is hidden, a brief
  `aria-live="polite"` announcement: "{Program} columns hidden."
  When shown: "{Program} columns shown."
- Per-program error tooltips are accessible via focus (not hover-only).
  The error icon has `aria-describedby` pointing to the error message.
- Sticky columns during horizontal scroll maintain proper header
  associations.
- Tab order in advanced mode: Advanced toggle → Programs picker →
  energy unit selector → table rows → Columns button → Export button.

---

## Acceptance Criteria

### Advanced Mode Toggle
- [ ] An "Advanced" toggle appears in the entity selection row.
- [ ] By default the toggle is off (basic mode). The page looks identical to the standard Calculator.
- [ ] Toggling to Advanced reveals the multi-select program picker.
- [ ] Toggling back to Basic removes comparison columns and restores the standard five-column table.
- [ ] The toggle state is encoded in the URL as `mode=advanced`.

### Program Selection
- [ ] In advanced mode, the Program selector becomes a multi-select with checkboxes.
- [ ] The auto-selected (default) program is always checked and cannot be unchecked.
- [ ] Incompatible programs are greyed out.
- [ ] Selecting additional programs adds column pairs to the table.
- [ ] Deselecting a program removes its column pair.

### Comparison Columns
- [ ] Each selected program adds two columns: stopping power and CSDA range.
- [ ] The default program's columns are visually highlighted (bold header, accent background, left border).
- [ ] All program columns use the same stopping power display unit.
- [ ] All program columns in the same row use the same CSDA range SI prefix.

### Column Show/Hide
- [ ] A "Columns…" button allows showing/hiding program column pairs.
- [ ] Right-clicking a program column header also opens the visibility menu.
- [ ] The default program's columns cannot be hidden.
- [ ] Hidden columns show a thin collapsed indicator between visible columns.
- [ ] Clicking the collapsed indicator re-shows the hidden columns.
- [ ] Column visibility is encoded in the URL as `phide=...`.

### Calculation
- [ ] `calculateMulti()` is called with all selected program IDs.
- [ ] Energies are normalized once and shared across all programs.
- [ ] Live debounced recalculation applies to all programs simultaneously.
- [ ] Hidden columns still receive calculated data (showing them is instant).

### Partial Failure
- [ ] A failing program shows "—" in its columns with an error icon and tooltip.
- [ ] Other programs' results are unaffected.
- [ ] Failed programs are retried on the next recalculation.
- [ ] If all programs fail, a banner appears above the table.

### URL State
- [ ] Advanced mode, selected programs, and hidden columns are all encoded in the URL.
- [ ] Loading a URL with `mode=advanced` restores the full comparison state.
- [ ] Invalid program IDs are silently dropped.
- [ ] A URL without `mode` or with `mode=basic` ignores multi-program parameters.

### Export
- [ ] In advanced mode, CSV includes visible program columns in wide-table format.
- [ ] Hidden program columns are excluded from CSV export.
- [ ] Column headers include program names and units.
- [ ] Filename includes program count.

### Responsive
- [ ] The table scrolls horizontally when columns exceed viewport width.
- [ ] The first three columns (Typed Value, → MeV/nucl, Unit) are sticky on desktop.
- [ ] On mobile, at least the Typed Value column is sticky.
- [ ] The "Columns…" button is prominently accessible on all screen sizes.

### Accessibility
- [ ] The Advanced toggle has proper ARIA switch semantics.
- [ ] The multi-select picker has proper listbox/option semantics.
- [ ] Column show/hide actions are announced via `aria-live`.
- [ ] Error tooltips are accessible via keyboard focus.
- [ ] Tab order is logical in advanced mode.

---

## Open Questions

1. Should the comparison table also show a **delta column** (difference
   from the default program) or a **% difference**? This could be a
   further advanced option. Deferred for now.
2. Should changing particle or material automatically uncheck programs
   that become incompatible, or should they be kept (greyed out) so
   the user can switch back? Current spec: greyed out and silently
   excluded from calculation, re-included if they become compatible
   again.
3. Should the "Columns…" menu also allow hiding the "→ MeV/nucl" and
   "Unit" columns (non-program columns)? Current spec: no, only
   program column pairs are toggleable.
4. Is there a use case for reordering program columns via drag-and-drop?
   Deferred — selection order is sufficient for v1.

---

## Cross-Spec Consistency Checks

- [ ] Calculator interaction model and layout terminology: [`calculator.md`](calculator.md)
- [ ] Entity selection compatibility and terminology: [`entity-selection.md`](entity-selection.md)
- [ ] Energy parsing, normalization, and display-unit rules: [`unit-handling.md`](unit-handling.md)
- [ ] Plot-page comparison relationship: [`plot.md`](plot.md)
- [ ] Service capabilities and error semantics: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
- [ ] Basic/Advanced mode principle: [`../01-project-vision.md`](../01-project-vision.md) §4.4
- [ ] Stage naming and intent: [`../00-redesign-plan.md`](../00-redesign-plan.md)