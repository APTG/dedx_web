# 2026-07-09 — Consistent mouse row removal for calculator tables

## Session Narrative

### Prompt 1: Add a visible, consistent way to remove table rows with the mouse

**User request**: On the calculator landing page there is a large kinetic-energy
input. After clicking "+ Add row" the layout becomes a multi-row table, but there
was no way to get back to a single row using the mouse — only Backspace on an
empty input removed a row. The ask: introduce a consistent and visible
mouse-driven way to remove rows in **basic and advanced mode for all table
types**; when a basic-mode table is reduced to one row the user should land back
on the same hero layout as the landing page (large input field); and the
solution should be mobile-friendly.

**AI response**:

- Audited the four calculator tables:
  - `results/table-basic.svelte` — Basic mode. Single row renders a "hero" card
    (large input); ≥2 rows render a compact table. The multi-row table had **no
    delete control** — the only removal path was Backspace on an empty cell
    (keyboard-only, undiscoverable by mouse). This was the core gap.
  - `results/table-advanced.svelte` — Advanced Energy → and Range → tables. Each
    already had a small muted `×` button, but it was hidden entirely at one row
    and relied on hover to reveal the destructive colour (invisible affordance on
    touch devices).
  - `results/table-inverse-stp.svelte` — Inverse STP table; similar ad-hoc `×`.
- Created a single shared control, `results/row-delete-button.svelte`, so the
  affordance is identical everywhere: a persistently visible `×` inside a 32px
  (`h-8 w-8`) hit target (touch-friendly, no hover required to find it),
  hover/focus escalate to the `destructive` colour, and a dimmed
  `cursor-not-allowed` disabled state for the last remaining row.
- Wired the shared button into all four tables, preserving every existing
  `data-testid` and aria-label (`advanced-delete-row-*`, `inverse-range-delete-*`,
  `inverse-stp-delete-*`) and the `×` text node (keeps the advanced 5-row aria
  snapshot valid). Added a new right-hand delete column + `basic-delete-row-*`
  ids to the Basic multi-row table.
- Collapse-to-hero needed no new logic: `isSingleRow` already switches the Basic
  layout, and `energy-rows` `removeRow` refuses to drop below one row. The delete
  column only exists in the multi-row branch, so deleting the 2nd row naturally
  returns to the hero card.
- Verified: `svelte-check` (0 errors), ESLint + Prettier clean, full Vitest
  suite green, and a new focused component test exercising hero → multi-row →
  delete → hero. (The live dev calculator can't be driven here because the WASM
  binary is absent; the Vitest mock covers the component behaviour.)

## Tasks

### Consistent, mobile-friendly mouse row removal across all calculator tables

- **Status**: completed
- **Stage**: post-Stage-7 calculator UX polish
- **Files changed**:
  - `src/lib/components/results/row-delete-button.svelte` (new shared control)
  - `src/lib/components/results/table-basic.svelte` (new delete column)
  - `src/lib/components/results/table-advanced.svelte` (Energy → and Range →)
  - `src/lib/components/results/table-inverse-stp.svelte`
  - `src/tests/components/table-basic-row-removal.test.ts` (new)
  - `CHANGELOG-AI.md`, `docs/ai-logs/2026-07-09-table-row-removal.md`,
    `docs/ai-logs/README.md`
- **Decision**: One shared component instead of per-table markup, to guarantee a
  consistent affordance and a single place to tune sizing/colour. Kept the `×`
  glyph (rather than switching to a Lucide trash icon) so the existing advanced
  aria snapshot and its `button "Delete row N": ×` text nodes stay valid, and to
  keep the control dense enough for the compact tables. Advanced/inverse tables
  now render the button on the single row too (disabled) rather than hiding it,
  for a stable, always-discoverable affordance; the Basic hero deliberately has
  no delete control (you cannot go below one row there).
- **Issue**: none outstanding. The `table-multi` compare-across grid was left
  untouched — it is a read-only results grid whose energies are edited via the
  Basic/Advanced input tables, so it has no per-row input to remove.
