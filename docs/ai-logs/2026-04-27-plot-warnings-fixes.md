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

### Prompt 4: Sidebar overlaps controls/plot, JSROOT cleanup race on navigation

User screenshot showed the `/plot` sidebar with Particle and Material
crammed side-by-side in a nested grid; from the user's viewpoint the
controls bar (`keV/µm`, `X: Log`, …) and plot canvas appeared to overlap
the Material and Program panels. Also, navigating Calculator → Plot →
Calculator → Plot reliably produced two JSROOT console messages:

```
pad drawing is not completed when cleanup is called   TPadPainter.mjs
failure, should not happen
```

**AI response**:

1. Composition: removed the inner `md:grid-cols-[1fr_2fr]` wrapper in
   `entity-selection-panels.svelte` so Particle, Material and Program now
   stack as three full-width rows in the sidebar, matching the
   single-column flex layout the page already uses for Add Series / Reset
   all. The component is only consumed by `plot/+page.svelte`, so this
   change is local.
2. JSROOT lifecycle: introduced a module-local `drawChain: Promise<unknown>`
   inside `jsroot-plot.svelte`. Each `$effect` run now (a) waits for the
   previous draw or teardown to settle before calling `JSROOT.draw`, and
   (b) on cleanup defers `painter.cleanup()` + `JSROOT.cleanup(el)` until
   the in-flight draw resolves. Removed the eager `JSROOT.cleanup(el)`
   call that used to run inside `drawPlot()` before each new draw — the
   serialized chain handles teardown. The resize observer also now keeps
   a local `disposed` flag so a late dynamic-import resolution doesn't
   call `resize` after the component is gone.
3. Re-ran unit suite (493/493) and plot E2E (`tests/e2e/plot.spec.ts` —
   2/2) — both clean.

The "grid-lines missing on first load" symptom the user observed is a
side-effect of `axisRanges` returning `DEFAULT_RANGES` (0.001…10000,
0.1…1000) until the first preview series resolves; once a material is
selected and the preview lands, `computeAxisRanges` produces real
log-rounded ranges and JSROOT redraws with grid lines. No code change
needed here — it self-heals as soon as the WASM call resolves, which is
exactly the user's observation.
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

### Stack entity panels vertically in sidebar

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/lib/components/entity-selection-panels.svelte](../../src/lib/components/entity-selection-panels.svelte)
- **Decision**: removed the nested `md:grid-cols-[1fr_2fr]` row wrapping
  Particle and Material. Within the plot sidebar (≈ 30% of viewport via
  `lg:grid-cols-[minmax(360px,3fr)_7fr]`) the 1/3+2/3 split squeezed
  Material into ~220 px while making the right edge of Material flirt
  with the start of the controls bar in the main column — visually
  reading as overlap. A clean three-row stack matches the rest of the
  sidebar and removes the perceived collision.

### Serialize JSROOT draw / cleanup across navigations

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/lib/components/jsroot-plot.svelte](../../src/lib/components/jsroot-plot.svelte)
- **Decision**: the previous `$effect` started `JSROOT.draw(el, ...)` and
  on dependency change immediately called `painter.cleanup()`/`JSROOT.cleanup(el)`,
  even if the previous draw was still in flight (which is common when the
  user navigates Calculator → Plot → Calculator → Plot before the first
  draw resolves). JSROOT then logs `pad drawing is not completed when
  cleanup is called` and `failure, should not happen`. Fixed by chaining
  every draw and every teardown onto a module-local `drawChain` so that
  draw and cleanup never overlap on the same element. Also removed the
  pre-emptive `JSROOT.cleanup(el)` from inside `drawPlot()` (the chained
  teardown now owns that), and made the resize observer guard against a
  late `import("jsroot")` resolution after disposal.

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

---

## Round 5 — Plot sidebar layout & calculator-style naming

### Prompt 5: Program scrolls below the fold; align with calculator UX

User reported that on a large screen the Program panel sits so far down
that the whole page must be scrolled to reach it. Asked for a denser
sidebar layout and to **adopt the calculator's polished particle/material
patterns**: the "Common particles" / "Ions" split, the lowercase
`proton` / `alpha particle` / `electron` labels, and material labels
without the leading numeric ID. Also: hide the electron from
"first-glance" prominence, fit Particle and Material side-by-side, and
use the same particle naming on the plot (series legends) — even if it
means amending the spec.

**AI response**:

1. **Extracted shared helpers** into
   [src/lib/utils/particle-label.ts](../../src/lib/utils/particle-label.ts)
   so Calculator combobox, Plot full-panel and Plot series legends all
   share one source of truth for particle naming. Refactored
   `entity-selection-comboboxes.svelte` to import from the new module
   (drops two duplicated functions).
2. **Refactored `entity-selection-panels.svelte`** to mirror the
   calculator's pattern:
   - Particle panel now uses `grouped`/`groups` with two sections —
     "Common particles" (proton, alpha particle, electron) and "Ions"
     (sorted by Z). Electron stays in Common particles but is greyed
     out (ESTAR unsupported), so it is visible to discover yet visually
     de-emphasised.
   - Particle labels come from the shared `getParticleLabel` —
     `proton` / `alpha particle` / `electron` / `Element (Symbol)`. The
     old `Z=N Name (Sym)` format is gone.
   - Material labels are now just `material.name`. The numeric ID
     stays as a hidden `searchText` so users can still type "276" to
     find Water.
3. **Plumbed `searchText` through `entity-panel.svelte`** — added an
   optional `searchText` field on `EntityItem<T>` and made the filter
   match on it in addition to label/description. No visible change for
   call sites that don't set it.
4. **Restored side-by-side layout per spec.** Reinstated the
   `1fr+2fr` Particle | Material sub-grid in
   `entity-selection-panels.svelte`, with Program full-width below at
   `maxHeight=150px`. Bumped the plot page sidebar column from
   `minmax(360px,3fr)_7fr` to `minmax(520px,5fr)_7fr` so the two
   panels actually fit comfortably; combined with the shorter Program
   list, all three panels now sit above the fold on a 1080p display.
5. **Plot series legends** now also use `getParticleLabel`, so a
   freshly added series reads `"proton in Water"` instead of
   `"Hydrogen in Water"`.
6. **Spec amendment**:
   `docs/04-feature-specs/entity-selection.md` (§ Particle naming
   preferences) gained a note that both layout modes share the same
   labels via `src/lib/utils/particle-label.ts`, including the plot
   series legends.
7. Verification: `pnpm test -- --run` → 493/493; plot E2E
   (`tests/e2e/plot.spec.ts`) → 2/2.

### Refactor: shared `getParticleLabel` helper

- **Status**: completed
- **Stage**: 5.5 (plot) + 4.6 (entity selection UX)
- **Files changed**:
  - [src/lib/utils/particle-label.ts](../../src/lib/utils/particle-label.ts) (new)
  - [src/lib/components/entity-selection-comboboxes.svelte](../../src/lib/components/entity-selection-comboboxes.svelte)
  - [src/lib/components/entity-selection-panels.svelte](../../src/lib/components/entity-selection-panels.svelte)
  - [src/routes/plot/+page.svelte](../../src/routes/plot/+page.svelte)
- **Decision**: extract instead of duplicate so the plot, calculator and
  series legends never drift apart again.

### Refactor: plot particle panel — Common particles / Ions split

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/lib/components/entity-selection-panels.svelte](../../src/lib/components/entity-selection-panels.svelte)
- **Decision**: keep electron in "Common particles" (matches the
  calculator and the spec wireframe) but greyed out — that is already
  the agreed "discoverable but de-emphasised" treatment. Pulling it
  into a separate "Other" section would diverge from the spec without
  user-visible benefit since greyed-out items already drop in opacity.

### Refactor: drop material ID from plot panel labels

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/lib/components/entity-selection-panels.svelte](../../src/lib/components/entity-selection-panels.svelte)
  - [src/lib/components/entity-panel.svelte](../../src/lib/components/entity-panel.svelte)
- **Decision**: the spec already mandates this for the calculator
  combobox; the plot panel was the outlier. Adding `searchText` to
  `EntityPanel` keeps numeric-ID search ("276" → Water) working.

### Layout: side-by-side Particle | Material, Program below

- **Status**: completed
- **Stage**: 5.5 (plot)
- **Files changed**:
  - [src/lib/components/entity-selection-panels.svelte](../../src/lib/components/entity-selection-panels.svelte)
  - [src/routes/plot/+page.svelte](../../src/routes/plot/+page.svelte)
- **Decision**: revert round-4's vertical stack — that fix was a
  workaround for cramped material width, which is now solved by
  dropping the ID prefix and widening the sidebar column from
  `minmax(360px,3fr)` to `minmax(520px,5fr)`. The result matches the
  spec wireframe exactly and brings Program above the fold.

### Spec amendment: plot uses calculator's particle naming

- **Status**: completed
- **Stage**: docs
- **Files changed**:
  - [docs/04-feature-specs/entity-selection.md](../../docs/04-feature-specs/entity-selection.md)
- **Decision**: documented that both layout modes (and the plot series
  legends) share `getParticleLabel` from `src/lib/utils/particle-label.ts`.
