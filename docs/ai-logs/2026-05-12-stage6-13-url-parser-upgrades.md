# Stage 6.13 URL Parser Upgrades

**Date:** 2026-05-12
**Stage:** 6.13 (URL version negotiation, duplicate-param resolution, unknown-param drop)
**Model:** (Qwen3.5-397B-A17B-FP8 via opencode)
**Branch:** `qwen/stage6-13-url-parser`

## Summary

Implemented URL parser upgrades per spec revision v5: (1) urlv version negotiation with incompatible-version banner, (2) duplicate-param last-wins resolution, (3) unknown-param drop. All 6 acceptance scenarios covered by E2E tests. 1075 unit tests pass, 7 E2E tests pass.

## Tasks Completed

### Task 1: negotiateVersion() utility
- Created `src/lib/utils/url-version.ts` with `CURRENT_URL_MAJOR=1`, `MIN_SUPPORTED_URL_MAJOR=1`
- Implemented `negotiateVersion(version: string | null | undefined): VersionNegotiationResult` — returns `{ status: "ok" }` or `{ status: "mismatch"; version: number | string }`
- Handles missing urlv (compatible), valid urlv=1 (compatible), urlv=999 (incompatible), malformed urlv (incompatible with the raw token preserved)
- 5 unit tests in `src/tests/unit/url-version.test.ts`

### Task 2: Duplicate-param + unknown-param resolution
- Added `resolveLastWins(params: URLSearchParams): URLSearchParams` helper to `src/lib/utils/calculator-url.ts` and `src/lib/utils/plot-url.ts`
- Uses `URLSearchParams.set()` to ensure last occurrence wins for each key
- Unknown params automatically dropped (only known keys extracted)
- Unit tests + contract tests verify behavior

### Task 3: UrlVersionWarningBanner component
- Created `src/lib/components/url-version-warning-banner.svelte`
- Props: `onLoadDefaults()`, `onTryMigration()` (latter reserved for future migration logic)
- Uses bits-ui primitives, data-testid="url-version-warning"
- 4 component tests

### Task 4: Calculator page urlv wiring
- Added `urlVersionMismatch`, `urlVersionChecked`, and `urlInitialized` state so negotiation stays separate from URL restore/write gating
- Separate `$effect` for URL version negotiation that runs BEFORE WASM loads (critical for banner visibility even if WASM fails)
- Moved URL init logic into `$effect` with `untrack()` for `replaceState` call (Entry 7 compliance)
- Banner renders at lines 1068-1073

### Task 5: Plot page urlv wiring
- Cross-page parity with Calculator: separate `$effect` for URL version check using `urlVersionChecked`
- Advanced mode URL init in separate `$effect` (no more mode-switch infinite loop risk)
- Banner renders at lines 595-598

### Task 6: E2E tests
- Created `tests/e2e/url-parser.spec.ts` with 7 tests covering all 6 acceptance scenarios:
  1. urlv=999 shows banner
  2. load-defaults works from banner
  3. urlv=1 no banner
  4. missing urlv no banner
  5. custom compound restore (E_low, density)
  6. duplicate params last-wins
  7. unknown params dropped
- Tests use `expect.poll()` instead of `waitForTimeout()` (Entry 12 compliance)

## Key Decisions

1. **Separate $effect for URL version negotiation:** Required on both pages — must run immediately on page load, independent of WASM state, to show banner even if WASM fails to load.

2. **Separate negotiation and restore flags:** Both pages keep `urlVersionChecked` separate from `urlInitialized` so version negotiation cannot enable URL writes before initial URL restore has completed.

3. **Scenario 4 exercises WASM when available:** The custom-compound round-trip E2E skips only when local WASM binaries are absent; when present it asserts a positive stopping-power cell.

4. **resolveLastWins uses set():** `URLSearchParams.set()` automatically implements last-wins semantics — each subsequent call with same key overwrites previous value.

## Validation

```
pnpm test           # 1075 passed
pnpm test:e2e       # 7 passed (url-parser suite)
pnpm lint           # clean
```

## Files Modified

- `src/lib/utils/url-version.ts` (new)
- `src/lib/utils/calculator-url.ts` (resolveLastWins helper)
- `src/lib/utils/plot-url.ts` (resolveLastWins helper)
- `src/lib/components/url-version-warning-banner.svelte` (new)
- `src/routes/calculator/+page.svelte` (urlv wiring, separate $effect)
- `src/routes/plot/+page.svelte` (urlv wiring, separate $effect)
- `tests/e2e/url-parser.spec.ts` (7 E2E tests)
- `src/tests/unit/url-version.test.ts` (4 unit tests)
- `.opencode/tasks/qwen/stage6-13-url-parser.md` (task tracker)

## Review follow-up (GPT-5.5 via GitHub Copilot coding agent)

Applied PR #457 review-thread fixes:

- Removed unrelated formatting churn from prior commits and archived the raw
  opencode transcript as
  `docs/ai-logs/2026-05-12-stage6-13-url-parser-qwen-session.md`.
- Split Plot URL negotiation state (`urlVersionChecked`) from URL restore/write
  state (`urlInitialized`) so `decodePlotUrl()` still runs before canonical URL
  writes.
- Gated Calculator advanced-only URL params on `isAdvancedMode.value` and
  `multiProgState`, fixing Advanced→Basic URL canonicalization after opening an
  advanced share URL.
- Gated the custom-compound E2E scenario on WASM availability and asserted a
  positive stopping-power result when WASM is present.
- Used `MATERIAL_URL_ROUNDTRIP` to drive the material round-trip contract test.
- Added a regression E2E for loading the requested advanced URL and switching
  back to Basic mode.

## Second review follow-up (GPT-5.5 via GitHub Copilot coding agent)

Applied the follow-up comments from PR #457 review thread 4272107104:

- Switched `urlv` handling to strict full-token integer validation, preserving malformed tokens such as `1abc` in the mismatch result.
- Split Calculator `urlVersionChecked` from `urlInitialized`, matching the Plot gating pattern from Entry 29.
- Added `type="button"` to both warning-banner actions and component assertions for the attributes.
- Added Scenario 1a E2E coverage that the stopping-power cell is not numeric while the mismatch banner is visible.
- Corrected this log's model attribution and `negotiateVersion()` API narrative to match the implementation.
