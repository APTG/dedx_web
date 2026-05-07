# 2026-05-06 — Stage 6.8: Agent Instructions, E2E Timeouts, Redesign Plan Cleanup

**Model:** Claude Sonnet 4.5 via GitHub Copilot coding agent

---

## Session Narrative

### Prompt 1: Protect agents from reactive trigger bugs; add E2E timeout guidance; ensure Advanced Options is only in Advanced mode; fill AI logs; adjust redesign plan

**User request (comment_id 4386137644):**

> modify agent instructions especially for opencode to protect from such situations in
> the future. It seems more e2e tests are needed to protect from problems like lack of
> triggering. Check also e2e total running time and instruct agents to have proper
> timeout. Be sure that advanced selector where density can be adjusted is only visible
> in basic mode for calculator and plotter. Fill ai logs. Adjust redesign plan marking
> as completed what has just been done.

**Context:** Stage 6.8 had a long debugging chain where the density override did not
affect calculations in the browser, even though unit tests passed. The root cause was
that reactive state read only inside an async callback (`.then()` or `setTimeout`) is
not registered as a Svelte `$effect` dependency, so the effect never retriggers when
that state changes. This was fixed in commit `4e26713` by snapshotting reactive state
synchronously before any `await`/`.then()` call.

**AI response:**

1. **`.opencode/agents/implementer.md` — new rules added to E2E section:**
   - Replaced the existing bare E2E section with three new sub-rules:
     - **E2E test timeouts** — never use `waitForTimeout()`; use `waitForSelector`,
       `waitForFunction`, or `expect.poll` with explicit `timeout` values.
     - **E2E tests for reactive side effects** — mandatory pattern: read baseline
       value, change input, poll DOM until value changes, assert physical correctness.
       Explicit code example with density override.
     - **Reactive dep registration** — the synchronous snapshot pattern that prevents
       missed retriggers. Explicit `✅ CORRECT` vs `❌ WRONG` examples.

2. **`playwright.config.ts` — explicit timeouts:**
   - `timeout: 60000` — global per-test timeout (was unbounded)
   - `expect.timeout: 10000` — how long `expect(...).toBeVisible()` polls
   - `navigationTimeout: 30000` — for `page.goto()` / `page.waitForSelector()`
   - `actionTimeout: 10000` — for `page.click()` / `page.fill()` etc.

3. **Advanced Options panel visibility verified:**
   Both calculator (`src/routes/calculator/+page.svelte:513`) and plot
   (`src/routes/plot/+page.svelte:612`) already gate `<AdvancedOptionsPanel>` with
   `{#if isAdvancedMode.value ...}`. The panel is absent from the DOM in Basic mode.
   This was confirmed via grep — no further code changes needed.

4. **`docs/00-redesign-plan.md` — Stage 6.8 marked complete:**
   - Status line updated: includes "Advanced Options (6.8)" in the ✅ list.
   - Added row for 6.8 in the "Completed sub-stages" table.
   - Removed 6.8 from "Remaining sub-stages" table.
   - Updated recommended order: `6.7 → 6.9 → 6.11 → 6.10 → 6.12 → 6.13`.

---

## Tasks

### Update `.opencode/agents/implementer.md` with reactive trigger + E2E timeout rules

- **Status**: completed
- **Stage**: 6.8 (hardening)
- **Files changed**: `.opencode/agents/implementer.md`
- **Decision**: Added three new sub-sections inside the existing "E2E tests" block
  rather than a separate top-level section, to keep the mandatory checklist cohesive.
  The reactive dep rule is placed in the same area as the Svelte 5 `$effect`
  self-dependency prevention section for discoverability.
- **Key rules added**:
  - Never use `waitForTimeout()` — use condition-based waits.
  - Individual WASM-dependent tests may use `test.setTimeout()` to extend beyond the global 60 s.
  - For every feature that computes a value from reactive state, write an E2E test
    that verifies the reactive wiring (not just the math).
  - Always snapshot reactive state synchronously before async calls in `$effect`.

### Add explicit timeouts to `playwright.config.ts`

- **Status**: completed
- **Stage**: 6.8 (hardening)
- **Files changed**: `playwright.config.ts`
- **Decision**: 60 s global test timeout is generous enough for WASM loading scenarios
  in CI. Individual tests that need more time (e.g., WASM initialization) should call
  `test.setTimeout(90000)`.

### Mark Stage 6.8 as complete in redesign plan

- **Status**: completed
- **Stage**: 6.8
- **Files changed**: `docs/00-redesign-plan.md`
- **Decision**: Added PR link [#427] and session log reference to the completed table.
