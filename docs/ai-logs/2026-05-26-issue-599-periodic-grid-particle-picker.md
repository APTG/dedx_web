# 2026-05-26 — Periodic-grid scan view in the advanced particle picker

## Session Narrative

### Prompt 1: Implement issue #599

User asked to address [issue #599](https://github.com/APTG/dedx_web/issues/599)
— add a periodic-grid scan view to the particle tab of the picker, ensure it
is mobile-friendly, and provide E2E tests.

**AI response**: Read the issue, the entity-selection spec
(`docs/04-feature-specs/entity-selection.md`), and the existing
`particle-tab.svelte`. The spec table reserves the periodic-grid view for
Advanced mode (acceptance criterion: "Advanced mode renders the periodic-grid
scan view"), so the toggle is gated on `isAdvancedMode.value`.

Changes:

- Added a list/grid view toggle (icon buttons `☰` / `▦`) at the top-right of
  the tab body. Visible only in Advanced mode; auto-falls-back to list when
  the user leaves Advanced.
- Grid renders all built-in particles (Z=1..118) as square tiles in a
  responsive grid (`grid-cols-6 sm:grid-cols-9`). Each tile shows Z (mono,
  muted) above the chemical symbol (mono, bold). Electron (id 1001) is
  excluded — same rule as the list.
- Selection, multi-select, anchor protection, search filter, and "show only
  selected" interactions reuse the same handlers as the list, so behavioural
  parity is automatic.
- Unavailable tiles render at `opacity-40 pointer-events-none` and carry
  `data-available="0"` for tests.
- External-only particles appear in a wrap row below the grid, prefixed with
  the 🔗 glyph and showing the friendly name and Z.
- Tiles have `min-h-[44px]` to meet mobile a11y tap-target minimums.

Added new Playwright spec `tests/e2e/particle-grid-view.spec.ts` covering:
basic-mode hides the toggle; toggle renders in Advanced; switching to grid
swaps the list out; tiles show symbol + Z; electron is omitted; clicking a
tile updates the tab label and aria-selected; unavailable tiles are disabled;
search filter applies in grid mode; back-and-forth toggle works; and a mobile
viewport block verifies tap-target height and selection-on-tap.

## Tasks

### Periodic-grid scan view

- **Status**: completed
- **Stage**: Stage 5 — entity-selection
- **Files changed**:
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `tests/e2e/particle-grid-view.spec.ts` (new)
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-05-26-issue-599-periodic-grid-particle-picker.md` (new)
- **Decision**: Gate the view-toggle on Advanced mode. The issue text does
  not explicitly say so, but the spec table lists periodic-grid as Advanced
  only and the acceptance criterion is unambiguous. The toggle auto-resets
  to list when the user drops out of Advanced so the grid state cannot
  "stick" hidden behind the toggle.
- **Decision**: Use a 6→9 column responsive grid instead of the literal
  18-column standard periodic-table layout. The issue scope calls for a
  "9-wide responsive grid of element tiles" laid out in Z order — a
  scan-view, not a true periodic table. 6 cols on small viewports keeps the
  tap-target ≥ 44px even inside the narrow picker panel.
- **Issue**: Local `pnpm test` showed 3 unrelated failures in
  `guard-forbidden-files.test.ts` caused by a code-signing service returning
  HTTP 400 — pre-existing infra issue, not introduced by this change. All
  1444 other unit tests pass, type-check is clean, production build
  succeeds, lint is clean.
