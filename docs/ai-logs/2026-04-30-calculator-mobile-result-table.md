# 2026-04-30 — Calculator result table mobile fix

**Model:** (Claude Sonnet 4.5 via Copilot coding agent)

## Session Narrative

### Prompt 1: User filed an issue with a Pixel 7A screenshot showing the "Stopping Power" header wrapping one character per line and the calculated value (`0.7…`) clipped mid-digit. Agent instructions: fix the issue and add a proper mobile e2e test.

**AI response**: Located `src/lib/components/result-table.svelte`. Root cause:
the table is `class="w-full text-sm"` with `px-4 py-2` on each of 5 columns, so
on a ~412 px viewport the columns get squashed and the right-hand result cells
clip. The wrapper has `overflow-x-auto` but it can never scroll because
`w-full` forces the table to fit the container.

Fix:

- `result-table.svelte` table → `w-full min-w-[560px]`; cell padding
  `px-4` → `px-2 sm:px-4`; added `whitespace-nowrap` on headers and
  right-aligned numeric cells so labels and values render on one line. The
  wrapper's existing `overflow-x-auto` now actually scrolls horizontally on
  narrow viewports.
- `routes/calculator/+page.svelte` card padding `p-6` → `p-3 sm:p-6` to give
  the table more horizontal room on phones without affecting desktop spacing.
- Added a `Calculator on mobile viewport` Playwright test (Pixel 7A-sized
  412 × 915) that exercises the real WASM path (100 MeV proton in liquid
  water) and asserts STP/CSDA values aren't clipped and the wrapper provides
  horizontal scroll.

11/11 existing `result-table.test.ts` unit tests still pass.

### Prompt 2: PR review feedback on commit `e87195e` flagged three issues.

**AI response**:

1. **Inline-element measurement.** The result-table cells render their value
   inside an inline `<span data-testid="stp-cell-i">`. Inline elements report
   `clientWidth = scrollWidth = 0`, so `expect(scrollWidth).toBeLessThanOrEqual(clientWidth)`
   passed trivially even when the value was clipped. Switched the assertion
   to walk up to the enclosing `<td>` (block element) via `span.closest('td')`
   and added a guard `expect(clientWidth).toBeGreaterThan(0)` so a future
   refactor that drops the `<td>` (or returns 0 widths) fails the test
   instead of silently passing.
2. **Strict scroll inequality.** Wrapper assertion was
   `scrollWidth >= clientWidth`, which is also satisfied when the table fits
   exactly and there is nothing to scroll. Changed to strict `>` so a future
   change that removes `min-w-[560px]` actually fails this regression test.
3. **Missing detailed AI log.** The 30-Apr changelog row had no linked
   `docs/ai-logs/2026-04-30-*.md` file. Added this log and a corresponding
   row in `docs/ai-logs/README.md`.

## Tasks

### Make calculator result table usable on mobile (Pixel 7A, ~412 px)
- **Status**: completed
- **Stage**: 6.1 (Calculator polish)
- **Files changed**:
  - `src/lib/components/result-table.svelte`
  - `src/routes/calculator/+page.svelte`
  - `tests/e2e/calculator.spec.ts`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-04-30-calculator-mobile-result-table.md` (this file)
  - `docs/ai-logs/README.md`
- **Decision**: kept the existing wrapper-based `overflow-x-auto` pattern
  rather than swapping to a custom column-stacking mobile layout — much
  smaller surgical change and matches user expectation that the same
  table layout is preserved across breakpoints. `min-w-[560px]` is well
  below the typical desktop column width so desktop layout is unchanged.
- **Issue**: none unresolved.
