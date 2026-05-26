# 2026-05-26 — PR #614 review-thread fixes

## Session Narrative

### Prompt 1: Fix all comments from review thread in PR #614 and failing E2E tests

**AI response**: Pulled PR #614 review comments, identified all actionable issues, and investigated failing CI runs (`26444501029`) via GitHub Actions logs. Confirmed failing E2E cases in `calculator-url.spec.ts` and `particle-grid-view.spec.ts`, then applied focused fixes to the commented files only.

### Prompt 2: Implement requested code and test corrections

**AI response**: Updated particle grid rendering to match the responsive scan-grid contract, enforced mobile 44px tile minimums, fixed empty-state behavior when only external particles match, canonicalized URL `across` tokens to plural forms with singular decode aliases, gated `across` decode on matching valid list params, and tightened E2E assertions for unavailable tiles and mobile behavior.

## Tasks

### PR #614 review comments + E2E follow-up

- **Status**: completed
- **Stage**: Stage 5 — entity-selection
- **Files changed**:
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/state/calculator-url-sync.svelte.ts`
  - `src/lib/state/entity-selection.svelte.ts`
  - `src/lib/utils/calculator-url.ts`
  - `src/tests/unit/calculator-url.test.ts`
  - `tests/e2e/calculator-url.spec.ts`
  - `tests/e2e/particle-grid-view.spec.ts`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-05-26-pr614-review-thread-fixes.md`
- **Decision**: Kept internal across state as singular (`particle|material|program`) for app compatibility, but made URL encoding canonical plural (`particles|materials|programs`) and decode accept both singular/plural.
- **Decision**: In URL decode, only retain `across` when the matching comparison list is present and valid to prevent non-round-trippable state.
- **Issue**: Local Playwright validation for the edited E2E specs is blocked without `static/wasm/libdedx.mjs`; CI remains the authoritative E2E verification path for these scenarios.
