# 2026-05-29 — Gate URL hydration on version negotiation (PR #659 review)

## Session Narrative

### Prompt 1: Address the PR #659 review comments

**AI response**: Four review threads were on PR #659. Three (UrlParseError catch
on the calculator/plot decode boundaries, and key normalization for
percent-encoded keys) were already fixed in commit `3023b1e`. The remaining
thread (Copilot, on `url-version.ts:24`) flagged that recording a version
mismatch only _halts the calc_ — it did not prevent URL state from being
hydrated — contrary to the new "rejected, not migrated" contract. I had left
that thread open for the maintainer to choose between (a) tightening the spec to
match the calc-only halt, or (b) implementing stricter input-level gating. The
maintainer chose **(b) full input-level gating**.

**What was implemented**: gate every URL→state hydration point on the
negotiation result, on both orchestrators, so an unsupported `urlv` hydrates
nothing and the page sits at defaults behind the banner.

- **Calculator** (`calculator-page-orchestrator.svelte.ts`):
  - Effect 1 reordered so version negotiation runs _before_ advanced-mode init,
    then both `initAdvancedModeFromUrl(...)` and `appInit.initialize(...)` use
    `new URLSearchParams()` (defaults) when mismatched.
  - Effect 2 (`decodeCalculatorUrl`) decodes empty params when mismatched →
    entity selection / energy rows / inverse lookups stay at defaults.
  - Multi-program decode (`decodeMultiProgramUrl`) also gated, because advanced
    mode can be active via the persisted localStorage preference even when the
    URL's `mode` param is suppressed, and it reads `window.location.search`
    directly.

- **Plot** (`plot-page-orchestrator.svelte.ts` + `plot-url-restore.svelte.ts`):
  - Version negotiation moved out of a free-standing `$effect` into a
    **synchronous** block at the top of `setupEffects()`. `$effect` callbacks run
    after construction, so this guarantees `urlVersionMismatch` is resolved
    before the init / advanced-mode / restore effects fire (the previous
    separate effect had no ordering guarantee against them).
  - `appInit.initialize(...)` and `initAdvancedModeFromUrl(...)` use default
    params when mismatched.
  - `setupPlotUrlRestore` gained an optional `getUrlVersionMismatch` getter;
    when mismatched it skips restoration entirely but still calls `onComplete()`
    so `urlInitialized` flips and URL-sync can emit the canonical default URL
    (matching the calculator, which flips `urlInitialized` unconditionally). The
    banner is state-driven, so it persists regardless of the URL rewrite.

- **Load-defaults recovery**: unchanged handlers (`goto("/calculator"|"/plot")` +
  clear `urlVersionMismatch`). Because init now already produced defaults,
  clearing the mismatch simply opens the calc gate and the page computes from
  defaults — verified against E2E scenario 1b, whose `stp-cell-0 > 0` assertion
  holds since the default energy row is `"100"` with the default proton/water
  selection.

- **Spec**: `shareable-urls-formal.md` §3.1 steps 5c–5e now state explicitly that
  no state is hydrated; removed the stale step-15 "v1-migration banner" line
  (step 5c halts before the v2 parse path) and added a note that steps 6–14 run
  only when 5a/5b proceed.

## Tasks

### Full input-level gating of URL hydration on version mismatch

- **Status**: completed
- **Stage**: URL parser refactor follow-up (Issue #477 / PR #659)
- **Files changed**:
  - `src/lib/state/calculator-page-orchestrator.svelte.ts`
  - `src/lib/state/plot-page-orchestrator.svelte.ts`
  - `src/lib/state/plot-url-restore.svelte.ts`
  - `docs/04-feature-specs/shareable-urls-formal.md`
  - `CHANGELOG-AI.md`
- **Decision**: Suppress hydration by feeding empty `URLSearchParams` to the
  decoders rather than branching each assignment — minimal, uniform, and keeps
  the decode functions as the single source of defaults. For plot, made
  negotiation synchronous to get a hard ordering guarantee instead of relying on
  effect registration order.
- **Decision**: `initAdvancedModeFromUrl(empty)` is a no-op, so a user's
  persisted advanced-mode preference survives an unsupported link — only the
  link's `mode`/state is suppressed, which is the intended "don't hydrate from
  the link" semantics (not "force basic mode").
- **Issue**: none outstanding. `pnpm check`, `lint`, `format:check` green; unit
  suite green except the pre-existing sandbox git-signing failures in
  `guard-forbidden-files.test.ts` (pass on CI).
