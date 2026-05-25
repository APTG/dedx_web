# Unit Test Fix for Entity Selection Idempotency

**Date:** 2026-05-25
**Agent:** Antigravity via opengravity

## Issue
One unit test in `src/tests/unit/entity-selection-tabbed.test.ts` was failing (`setAcross + toggleMulti maintain the multi-selection state`). The test was expecting `state.multiSelected.program` to be `[7, 9]` but it was only `[9]`.

## Solution
In the previous commit, `setAcross(dim)` was updated to be idempotent (`if (this.across === dim) return;`). This prevents infinite reactivity loops in Svelte 5.
However, the unit test relied on the old non-idempotent behavior to re-seed the `multiSelected` array by calling `setAcross("program")` a second time after modifying the single `selectedProgramId`.
Removed the duplicate `setAcross("program")` call in the test, so `selectProgram(7)` sets the selected ID, and then `setAcross("program")` correctly seeds the multi array to `[7]`.

## Outcome
All unit tests now pass successfully.
