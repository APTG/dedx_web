# 2026-05-29 — Compound editor: mobile 2-step sheet & virtual-keyboard handling

## Session Narrative

### Prompt 1: Implement issue #647 (#606-4)

**AI response**: Built the phone-only compound-editor experience described in
the issue. The desktop modal in `compound-editor-modal.svelte` is unchanged;
when the viewport matches `(max-width: 640px) and (pointer: coarse)` the editor
now renders a dedicated full-screen sheet instead.

Architecture decision: all form state stays in the parent
(`compound-editor-modal.svelte`). It exposes a single `EditorController` object
(getters that track the parent runes + methods that mutate them) handed to the
mobile sub-components. This keeps step transitions non-destructive — switching
between Step 1 / Step 2 / Picker never re-initialises inputs — without
duplicating the validation, derivation, or merge logic that already lives in
the parent.

New pieces:

- `mobile-sheet.svelte` — 2-bar progress header, sliding Step 1 (Basics) /
  Step 2 (Composition) track (180ms, disabled under
  `prefers-reduced-motion`), sticky footers with safe-area padding, Quick Start
  on Step 2 when empty, compressed duplicate banner + edit-duplicate prompt,
  Z-sorted rows with long-press → action sheet, and `+ Add element`.
- `mobile-picker-overlay.svelte` — full-screen periodic-table picker (reuses
  `element-picker.svelte`) with autofocus search + helper line, pending
  selection, and `[Cancel] [Add →]` / `[Change to X]` footer.
- `row-action-sheet.svelte` — bottom action sheet (Change element… / Remove
  from compound / Cancel), destructive action default-focused.
- `visual-viewport.ts` (+ unit test) — `keyboardOffset()` and
  `useVisualViewport()` mirror the visual-viewport gap into `--vkb-offset` for
  engines without `interactive-widget=resizes-content`.
- `app.html` — viewport meta gains `interactive-widget=resizes-content`.

`element-picker.svelte` gained an optional `highlightZ` prop so the mobile Add
flow can highlight the pending tile regardless of ADD/EDIT mode.

The picker-selection logic in the parent was refactored into a parameterised
`applyElementSelection(z, mode, index)` so desktop dialog and mobile overlay
share one code path; an `addElementBySymbol` helper was extracted too.

## Tasks

### Mobile compound editor (#647 / #606-4)

- **Status**: completed
- **Stage**: Stage 6.10 (custom compounds)
- **Files changed**:
  - `src/app.html`
  - `src/lib/utils/visual-viewport.ts` (new)
  - `src/tests/unit/visual-viewport.test.ts` (new)
  - `src/lib/components/element-picker.svelte`
  - `src/lib/components/compound-editor-modal.svelte`
  - `src/lib/components/compound-editor/types.ts` (new)
  - `src/lib/components/compound-editor/mobile-sheet.svelte` (new)
  - `src/lib/components/compound-editor/mobile-picker-overlay.svelte` (new)
  - `src/lib/components/compound-editor/row-action-sheet.svelte` (new)
  - `tests/e2e/compound-editor-mobile.spec.ts` (new)
- **Decision**: shared `EditorController` controller object over prop-drilling
  bindables — keeps a single source of truth for validation/merge logic and
  guarantees non-destructive step switching.
- **Decision**: `longPressFired` guard suppresses the synthetic click that
  follows a long-press on the element tile, so long-press opens the action
  sheet rather than the EDIT picker.
- **Decision**: the sheet activates on `(max-width: 640px) and
  (pointer: coarse)`; jsdom (no `matchMedia`) keeps it `false`, so the existing
  desktop component tests still exercise the modal.
- **Issue**: keyboard test matrix is simulator-only here — the
  `interactive-widget` + `visualViewport` paths were verified against the spec
  and unit-tested via `keyboardOffset`, but real iPhone 14 / Pixel 7 device
  verification is left for manual QA. The E2E mobile spec is tagged
  `@responsive` and self-skips off coarse-pointer viewports; CI runs it under
  the `mobile-chrome` (Pixel 5) project.
