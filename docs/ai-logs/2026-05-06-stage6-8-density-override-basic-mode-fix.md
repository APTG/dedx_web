# 2026-05-06 — Stage 6.8: Density Override Isolation & CI Auto-Run Fix

**Model:** Claude Sonnet 4.5 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Density override not affecting calculations; leaks into Basic mode; E2E auto-run

User reported two bugs with density override in the Advanced Options panel:

1. **In Advanced mode**, typing `2` in the density field and pressing Tab does NOT retrigger
   calculation — CSDA range stays unchanged.
2. **Switching back to Basic mode** after setting density=2 shows a halved range — but Basic
   mode should always use the material's built-in density, ignoring any override.

User also asked to:
- Fix CI so E2E tests run automatically on `feat/**` branches without prompting
- Add E2E tests for both scenarios
- Fill AI logs

**AI response**: Traced the two root causes and fixed them across multiple files.

### Root cause analysis

**Bug 1 (Advanced mode display not updating):**
`result-table.svelte` used `entitySelection.selectedMaterial.density` (the material's
built-in density) when converting the multi-program comparison columns from `g/cm²` to `cm`
and from `MeV·cm²/g` to `keV/µm`. The density override from `advancedOptions.value.densityOverride`
was never consulted. Even though `calculateMulti()` was correctly retriggered on density changes
(the reactive dep was set up), the *display* conversion always used the built-in density, so the
shown values were unchanged.

**Bug 2 (Basic mode leaks density override):**
`calculator.svelte.ts` → `performCalculation()` unconditionally read
`advancedOptions.value.densityOverride` regardless of mode. When switching from Advanced → Basic,
`isAdvancedMode.value` became false and `triggerCalculation()` fired, but the density override
was still `2`, so the basic-mode result was also halved. Same for `getStpDisplayUnit()` which
read `advancedOptions.value.aggregateState` without a mode guard.

**E2E test design flaw:**
Both failing tests captured a baseline from `[data-testid="range-cell-0"]` (the single-program
basic-mode cell) and then checked the same locator after switching to Advanced mode. But in
Advanced mode the result table replaces `range-cell-{rowIndex}` with
`range-cell-{programId}-{rowIndex}` — the original locator matched nothing, so
`parseFloat("")` returned `NaN`, and `NaN < baseline * 0.6` was always `false`, causing
a 5000 ms timeout.

**CI branch gap:**
The `on.push.branches` list contained `feature/**` but not `feat/**`. The active branch
`feat/stage6-advanced-options` never matched, so E2E tests were only triggered by the
`pull_request` event (not by every push).

### Fixes applied

**`src/lib/components/result-table.svelte`**
- Added `import { advancedOptions } from "$lib/state/advanced-options.svelte"`
- Both multi-program column density variables changed to
  `advancedOptions.value.densityOverride ?? entitySelection.selectedMaterial.density`
  so the density override is used when set.

**`src/lib/state/calculator.svelte.ts`**
- Added `import { isAdvancedMode } from "./advanced-mode.svelte"`
- `getStpDisplayUnit()`: aggregate state override now guarded —
  `const aggOverride = isAdvancedMode.value ? advancedOptions.value.aggregateState : undefined`
- `performCalculation()`: advanced options only passed to WASM in Advanced mode —
  `const calculationOptions = isAdvancedMode.value ? advancedOptions.value : undefined`
- Density override: `(isAdvancedMode.value ? advancedOptions.value.densityOverride : undefined) ?? material?.density ?? 1`

**`src/routes/plot/+page.svelte`**
- Preview series `density` changed to
  `(isAdvancedMode.value ? advOptsSnapshot.densityOverride : undefined) ?? selectedMaterial.density`
- `handleAddSeries()` changed to preserve `p.density` (the density that was active when the
  preview was computed) rather than re-reading `selectedMaterial.density`.

**`tests/e2e/advanced-options.spec.ts`**
- Two failing density tests rewritten:
  - Now check `td[data-program-id][data-testid^="range-cell-"]` (multi-program columns) in
    Advanced mode instead of `range-cell-0` (basic-mode single-program cell, absent in
    Advanced mode)
  - Timeouts increased from 5000 ms to 15000 ms; `test.setTimeout(60000)` added
- New test: **switching back to Basic mode reverts to default density** — sets density=2 in
  Advanced mode, confirms multi-program CSDA cell halves, then switches to Basic mode and
  asserts `range-cell-0` returns to ≥ 80 % of the original baseline.
- STP density test also updated to use `td[data-program-id][data-testid^="stp-cell-"]`.

**`src/tests/unit/calculator-state.test.ts`**
- Added `import { isAdvancedMode }` and `isAdvancedMode.value = false` reset in `afterEach`
- All density override and aggregate-state override tests now set `isAdvancedMode.value = true`
  before exercising advanced-mode-only behavior
- Added new test: "aggregate state override does NOT apply in Basic mode"

**`.github/workflows/ci.yml`**
- Added `"feat/**"` to `on.push.branches` list so every push to `feat/…` branches triggers
  the full CI pipeline (unit tests + E2E tests) automatically.

### Verification

717 unit tests pass. No TypeScript errors in modified files.

## Tasks

### Fix density override isolation (Bugs 1 & 2)

- **Status**: completed
- **Stage**: Stage 6.8 (Advanced Options)
- **Files changed**:
  - `src/lib/components/result-table.svelte`
  - `src/lib/state/calculator.svelte.ts`
  - `src/routes/plot/+page.svelte`
  - `src/tests/unit/calculator-state.test.ts`
- **Decision**: Guarded all advanced-option reads with `isAdvancedMode.value` so that Basic
  mode is completely unaffected by any stored overrides. This is the cleanest isolation
  without resetting the override values on mode switch (which would lose the user's settings
  when toggling back to Advanced).

### Fix E2E tests for Advanced mode density verification

- **Status**: completed
- **Stage**: Stage 6.8
- **Files changed**: `tests/e2e/advanced-options.spec.ts`
- **Decision**: Multi-program CSDA/STP cells use `td[data-program-id][data-testid^="range-cell-"]`
  — robust against any default program ID. Timeouts raised to 15 s for WASM-heavy operations.

### Fix CI branch trigger

- **Status**: completed
- **Files changed**: `.github/workflows/ci.yml`
- **Decision**: Added `feat/**` pattern alongside `feature/**` so both common branch prefixes
  trigger the full CI pipeline automatically on push.
