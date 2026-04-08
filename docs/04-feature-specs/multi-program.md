# Feature: Multi-Program Comparison Mode (Calculator — Advanced)

> **Status:** Draft v2 (8 April 2026)
>
> **v1** (8 April 2026): Full draft. Multi-program comparison is an
> advanced-mode feature that adds per-program columns to the Calculator's
> unified table. Columns can be shown/hidden (Excel-style). Default
> program is visually highlighted. Uses `calculateMulti()` from the WASM
> contract. URL encodes advanced mode, selected programs, and column
> visibility. Partial-failure handling, responsive layout, export, and
> accessibility specified.
>
> **v2** (8 April 2026): Address review feedback.
> - Advanced mode toggle moved to the **top-right action bar** (app-wide,
>   uniform across Calculator and Plot).
> - Columns grouped **by quantity** (all stopping powers together, then
>   all CSDA ranges together), not by program.
> - **Drag-and-drop column reordering** within each group; reorder syncs
>   between groups.
> - **Onboarding hint** shown on first entry into advanced mode.
> - **Delta / % difference tooltip** on hover over comparison values.
> - URL parameter `phide` renamed to `hidden_programs`.
> - Wireframe examples use ICRU 90 / PSTAR / Bethe (not MSTAR).
> - Explicitly scoped as a **Calculator page** advanced feature.
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

- Multi-program comparison columns on the **Calculator page** in
  advanced mode.
- Multi-select program picker in advanced mode.
- Columns grouped by quantity (stopping power group, CSDA range group).
- Drag-and-drop column reordering within groups, synced across groups.
- Excel-style show/hide column mechanism.
- Visual highlighting of the default (auto-selected) program.
- Delta / % difference tooltip on hover.
- Onboarding hint when entering advanced mode.
- Partial-success/partial-failure rendering.
- URL encoding for advanced mode, selected programs, column visibility,
  and column order.
- CSV export with comparison columns.
- Responsive behavior for the wider comparison table.

### Out of Scope

- Plot-page multi-program overlays (handled by adding multiple series
  in [`plot.md`](plot.md)).
- Other advanced-mode features (MSTAR modes, aggregate state, density
  override, inverse lookups) — those are separate specs.
- The Advanced mode toggle itself — it is an app-wide control defined
  in [`01-project-vision.md`](../01-project-vision.md) §4.4. This spec
  only defines what happens on the Calculator page when advanced mode
  is on.
- PDF export specifics (deferred to the future `export.md` spec).

---

## Inputs

### 1. Advanced Mode Toggle (App-Wide)

The Advanced toggle is an **app-wide** control positioned in the
**top-right action bar** alongside the Share and Export buttons (see
[`01-project-vision.md`](../01-project-vision.md) §4.4). It is not
specific to the Calculator — the same toggle appears on every page.

| Property | Detail |
|----------|--------|
| Type | Segmented control: **Basic** · **Advanced** |
| Position | Top-right action bar, before Share / Export buttons |
| Default | **Basic** (off) |
| Persistence | URL parameter `mode=advanced`. Also stored in `localStorage` so the mode persists when navigating between pages. |
| Behavior | Switching to Advanced on any page activates advanced features app-wide. On the Calculator page, this reveals the multi-select program picker and comparison columns. |

### 2. Onboarding Hint

When the user switches to Advanced mode **for the first time** (or the
first 2 times, tracked via `localStorage`):

| Property | Detail |
|----------|--------|
| Type | Inline hint banner, dismissible |
| Position | Below the entity selection row, above the unified table |
| Content | "Advanced mode enabled. You can now select **multiple programs** to compare stopping power and range side by side." |
| Dismiss | Clicking × or any interaction with the program picker. Auto-dismissed after 8 seconds. |
| Suppression | After 2 showings, the hint is permanently suppressed (via `localStorage` counter). |

### 3. Entity Selection

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

### 4. Energy Input

Unchanged from Calculator. The unified input/result table rows, per-row
unit suffix detection, paste behavior, and debounce timing all remain
identical. The only change is that the result columns expand when
additional programs are selected.

---

## State Model

### Core State

```typescript
interface MultiProgramState {
  /** Whether advanced mode is active (app-wide, from the action bar toggle). */
  advancedMode: boolean;

  /**
   * Selected program IDs in advanced mode.
   * In basic mode this is always [resolvedProgramId].
   * The first element is always the auto-selected (default) program.
   */
  selectedProgramIds: number[];

  /**
   * Display order of programs within each column group.
   * The default program is always first. Additional programs can be
   * reordered via drag-and-drop; this order applies to both the
   * stopping power group and the CSDA range group simultaneously.
   */
  programDisplayOrder: number[];

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
/** Ordered list of visible program IDs for rendering (respects drag-and-drop order). */
const visibleProgramIds: number[] = $derived(
  programDisplayOrder.filter(id => columnVisibility.get(id) !== false)
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
| `programs` | `2,7,12` | Comma-separated program IDs in display order. First is always the default. Present only in advanced mode. |
| `hidden_programs` | `7,12` | Comma-separated program IDs whose columns are hidden. Absent = all visible. |

These extend the existing Calculator URL parameters (`particle`,
`material`, `program`, `energies`, `eunit`). In advanced mode, `program`
is replaced by `programs`. The order of IDs in `programs` encodes the
user's drag-and-drop column order. Example:

```
?particle=1&material=276&programs=2,7,4&hidden_programs=4&energies=100,200&eunit=MeV&mode=advanced
```

This example: Proton in Water, comparing ICRU 90 (default, ID 2),
PSTAR (ID 7), and Bethe (ID 4, hidden). Energy 100 and 200 MeV.

Restoration rules:
- If `mode=advanced` is present but `programs` is absent, use only the
  auto-selected program (effectively single-program advanced mode).
- If any program ID in `programs` is invalid or incompatible with the
  current particle/material, silently drop it and show a brief toast.
- If all program IDs are invalid, fall back to auto-select only.
- `hidden_programs` references a program not in `programs` → ignored
  silently.
- Missing `mode` or `mode=basic` → ignore `programs` and
  `hidden_programs` entirely and display standard single-program
  Calculator.

---

## Behavior

### Default Behavior (Basic Mode)

The Calculator opens in basic mode. The page looks and behaves exactly
as specified in [`calculator.md`](calculator.md) — single program,
five-column unified table, no comparison columns. There is no visible
indication of multi-program capability except the "Advanced" toggle in
the top-right action bar.

### Entering Advanced Mode

1. The user clicks the **Advanced** segment in the top-right action bar.
2. The onboarding hint appears (if not yet suppressed): "Advanced mode
   enabled. You can now select **multiple programs** to compare stopping
   power and range side by side."
3. The Program combobox transforms into a multi-select picker.
4. The auto-selected program is pre-checked and highlighted as the
   default.
5. The unified table remains unchanged until the user checks additional
   programs.

### Adding Comparison Programs

1. The user checks one or more additional programs in the picker.
2. New columns appear in the unified table, grouped by quantity:
   - One stopping power column per additional program (added to the
     stopping power group).
   - One CSDA range column per additional program (added to the CSDA
     range group).
3. Calculation fires via `LibdedxService.calculateMulti()` with all
   selected program IDs.
4. Results populate the new columns for all valid rows.
5. The default program's columns are visually highlighted within each
   group (see § Visual Highlighting).

### Column Layout — Grouped by Quantity

The unified table in advanced mode groups columns **by physical
quantity**, not by program. This makes it easy to scan across programs
for the same quantity:

| # | Column | Group | Notes |
|---|--------|-------|-------|
| 1 | **Typed Value** | Input | Unchanged — editable input |
| 2 | **→ MeV/nucl** | Input | Unchanged — normalized energy |
| 3 | **Unit** | Input | Unchanged — per-row unit |
| 4 | **Stp Power ({default prog}) ◆** | Stopping Power | **Highlighted** — default program |
| 5 | Stp Power ({program 2}) | Stopping Power | Additional program |
| 6 | Stp Power ({program 3}) | Stopping Power | Additional program |
| 7 | **CSDA Range ({default prog}) ◆** | CSDA Range | **Highlighted** — default program |
| 8 | CSDA Range ({program 2}) | CSDA Range | Additional program |
| 9 | CSDA Range ({program 3}) | CSDA Range | Additional program |

Each group has a **group header row** spanning its columns:
"Stopping Power ({unit})" and "CSDA Range". Program names appear in the
sub-header row within each group.

The program order within both groups is always identical — reordering
in one group automatically reorders the other (see § Drag-and-Drop
Column Reordering).

### Drag-and-Drop Column Reordering

Users can reorder program columns within each group via drag-and-drop
on the column sub-headers.

| Property | Detail |
|----------|--------|
| Trigger | Drag a program sub-header cell within the stopping power or CSDA range group |
| Constraint | The default program column is always first and cannot be moved. Only additional program columns are draggable. |
| Sync | Reordering in either group (stopping power or CSDA range) applies the same order to the other group. The `programDisplayOrder` state is shared. |
| Visual feedback | A drag ghost shows the column header text. Drop zones are indicated by a vertical insertion line between columns. |
| URL persistence | The `programs` parameter encodes IDs in display order. |
| Keyboard | Arrow keys reorder when a column header is focused and a modifier key is held (e.g., Alt+← / Alt+→). |

### Column Show/Hide

Users can show or hide any program's columns across both groups, like
hiding columns in a spreadsheet. This keeps the table manageable when
many programs are selected.

| Property | Detail |
|----------|--------|
| Trigger | Right-click (context menu) on any program column header, or a dedicated **"Columns…"** button in the table toolbar |
| Menu | Checklist of all selected programs. Each entry has a checkbox. Checked = visible, unchecked = hidden. |
| Default program | Always checked; the checkbox is disabled (cannot be hidden). |
| Visual cue for hidden columns | A thin vertical "collapsed" indicator between visible columns within each group, like Excel's hidden-column marker. Clicking it re-shows the hidden column(s). |
| Scope | Hiding a program hides its column in **both** the stopping power group and the CSDA range group simultaneously. |
| Keyboard | The "Columns…" button is focusable and opens the checklist on Enter/Space. Arrow keys navigate the checklist. |
| URL persistence | Hidden program IDs are listed in the `hidden_programs` URL parameter. |

### Delta / % Difference Tooltip

When the user hovers over (or focuses) a **non-default program's**
result cell, a tooltip shows the difference from the default program:

| Property | Detail |
|----------|--------|
| Content | "Δ = {absolute difference} ({relative %}% vs {default program})" |
| Example | "Δ = −42 keV/µm (−2.7% vs ICRU 90)" |
| Trigger | Mouse hover or keyboard focus on any comparison cell |
| Default program cells | No tooltip (they are the reference) |
| Error cells | No tooltip (value is "—") |
| Computation | `delta = value_program - value_default`; `pct = delta / value_default * 100` |

### Calculation Flow

1. Parse and validate rows exactly as in Calculator.
2. Normalize energies to MeV/nucl per [`unit-handling.md`](unit-handling.md).
3. Call `LibdedxService.calculateMulti()` with:
   - `programIds`: all selected program IDs
   - `particleId`, `materialId`: from entity selection
   - `energies`: normalized MeV/nucl array
   - `options`: reserved for future `AdvancedOptions` compatibility
4. Receive `Map<number, CalculationResult | LibdedxError>`.
5. Distribute results into the per-program columns within each group.
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

1. The user clicks the **Basic** segment in the top-right action bar.
2. All comparison columns are removed.
3. The table returns to the standard five-column Calculator layout.
4. Only the default program's results are shown.
5. The `programs`, `hidden_programs`, and `mode` URL parameters are
   removed.
6. Typed values, row order, unit state, and focus are preserved.

### Removing a Comparison Program

1. The user unchecks a program in the multi-select picker.
2. Its column is removed from both groups immediately.
3. Remaining columns shift left.
4. If only the default program remains, the table shows one stopping
   power column and one CSDA range column (identical to basic mode,
   but grouped headers still visible while advanced mode is on).

---

## Output

### Result Semantics

All result values use the same physical semantics as Calculator:
- Stopping power from `CalculationResult.stoppingPowers` in MeV·cm²/g,
  converted to the current display unit per
  [`unit-handling.md`](unit-handling.md) §5.
- CSDA range from `CalculationResult.csdaRanges` in g/cm², converted
  to auto-scaled length per [`unit-handling.md`](unit-handling.md) §6.

Every program column uses the **same display unit** as the default
program. There is no per-program unit override — all columns are
directly comparable at a glance.

### Visual Highlighting of the Default Program

The default (auto-selected) program's column in each group is visually
distinct:

| Element | Treatment |
|---------|-----------|
| Column sub-header | **Bold** program name + "◆" marker |
| Header background | Subtle accent tint (e.g., light blue `bg-blue-50`) |
| Cell background | Same subtle tint, slightly lighter than header |
| Column border | Left border 2px accent color to visually separate the default column |

Additional program columns use the standard table styling (no tint,
normal-weight header text).

---

## Rendering / UI Layout

### Desktop Wireframe (≥900px, Advanced Mode, 3 Programs)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                    [Basic · ●Advanced]  [Share]  [Export CSV ↓]      │
│                                                                                                      │
│  Particle: [Proton (H) ▾]  Material: [Water (liquid) ▾] 💧liquid                                    │
│  Programs: [☑ ICRU 90 ☑ PSTAR ☑ Bethe ▾]  Energy: (•) MeV                                          │
│                                                                                                      │
│  ℹ Advanced mode enabled. You can now select multiple programs to compare.                     [×]   │
│                                                                                                      │
│  [Columns…]                                                                                          │
│  ┌────────┬────────┬─────┬══════════════════════════════════════════┬═══════════════════════════════┐  │
│  │        │        │     │     Stopping Power (keV/µm)             │      CSDA Range               │  │
│  │Energy  │→MeV/n  │Unit ├──────────────┬──────────┬──────────────┼───────────┬─────────┬─────────┤  │
│  │(MeV)   │        │     │ ICRU 90 ◆    │ PSTAR    │ Bethe        │ ICRU 90 ◆ │ PSTAR   │ Bethe   │  │
│  ├────────┼────────┼─────┼══════════════╪══════════╪══════════════╪═══════════╪═════════╪═════════┤  │
│  │ 100    │ 100    │ MeV │  45.76       │  44.92   │  46.01       │ 7.718 cm  │ 7.651 cm│ 7.740 cm│  │
│  │ 200    │ 200    │ MeV │  27.34       │  26.88   │  27.51       │ 26.27 cm  │ 26.01 cm│ 26.39 cm│  │
│  │ ░░░░░░ │        │     │              │          │              │           │         │         │  │
│  └────────┴────────┴─────┴══════════════╧══════════╧══════════════╧═══════════╧═════════╧═════════┘  │
│  Valid range: 0.001–10000 MeV                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ◆ = default program (highlighted columns, accent background)
  Hovering 44.92 (PSTAR) shows tooltip: "Δ = −0.84 keV/µm (−1.8% vs ICRU 90)"
  Drag PSTAR or Bethe sub-headers to reorder; order syncs across both groups.
```

The table scrolls horizontally when column count exceeds viewport
width. The first three columns (Typed Value, → MeV/nucl, Unit) are
sticky (frozen) on horizontal scroll so the user always sees which
energy row they are looking at.

### Desktop Wireframe (Hidden Column Example)

If the user hides the Bethe columns:

```
│  │        │        │     │     Stopping Power (keV/µm)  │      CSDA Range          │
│  │Energy  │→MeV/n  │Unit │ ICRU 90 ◆    │ PSTAR   │▐│  │ ICRU 90 ◆ │ PSTAR   │▐│  │
```

The `▐` represents the thin collapsed-column indicator within each
group. Hovering shows a tooltip: "Bethe (hidden) — click to show".
Clicking it restores the Bethe column in both groups.

### Tablet (600–899px)

Same layout at full viewport width. The table scrolls horizontally.
The "Columns…" button becomes essential for managing visibility because
screen space is limited. Entity selectors may wrap to two rows.

### Mobile (<600px)

- Entity selectors stack vertically.
- The action bar (including Advanced toggle) remains at the top.
- The Programs multi-select stacks below entity selectors.
- The table scrolls horizontally. The first column (Typed Value) is
  sticky.
- The "→ MeV/nucl" and "Unit" columns may be hidden by default on
  mobile to save space — only the Typed Value and result columns show.
- The "Columns…" button is prominently placed above the table.
- If more than 2 programs are visible, a hint suggests: "Hide some
  program columns for a better mobile experience."
- Drag-and-drop reordering is available on touch via long-press + drag.

### Loading / Empty / Error States

| State | Display |
|-------|---------|
| No valid rows | All result columns empty. Standard Calculator validation messaging. |
| No additional programs selected | Table shows only the default program column in each group (identical to basic mode). |
| Calculation in progress | Subtle shimmer/skeleton animation on result cells. Input cells remain editable. |
| Some programs still loading | Show results for completed programs; show skeleton for pending ones. |
| All programs failed | All result cells show "—". Banner above table. |

---

## Validation and Error Handling

### Input Validation

Unchanged from Calculator. Per-row parsing, suffix detection, range
validation, and row-level error display are identical. Invalid rows
are excluded from the `calculateMulti()` call. Invalid rows show
"—" across all program columns in both groups.

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
  columns within the stopping power group. If the material is non-gas,
  all columns show keV/µm. If gas, all show MeV·cm²/g. This ensures
  direct visual comparability.
- CSDA range auto-scaling is per-row as usual. Within a single row,
  all program columns in the CSDA range group use the **same SI
  prefix** — the prefix is determined by the default program's value
  for that row. This prevents confusing situations where one column
  says "µm" and another says "nm" for the same energy.
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
| `programs` | Advanced mode is on | Comma-separated program IDs in display order | `programs=2,7,4` |
| `hidden_programs` | Any columns are hidden | Comma-separated hidden program IDs | `hidden_programs=4` |

In basic mode, the standard `program` parameter is used (single ID or
`auto`). In advanced mode, `program` is replaced by `programs`.

Restoration rules:
- `mode=advanced` without `programs` → advanced mode with only the
  default program.
- Invalid program IDs in `programs` → silently dropped; toast shown.
- All IDs invalid → fall back to default program only.
- `hidden_programs` references a program not in `programs` → ignored
  silently.
- Missing `mode` or `mode=basic` → ignore `programs` and
  `hidden_programs` entirely and display standard single-program
  Calculator.
- The order of IDs in `programs` is the display order (reflecting any
  drag-and-drop reordering). The first ID is always the default.

---

## Interaction With Export

### CSV Export (Advanced Mode)

The "Export CSV" button exports the **visible** columns only (hidden
columns are excluded, matching the visual table). Columns are grouped
by quantity, matching the on-screen layout.

CSV schema — **wide table** format (one row per energy, grouped columns):

```csv
"Energy (MeV)","MeV/nucl","Unit","Stp Power ICRU 90 (keV/µm)","Stp Power PSTAR (keV/µm)","Stp Power Bethe (keV/µm)","CSDA Range ICRU 90 (cm)","CSDA Range PSTAR (cm)","CSDA Range Bethe (cm)"
100,100,MeV,45.76,44.92,46.01,7.718,7.651,7.740
200,200,MeV,27.34,26.88,27.51,26.27,26.01,26.39
```

Rules:
- Column headers include the program name and unit.
- Column order matches on-screen order (including drag-and-drop
  reordering).
- CSDA range is exported in cm (not auto-scaled) for machine readability.
  This matches the Calculator export convention from
  [`calculator.md`](calculator.md).
- Stopping power unit matches the current display unit.
- Hidden program columns are **not** exported.
- Filename pattern: `dedx_{particle}_{material}_{N}programs.csv`
  (e.g., `dedx_Proton_Water_3programs.csv`).

### Basic Mode Export

Unchanged from Calculator — single program, five-column CSV.

---

## Accessibility

- The multi-select program picker uses `role="listbox"` with
  `aria-multiselectable="true"`. Each item uses `role="option"` with
  `aria-selected`.
- Per-program column headers use `scope="col"` and include the program
  name for screen readers. The default program header also includes
  `aria-label="... (default program)"`.
- Group headers ("Stopping Power", "CSDA Range") use `scope="colgroup"`.
- The "Columns…" button opens a dialog or popover with checkboxes.
  Focus is trapped in the popover while open.
- Hidden columns are announced: when a column is hidden, a brief
  `aria-live="polite"` announcement: "{Program} columns hidden."
  When shown: "{Program} columns shown."
- Drag-and-drop reordering: column headers are focusable with
  `aria-grabbed` / `aria-dropeffect` attributes. Keyboard reordering
  via Alt+Arrow keys. Screen reader announcement: "{Program} moved to
  position {N}."
- Delta tooltips are accessible via keyboard focus on comparison cells
  (not hover-only). The tooltip content is exposed via `aria-describedby`.
- Per-program error tooltips are accessible via focus (not hover-only).
  The error icon has `aria-describedby` pointing to the error message.
- Sticky columns during horizontal scroll maintain proper header
  associations.
- Tab order in advanced mode: Action bar (Advanced toggle) → Programs
  picker → energy unit selector → table rows → Columns button.

---

## Acceptance Criteria

### Advanced Mode Toggle
- [ ] The Advanced toggle in the top-right action bar is visible on all pages.
- [ ] By default the toggle is off (basic mode). The Calculator page looks identical to the standard Calculator.
- [ ] Toggling to Advanced on the Calculator reveals the multi-select program picker.
- [ ] An onboarding hint appears on the first 2 entries into advanced mode: "Advanced mode enabled. You can now select multiple programs to compare…"
- [ ] The onboarding hint dismisses on × click, program picker interaction, or after 8 seconds.
- [ ] Toggling back to Basic removes comparison columns and restores the standard five-column table.
- [ ] The toggle state is encoded in the URL as `mode=advanced` and persists in `localStorage`.

### Program Selection
- [ ] In advanced mode, the Program selector becomes a multi-select with checkboxes.
- [ ] The auto-selected (default) program is always checked and cannot be unchecked.
- [ ] Incompatible programs are greyed out.
- [ ] Selecting additional programs adds columns to both the stopping power and CSDA range groups.
- [ ] Deselecting a program removes its columns from both groups.

### Column Layout — Grouped by Quantity
- [ ] Columns are grouped: input columns → all stopping power columns → all CSDA range columns.
- [ ] Each group has a spanning group header ("Stopping Power (unit)", "CSDA Range").
- [ ] Program names appear in sub-headers within each group.
- [ ] The program order is identical in both groups.
- [ ] The default program's column is first in each group and visually highlighted (bold header, accent background, left border).

### Drag-and-Drop Column Reordering
- [ ] Additional program sub-headers are draggable within each group.
- [ ] Reordering in one group applies to both groups simultaneously.
- [ ] The default program column cannot be moved from the first position.
- [ ] The display order is encoded in the `programs` URL parameter.
- [ ] Keyboard reordering is available via Alt+Arrow keys.

### Column Show/Hide
- [ ] A "Columns…" button allows showing/hiding program columns.
- [ ] Right-clicking a program column header also opens the visibility menu.
- [ ] The default program's columns cannot be hidden.
- [ ] Hidden columns show a thin collapsed indicator within each group.
- [ ] Clicking the collapsed indicator re-shows the hidden columns in both groups.
- [ ] Column visibility is encoded in the URL as `hidden_programs=...`.

### Delta Tooltip
- [ ] Hovering a non-default program's result cell shows a tooltip with absolute and percentage difference from the default program.
- [ ] The tooltip is accessible via keyboard focus.
- [ ] Default program cells and error cells ("—") do not show a delta tooltip.

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
- [ ] Advanced mode, selected programs (in display order), and hidden columns are all encoded in the URL.
- [ ] Loading a URL with `mode=advanced` restores the full comparison state.
- [ ] Invalid program IDs are silently dropped.
- [ ] A URL without `mode` or with `mode=basic` ignores multi-program parameters.

### Export
- [ ] In advanced mode, CSV columns are grouped by quantity (all stopping powers, then all CSDA ranges).
- [ ] Hidden program columns are excluded from CSV export.
- [ ] Column headers include program names and units.
- [ ] Column order in CSV matches on-screen order.
- [ ] Filename includes program count.

### Responsive
- [ ] The table scrolls horizontally when columns exceed viewport width.
- [ ] The first three columns (Typed Value, → MeV/nucl, Unit) are sticky on desktop.
- [ ] On mobile, at least the Typed Value column is sticky.
- [ ] The "Columns…" button is prominently accessible on all screen sizes.
- [ ] Drag-and-drop works on touch devices via long-press.

### Accessibility
- [ ] The multi-select picker has proper listbox/option semantics.
- [ ] Group headers use `scope="colgroup"`.
- [ ] Column show/hide actions are announced via `aria-live`.
- [ ] Drag-and-drop reorder is announced via `aria-live`.
- [ ] Delta tooltips are accessible via keyboard focus.
- [ ] Error tooltips are accessible via keyboard focus.
- [ ] Tab order is logical in advanced mode.

---

## Open Questions

1. Should changing particle or material automatically uncheck programs
   that become incompatible, or should they be kept (greyed out) so
   the user can switch back? Current spec: greyed out and silently
   excluded from calculation, re-included if they become compatible
   again.
2. Should the "Columns…" menu also allow hiding the "→ MeV/nucl" and
   "Unit" columns (non-program columns)? Current spec: no, only
   program columns are toggleable.
3. What advanced-mode features should appear on the **Plot page**?
   This spec only defines Calculator behavior. Plot-page advanced
   features are deferred to future specs.

---

## Cross-Spec Consistency Checks

- [ ] Calculator interaction model and layout terminology: [`calculator.md`](calculator.md)
- [ ] Entity selection compatibility and terminology: [`entity-selection.md`](entity-selection.md)
- [ ] Energy parsing, normalization, and display-unit rules: [`unit-handling.md`](unit-handling.md)
- [ ] Plot-page comparison relationship: [`plot.md`](plot.md)
- [ ] Service capabilities and error semantics: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
- [ ] Basic/Advanced mode principle and action bar placement: [`../01-project-vision.md`](../01-project-vision.md) §4.4
- [ ] Stage naming and intent: [`../00-redesign-plan.md`](../00-redesign-plan.md)