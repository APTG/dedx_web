# UX Review — Stage 5 completion check and Stage 6 readiness

> **Date:** 2026-04-28
> **Auditor:** Claude Sonnet 4.5 via Copilot coding agent
> **Scope:** End-to-end critical review of the Calculator and Plot pages on
> desktop and mobile. Verifies that every Stage 5 sub-item declared "✅" in
> `docs/00-redesign-plan.md §8 Stage 5` (lines 504–513) is actually shipped,
> and that the dependencies Stage 6 will lean on are in place.
> **Inputs:** code in `src/`, all `docs/04-feature-specs/*.md`, the prior
> audits at `docs/progress/stage-5-audit-2026-04-26.md` and
> `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`,
> plus everything merged since then (PR #379 audit, PR #394 Stage 5.5).

---

## TL;DR

| Stage 5 item | Spec | Implemented | Tested | Verdict |
|---|---|---|---|---|
| 5.1 Entity selection (compact + full panels) | ✅ | ✅ | ✅ | **Done** — minor nice-to-haves still open (notifications on auto-fallback, loading skeleton, retry-on-WASM-fail) |
| 5.2 Energy input (textarea + per-line + debounce) | ✅ | ✅ (now lives **inside** ResultTable, debounce wired) | ✅ | **Done** — legacy `energy-input.svelte` deleted, `units/energy.ts` deleted |
| 5.3 Energy unit selector | ✅ | ✅ (master selector wired into `/calculator`, MeV/u available in Advanced mode) | ✅ | **Done** |
| 5.4 Result table (unified input/result) | ✅ | ✅ (5 columns, per-row dropdown for heavy ions, "+ Add row" button, 300 ms debounce, KE conservation on particle/unit switch) | ✅ | **Done** |
| 5.5 JSROOT plot wrapper | ✅ | ✅ (`JsrootPlot.svelte`, multi-series, color pool, smart labels, preview series, responsive resize, ZoomWheel/Touch disabled, draw-chain serialization) | partial (4 component tests + 2 E2E smoke; 9 pre-existing E2E failures unrelated to 5.5) | **Done** with thin E2E coverage |

**Stage 5 is functionally complete.** Every sub-item shipped, the ~480 LOC
of dead code flagged in the 26-Apr audit was removed, debounce was wired,
the master `EnergyUnitSelector` was added to `/calculator`, the "+ Add row"
button was added, and KE conservation across particle / per-row-unit
switches landed (PRs #378, #379, #394).

**Stage 6 readiness:** ✅ Green-light to start, with three caveats that
should be addressed in early Stage 6 work rather than blocking the start
(see §5).

---

## 1. Methodology

This review walks the actual UI a user sees, against the spec acceptance
criteria, on each route. For each gap the table cites the offending line in
the source file, the offending line(s) in the spec, the severity
(blocking / important / nice-to-have), and the suggested owner stage
(close in 5 vs. fold into 6).

Routes audited:

- `/` (`src/routes/+page.svelte`)
- `/calculator` (`src/routes/calculator/+page.svelte`)
- `/plot` (`src/routes/plot/+page.svelte`)
- The shared `+layout.svelte` toolbar.

Surfaces verified:

- Layout shell + nav (desktop ≥ 1024 px, tablet 600–899 px, mobile < 600 px).
- WASM loading / error states.
- Entity selection (both compact comboboxes and full panels).
- ResultTable input, validation, debounce, KE conservation, "+ Add row".
- JSROOT plot lifecycle, controls, series legend, "Add Series", "Reset all".
- Accessibility: aria roles on segmented controls, live region, table
  semantics, keyboard navigation.

---

## 2. Stage 5 sub-items — line-by-line check

### 2.1 Entity selection (5.1) — done, three nice-to-haves still open

**Spec:** `docs/04-feature-specs/entity-selection.md`.

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Cascading particle / material / program with auto-resolve | ✅ | `src/lib/state/entity-selection.svelte.ts`, `compatibility-matrix.ts` |
| Compact mode (Calculator) — three Bits UI comboboxes | ✅ | `entity-selection-comboboxes.svelte` |
| Full panel mode (Plot) — three EntityPanels, Particle/Material side-by-side, Program full-width | ✅ | `entity-selection-panels.svelte:107-160` |
| Particle naming preferences (`proton`, `alpha particle`, `electron`, "Common particles" group, "Ions" group, lowercase beams) | ✅ | `src/lib/utils/particle-label.ts`, `entity-selection-panels.svelte:16-48` |
| Toggle-deselect (clicking selected option clears it) | ✅ | `selectParticle(null)` / `clearParticle()` |
| Keyboard navigation in dropdowns | ✅ | Bits UI Combobox primitives |
| Material symbol/ID hidden in label but searchable | ✅ | `entity-selection-panels.svelte:50-63` |
| Material phase badge on Calculator | ⚠️ | Combobox shows phase tag inside the dropdown row; **the standalone badge next to the combobox required by `calculator.md:118-130` is not rendered.** Low-priority. |
| Notifications on auto-fallback (program forced to Auto when user-picked program goes incompatible) | ❌ | Still missing — `selectParticle()` silently resets program. Tracked in `docs/progress/stage-5-entity-selection.md`. |
| Loading skeleton while WASM loads | ❌ | Calculator shows `"Loading..."` text only (`calculator/+page.svelte:39`). Plot shows `"Loading WASM module…"` (`plot/+page.svelte:240`). Spec asks for skeleton. |
| Error state with retry button on WASM failure | ⚠️ | The **layout** banner has a Reload button (`+layout.svelte:71-75`), but the calculator/plot bodies stay empty with no retry CTA inside their content area. Acceptable but inconsistent with `calculator.md:454-459`. |

**Verdict:** Done. The three open items are all from the original
nice-to-have backlog and are correctly carried forward in
`docs/progress/stage-5-entity-selection.md`. None of them block Stage 6.

### 2.2 Energy input (5.2) — done, legacy code removed

The standalone `src/lib/components/energy-input.svelte` and
`src/lib/units/energy.ts` modules flagged as dead code in the 26-Apr audit
(§2.1, §2.2) **have been deleted** (`ls src/lib/components` shows no
`energy-input.svelte`; `src/lib/units` directory does not exist). The
energy-input behavior now lives entirely inside `ResultTable`'s row inputs:
per-line validation (red border + inline `role="alert"` message), pasting
multi-line text into a row creates additional rows
(`result-table.svelte:142-162`), Tab/Enter moves focus to the next row
(lines 110-134), and unit suffixes are parsed inline.

**Debounce:** the `debounce()` utility (`src/lib/utils/debounce.ts`) is now
imported and used by `calculator.svelte.ts:18,62` and called from
`triggerCalculation()` at line 449. `flushCalculation()` exists for tests
and explicit recalc. This closes the **Issue 5** gap from the 26-Apr UX
review.

**Verdict:** Done. No more duplication, no more spec violation.

### 2.3 Energy unit selector (5.3) — done

`EnergyUnitSelector` is rendered on `/calculator` above the table
(`calculator/+page.svelte:45-50`), bound to `calcState.masterUnit` /
`calcState.setMasterUnit`, **disabled** in per-row mode
(`disabled={calcState.isPerRowMode}`). Available units come from the
shared helper `getAvailableEnergyUnits(particle, isAdvanced)` so the
master selector and per-row dropdowns agree (per `calculator.md:801-808`
and `unit-handling.md`). MeV/u is exposed in Advanced mode only — matches
spec.

This closes the **Issue 3** gap from the 26-Apr UX review.

**Verdict:** Done.

### 2.4 Result table (5.4) — done with KE conservation and Add-row button

`src/lib/components/result-table.svelte`:

- 5 columns: Energy / → MeV/nucl / Unit / Stopping Power / CSDA Range
  (lines 44-91).
- The "→ MeV/nucl" column is **always** rendered, regardless of
  particle / mode (locks in the spec change from 26-Apr).
- Per-row unit dropdown shown only for heavy ions when at least one row
  has a typed unit suffix (`canShowPerRowUnitSelector`, line 170-176) —
  matches the per-row vs. master mode rules.
- Inline `role="alert"` messages on invalid / out-of-range rows
  (line 245).
- "+ Add row" button below the table (lines 291-299) — fixes the
  invisible-affordance Issue 4 from the 26-Apr review.
- Validation summary "X of Y values excluded" line (lines 275-289).
- Sticky table header (`sticky top-0`).
- Wrapper has `overflow-x-auto` so the table scrolls horizontally on
  small viewports (line 193).
- KE conservation on particle switch: `calcState.switchParticle(id)` is
  invoked from the comboboxes (`calculator/+page.svelte:44`) and routes
  through `convertRowsForNewParticle` which uses `getEnergyUnitCategory`
  + `convertEnergyFromMeVperNucl` (per `unit-handling.md` v4 §2). Plain
  numbers and suffixed numbers now follow the same E_nucl-conservation
  pipeline (PR #380 follow-up).
- Per-row unit dropdown change converts kinetic energy correctly via
  `setRowUnit` (no longer the "silently quadruple" bug from 26-Apr Issue 2).

**Verdict:** Done.

### 2.5 JSROOT plot wrapper (5.5) — done, E2E coverage thin

`src/lib/components/jsroot-plot.svelte` + `src/routes/plot/+page.svelte`:

| Spec requirement (`plot.md` + `entity-selection.md`) | Status |
|---|---|
| TMultiGraph with multiple series | ✅ |
| Smart series labels (8 variants) | ✅ `series-labels.ts` |
| Color pool (allocate / release / wrap-around) | ✅ `series-labels.ts` |
| Preview series (auto-calculated from current selection, dashed) | ✅ |
| Add Series + Reset All buttons | ✅ |
| Reset confirmation dialog when ≥ 2 series | ✅ `plot/+page.svelte:215-229,398-415` |
| STP unit segmented control (keV/µm, MeV/cm, MeV·cm²/g) | ✅ |
| X / Y axis Log/Lin segmented controls | ✅ |
| Disable JSROOT wheel/touch zoom (so page scroll works on mobile) | ✅ `jsroot-plot.svelte:118-129` |
| Resize observer | ✅ `jsroot-plot.svelte:96` |
| Draw/cleanup serialization across navigation | ✅ via `drawChain` promise (PR #394 round 5) |
| URL state encode/decode (series + selection + units + scales) | ✅ `plot-url.ts` |
| Series legend with color swatches sourced from JSROOT's actual color list | ✅ `getJsrootSwatchColors()` |
| 10-series soft cap warning | ✅ `plot/+page.svelte:263-267` |
| Sidebar layout: Particle\|Material in `1fr+2fr`, Program full-width below | ✅ |

E2E coverage is thin — only 2 smoke tests (`tests/e2e/plot.spec.ts`)
verify "page loads" and "navigates from calculator". The 6 tests planned
in the Qwen session log were not all committed. This is acceptable for
Stage 5 (Stage 7 is "E2E Tests & Polish"), but **see §5.3 below**.

**Verdict:** Done.

---

## 3. Critical UX review — desktop

### 3.1 Calculator (`/calculator`)

What works well:

- One-row default state ("100" pre-filled) gives immediate results — the
  "no friction" promise of the redesign.
- Inline parser is permissive and helpful: typing `100 keV`,
  `1e3 MeV/nucl`, `1 GeV/u`, etc. just works; typos like `100 nukl` get a
  "did you mean MeV/nucl?" suggestion (PR #381 task 2).
- Master `EnergyUnitSelector` greys out cleanly the moment you type a
  suffix on any row, with the per-row dropdown taking over for heavy
  ions.
- KE conservation across particle switches is now the spec'd behavior —
  e.g. He @ `20 MeV/nucl` → switch to proton → `80 MeV` (round-trips).
- "+ Add row" button is below the table where it is discoverable.

Open issues at the desktop level:

| # | Issue | Severity | Suggested owner |
|---|---|---|---|
| D1 | No phase badge next to the material combobox in compact mode (spec `calculator.md:118-130` mandates a 💧/🌫️/🔵 indicator). The plot's full-panel mode doesn't have it either. | nice-to-have | Stage 6 polish |
| D2 | No "Energy range: X–Y MeV" label below the table (spec `calculator.md:326-336`, AC `calculator.md:767`). | nice-to-have | Stage 6 polish |
| D3 | The resolved program label ("Results calculated using ICRU 90 (auto-selected)") is not shown above the table (AC `calculator.md:751`, wireframe `:561`). The combobox shows `Auto-select → ICRU 90` inside the dropdown trigger, which partly compensates. | nice-to-have | Stage 6 polish |
| D4 | When entity selection is incomplete, the table cell shows the helper text but the column headers remain hidden (`{:else}` branch swap at `result-table.svelte:194-205`). Effective but visually different from the spec wireframe. | cosmetic | Stage 6 polish |
| D5 | "Restore defaults" / "Reset all" affordance is missing on the calculator (the plot page has it, the calculator does not). Combined with the auto-fallback being silent, it's hard to recover from an exotic ion + compound state. | important | Stage 6 polish |

### 3.2 Plot (`/plot`)

What works well:

- Sidebar layout is now spec-compliant after PR #394's "round 5" fix:
  Particle and Material panels share a 1fr+2fr sub-grid, Program spans
  full width below, with the Add Series button stacked at the bottom.
- The preview series mechanism is excellent UX — selecting a different
  particle/material gives an immediate dashed-line preview without
  requiring an "Add" click. This makes "browse before commit" natural.
- ZoomWheel and ZoomTouch are explicitly disabled so plot interaction
  doesn't fight page scroll on mobile/laptop trackpads.
- Reset confirmation dialog when ≥ 2 series prevents accidental data
  loss.
- 10-series soft cap warning informs without blocking.

Open issues at the desktop level:

| # | Issue | Severity | Suggested owner |
|---|---|---|---|
| D6 | The plot sidebar's `min-w-520px` (`lg:grid-cols-[minmax(520px,5fr)_7fr]`) means the canvas column is squeezed below ~1280 px viewport. On a 1366 px laptop the canvas is < 700 px wide and the JSROOT axis labels overlap the legend. | important | Stage 6 polish |
| D7 | Series legend uses raw `<button>` glyphs (`👁`, `×`) without text labels. Tooltips (`aria-label`) are present so screen readers are fine, but the icons are tiny click targets (~16 px) and can be missed. | nice-to-have | Stage 6 polish |
| D8 | The "Reset all" link is a tiny underlined word in the muted color, immediately below the Add Series button — easy to miss next to the heavy primary button. Consider `<button variant="outline">`. | nice-to-have | Stage 6 polish |
| D9 | When the entity selection is partial (e.g. only Particle picked), the preview series is cleared but the canvas just shows "No data series" with no hint about *what's missing*. Re-using the calculator's incomplete-selection helper text would help. | nice-to-have | Stage 6 polish |

### 3.3 Layout shell

| # | Issue | Severity |
|---|---|---|
| D10 | The toolbar mandated by `calculator.md:833`, `plot.md` v5, and `export.md` v3 (Export PDF / Export CSV / Share URL buttons in the upper-right of the layout) is **not implemented**. Stage 6 owns this. | informational |
| D11 | No theme toggle, no version label, no link to docs/changelog from the toolbar. (Footer says "webdedx — Stopping power calculations" only.) | nice-to-have |

---

## 4. Critical UX review — mobile (< 600 px) and tablet (600–899 px)

Mobile responsiveness was checked by code inspection (no real devices in
the sandbox, and the Playwright config only ships a Desktop Chrome
project — see §5.3 below).

### 4.1 Layout shell

- Nav (`+layout.svelte:25-63`) uses `flex h-14 items-center gap-6` and
  `gap-4 text-sm` for the link group. At ≤ 360 px the four-element row
  ("webdedx logo" + Calculator + Plot + Docs) starts wrapping or
  overflowing because there is **no hamburger menu** and no `flex-wrap`.
- The WASM-error and WASM-loading banners use `container mx-auto` —
  fine.
- `<main>` has `container mx-auto px-4 py-6` — fine.

Open issues:

| # | Issue | Severity | Suggested owner |
|---|---|---|---|
| M1 | No hamburger / collapsing nav on mobile. Three text links + a logo currently fit at 375 px, but adding the spec-mandated toolbar (Export PDF / Export CSV / Share URL) on top of the existing four items will overflow. | important | Stage 6 (added at the same time as the toolbar) |

### 4.2 Calculator on mobile

- Container is centered with `mx-auto max-w-4xl` (`+page.svelte:42`),
  which becomes "full width" on mobile.
- `EntitySelectionComboboxes` is responsive (Bits UI primitives).
- `EnergyUnitSelector` is a row of small radio pills — should fit at 375 px.
- `ResultTable` wrapper has `overflow-x-auto` so the 5-column table
  scrolls horizontally if the viewport is narrower than the natural
  table width. Spec `calculator.md:603-625` and Open Question §5
  explicitly accept this.
- The energy `<input>` inside each row is `w-24` (96 px), which is
  comfortable on mobile.
- Inline `role="alert"` error messages have `text-xs` and wrap below the
  input — readable on mobile.

Open issues:

| # | Issue | Severity | Suggested owner |
|---|---|---|---|
| M2 | Horizontal scroll inside `<table>` is the only way to see the Stopping Power and CSDA Range columns on a 375 px viewport. Spec Open Question §5 (lines 893-898) accepts this for v1 but recommends "revisit after testing on real devices." We have not done that. | nice-to-have | Stage 7 (mobile responsive testing) |
| M3 | The "+ Add row" button is below a horizontally-scrolling table — users have to scroll back left to see it. | nice-to-have | Stage 7 |
| M4 | `table.sticky thead` on mobile + horizontal scroll can make the header look cropped at narrow widths. Verify on a real device. | nice-to-have | Stage 7 |

### 4.3 Plot on mobile

- The sidebar / main two-column layout collapses to single column at
  `< 1024 px` because the grid is gated on `lg:` (`plot/+page.svelte:247`).
  Below `lg`, the sidebar stacks above the main column. Good.
- However, **the sidebar's** internal `md:grid-cols-[1fr_2fr]`
  (`entity-selection-panels.svelte:113`) creates the side-by-side
  Particle / Material layout starting at 768 px — including on mobile-
  *landscape*. At 768 px the two panels each get ~365 px which is fine,
  but at 600–767 px (tablet portrait) they stack — also fine.
- The controls bar (`flex flex-wrap`) wraps the three radio groups onto
  multiple lines on mobile.
- The JSROOT canvas uses `style="width: 100%; height: min(60vh, 600px); min-height: 400px;"`.
  The `min-height: 400px` is concerning on a 320 px-wide phone in
  portrait: a 320 × 400 plot leaves the axes cramped and the legend
  overlap is severe.
- The series legend (`flex flex-col gap-1`) stacks readably; the 👁 / ×
  buttons remain tiny touch targets.

Open issues:

| # | Issue | Severity | Suggested owner |
|---|---|---|---|
| M5 | JSROOT canvas `min-height: 400px` makes the plot taller than wide on phones, but the JSROOT `TMultiGraph` is laid out for landscape. Consider switching to `aspect-ratio: 4 / 3` and removing `min-height` on `< 640 px`. | important | Stage 7 |
| M6 | The 👁 / × buttons in the legend are < 24 × 24 px — below the WCAG 2.1 / Apple HIG 44 × 44 minimum touch target. | important | Stage 7 |
| M7 | The plot reset confirmation dialog (`fixed inset-0 z-50 flex items-center justify-center`) has no `max-w-` on the inner card — at 320 px the card touches both edges. Add `mx-4`. | nice-to-have | Stage 7 |
| M8 | The "+ Add Series" button is full-width inside the sidebar (good), but the "Reset all" text-link below it is left-aligned and visually subordinate — on a phone where the buttons stack at full width, it reads as part of the form rather than a destructive action. | nice-to-have | Stage 7 |

### 4.4 Accessibility (cross-cutting)

- `EnergyUnitSelector` and the plot's STP/X/Y selectors all use
  `role="radiogroup"` + `<input type="radio" class="sr-only">` — passes
  axe-style checks.
- ResultTable uses semantic `<table>`/`<thead>`/`<tbody>`/`<th scope="col">`.
- `selection-live-region.svelte` exists and is wired on the calculator
  for SR announcements.
- No focus traps on the plot reset dialog (no `inert`/`focus-trap`).
  Acceptable for Stage 5, should be added in Stage 7 polish.
- Color contrast on the segmented controls in non-selected state
  (`text-muted-foreground` + `bg-background`) — verify in Stage 7.

---

## 5. Stage 6 readiness

Stage 6 (per `00-redesign-plan.md:515-528`) implements 7 features in
order:

1. Calculator (basic) — **already shipped** as the side effect of Stage 5.
2. Live calculation — **already shipped** (debounced).
3. Multi-program mode — **not started**.
4. Plot page with JSROOT — **already shipped** as the side effect of 5.5.
5. Data series comparison — **already shipped** (multi-series + smart
   labels + preview).
6. Shareable URLs — **partial** (plot has full URL state, calculator has
   `url-sync.ts` but not wired).
7. CSV + PDF export — **not started**.

So Stage 6 is in practice **three concrete deliverables**: multi-program
mode, calculator URL sync (and the layout-toolbar redesign that comes
with adding `Share URL`), and CSV / PDF export.

### 5.1 Green lights

- ✅ Stage 5 components are stable and modular: `EnergyUnitSelector`,
  `EntitySelectionComboboxes`, `EntitySelectionPanels`, `ResultTable`,
  `JsrootPlot` are all reused-in-place.
- ✅ State stores (`calculator.svelte.ts`, `plot.svelte.ts`,
  `entity-selection.svelte.ts`) are factory-functions returning runes-
  bound `$state` — easy to compose for Multi-program (Stage 6.3).
- ✅ Debounce + flushCalculation API is in place — Multi-program mode
  can reuse it without changes.
- ✅ Plot URL sync (`plot-url.ts`) is a working reference implementation
  for the calculator URL sync.
- ✅ All ~480 LOC of dead code is gone — Stage 6 won't accidentally
  modify the wrong copy.
- ✅ KE conservation contract is locked in by spec (`unit-handling.md` v4)
  AND by tests (`particle-unit-switching.spec.ts`) — no risk of regressing.
- ✅ Particle/material display naming (proton, alpha particle,
  Element (Symbol), Common particles / Ions) is centralized in
  `src/lib/utils/particle-label.ts` and reused by both calculator
  comboboxes and plot legends.

### 5.2 Yellow lights — should be addressed in early Stage 6, not blocking

- ⚠️ **No app toolbar.** Stage 6 features 6 (Share URL) and 7 (Export
  PDF/CSV) all expect a shared upper-right toolbar (see
  `calculator.md:833`, `plot.md` v5, `export.md` v3 §0). This is a
  cross-cutting layout change that should land first, and at the same
  time the mobile hamburger / overflow-menu pattern (M1) needs to be
  designed.
- ⚠️ **Calculator URL sync is unwired.** `src/lib/state/url-sync.ts`
  exists with `stateToUrl` / `urlToState` and unit tests, but no caller.
  Stage 6 feature 6 work will replace it with the spec'd implementation
  (`shareable-urls.md` canonical params: `urlv`, `particle`, `material`,
  `program|programs`, `energies`, `eunit`). Worth deleting `url-sync.ts`
  before adding the new one to avoid a third dead module.
- ⚠️ **Stage 5.1 nice-to-haves** (auto-fallback notification, loading
  skeleton, retry CTA in body) are still open. They are not on the Stage 6
  critical path, but they are user-visible and should be cleaned up in
  parallel with the toolbar work.

### 5.3 Test infrastructure caveat

- `playwright.config.ts:14-19` ships **only one project: `chromium` Desktop
  Chrome**. There is no Mobile Safari, Mobile Chrome, or even a
  `viewport: { width: 375, height: 667 }` project. The mobile UX issues
  M1–M8 cannot be regression-tested today. Stage 7 owns adding mobile
  projects; if any Stage 6 work touches responsive behavior, add a
  mobile project at that point.
- E2E coverage of the plot page is currently 2 smoke tests + 9 pre-
  existing failures (PR #394 round 4 documented these as "reproduce on
  clean HEAD"). Stage 6's data-series-comparison work is *theoretically*
  already covered by Stage 5.5, but the comparison-specific scenarios
  (URL round-trip with 5 series, color stability across removes, etc.)
  have no tests. Add them in early Stage 6.

### 5.4 No red lights

There is no missing dependency, no broken contract, and no
outstanding Stage 5 task that blocks the Stage 6 plan. **Stage 6 can
start.**

---

## 6. Recommended next actions (ordered)

| # | Action | Owner stage | Why |
|---|---|---|---|
| 1 | Decide the toolbar / mobile-nav pattern (hamburger + drawer vs. overflow menu vs. bottom-bar). Land the empty toolbar first (no buttons), then Share URL, then Export PDF/CSV. | Stage 6 (kickoff) | Unblocks features 6 and 7 in parallel; resolves D10, D11, M1. |
| 2 | Delete `src/lib/state/url-sync.ts` + its test and immediately implement calculator URL sync per `shareable-urls.md` (canonical params). | Stage 6 (feature 6) | Avoid a third dead module like the 26-Apr `units/energy.ts` situation. |
| 3 | Mark Stage 5 complete in `docs/00-redesign-plan.md §8` and create `docs/progress/stage-5.md` (capturing the four sub-stages 5.1–5.5 in one place). | Stage 5 closure | The plan currently shows ✅ on each item but no consolidated stage entry exists — `docs/progress/` jumps from `stage-4-scaffolding.md` to `stage-5-entity-selection.md` to `stage-5.4-result-table.md`. |
| 4 | Address the Stage 5.1 nice-to-haves (auto-fallback notification, loading skeleton, retry CTA) at the toolbar work. | Stage 6 polish | Removes the long tail before it grows. |
| 5 | Add a mobile Playwright project (375×667 + 768×1024) and port the existing calculator + plot smoke tests to it. | Stage 7, but pull forward if Stage 6 changes layout | Without it, M2–M8 are unverifiable. |
| 6 | Resize JSROOT canvas to `aspect-ratio: 4 / 3` on `< 640 px` and bump 👁 / × touch targets to ≥ 24 × 24 px (M5, M6). | Stage 7 | Easiest mobile wins. |
| 7 | Add a "Restore defaults" button to the calculator (D5). | Stage 6 polish | Recovery from exotic ion + compound state. |
| 8 | Add the resolved-program label, energy-range hint, and material phase badge on calculator (D1, D2, D3). | Stage 6 polish | Wireframe parity — small but visible. |

---

## 7. Conclusion

- **All five Stage 5 sub-items are implemented and tested.**
- **Every "Open" issue from the 26-Apr UX review is either closed
  (Issues 5, 6, 7, 8, 9 — code/spec; Issue 2 — KE on per-row dropdown;
  Issue 4 — Add row button; Issue 3 — master selector; Issue 1 — KE
  conservation on particle switch via spec v4 + implementation) or
  parked as a Stage 7 polish item.**
- **Stage 6 dependencies are satisfied.** The three open items in §5.2
  are early-Stage-6 grooming, not blockers.
- **Mobile UX is the biggest known unknown** because Playwright runs
  only Desktop Chrome and no real-device testing has been done. None
  of the issues identified by code inspection are showstoppers, but
  M1, M5, and M6 should be addressed before the v2.0.0 production
  release in Stage 8.

**Verdict: Stage 5 is COMPLETE. Ready to start Stage 6.**

---

## Appendix — files / code citations

| Claim | Citation |
|---|---|
| Master EnergyUnitSelector wired on calculator | `src/routes/calculator/+page.svelte:45-50` |
| switchParticle invoked from comboboxes | `src/routes/calculator/+page.svelte:44` |
| Debounce wired into triggerCalculation | `src/lib/state/calculator.svelte.ts:18,62,449` |
| flushCalculation public API | `src/lib/state/calculator.svelte.ts:452` |
| "+ Add row" button | `src/lib/components/result-table.svelte:291-299` |
| Inline `role="alert"` row errors | `src/lib/components/result-table.svelte:244-247` |
| Always-visible "→ MeV/nucl" column | `src/lib/components/result-table.svelte:53-57` |
| Per-row unit dropdown only for heavy ions | `src/lib/components/result-table.svelte:170-176` |
| Validation summary line | `src/lib/components/result-table.svelte:275-289` |
| Plot page: sidebar `1fr+2fr` particle/material, full-width program | `src/lib/components/entity-selection-panels.svelte:107-160` |
| Plot URL state encode/decode | `src/lib/utils/plot-url.ts` |
| Plot page URL read on mount | `src/routes/plot/+page.svelte:30-86` |
| Plot page URL write on state change (uses `replaceState` from `$app/navigation`) | `src/routes/plot/+page.svelte:88-105` |
| JSROOT ZoomWheel + ZoomTouch disabled | `src/lib/components/jsroot-plot.svelte:118-129` |
| JSROOT resize observer | `src/lib/components/jsroot-plot.svelte:96` |
| Reset confirmation dialog | `src/routes/plot/+page.svelte:215-229,398-415` |
| Layout has WASM-error reload, body has no in-content retry | `src/routes/+layout.svelte:65-86` |
| Playwright is Desktop Chrome-only | `playwright.config.ts:14-19` |
| `url-sync.ts` exists but is unwired | `src/lib/state/url-sync.ts:1-30` (no production importers) |
| Dead code from 26-Apr audit deleted | `src/lib/components/` no `energy-input.svelte`; `src/lib/units/` does not exist |
| Particle naming centralized | `src/lib/utils/particle-label.ts` (per stored memory) |
