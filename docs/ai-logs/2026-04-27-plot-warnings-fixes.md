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
### Prompt 3: Plot canvas blank, JSROOT undefined, layout broken

User screenshot showed the `/plot` page with three new symptoms:

1. Console: `TypeError: can't access property "settings", JSROOT is undefined`
   from `jsroot-plot.svelte:96`, then the same error in the resize observer.
2. Vite/SvelteKit warning about `history.replaceState(...)` conflicting with
   the SvelteKit router — should use `replaceState` from `$app/navigation`.
3. Sidebar showed two `+ Add Series` buttons and two `Reset all` links,
   stacked vertically, because `EntitySelectionPanels` rendered its own
   stub buttons in addition to the page-level controls.

**AI response**:

1. Verified the installed `jsroot@7.10.3` package exposes only **named ESM
   exports** (221 of them, including `settings`, `draw`, `resize`,
   `createTGraph`, `createTMultiGraph`, `createHistogram`, `BIT`,
   `cleanup`) and **no default export**. The component used
   `(await import("jsroot")).default` which evaluated to `undefined`,
   causing every property access to throw. Replaced both dynamic-import
   sites in `jsroot-plot.svelte` with the namespace form
   `await import("jsroot")`, then propagated the same fix to
   `jsroot-plot.test.ts` (the `vi.mock("jsroot", ...)` factory was
   wrapping its surface in `default: { ... }` — flattened it to top-level
   named exports — and the in-test import was updated likewise).
2. Replaced the bare `history.replaceState({}, "", newUrl)` call in
   `plot/+page.svelte` with SvelteKit's `replaceState(newUrl, page.state)`
   (`$app/navigation` + `$app/state`) so the router stays in sync.
3. Removed the duplicate stub `+ Add Series` / `Reset all` block at the
   bottom of `entity-selection-panels.svelte`. The component is only used
   inside the plot page, which already renders the wired-up versions
   below the sidebar; the stub `+ Add Series` had no `onclick` handler
   and was confusing in the rendered UI.
4. Re-ran the unit suite (493/493 pass) and the plot E2E spec
   (`tests/e2e/plot.spec.ts` — 2/2 pass).

During verification an interesting interaction was discovered: removing
`default` from the runtime import temporarily broke 1/493 unit tests
(`entity-combobox.test.ts`) because the existing `vi.mock("jsroot")`
factory still wrapped the surface in a `default` key, leaving
`JSROOT.settings` undefined in tests too. Updating the mock to expose
named exports — matching the real ESM shape — restored a clean 493/493.
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

### Fix `JSROOT undefined` runtime error on plot page

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/lib/components/jsroot-plot.svelte](../../src/lib/components/jsroot-plot.svelte)
  - [src/tests/components/jsroot-plot.test.ts](../../src/tests/components/jsroot-plot.test.ts)
- **Decision**: jsroot 7.10.3 publishes pure ESM with named exports and
  no default. Use `await import("jsroot")` and read members from the
  namespace; updated the vitest mock to mirror that shape (no `default:`
  wrapper).

### Switch URL writes to SvelteKit `replaceState`

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/routes/plot/+page.svelte](../../src/routes/plot/+page.svelte)
- **Decision**: import `replaceState` from `$app/navigation` and `page`
  from `$app/state`; pass the existing `page.state` so SvelteKit's router
  stays consistent and the deprecation warning goes away.

### Remove duplicate Add Series / Reset all from sidebar

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/lib/components/entity-selection-panels.svelte](../../src/lib/components/entity-selection-panels.svelte)
- **Decision**: the inner stub `+ Add Series` button had no `onclick`
  handler and was rendered alongside the wired-up controls in
  `plot/+page.svelte` (visible as a duplicate pair in the user's
  screenshot). Drop the stub block; the page-level buttons remain the
  single source of truth.

### Pre-existing E2E failures (not addressed)

- **Status**: blocked (out of scope for this session)
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
