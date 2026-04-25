# 2026-04-25 — UX Review Fixes (Entity Selector & Energy Input) — Full Session

**Model:** Qwen3.5-122B-A10B via opencode  
**Branch:** `fix/ux-review-entity-energy`  
**Session ID:** ses_23ca375a0ffeFVs0r1ocyZIjOW  

---

## Session Narrative

### Prompt 1: implement UX review issues one by one with commits
**AI response:** Worked through all open issues from
`docs/ux-review-entity-selector-energy-input.md` in priority order, one commit
per issue. Issues 4, 8, 11 skipped (already marked ✅ FIXED on 2026-04-24).

### Prompt 2: continue, check also e2e tests
**AI response:** Ran Playwright e2e suite after unit tests; fixed one e2e test
that expected old "Reset all" button text (now "Restore defaults" per Issue 7).
Final state: 340 unit tests + 36 e2e tests passing, 2 e2e skipped.

---

## Tasks

### Issue 14 — Energy state not exposed to parent
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`, `src/routes/calculator/+page.svelte`
- **Decision:** Renamed prop to `inputState` (not `state`) to avoid collision with Svelte 5 `$state` rune keyword
- **Commit:** `fix: expose energy input state to parent via prop`

### Issue 1 — No visible field labels on comboboxes
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-selection-comboboxes.svelte`
- **Decision:** Labels were already present in the DOM from a prior implementation; docs synced to reflect this
- **Commit:** (docs sync only)

### Issue 2 — No selected-item indicator when re-opening combobox
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-combobox.svelte`
- **Commit:** `fix: show checkmark on selected item when combobox re-opens`

### Issue 20 — Paste of multi-line text not handled
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`, `src/lib/state/energy-input.svelte.ts`
- **Commit:** `fix: handle paste of multi-line text into energy input`

### Issue 16 — Placeholder set to `row.text` (bug)
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`
- **Commit:** `fix: use instructional placeholder text in energy input rows`

### Issue 19 — "Add row" button over-styled as primary action
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`
- **Commit:** `fix: style add-row button as secondary action`

### Issue 3 — Search box gives no hint of searchable fields
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-combobox.svelte`
- **Commit:** `fix: descriptive search placeholder per entity combobox type`

### Issue 6 — "Clear" button placement awkward
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-combobox.svelte`
- **Commit:** `fix: move clear button inline into combobox trigger`

### Issue 7 — "Reset all" easy to trigger accidentally
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-selection-comboboxes.svelte`
- **Commit:** `fix: rename and de-emphasise "Reset all" → "Restore defaults"`
- **Issue:** Required follow-up e2e test fix (test expected old button text)

### Issue 18 — "Per-row mode active" label is cryptic
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`
- **Commit:** `fix: replace cryptic per-row mode label with actionable text`

### Issue 5 — Electron always visible but permanently disabled
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-combobox.svelte`, `src/lib/components/entity-panel.svelte`
- **Commit:** `fix: move disabled Electron to bottom of particle list with tooltip`

### Issue 15 — Redundant parsed-value display
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`
- **Commit:** `fix: hide redundant parsed-value display when unit matches master`

### Issue 21 — `setTimeout` instead of `tick()` for focus
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`
- **Commit:** `fix: replace setTimeout with tick() for post-addRow focus`

### Issue 22 — Focus helper uses fragile `aria-label` query
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`
- **Decision:** Used `HTMLInputElement[]` array for `bind:this` refs (simpler than Map); renamed prop to avoid `$state` keyword conflict
- **Commit:** `fix: use bind:this refs array instead of aria-label query for focus`

### Issue 12 — Panel listbox: keyboard navigation absent
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-panel.svelte`
- **Decision:** Chose Option A (change ARIA role) — changed `role="listbox"` → `role="list"` and `role="option"` → `role="listitem"` to remove broken ARIA promise rather than implement full keyboard nav
- **Commit:** `fix: align panel ARIA role with actual keyboard behaviour`

### Issue 17 — Error and parsed-value share unstable layout slot
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`
- **Decision:** `min-h-[1.25rem]` wrapper with `{:else}` conditional (error OR parsed value, not both simultaneously)
- **Commit:** `fix: stabilise energy row height to prevent layout shift`

### Issue 24 — Mobile dropdown overflow risk
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-combobox.svelte`
- **Commit:** `fix: cap combobox dropdown width on narrow viewports`

### Issue 10 — Label inconsistency: panel vs. compact mode
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-selection-panels.svelte`, `src/lib/components/entity-selection-comboboxes.svelte`
- **Commit:** `fix: standardise field names across panel and compact modes`

### Issue 9 — Program selector jargon-heavy with no explanation
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-combobox.svelte`
- **Commit:** `fix: show program descriptions in combobox trigger`

### Issues 4, 8, 11 — skipped
- Already marked ✅ FIXED (2026-04-24) before this session

### Issue 23 — No live region for selection feedback
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/state/entity-selection.svelte.ts` (added `selectionSummary` getter), new `src/lib/components/selection-live-region.svelte`, `src/routes/calculator/+page.svelte`
- **Commit:** `fix: add aria-live region for selection feedback announcements`

### Issue 13 — Unified input/result table not implemented
- **Status:** completed (WASM calculation deferred)
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`, `src/tests/components/energy-input.test.ts`
- **Decision:** Used native HTML `<select>` instead of Bits UI Select for per-row unit dropdown to avoid import issues. Table has all 5 columns; Stopping Power and CSDA Range show `—` placeholder until WASM integration (later stage).
- **Commit:** `feat: add unit column and converted-value column to energy table`
- **Issue:** WASM calculation integration (populating Stopping Power and CSDA Range) deferred to a later stage

---

## Summary

- **Issues completed:** 21 of 24 (Issues 4, 8, 11 were already fixed prior to this session)
- **Unit tests:** 340 passing (18 test files, 0 regressions)
- **E2E tests:** 36 passing, 2 skipped
- **Branch:** `fix/ux-review-entity-energy`
- **Model:** Qwen3.5-122B-A10B via opencode
- **Pre-existing lint errors:** 34 problems / 28 errors in unrelated files — not introduced by this session
