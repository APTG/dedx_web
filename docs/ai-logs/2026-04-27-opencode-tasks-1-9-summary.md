# opencode Tasks 1–9 — Summary (Stage 5 E2E Debug in Progress)

**Date:** 2026-04-27  
**Model:** (Qwen3.5-397B-A17B-FP8 via opencode)  
**Branch:** `copilot/check-stage-5-implementations`

---

## Session Overview

This session was intended to complete all 9 tasks from `docs/ai-logs/prompts/2026-04-27-opencode-tasks.md`, covering:

- TeV energy units (Task 1) ✅
- Typo suggestions in parser (Task 2) ✅
- Particle display names & grouping (Task 3) ✅
- Fix `setRowUnit` KE conversion (Task 4) ✅
- KE conservation on particle switch (Task 5) ✅
- Master energy unit selector (Task 6) ✅
- Add row button (Task 7) ✅
- Debounce wiring (Task 8) ✅
- Dead code cleanup (Task 9) ✅

**Status:** All 9 tasks implemented and committed. However, **E2E tests are failing** due to WASM not loading in the Playwright preview server environment.

---

## What Was Completed

### All 9 Tasks — Implemented & Committed

The following commits were made:

1. `feat(parser): add TeV, TeV/nucl, TeV/u energy units (×1e6 MeV)` — Task 1
2. `feat(parser): typo suggestions for common unit casing errors` — Task 2
3. `feat(ui): rename particle groups to "Common particles"/"Ions", use proton/alpha particle/electron labels` — Task 3
4. `fix(calculator): setRowUnit now converts KE instead of stamping suffix` — Task 4
5. `feat(calculator): conserve E_nucl on particle switch; re-express row values via per-nucleon-first algorithm` — Task 5
6. `feat(calculator): add master energy unit selector above result table` — Task 6
7. `feat(result-table): add "Add row" button below energy table` — Task 7
8. `feat(calculator): debounce calculation trigger to 300ms per spec` — Task 8
9. `chore: delete dead energy-input.svelte, units/energy.ts, and their tests (~480 LOC)` — Task 9

### Unit Tests: All Passing ✅

```
Test Files  20 passed (20)
     Tests  425 passed (425)
```

### E2E Tests: Systemic Failure ❌

**72 tests run, 43 failed, 4 skipped, 25 passed**

**Root cause:** WASM module not loading in Playwright preview server. All failing tests timeout waiting for `[aria-label="Particle"]` selector.

- Error: `TimeoutError: page.waitForSelector: Timeout 20000ms exceeded.`
- Page snapshot shows: `<paragraph>Loading WASM module...</paragraph>`
- WASM files accessible via HTTP (curl returns 200 + binary data)
- `wasmReady.value` never becomes `true` in browser context

**Passing E2E tests:** `basic.spec.ts` (doesn't wait for Particle combobox)

**Failing E2E test suites:**
- `entity-selection.spec.ts` — 8 tests failing (all timeout on Particle combobox)
- `complex-interactions.spec.ts` — 22 tests failing (all timeout)
- `particle-unit-switching.spec.ts` — 12 tests failing/timeout
- `layout.spec.ts` — 3 tests failing (page titles, WASM loading)

---

## Key Changes Made

### `src/lib/components/entity-selection-comboboxes.svelte`

Added optional `onParticleSelect` callback to intercept particle selection before calling `state.selectParticle()`. This allows the calculator page to wire KE conservation through `calcState.switchParticle()`.

```svelte
interface Props {
  state: EntitySelectionState;
  class?: string;
  onParticleSelect?: (particleId: number) => void;
}

// In particle combobox onSelect:
if (onParticleSelect) {
  onParticleSelect(particle.id);
} else {
  state.selectParticle(particle.id);
}
```

### `src/routes/calculator/+page.svelte`

Wired `onParticleSelect` callback to `calcState.switchParticle()`:

```svelte
<EntitySelectionComboboxes
  {state}
  onParticleSelect={(particleId) => calcState.switchParticle(particleId)}
/>
```

### Test Files Updated

- `tests/e2e/particle-unit-switching.spec.ts` — Updated search terms from "helium"/"hydrogen" to "alpha particle"/"proton" to match UI labels
- `tests/e2e/complex-interactions.spec.ts` — Minor fixes for test assertions

---

## Current Blocker: WASM Loading in E2E

### Symptoms

1. Page shows "Loading WASM module..." indefinitely
2. `wasmReady.value` stays `false`
3. All tests waiting for `[aria-label="Particle"]` timeout after 20s
4. WASM files are accessible via HTTP (verified with curl)

### Investigation Status

- WASM files present in both `static/wasm/` and `build/wasm/`
- `build/wasm/libdedx.mjs` (16K) and `build/wasm/libdedx.wasm` (463K) exist
- Playwright config uses `baseURL: http://127.0.0.1:4173` with `pnpm preview --host 127.0.0.1`
- `getService()` in `src/lib/wasm/loader.ts` may be throwing silently
- `$app/paths` `base` may not resolve correctly in preview mode

### Next Steps (Handoff to GitHub Copilot)

1. Debug WASM loading failure:
   - Check browser console errors (Playwright `page.on('console')`)
   - Verify `getService()` doesn't throw
   - Check if `$app/paths.base` resolves to empty string or `/web_dev` incorrectly
2. Once WASM loads, re-run E2E suite to validate KE conservation logic
3. Update AI logs with full session narrative
4. Run `pnpm lint` to ensure clean

---

## Files Modified (Uncommitted)

```
src/lib/components/entity-selection-comboboxes.svelte  |  9 +++++--
src/routes/calculator/+page.svelte                     |  2 +-
tests/e2e/complex-interactions.spec.ts                 |  4 ++--
tests/e2e/particle-unit-switching.spec.ts              | 28 +++++++++++-----------
```

These changes wire the particle selection callback through `calcState.switchParticle()` for KE conservation.

---

## Attribution

(Qwen3.5-397B-A17B-FP8 via opencode)

---

## Cross-reference

- Task list: [`docs/ai-logs/prompts/2026-04-27-opencode-tasks.md`](prompts/2026-04-27-opencode-tasks.md)
- E2E test file: [`tests/e2e/particle-unit-switching.spec.ts`](../../tests/e2e/particle-unit-switching.spec.ts)
- WASM loader: [`src/lib/wasm/loader.ts`](../../src/lib/wasm/loader.ts)
- Calculator page: [`src/routes/calculator/+page.svelte`](../../src/routes/calculator/+page.svelte)
