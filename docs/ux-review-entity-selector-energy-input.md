# UX Review — Entity Selector & Energy Input

> **Date:** 2026-04-24  
> **Scope:** `entity-combobox.svelte`, `entity-selection-comboboxes.svelte`,
> `entity-selection-panels.svelte`, `entity-panel.svelte`, `energy-input.svelte`,
> `energy-input.svelte.ts`, `energy-parser.ts`  
> **Basis:** Code review + comparison against spec (`entity-selection.md`, `calculator.md`)
> and general UI/UX best practices.

---

## Summary

Both features are functionally solid and well-tested, but share a common
weakness: **information density vs. discoverability**. The entity selector
does a good job of filtering a large dataset but misses several conventions
that experienced users expect from a combobox. The energy input is far from
the spec's "unified table" vision — it currently renders as a plain list of
text inputs with no result columns. Several smaller issues across both
components make the experience feel unfinished.

---

## Entity Selector — Combobox Mode (Calculator Page)

### 1. No visible field labels

**Issue:** Each combobox uses its placeholder text ("Select particle", etc.)
as the only visible label. Once an item is selected the placeholder
disappears; only the selected value remains visible. Users scanning the
three-column row must infer meaning from the value alone.

**Best practice:** Every form field should have a persistent visible label
above or beside the control. The label must not vanish after selection.

**Fix:** Add a `<label>` element (or `<div>` with `id` tied to
`aria-labelledby`) above each combobox, e.g. **Particle**, **Material**,
**Program**. The current `aria-label` on `<Combobox.Trigger>` covers
accessibility but not visual clarity.

---

### 2. No checkmark / highlight on the currently selected item when re-opening

**Status:** ✅ FIXED (2026-04-25)

**Issue:** Opening a combobox after a selection shows the list in its
default state. There is no visual indicator (checkmark, bold text, or
highlighted background) next to the currently selected item. The user
cannot quickly verify what is selected without closing the dropdown and
reading the trigger.

**Best practice:** Standard combobox pattern (Material UI, Radix, Headless
UI) always highlights or marks the selected item on open.

**Fix:** Inside `<Combobox.Item>`, compare `item.entity.id === selectedId`
and render a checkmark SVG (similar to the existing chevron) on the right
when true. Bits UI exposes `data-selected` on the item — that attribute
can drive a Tailwind class instead of manual comparison.

**Implemented:** Checkmark already rendered at lines 248-264 in `entity-combobox.svelte`.
Added test `§7.2: shows checkmark on selected item when combobox re-opens` to verify
the SVG with `aria-label="Selected"` appears for the selected item.

---

### 3. Search box does not hint at searchable fields

**Status:** ✅ FIXED (2026-04-25)

**Issue:** The search input placeholder is the generic `"Search..."`. The
combobox supports searching by Z number (`z=6`), mass number (`a=12`),
chemical symbol, and aliases. Physicists habitually type atomic numbers
rather than names, but nothing in the UI reveals this capability.

**Fix:** Use a more descriptive placeholder: `"Name, symbol, Z…"` for
Particle and `"Name or ID…"` for Material. The Program box can keep
`"Search…"` since name is the natural search key there.

**Implemented:** Added `getSearchPlaceholder()` function at lines 46-50 in
`entity-combobox.svelte` that returns context-aware placeholders based on
the `label` prop. Added three tests verifying correct placeholder for
Particle/Material/Program comboboxes.

---

### 4. No match count inside the dropdown

**Status:** ✅ FIXED (2026-04-24)

**Issue:** The `entity-panel` (full panel mode) shows `"X of Y available"`.
The combobox shows nothing equivalent. After filtering, there is no
feedback on how many items matched — the user just sees the list.

**Fix:** Show a small count below the search input: `"12 results"` or
`"3 of 240"` when a search term is active. Hide it when the field is empty
to avoid clutter.

**Implemented:** Added `$derived` `totalMatchCount` to `entity-combobox.svelte` 
that counts filtered items. Displays `"{n} result(s)"` below search input 
when search term is active. Test: `§7.4: match count hides when no search term`.

---

### 5. Permanently disabled "Electron" clutters the list

**Issue:** Electron (ID 1001) is always greyed out with the description
"Not available in libdedx v1.4.0". It cannot be selected under any
circumstance. Showing a permanently disabled item trains users to expect
it will eventually be enabled, and its presence in the list is noise.

**Options (pick one):**
- Move it to the very bottom of the list, visually separated, with a
  tooltip explaining the limitation.
- Hide it entirely and add a tooltip on the "Particle" label: "Electrons
  not yet supported."

The current behaviour — middle of the list, opacity-50, no tooltip — is
the worst of both worlds.

---

### 6. "Clear" button placement is awkward

**Status:** ✅ FIXED (2026-04-25)

**Issue:** The "Clear" link appears below the combobox trigger on a
separate line (`mt-1 text-right`). In the three-column grid this adds
vertical height to only some columns (Material and Particle have clear
buttons; Program does not), creating uneven row heights.

**Fix:** Place the clear action inline with the trigger — an `×` icon
button on the right side of the trigger, replacing the chevron when a
value is selected. This is the standard "clearable select" pattern and
eliminates the extra row.

**Implemented:** Replaced standalone Clear link with inline × button using
SVG inside `Combobox.Trigger`. Button renders when `selectedId !== null`
and `onClear` prop exists, calls `e.stopPropagation()` to prevent dropdown
open. Added 3 tests: absent when no selection, present when selected,
clicking calls handler without opening dropdown.

---

### 7. "Reset all" is easy to trigger accidentally

**Status:** ✅ FIXED (2026-04-25)

**Issue:** "Reset all" is a plain text button, centered below the three
comboboxes, with no confirmation step. A misclick resets all three
selections to defaults. The action is irreversible within a session if
the user had uncommon selections.

**Fix:**
- Either require confirmation for Reset all ("Are you sure?"), or
- Rename to "Restore defaults" to signal it is a soft reset to known
  values (Proton / Water / Auto-select), not a data-loss action.
- Alternatively, consider moving it to a less prominent location (e.g.,
  a small icon button with tooltip) so it is not on the critical path.

**Implemented:** Renamed button to "Restore defaults", right-aligned with
`lg:text-right`, reduced styling to `text-sm text-muted-foreground`, added
`title="Restores Proton / Water / Auto-select"`. Added 3 tests: button text,
tooltip present, styling classes correct.

---

### 8. Dropdown max-height is fixed at 300 px with no scroll indicator

**Status:** ✅ FIXED (2026-04-24)

**Issue:** The dropdown list is `max-h-[300px]` with `overflow-y-auto`.
When the list overflows there is no visual hint that scrolling is
possible (no fading edge, no scrollbar until the user hovers).

**Fix:** Add a subtle gradient fade at the bottom of the list to signal
scrollability — a common technique:
```css
mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent 100%);
```

**Implemented:** Added `mask-image` gradient style to dropdown scroll container 
in `entity-combobox.svelte`. Test: `§7.5: scrollable dropdown has gradient mask hint`.

---

### 9. Program selector is jargon-heavy with no explanation

**Issue:** The program list contains entries like "PSTAR — Proton stopping
powers", "ICRU 73 — Stopping powers for ions", "MSTAR". A physicist will
know these, but a student will not. "Auto-select" resolves this for the
default case but if a user opens the dropdown to understand their options,
there is no help text, link, or tooltip explaining each program.

**Fix:** The spec already has `getProgramDescription()` integrated for
labels. Consider adding an info icon (ⓘ) that opens a small popover/
tooltip with a 1-sentence description when no description is already
visible in the trigger. For the combobox the description is shown in
the item list — but it disappears once closed.

---

### 10. Panel mode label inconsistency

**Issue:** Full panel mode uses numbered labels — "① Particle",
"② Target Material", "③ Program" — while compact mode uses plain
"Particle", "Material", "Program". The terminology also differs:
"Material" (compact) vs. "Target Material" (panel).

**Fix:** Standardise. If the numbered approach aids discoverability in
the panel, apply consistent naming across both modes. If not, drop the
numbers and align on the same field names.

---

### 11. Panel mode: "X of Y available" does not reflect current search

**Status:** ✅ FIXED (2026-04-24)

**Issue:** In `entity-panel.svelte`, `totalAvailable` is computed as
`items.filter(i => i.available).length` — a static count that never
changes when the user types in the search box. After filtering to
e.g. 3 results, the counter still says "18 of 240 available".

**Fix:** Compute the available count from `filteredItems` instead:
```ts
const filteredAvailable = $derived(
  filteredItems.flatMap(g => g.items).filter(i => i.available).length
);
const filteredTotal = $derived(filteredItems.flatMap(g => g.items).length);
```
Display as `"3 of 18 available (filtered)"` or just hide the counter
when a search term is active.

**Implemented:** Replaced `totalAvailable` with `filteredAvailable` and 
`filteredTotal` derived states in `entity-panel.svelte`. Counter now shows 
filtered results (e.g., "1 of 1 available" when searching for "Hydrogen"). 
Tests: 3 new tests in `entity-panel.test.ts` verify count updates when 
searching, shows correct filtered matches, and resets when cleared.

---

### 12. Panel mode: keyboard navigation is absent

**Issue:** The panel uses `role="listbox"` / `role="option"`, which
implies keyboard navigation with arrow keys per the ARIA spec. But no
`onkeydown` handler is implemented. Keyboard users expecting to navigate
the list with arrows will find the interaction broken.

**Fix:** Implement arrow-key navigation within the `role="listbox"` container,
or change the ARIA role to `role="list"` / `role="listitem"` to avoid
making a promise the implementation cannot keep.

---

## Energy Input

### 13. Spec gap: the unified table is not implemented

**Issue:** The spec (`calculator.md` v5) describes a **unified input/result
table** with five columns per row: Typed Value | → MeV/nucl | Unit
(per-row dropdown) | Stopping Power | CSDA Range. The current
implementation is a plain list of text inputs with no result columns
and no per-row unit dropdown. The "per-row unit" is inferred from the
suffix the user types, but there is no dedicated column control.

This is the most significant gap: the energy input UI is an incomplete
component, not a minor style issue.

**Fix:** This is tracked in the stage plan. The table layout needs to be
built before the calculator is usable.

---

### 14. State is not exposed to the parent

**Status:** ✅ FIXED (2026-04-25)

**Issue:** `energy-input.svelte` calls `createEnergyInputState()` internally.
The parent (Calculator page) cannot access `getParsedEnergies()` or react
to row changes. The component is self-contained in a way that breaks the
dataflow needed for calculations.

**Fix:** Accept `state: EnergyInputState` as a prop (or a `bind:` for
the rows), consistent with how `EntitySelectionState` is passed to
`entity-selection-comboboxes.svelte`. Alternatively expose an
`onchange` callback.

**Implemented:** Moved state creation from `energy-input.svelte` to
`calculator/+page.svelte`. Component now accepts `state: EnergyInputState`
via `$props()`. Parent can call `state.getParsedEnergies()`. Tests updated
to pass state as prop.

---

### 15. Parsed value display is redundant for the common case

**Issue:** The "→ value unit" snippet fires for every row, including
rows where no conversion is needed. If the user types `100` and the
master unit is MeV, the display shows `→ 100 MeV` — identical
information echoed back. This is visual noise.

**Fix:** Only show the parsed/converted display when the row's unit
**differs** from the master unit — i.e. when `parsed.unit !== null`
and `parsed.unit !== masterUnit`. When the value is already in the
master unit, omit the arrow entirely.

---

### 16. `placeholder` is set to `row.text` — a bug

**Status:** ✅ FIXED (2026-04-25)

**Issue:** In `energy-input.svelte:117`:
```svelte
placeholder={row.text || ""}
```
HTML placeholder text is shown only when the input is empty. Since
`value={row.text}` is also set, the placeholder can never be seen
(the value is always present or ""). The intent was probably
instructional text like `"e.g. 100 keV"`. Setting it to `row.text`
is a no-op that adds confusion in the code.

**Implemented:** Changed to fixed instructional placeholder
`placeholder="e.g. 100 keV"`. Added test verifying placeholder text.

---

### 17. Error and parsed-value appear in the same horizontal slot

**Issue:** Error messages (`text-xs text-destructive`) and parsed
values (`→ value unit`) share the same horizontal row without fixed
column widths. When both appear simultaneously the row layout shifts,
and on narrow viewports text wraps unpredictably. The layout is unstable.

**Fix:** Reserve a fixed-width column for the "→ converted" display and
a fixed-width or full-width region for error messages (e.g. below the
input, not inline). Or adopt the table layout the spec requires, where
columns are fixed-width by definition.

---

### 18. "Per-row mode active" message is cryptic

**Status:** ✅ FIXED (2026-04-25)

**Issue:** When the master unit selector is disabled, the label
`"(per-row mode active)"` appears next to it. Most users — especially
students — will not understand what "per-row mode" means. The disabled
selector provides no affordance explaining why it is locked or how to
re-enable it.

**Fix:** Replace with actionable text: `"Mixed units in use — edit rows
to change"` or provide a small `×` reset button that strips all inline
unit suffixes and returns to master-unit mode.

**Implemented:** Replaced cryptic string `"(per-row mode active)"` with
`"Mixed units — edit rows to change"` at line 156 in `energy-input.svelte`.

---

### 19. "Add row" button is over-styled as primary action

**Status:** ✅ FIXED (2026-04-25)

**Issue:** The "Add row" button uses `bg-primary` (solid blue/branded
color), the highest visual weight in the design system. Adding a row
is a supporting action — the primary action is typing values. This
hierarchy mismatch draws the eye away from the inputs.

**Implemented:** Changed button styling from `bg-primary` to
`hover:bg-accent hover:text-accent-foreground` (secondary/outline style).
Added test verifying the button does not have `bg-primary` class.

---

### 20. Paste of multi-line text is not handled

**Status:** ✅ FIXED (2026-04-25)

**Issue:** The spec explicitly requires: "Paste support — pasting
multi-line text creates multiple rows." No `onpaste` handler exists
in `energy-input.svelte` or `energy-input.svelte.ts`.

**Implemented:** Added `handlePaste()` function to `energy-input.svelte` that
splits clipboard text on newlines, updates first row with first line, creates
new rows for subsequent lines. Added `onpaste` event handler and test
verifying multi-line paste creates correct number of rows with proper text.

---

### 21. Focus management uses `setTimeout` instead of `tick()`

**Issue:** In `handleKeydown`, adding a row and then focusing it uses:
```ts
state.addRow();
setTimeout(() => focusEnergyInput(index + 1), 0);
```
The rest of the codebase (e.g. `entity-combobox.svelte:66`) uses
`tick().then(...)` for post-DOM-update work. `setTimeout(fn, 0)` is
less reliable in Svelte 5's async scheduler.

**Fix:** Replace with:
```ts
state.addRow();
await tick();
focusEnergyInput(index + 1);
```

---

### 22. Focus helper relies on fragile `aria-label` query

**Issue:** `focusEnergyInput` finds rows via:
```ts
document.querySelector(`input[aria-label="Energy value ${index + 1}"]`)
```
If the label template changes (localisation, wording update), focus
breaks silently. It also assumes only one component instance per page.

**Fix:** Use `bind:this` refs stored in an array, or set `data-row-index`
attributes and query on that instead of aria-label.

---

## Cross-cutting Issues

### 23. Accessibility: no live region for selection feedback

**Issue:** When a user selects a particle or material, nothing is
announced to screen readers outside the combobox itself. A user
relying on a screen reader knows the combobox closed, but does not
get confirmation that the calculated data will now update.

**Fix:** Add an `aria-live="polite"` region on the Calculator page that
announces "Particle changed to Proton. Material: Water. Program:
Auto-select → PSTAR. Ready to calculate." after each selection.

---

### 24. Mobile: three-column combobox grid stacks to single column

**Issue:** On mobile (< `lg` breakpoint), the three comboboxes stack
vertically. Each combobox then spans full width — reasonable. But the
"Reset all" link is `lg:col-span-3` on desktop and `w-full` on mobile,
which is fine. However, the Program combobox dropdown may overflow
screen width on very narrow viewports (the dropdown uses `w-full` on
the containing div, which should handle this, but depends on the
parent container not having `overflow-hidden`).

**Fix:** Verify on 375 px viewport that no dropdown overflows. If it
does, add `max-w-[calc(100vw-2rem)]` to the dropdown container.

---

## Priority Summary

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 13 | Unified table not implemented | Critical | Large |
| 14 | Energy state not exposed to parent | Critical | Small |
| 1 | No visible field labels on comboboxes | High | Small |
| 2 | No selected-item indicator on re-open | High | Small |
| 20 | Paste of multi-line text unhandled | High | Small |
| 6 | "Clear" button placement awkward | Medium | Small |
| 7 | "Reset all" easy to trigger accidentally | Medium | Small |
| 16 | Placeholder set to `row.text` (bug) | Medium | Trivial |
| 18 | "Per-row mode" label cryptic | Medium | Small |
| 19 | "Add row" over-styled as primary action | Medium | Trivial |
| 3 | Search box gives no hint of searchable fields | Medium | Trivial |
| 5 | Electron always visible but permanently disabled | Medium | Small |
| 15 | Redundant parsed-value display | Low | Small |
| 11 | Available count ignores search filter (panel) | Low | Small |
| 12 | Panel listbox: keyboard nav not implemented | Low | Medium |
| 4 | No match count in combobox dropdown | Low | Small |
| 8 | Dropdown scroll not signalled visually | Low | Trivial |
| 10 | Label inconsistency panel vs. compact mode | Low | Trivial |
| 17 | Error + parsed value share unstable layout slot | Low | Medium |
| 21 | `setTimeout` instead of `tick()` for focus | Low | Trivial |
| 22 | Focus helper uses fragile `aria-label` query | Low | Small |
| 9 | Program list jargon-heavy, no in-line help | Low | Medium |
| 23 | No live region for selection feedback | Low | Medium |
| 24 | Mobile dropdown overflow risk | Low | Small |
