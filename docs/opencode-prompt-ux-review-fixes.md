You are working on the dEdx Web project — a SvelteKit + Svelte 5 (runes only)
+ TypeScript + Tailwind CSS v4 physics calculator.

## Start-of-session checklist (do this before any code changes)

1. Read `AGENTS.md` (opencode entry point) and
   `.github/copilot-instructions.md` (stack rules, Svelte 5 rules, logging
   conventions).
2. Read `CHANGELOG-AI.md` (top 5 rows) to understand recent history.
3. Read `docs/ux-review-entity-selector-energy-input.md` — this is your task
   list for the session.
4. Run `pnpm test` to confirm the baseline test count before you touch
   anything. Record this number.

---

## Your mission

Implement the open UX issues from `docs/ux-review-entity-selector-energy-input.md`,
**one issue at a time**, in the priority order listed below. After each issue
is fully done, commit and then move to the next one. Do not batch multiple
issues into one commit.

Skip issues already marked **✅ FIXED** in the review doc (issues 4, 8, 11).

---

## Issue implementation order (high → low priority)

Work through the list in this exact order. Each item has its issue number
from the review doc, a title, and implementation guidance.

---

### Issue 14 — Energy state not exposed to parent
**Files:** `src/lib/components/energy-input.svelte`,
`src/lib/state/energy-input.svelte.ts`, `src/routes/calculator/+page.svelte`
**What to do:** `energy-input.svelte` currently calls
`createEnergyInputState()` internally. Move state creation to the parent
(`+page.svelte`) and pass it in as a prop — `state: EnergyInputState` —
exactly as `EntitySelectionState` is passed to
`entity-selection-comboboxes.svelte`. The parent must now be able to call
`state.getParsedEnergies()`.
**Svelte 5 prop syntax:** use `$props()` to receive the state object; never
use `export let`.
**Tests:** add or update a unit test confirming the component renders when
state is passed as a prop and that the parent can access parsed energies.
**Commit:** `fix: expose energy input state to parent via prop`

---

### Issue 1 — No visible field labels on comboboxes
**Files:** `src/lib/components/entity-selection-comboboxes.svelte`
**What to do:** Add a persistent visible `<label>` (or labelled `<div>`)
above each of the three combobox triggers: **Particle**, **Material**,
**Program**. The label must remain visible after selection — it must not be
the placeholder. Use `text-sm font-medium text-foreground` styling consistent
with the rest of the form. Wire `aria-labelledby` or `for`/`id` so the
combobox trigger is still accessible.
**Tests:** add a test asserting the label text is present in the DOM
regardless of whether a value is selected.
**Commit:** `fix: add persistent visible labels to entity comboboxes`

---

### Issue 2 — No selected-item indicator when re-opening combobox
**Files:** `src/lib/components/entity-combobox.svelte`
**What to do:** Inside `<Combobox.Item>`, check whether the item's
`entity.id` equals the currently selected entity's id. When it matches,
render a checkmark SVG icon on the right side of the item row. Bits UI
exposes `data-selected` on `<Combobox.Item>` — you can use that attribute
to drive a Tailwind conditional class instead of manual comparison if
preferred. The checkmark should be the same style as other icons in the
component (16×16, `currentColor`).
**Tests:** add a test confirming that after selecting an item and
re-opening, the selected item has the `data-selected` attribute (or the
checkmark element is present).
**Commit:** `fix: show checkmark on selected item when combobox re-opens`

---

### Issue 20 — Paste of multi-line text not handled
**Files:** `src/lib/components/energy-input.svelte`,
`src/lib/state/energy-input.svelte.ts`
**What to do:** Add an `onpaste` handler to each energy text input. When the
clipboard text contains newlines, split on `\n`, filter empty lines, and call
`updateRowText` (or the equivalent state method) for each line — creating new
rows as needed. The first line replaces the current row's text; subsequent
lines create new rows. After paste, focus the last populated row.
**Tests:** add a unit test simulating a paste event with three lines and
asserting three rows are created with correct text values.
**Commit:** `fix: handle paste of multi-line text into energy input`

---

### Issue 16 — Placeholder set to `row.text` (bug)
**Files:** `src/lib/components/energy-input.svelte`
**What to do:** Find the `placeholder={row.text || ""}` prop on the energy
text `<input>`. Replace with the fixed instructional string
`placeholder="e.g. 100 keV"`. This is a one-line fix.
**Tests:** update or add a test asserting the placeholder text is
`"e.g. 100 keV"` and is not the row value.
**Commit:** `fix: use instructional placeholder text in energy input rows`

---

### Issue 19 — "Add row" button over-styled as primary action
**Files:** `src/lib/components/energy-input.svelte`
**What to do:** Change the "Add row" button from `bg-primary` (solid filled)
to a ghost/outline variant. In shadcn-svelte the correct prop is
`variant="outline"` or `variant="ghost"` on `<Button>`. Pick whichever is
visually lighter. Do not change the button's text or behaviour.
**Tests:** add or update a snapshot/attribute test confirming the button does
not have a primary/filled class.
**Commit:** `fix: style add-row button as secondary action`

---

### Issue 3 — Search box gives no hint of searchable fields
**Files:** `src/lib/components/entity-combobox.svelte`
**What to do:** The search `<Combobox.Input>` currently uses a generic
`placeholder="Search..."`. Change it to be context-aware based on which
entity type the combobox is for:
- Particle combobox → `"Name, symbol, Z…"`
- Material combobox → `"Name or ID…"`
- Program combobox → keep `"Search…"` (name is the only key)

The combobox already receives an `entityType` or `label` prop — use that to
select the correct placeholder string. If no such prop exists, add a
`searchPlaceholder` prop with a sensible default.
**Tests:** add a test per combobox type asserting the correct placeholder
text is rendered.
**Commit:** `fix: descriptive search placeholder per entity combobox type`

---

### Issue 6 — "Clear" button placement awkward
**Files:** `src/lib/components/entity-combobox.svelte`
**What to do:** Remove the standalone "Clear" link that sits below the
trigger on a separate line. Replace it with an `×` icon button rendered
**inside** the trigger on the right side, visible only when a value is
selected (i.e. `selectedEntity !== null`). The `×` button should call the
existing clear handler and stop propagation so it does not open the dropdown.
Use a 16×16 `X` icon from lucide-svelte. When nothing is selected, the
chevron icon should be shown as before.
**Tests:** assert that (a) the clear button is absent when nothing is
selected, and (b) clicking it fires the clear handler without opening the
dropdown.
**Commit:** `fix: move clear button inline into combobox trigger`

---

### Issue 7 — "Reset all" easy to trigger accidentally
**Files:** `src/lib/components/entity-selection-comboboxes.svelte`
**What to do:** Rename the button label from "Reset all" to
**"Restore defaults"** to signal it resets to known defaults (Proton / Water
/ Auto-select), not destructive data loss. Additionally move it to a less
prominent visual position: right-align it, reduce it to `text-sm` with
`variant="ghost"`, and add a `title` tooltip attribute reading
`"Restores Proton / Water / Auto-select"`.
**Tests:** assert the button text reads "Restore defaults" and carries the
tooltip.
**Commit:** `fix: rename and de-emphasise "Reset all" → "Restore defaults"`

---

### Issue 18 — "Per-row mode active" label is cryptic
**Files:** `src/lib/components/energy-input.svelte` (or
`energy-input.svelte.ts` if the label is generated there)
**What to do:** Replace the string `"(per-row mode active)"` with
`"Mixed units — edit rows to change"`. Do not change the disabled state
logic of the master unit selector — only the label text.
**Tests:** update the existing test (if any) that checks this label text, or
add one.
**Commit:** `fix: replace cryptic per-row mode label with actionable text`

---

### Issue 5 — Electron always visible but permanently disabled
**Files:** `src/lib/components/entity-combobox.svelte`,
`src/lib/components/entity-panel.svelte`
**What to do:** Move Electron (ID 1001) to the **bottom** of the particle
list, separated from the rest by a visual divider (`<Combobox.Separator />`
or an `<hr>`). Add a `title` tooltip on the disabled Electron item reading
`"Electrons not supported in libdedx v1.4.0"`. In panel mode apply the same
treatment. Do not hide it entirely — keep it discoverable as a future item.
**Tests:** assert Electron renders last in the list and has the tooltip
attribute.
**Commit:** `fix: move disabled Electron to bottom of particle list with tooltip`

---

### Issue 15 — Redundant parsed-value display
**Files:** `src/lib/components/energy-input.svelte`
**What to do:** The `→ value unit` conversion snippet currently renders for
every row. Only show it when the row's unit **differs** from the master unit
— i.e. when `parsed.unit !== null && parsed.unit !== masterUnit`. When the
value is already in the master unit, omit the arrow span entirely.
**Tests:** add tests for (a) row in master unit → no arrow rendered, and (b)
row with different unit suffix → arrow with converted value rendered.
**Commit:** `fix: hide redundant parsed-value display when unit matches master`

---

### Issue 10 — Label inconsistency: panel vs. compact mode
**Files:** `src/lib/components/entity-selection-panels.svelte`,
`src/lib/components/entity-selection-comboboxes.svelte`
**What to do:** Standardise the field names across both modes:
- Use **"Particle"**, **"Material"**, **"Program"** everywhere (drop "Target"
  from "Target Material").
- Keep the numbered circles (① ② ③) in panel mode as they aid
  discoverability; do not add them to compact mode.
- Result: both modes use the same base names; only panel mode has the circles.
**Tests:** assert label text in both components after the change.
**Commit:** `fix: standardise field names across panel and compact modes`

---

### Issue 21 — `setTimeout` instead of `tick()` for focus
**Files:** `src/lib/components/energy-input.svelte` (the `handleKeydown`
function)
**What to do:** Replace:
```ts
state.addRow();
setTimeout(() => focusEnergyInput(index + 1), 0);
```
with:
```ts
state.addRow();
await tick();
focusEnergyInput(index + 1);
```
Import `tick` from `'svelte'`. Make the enclosing handler `async`.
**Tests:** no new tests needed — this is a correctness fix. Verify existing
keyboard-nav tests still pass.
**Commit:** `fix: replace setTimeout with tick() for post-addRow focus`

---

### Issue 22 — Focus helper uses fragile `aria-label` query
**Files:** `src/lib/components/energy-input.svelte`
**What to do:** Replace the `document.querySelector(
'input[aria-label="Energy value ${index + 1}"]')` pattern with a
`bind:this` ref array. Declare `let inputRefs: HTMLInputElement[] = $state([])`.
In the `{#each rows}` block, bind each input: `bind:this={inputRefs[i]}`.
Update `focusEnergyInput(index)` to call `inputRefs[index]?.focus()`. Remove
the old querySelector.
**Tests:** existing focus tests should continue to pass; update any that
relied on the aria-label selector pattern.
**Commit:** `fix: use bind:this refs array instead of aria-label query for focus`

---

### Issue 12 — Panel listbox: keyboard navigation absent
**Files:** `src/lib/components/entity-panel.svelte`
**What to do:** The panel uses `role="listbox"` / `role="option"`, which
promises arrow-key navigation per ARIA. Two options — pick the simpler one:

**Option A (recommended — change the role):** Change `role="listbox"` to
`role="list"` and `role="option"` to `role="listitem"`. This removes the
broken ARIA promise without adding complex keyboard logic. Update any
accessibility tests accordingly.

**Option B (implement navigation):** Add an `onkeydown` handler on the
listbox container that moves a focused index with ArrowUp/ArrowDown, selects
with Enter, and closes with Escape.

Prefer Option A unless the spec explicitly requires listbox semantics.
**Tests:** assert the ARIA roles are consistent with the navigation behaviour.
**Commit:** `fix: align panel ARIA role with actual keyboard behaviour`

---

### Issue 17 — Error and parsed-value share unstable layout slot
**Files:** `src/lib/components/energy-input.svelte`
**What to do:** Give the per-row feedback region a fixed minimum height so
the row does not jump when error/parsed-value text appears or disappears.
Add `min-h-[1.25rem]` (20 px) to the container `<div>` that holds both the
error text and the parsed-value arrow. This prevents layout shift without
requiring a full table rewrite (which belongs to Issue 13).
**Tests:** no new tests needed — visual stability fix. Confirm existing tests
pass.
**Commit:** `fix: stabilise energy row height to prevent layout shift`

---

### Issue 24 — Mobile dropdown overflow risk
**Files:** `src/lib/components/entity-combobox.svelte`
**What to do:** Add `max-w-[calc(100vw-2rem)]` to the dropdown content
container (`<Combobox.Content>` or its wrapper `<div>`). This caps the
dropdown width on narrow viewports so it cannot overflow the screen edge.
Combine with `overflow-x-hidden` on the same element.
**Tests:** no new tests needed. Verify existing combobox render tests pass.
**Commit:** `fix: cap combobox dropdown width on narrow viewports`

---

### Issue 13 — Unified input/result table not implemented (LARGE)
**Files:** `src/lib/components/energy-input.svelte`,
`src/lib/state/energy-input.svelte.ts`,
`src/routes/calculator/+page.svelte`,
`docs/04-feature-specs/calculator.md`
**What to do:** This is the largest remaining item. The spec (`calculator.md`
v5) describes a **unified input/result table** with columns:
`Typed Value | → MeV/nucl | Unit (per-row dropdown) | Stopping Power | CSDA Range`.

Build it as a `<table>` (or CSS grid with `role="table"`) replacing the
current plain list of text inputs:
- Column 1: the existing text input (`<input>` bound to `row.text`)
- Column 2: converted value in MeV/nucl (from `getParsedEnergies()`)
- Column 3: per-row unit dropdown (shadcn-svelte `<Select>`) pre-filled from
  parsed unit, falling back to master unit
- Column 4 & 5: Stopping Power and CSDA Range — show `—` (em-dash) as
  placeholder until calculation is wired (that is a later stage)

Keep the existing state API unchanged — only the rendering layer changes.
The per-row unit dropdown should call `updateRowText` with the new unit
appended if the user changes it.

**Do this as a single focused commit. If the implementation is too large to
do cleanly in one pass, split it into two commits:**
1. `feat: add unit column and converted-value column to energy table`
2. `feat: add stopping-power and CSDA range placeholder columns`

---

## After every issue

1. Run `pnpm test` and confirm the test suite is green (same count or higher
   than baseline — no regressions).
2. Run `pnpm lint` — fix any lint errors before committing.
3. Commit with the exact message given for that issue (Conventional Commits
   format).
4. Update `docs/ux-review-entity-selector-energy-input.md` — mark the
   issue's **Status** line as `✅ FIXED (2026-04-25)` and add a one-sentence
   **Implemented:** note describing what was done.

---

## End-of-session AI logging (MANDATORY)

When all issues are done (or you have gone as far as you can):

1. **Prepend a new row** to the table in `CHANGELOG-AI.md`:
```
| 2026-04-25 | 5.3 | **Stage 5.3 UX Review Fixes — continued** (<Model name> via opencode): <one-line summary of what was fixed, how many tests, any blockers> | [log](docs/ai-logs/2026-04-25-ux-review-fixes.md) |
```
Replace `<Model name>` with your actual model identifier.

2. **Create `docs/ai-logs/2026-04-25-ux-review-fixes.md`** with this
structure:
```markdown
# 2026-04-25 — UX Review Fixes (Entity Selector & Energy Input)

## Session Narrative

### Prompt 1: implement UX review issues
**AI response**: <summary of what was done>

### Prompt N: ...

## Tasks

### Issue N — <title>
- **Status**: completed | partial | blocked
- **Stage**: 5.3
- **Files changed**: list
- **Decision**: any non-obvious choice
- **Issue**: anything unresolved
```

3. Add a line to `docs/ai-logs/README.md` listing the new log file.

4. Commit all log/doc changes together:
   `docs: add AI session log for 2026-04-25 UX review fixes`

---

## Constraints (enforce throughout)

- **Svelte 5 runes only** — never use `export let`, `$:`, `onMount`,
  `onDestroy`, or `createEventDispatcher`.
- **TypeScript strict** — no `any`, no type assertions without a comment
  explaining why.
- **No new dependencies** — use shadcn-svelte, Bits UI, lucide-svelte, and
  Tailwind CSS v4 only (all already installed).
- **No reformatting unrelated code** — touch only lines required by the fix.
- **Conventional Commits** — use the exact commit messages given above.
- The test suite must remain green after every single commit.
