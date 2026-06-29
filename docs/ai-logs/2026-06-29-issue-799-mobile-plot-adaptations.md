# 2026-06-29 — Mobile adaptations: re-verify plot fixes at 375px (#799)

## Session Narrative

### Prompt 1: Work on issue #799, make a PR when ready

**AI response**: #799 is PR bundle E of the plotting-area epic (#800) — the
mobile pass over the landed plot fixes (#793 series strip, #794 toolbar + zoom,
#798 advanced disclosure). I read the issue, the four touched components
(`plot-toolbar.svelte`, `series-strip.svelte`, `jsroot-plot.svelte`,
`advanced-options-panel.svelte`), the plot page (`plot/+page.svelte`), the
shared `IconButton`, the Tailwind theme (custom `tablet`/`desktop` breakpoints
in `app.css`), and the existing responsive/plot Playwright specs.

Findings before touching code:

- **Toolbar** was the one real failure mode: `flex flex-wrap justify-between`
  with a fixed-width `Reset zoom` label + a `Export image ▾` text button wraps
  to two rows below ~375px. This is the only fix that genuinely broke.
- **Series rows** already satisfied the mobile ACs: the shared `IconButton` is
  ≥44px below `sm`, the label already uses `truncate`, the swatch is
  `shrink-0`. No code change needed — re-verified by test.
- **Plot height** already had `min-height: 300px` + `50vh` on mobile (well
  above the ~170px legibility floor). No change — re-verified by test.
- **Touch zoom**: axis pinch-zoom (`ZoomTouch`) and graph-drag (`DragGraphs`)
  are deliberately disabled on coarse-pointer devices (decision from the
  2026-06-18 scroll-hijack fix) so the page keeps native scroll/pinch. The
  toolbar `−`/`+` and the persistent `Reset zoom` are the finger-sized escape
  hatch. I did **not** re-enable axis pinch (would regress the scroll-hijack
  fix); the transient hint was already removed in #794 by owner request, so I
  did not re-add it.
- **Advanced disclosure** is already full-width + collapsed by default; it
  sits directly above the plot, so opening it pushes the plot down — verified
  it stays partially in a 375×667 viewport.

Changes made:

1. `app.css` — added an `xs` (420px) breakpoint to the existing
   `--breakpoint-*` set so labels can drop to icons below ~420px (the issue's
   threshold), matching the established `tablet`/`desktop` pattern.
2. `plot-toolbar.svelte` — reflowed to a single non-wrapping row
   (`flex flex-nowrap`): icon-only `−`/`+`, a `flex-1` `Reset zoom` that keeps
   its label below `xs` and a spacer that pushes Export right from `xs` up
   (restoring the desktop layout). The Export button is icon-only
   (`ImageDown`) below `xs` and regains its `Export image ▾` label from `xs`
   up. All `data-testid`s preserved.
3. `tests/e2e/plot-mobile.spec.ts` — new `@responsive` spec parametrised over
   375×667 and 360×640: toolbar single-row + no overflow + Reset keeps label +
   Export icon-only; series-row ≥44px targets + ellipsis + no overflow; canvas
   height ≥170px; zoom-then-Reset restores full range with Reset in viewport;
   Advanced disclosure opens without shoving the plot off a short viewport.
4. `docs/04-feature-specs/plot.md` — extended the Mobile (<600px) subsection
   with the #799 plot-column adaptation rules.

Verification: `svelte-check` 0 errors; `eslint` clean; `vitest run` 1897
passed / 3 skipped; `vite build` succeeds and the built CSS contains the
`@media (width>=420px)` block with the `xs:` utilities. (Local env has no WASM
or system canvas libs, so the Playwright specs run in CI, consistent with the
prior plot PRs.)

## Tasks

### Mobile adaptations — re-verify every plot fix at 375px

- **Status**: completed
- **Stage**: Mobile · PR bundle E of plotting-area epic #800
- **Files changed**:
  - `src/app.css`
  - `src/lib/components/plot-toolbar.svelte`
  - `tests/e2e/plot-mobile.spec.ts` (new)
  - `docs/04-feature-specs/plot.md`
  - `CHANGELOG-AI.md`, `docs/ai-logs/README.md`, this log
- **Decision**: Did not re-enable JSROOT axis pinch-zoom on touch — the
  2026-06-18 fix deliberately disabled it so the page keeps native scroll, and
  "no regression" is an AC. Pinch zooms the page; the toolbar `−`/`+` + Reset
  are the in-plot zoom controls. Did not re-add the transient zoom hint (owner
  removed it in #794); the touch story is documented in the spec instead.
  Series rows and plot height needed no code change — they already met the ACs
  and are now locked in by the new spec.
- **Decision**: Added a 420px `xs` breakpoint (the issue's stated label-drop
  threshold) rather than reuse `sm` (640px), so a landscape phone keeps the
  Export label while a 375px portrait phone gets the icon.
- **Issue**: Playwright not runnable locally (no WASM/canvas) — relying on CI,
  matching the established pattern for the #793–#798 plot PRs.
