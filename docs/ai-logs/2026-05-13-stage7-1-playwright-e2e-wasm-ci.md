# 2026-05-13 — Stage 7.1 Playwright E2E + WASM CI

## Session Narrative

### Prompt 1: Analyse task 7.1 from the redesign plan

**AI response**: Deep audit of the codebase found that the CI infrastructure (WASM download, Playwright install, `pnpm test:e2e` run, HTML report upload) was fully implemented from earlier stages. The E2E test suite (18 spec files, ~3900 lines) ran against real WASM. However, three gaps prevented marking 7.1 complete:

1. `@axe-core/playwright` mandatory per `07-testing-strategy.md §3` — completely absent
2. One unconditionally-skipped calculator test (`test.skip(true, ...)`) with stale selectors
3. Missing `@smoke` tags on basic calculator, plot, and export happy paths

Branch created: `feature/7.1-playwright-e2e-wasm-ci`

### Prompt 2: Implement the gaps autonomously

**AI response**:

**Item 1 — axe-core accessibility (commit f2a41a7)**

- Installed `@axe-core/playwright 4.11.3` as devDependency.
- Created `tests/e2e/accessibility.spec.ts` with 4 `@regression` tests (one per route).
- First run revealed 4 actual violations. Fixed all at source:
  - `aria-input-field-name`: `Combobox.ContentStatic` rendered `div[role="listbox"]` without accessible name → added `aria-labelledby={labelId}` pointing to the visible `<label>`.
  - `scrollable-region-focusable`: combobox scroll container had no keyboard access → added `tabindex="0"` (suppressed `a11y_no_noninteractive_tabindex` Svelte lint with comment + justification).
  - `color-contrast`: `text-muted-foreground` at `oklch(0.556 0 0)` rendered as `#858585`, contrast 3.69:1 on white (need 4.5:1) → darkened to `oklch(0.47 0 0)`.
  - `aria-prohibited-attr`: plot preview swatch `<span>` had `aria-label` without role → added `role="img"`.
- One rule disabled: `aria-required-children` — Bits UI places `<input role="combobox">` inside `div[role="listbox"]`, violating ARIA children constraints. Documented in axe config comment. Cannot fix without forking bits-ui.
- Also added `aria-disabled={!item.available ? true : undefined}` to disabled combobox items so axe exempts their color from contrast checks.

**Item 2 — Fix unconditional skip (commit 7d6ef3d)**

- `calculator.spec.ts`: removed `test.skip(true, ...)`. Old selectors expected `aria-label*="Energy value"` (nonexistent) and count=3 rows (default is 1). Replaced with `[data-testid="energy-input-0"]` and `getByRole("button", { name: /\+ Add row/i })`. Set `test.setTimeout(60000)`.

**Item 3 — Missing `@smoke` tags (same commit)**

- Added `@smoke` to "100 MeV proton…" and new "energy input renders" tests in `calculator.spec.ts`.
- Added `@smoke` to "plot page loads" in `plot.spec.ts`.
- Added `@smoke` to "Export CSV…" in `export.spec.ts`.
- Total smoke tests: 17 (from 13).

## Tasks

### Stage 7.1 — axe-core accessibility integration

- **Status**: completed
- **Stage**: 7.1
- **Files changed**:
  - `tests/e2e/accessibility.spec.ts` (new)
  - `src/lib/components/entity-combobox.svelte`
  - `src/app.css`
  - `src/routes/plot/+page.svelte`
  - `package.json`, `pnpm-lock.yaml`
- **Decision**: Used `aria-labelledby` (not `aria-label`) on the listbox to avoid creating a duplicate `aria-label="Particle"` that would make existing `waitForSelector('[aria-label="Particle"]')` tests ambiguous.
- **Decision**: Disabled `aria-required-children` rule in axe rather than forking Bits UI. Documented with a clear WHY comment.
- **Decision**: Darkened `--muted-foreground` globally (affects all muted text, not just combobox). Visual impact is minimal but contrast compliance requires it.

### Stage 7.1 — Fix calculator skip + smoke tags

- **Status**: completed
- **Stage**: 7.1
- **Files changed**:
  - `tests/e2e/calculator.spec.ts`
  - `tests/e2e/plot.spec.ts`
  - `tests/e2e/export.spec.ts`
- **Decision**: Kept the fixed test in the same describe block ("Calculator Page - Smoke Test") since it belongs there structurally.
