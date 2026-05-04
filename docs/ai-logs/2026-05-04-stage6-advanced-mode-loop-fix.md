# 2026-05-04 — Stage 6: Fix effect_update_depth_exceeded in Advanced Mode

## Session Narrative

### Prompt 1: Move opencode transcript, fix infinite effect loop, fix E2E tests, fill AI logs

**AI response**: Session continues from a previous context. Work done:

1. **Moved session transcript** `session-ses_20be.md` → `docs/ai-logs/2026-05-04-stage6-multi-program-qwen-session.md` (the raw Qwen3.5 opencode session for Stage 6 multi-program implementation).

2. **Fixed `effect_update_depth_exceeded`** when clicking the Advanced mode toggle. Root cause was a two-part reactive loop in `src/routes/calculator/+page.svelte`:

   - **Part 1** (fixed in previous session): The multiProgState creation `$effect` read `page.url.searchParams` to decode URL params, creating a reactive dependency on `page.url`. Every `replaceState` call from the URL update effect updated `page.url`, re-triggering the creation effect, which destroyed and recreated `multiProgState`, which re-triggered the URL update effect — infinite loop.  
     Fix: replaced `page.url.searchParams` with `new URLSearchParams(window.location.search)` (non-reactive DOM API).

   - **Part 2** (fixed in this session): The creation effect called `multiProgState.setAdvancedMode(true)`, `multiProgState.addProgram(...)`, etc. — each of these reads the outer reactive `multiProgState` signal (Svelte 5 tracks the signal read to get the object). Since the effect also writes `multiProgState = createMultiProgramState()`, it creates a self-dependency: the effect writes `multiProgState` → the write schedules the effect to re-run → the effect runs again and creates a NEW object → writes again → re-triggers indefinitely, hitting Svelte's `~100 depth` limit.  
     Fix: use a local variable `newState` for all initialization, then write `multiProgState = newState` ONCE at the very end after all setup is done. This way the effect never reads the outer `multiProgState` signal during its body.

   - **Part 3** (applied in this session): `replaceState(next, page.state)` at the end of the URL update effect reads `page.state` reactively. When `replaceState` updates the SvelteKit page store, `page.state` gets a new object reference, re-triggering the URL update effect. While the URL guard (`if (next === currentUrl) return`) SHOULD stop the loop after one extra run, combined with Part 1/2 pathways the accumulation reached the depth limit.  
     Fix: `untrack(() => replaceState(next, page.state))` breaks the reactive dependency on `page.state`.

3. **Fixed E2E test `toolbar.spec.ts:41`** (Share URL clipboard mismatch): Share URL button was clicked before WASM loaded and URL sync ran, so the clipboard got the bare `/calculator` URL while `page.url()` later had query params. Fix: added `waitForFunction(() => window.location.search.includes("particle="))` before clicking.

4. **Fixed E2E test `calculator-url.spec.ts:27`** (`:keV` never appeared in URL): the URL update effect was calling `encodeCalculatorUrl({...}).toString()` which percent-encodes `:` → `%3A` and `,` → `%2C`. Fix: switched to `calculatorUrlQueryString()` (which calls `.replaceAll("%3A", ":").replaceAll("%2C", ",")`) so URLs are human-readable (`energies=100,500:keV`). The test was then blocked by the still-active infinite loop from Part 2 (which disabled the URL update effect). After Part 2 fix, this test also passes.

5. **Added regression tests** in `tests/e2e/calculator-advanced.spec.ts`:
   - "Clicking Advanced does not throw effect_update_depth_exceeded" — captures `pageerror` events and asserts none include that message after clicking the Advanced toggle.
   - "Toggling Advanced on/off/on does not cause errors" — full on→off→on cycle.
   - "Advanced mode URL contains mode=advanced after toggling on" — `waitForFunction` for `mode=advanced` in URL.

6. **Updated AI logs**: added qwen-session link to Stage 6 multi-program CHANGELOG row, added this session's log and CHANGELOG row, updated `docs/ai-logs/README.md`.

## Tasks

### Fix effect_update_depth_exceeded on Advanced mode toggle

- **Status**: completed
- **Stage**: Stage 6 (multi-program comparison)
- **Files changed**:
  - `src/routes/calculator/+page.svelte` — three fixes: local `newState` variable in creation effect, `untrack(() => replaceState(...))` in URL update effect, `calculatorUrlQueryString` for human-readable URLs
- **Decision**: Used local variable pattern instead of `untrack` for the creation effect self-dependency, because `untrack` would still let the effect re-run (it just breaks the specific dependency), whereas using a local variable prevents the outer signal from being read at all. For the `replaceState` / `page.state` dependency, `untrack` is the right tool — we still want to pass `page.state` (for SvelteKit navigation state), we just don't want it as a reactive dependency.
- **Issue**: The Svelte 5 `effect_update_depth_exceeded` error surfaces as a URL on the `pageerror` event (`https://svelte.dev/e/effect_update_depth_exceeded`), not a stack trace. The regression tests check for the string "effect_update_depth_exceeded" in `pageerror` event messages.

### Fix E2E tests

- **Status**: completed
- **Stage**: Stage 6
- **Files changed**:
  - `tests/e2e/toolbar.spec.ts` — added `waitForFunction` for URL sync before clipboard copy
  - `tests/e2e/calculator-url.spec.ts` — was already correct after URL encoding fix
  - `tests/e2e/calculator-advanced.spec.ts` — replaced 5 skipped tests with 3 active regression tests

### Fill AI logs

- **Status**: completed
- **Files changed**:
  - `CHANGELOG-AI.md` — added qwen-session link to Stage 6 row; added this session row
  - `docs/ai-logs/README.md` — added qwen-session row and this session row
  - `docs/ai-logs/2026-05-04-stage6-multi-program-qwen-session.md` — moved from repo root
  - `docs/ai-logs/2026-05-04-stage6-advanced-mode-loop-fix.md` — this file
