# 2026-04-27 — Plot page Svelte warnings/errors fix

## Session Narrative

### Prompt 1: Investigate runtime/compile warnings & errors and run E2E

User reported:

- Vite plugin warnings on `src/lib/components/entity-panel.svelte:137` —
  `a11y_click_events_have_key_events` and `a11y_no_noninteractive_element_interactions`.
- Browser runtime error on `/plot`: `each_key_volatile` for the X/Y axis-scale
  segmented controls in `src/routes/plot/+page.svelte` — keyed each block whose
  key tuple `[label, isLog]` produced a fresh array every render, so Svelte
  rejected it as non-idempotent.

**AI response**:

1. Located both `#each` blocks (lines ~250 and ~268) and replaced the tuple
   key `([label, isLog])` with the stable string key `(label)`. The label
   alone (`"Log"` / `"Lin"`) uniquely identifies each radio in its group, so
   no information is lost.
2. Rewrote the entity-panel list item: replaced the clickable `<div role="listitem">`
   with `<button type="button" disabled aria-pressed>`. A `<button>` cannot
   carry `role="listitem"` (Svelte a11y rule), so the wrapping `role="list"`
   was also dropped — the panel's `aria-label` and the section headings
   (already styled as group labels) preserve the semantics. This eliminates
   both a11y warnings without re-introducing a click-without-keyboard
   handler.
3. Verified no new compile errors via `get_errors`.
4. Ran `pnpm lint` (47 pre-existing errors in unrelated files, no new ones)
   and `pnpm test -- --run` (493/493 unit tests passing).
5. Ran `pnpm exec playwright test` with a 300 s wall-clock cap. 58 passed,
   9 failed, 4 skipped.

### Prompt 2: Use timeouts so E2E doesn't hang

**AI response**: re-ran with `timeout 300 pnpm exec playwright test
--reporter=line | tail -120`; suite finished in 38 s. To rule out
regressions from the two edits, stashed them and re-ran two representative
failing specs (`particle-unit-switching.spec.ts:255` and
`entity-selection.spec.ts:23`) on clean HEAD — both still fail. The 9 E2E
failures are therefore pre-existing on the `qwen/stage-5-jsroot-plot`
branch (Add-row button never rendered, default particle is hydrogen not
proton, alpha-particle option not surfaced from combobox), not caused by
this session's changes.

## Tasks

### Fix `each_key_volatile` runtime error on plot page

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/routes/plot/+page.svelte](../../src/routes/plot/+page.svelte#L250)
  - [src/routes/plot/+page.svelte](../../src/routes/plot/+page.svelte#L268)
- **Decision**: use `(label)` instead of `([label, isLog])` — the second
  tuple element is always derivable from the first, so a scalar key is
  both stable and unambiguous.

### Fix a11y warnings in entity-panel list items

- **Status**: completed
- **Stage**: 4.6 (entity selection UX)
- **Files changed**:
  - [src/lib/components/entity-panel.svelte](../../src/lib/components/entity-panel.svelte#L119)
- **Decision**: convert clickable `<div>` to `<button type="button">` and
  drop `role="list"`/`role="listitem"`. A real button gives free keyboard
  activation (Enter/Space) and focus management; `aria-pressed` exposes
  the selected state. The Svelte rule "button cannot have role listitem"
  forces removing the list ARIA scaffolding, which is acceptable because
  the panel root still carries `aria-label={label}`.

### Pre-existing E2E failures (not addressed)

- **Status**: blocked (out of scope for this session)
- **Stage**: 4.x / 5.x
- **Files changed**: none
- **Issue**: 9 Playwright tests fail on the current branch HEAD before any
  of this session's edits:
  - `tests/e2e/entity-selection.spec.ts:23,59` — default particle renders
    as "Hydrogen (H)" instead of matching `/proton/i`; "Reset all" link
    behaviour broken.
  - `tests/e2e/particle-unit-switching.spec.ts:64,77,89,107,146,255` —
    `selectParticle("alpha")` cannot find the option, and the explicit
    "+ Add row" button is not rendered (test expects it from PR #379).
  - `tests/e2e/complex-interactions.spec.ts:306` — same
    `getByRole("option", { name: /alpha particle/i })` timeout.
  Reproduced on clean HEAD (after `git stash`-ing this session's edits),
  so these are existing regressions on `qwen/stage-5-jsroot-plot`. Should
  be fixed in a dedicated session that revisits the entity-combobox
  default selection and the Add-row UI.
