# 2026-05-07 — Stage 6.9 Inverse Lookups Implementation (opencode session)

**Model:** Qwen3.5-397B-A17B-FP8 via opencode (session ses_1fcf11fd6ffeB6DJ7XZgtD1ZoB)

## Session Narrative

### Prompt 1: Stage 6.9 Inverse Lookups — full implementation

Qwen was given the 5-task TDD prompt from
`docs/ai-logs/prompts/2026-05-07-stage6-9-inverse-lookups.md`.

**AI response**: Implemented all five tasks:

1. **WASM service interface** (`src/lib/wasm/libdedx.ts`, `src/lib/wasm/types.ts`):
   Added `getInverseStp`, `getInverseCsda`, `getBraggPeakStp`, `getDensity`,
   `convertEnergy` to `LibdedxService` interface and `LibdedxServiceImpl`.
   Updated the mock in `src/lib/wasm/__mocks__/`.

2. **Calculator URL codec** (`src/lib/utils/calculator-url.ts`):
   Added `imode`/`ivalues`/`iunit` round-trip encoding for inverse lookup state.

3. **Range suffix parser + energy scaling** (`src/lib/utils/range-suffix-parser.ts`,
   `src/lib/utils/energy-auto-scaling.ts`):
   Parser handles `nm`, `µm`, `mm`, `cm`, `m` suffixes and rejects `km`.
   Auto-scaling converts raw energy to display unit.

4. **Calculator tab switcher + Range tab** (`src/routes/calculator/+page.svelte`,
   `src/lib/state/inverse-lookups.svelte.ts`):
   Three-tab UI (Forward / Range / Inverse STP) with tab state management.
   Range tab: CSDA-range-to-energy lookup with per-row validation.

5. **Inverse STP tab** + multi-program column layout + export filename changes.

### Post-implementation: reactivity bug fix

**Issue**: Tab switching was broken — clicking "Range" did not update the UI.

**Root cause**: In `createInverseLookupState()`, `activeTab` was declared as a
plain `let` variable. Svelte 5 requires `$state` for reactive primitives inside
factory functions that return getter/setter objects.

**Fix** (commits `e85cccc`, `bf03e83`): Wrapped `activeTab` in
`const state = $state<{ activeTab: ActiveTab }>({ activeTab: "forward" })`.
Updated all reads and writes to go through `state.activeTab`. Along the way
discovered and removed a spurious `set activeTab` setter that tried to reassign
a `$state`-const binding (Svelte compile error `constant_assignment`).

### E2E test status at session end

After the reactivity fix, 3 of 6 E2E tests still fail. All three failures share
the same root cause in the test code:

```ts
const energyText = await expect
  .poll(async () => (await result.textContent())?.trim(), { timeout: 15000 })
  .toMatch(/^\d+(\.\d+)?\s*(MeV|GeV)?$/);
// ↑ Playwright assertion returns void — energyText is undefined
expect(parseFloat(energyText!)).toBeGreaterThan(0);  // NaN > 0 → fails
```

`expect.poll().toMatch()` is a `void`-returning assertion; the variable capture
is a no-op. Fix is to poll the text separately, then `parseFloat` on the actual
DOM content.

## Tasks

### Task 1–5: Full Stage 6.9 implementation

- **Status**: partial (core feature works; 3 E2E tests still failing due to test bug)
- **Stage**: 6.9 (Inverse Lookups)
- **Files changed**:
  - `src/lib/wasm/libdedx.ts`
  - `src/lib/wasm/types.ts`
  - `src/lib/wasm/__mocks__/libdedx.ts`
  - `src/lib/utils/calculator-url.ts`
  - `src/lib/utils/range-suffix-parser.ts` (new)
  - `src/lib/utils/energy-auto-scaling.ts` (new, or integrated into calculator)
  - `src/lib/state/inverse-lookups.svelte.ts` (new)
  - `src/routes/calculator/+page.svelte`
  - `tests/e2e/inverse-lookups.spec.ts` (new)
  - Various unit tests
- **Decision**: Range tab uses `activeTab === "csda"` internally (not "range") for
  URL codec consistency; tab button `data-testid="inverse-tab-range"` for the UI.

### Reactivity fix

- **Status**: completed
- **Files changed**: `src/lib/state/inverse-lookups.svelte.ts`
- **Decision**: Used `$state<{ activeTab: ActiveTab }>({...})` wrapper object
  rather than `$state<ActiveTab>("forward")` because primitives declared `const`
  with `$state` cannot be reassigned — only object properties can be mutated.

## Known issues / follow-up

### WASM inverse lookup calling convention mismatch (CRITICAL)

The TypeScript `EmscriptenModule` interface in `libdedx.ts` declares:

```ts
_dedx_get_inverse_stp(program_id, particle_id, material_id, stp, side, err_ptr): number;
_dedx_get_inverse_csda(program_id, particle_id, material_id, range, err_ptr): number;
_dedx_get_bragg_peak_stp(program_id, particle_id, material_id, err_ptr): number;
```

But the actual C signatures (from `libdedx/include/dedx_tools.h`) are:

```c
double dedx_get_inverse_stp(dedx_workspace *ws, dedx_config *config, float stp, int side, int *err);
double dedx_get_inverse_csda(dedx_workspace *ws, dedx_config *config, float range, int *err);
```

The functions take **workspace and config pointers**, not flat integer IDs.
Calling them with integer IDs passes garbage heap addresses — the functions will
either segfault inside WASM or return meaningless results.

`_dedx_get_bragg_peak_stp` **does not exist** anywhere in the C codebase or
WASM exports. It was hallucinated by the model.

The current E2E tests work with the mock (`__MOCK_INVERSE_CSDA_RESULTS`) but
will silently produce wrong results against real WASM.

### Recommended fix: JavaScript wrapper using existing `calculate()` method

Implement inverse lookups entirely in TypeScript using the existing forward
`calculate()` call that already correctly retrieves STP and CSDA tables:

**Inverse CSDA** (monotonic — range increases with energy):
1. Call `calculate()` on a dense energy grid (e.g. 500 log-spaced points from
   E_min to E_max).
2. Binary search the returned `csdaRanges` array for the target range value.
3. Linearly interpolate between adjacent grid points.

**Inverse STP** (non-monotonic — has Bragg peak):
1. Call `calculate()` on the same dense grid.
2. Find the index of the maximum STP value = Bragg peak position.
3. For `side=0` (low-energy branch): binary search in `[0, braggIdx]`.
4. For `side=1` (high-energy branch): binary search in `[braggIdx, N-1]`.
5. Interpolate as above.

**Bragg peak STP**: `Math.max(...result.stoppingPowers)` from the grid.

This approach:
- Requires no WASM rebuild
- Avoids the workspace/config struct layout complexity
- Works with all interpolation modes already handled by `calculate()`
- Is testable without WASM (mock can return a STP curve)

Alternative: add flat C wrappers to `wasm/dedx_extra.c` that handle
workspace allocation internally, then rebuild WASM. Higher accuracy but
requires Docker + WASM rebuild.
