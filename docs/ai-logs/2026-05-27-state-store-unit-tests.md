# 2026-05-27 — Unit tests for headless calc setup functions

## Session Narrative

### Prompt 1: What to do next after merging PR #619

After the page decomposition PR was merged, I suggested adding unit tests for the
five new headless setup functions extracted from the calculator and plot pages.
The user confirmed: "Go with option 2 now, create a PR, remember about AI logs."

**AI response**: Wrote unit tests covering all five setup functions and a utility
module, creating five new test files.

### Prompt 2: Fix failing tests (continued from context overflow)

Several tests were failing due to two categories of bugs:

1. **Async timer flushing**: `vi.runAllTimers(); await Promise.resolve()` does not
   await async timer callbacks. The setup functions use
   `setTimeout(async () => { await getService(); ... }, 300)`, requiring
   `await vi.runAllTimersAsync()` which awaits the async continuation.

2. **Pending timer in `beforeEach`**: Tests that assert "does not run when mismatch
   is set" installed a spy *before* draining the `beforeEach`-established timer.
   When `vi.runAllTimersAsync()` fired, the initial (no-mismatch) timer called the
   service, tripping the spy. Fix: call `await vi.runAllTimersAsync()` before
   setting up the spy to drain the initial timer first.

3. **`toggleMulti` wrong call**: `entityState.toggleMulti(267)` passed only one
   argument; the signature is `toggleMulti(dim, id)`. Fixed to
   `entityState.toggleMulti("material", 267)`.

4. **`setAcross` no-op when already active**: `setAcross("material")` is a no-op
   when `across` is already `"material"` (line 594 guards on `across === newAcross`).
   The custom-compound test used `setAcross` to re-seed `multiMaterial` after
   changing the anchor, but this had no effect. Fixed by using
   `entityState.setMultiMaterial([created.compound.id])` directly.

**AI response**: Applied all fixes; all 44 new tests now pass.

## Tasks

### Write unit tests for headless calc setup functions

- **Status**: completed
- **Stage**: post-PR #619 (page decomposition)
- **Files changed**:
  - `src/tests/helpers/effect-root.svelte.ts` (new — wraps `$effect.root` for plain `.test.ts` files)
  - `src/tests/unit/inverse-units.test.ts` (new)
  - `src/tests/unit/multi-entity-calc.test.ts` (new)
  - `src/tests/unit/multi-program-calc.test.ts` (new)
  - `src/tests/unit/inverse-calc.test.ts` (new)
  - `src/tests/unit/plot-preview-calc.test.ts` (new)
- **Decision**: Plain `.test.ts` files cannot call `$effect.root()` directly
  (Svelte rune syntax is only compiled in `.svelte.ts` files). A thin
  `effect-root.svelte.ts` helper wraps the call so `.test.ts` files can access
  reactive roots.
- **Decision**: `plot-preview-calc` has no `setTimeout` debounce; it uses
  `getService().then(...)` directly, so tests use two `await Promise.resolve()`
  rather than `vi.useFakeTimers()` + `vi.runAllTimersAsync()`.
- **Issue**: Three pre-existing failures in `guard-forbidden-files.test.ts`
  (CI environment issue with git temp repos) were not touched.
