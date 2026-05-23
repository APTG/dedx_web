# 2026-05-18 — Issue #538: Fix plotting via jsroot UMD bundle

## Session Narrative

### Prompt 1: Read issue #538, look at screenshot, come up with a plan

**AI response**: Fetched issue #538 via `gh`. The screenshot and console log showed
`JSROOT module race (attempt 1–4), retrying…` followed by `JsrootPlot error: TypeError:
can't access property "jsroot" of undefined`. All five retry attempts (introduced in #537)
failed, meaning the error is persistent — not a transient timing race.

Diagnosed root cause by tracing `ObjectPainter.mjs:1828`:

```js
Object.assign(internals.jsroot, { ObjectPainter, cleanup, resize });
```

`internals` is imported from `core.mjs`. In Rollup's production bundle, the static import
graph is linearised; when jsroot 7.11.0 added `import('@resvg/resvg-js')` in
`BasePainter.mjs` (aliased to a local shim), Rollup changed its chunk-split decisions and
now evaluates `ObjectPainter.mjs` top-level code before `core.mjs` initialises `internals`.
The error is structural — retrying never helps.

Proposed three options:

1. Pin jsroot to 7.10.3 (quick, fights dependabot)
2. Make `@resvg/resvg-js` a Rollup external (uncertain fix)
3. Load jsroot via its own pre-built UMD bundle (definitive fix)

### Prompt 2: Check past commits at end of stage 6 to understand what was different

**AI response**: Traced the exact version history:

- Stage 6 end (3863744, May 13 08:55 UTC): jsroot `7.10.3` via `^7.9.0` in package.json
- 17 minutes later (3cf5e09, May 13 09:12 UTC): dependabot bumped to jsroot `7.11.0`
- May 15 (59b26fe): second bump PR also added `@resvg/resvg-js` alias to vite.config.ts

Key finding: `git diff 232bb59 1197b14` on the vendor/jsroot submodule showed NO changes
in `ObjectPainter.mjs` or `main.mjs` between versions — the circular dependency was always
latent. The 7.11.0 changelog entry "Use `resvg-js` backend for PNG support in node.js"
introduced the `import('@resvg/resvg-js')` dynamic import in `BasePainter.mjs`. This new
cross-boundary dynamic import (node_modules → src/ shim) changed Rollup's module-graph
processing and exposed the pre-existing circular dep bug.

Confirmed 7.10.3 lockfile had no `@resvg` dependency; 7.11.0 lockfile added it.

### Prompt 3: Explain pros and cons of all three options in detail

**AI response**: Detailed comparison:

- **Option 1** (pin 7.10.3): trivial, confirmed working, but fights dependabot forever
- **Option 2** (Rollup external): small change, uncertain — doesn't guarantee evaluation
  order; Vitest handling complex
- **Option 3** (UMD bundle): most code, guaranteed — jsroot's own build has correct order;
  future-proof for all jsroot versions; removes jsroot from Vite bundle entirely

### Prompt 4: Implement option 3, commit, write AI logs

**AI response**: Implemented:

## Tasks

### Fix #538 — load jsroot via pre-built UMD bundle

- **Status**: completed
- **Stage**: Stage 8 (Open Beta / bug fixes)
- **Files changed**:
  - `vite.config.ts`
  - `.gitignore`
  - `src/lib/components/jsroot-plot.svelte`
  - `src/tests/components/jsroot-plot.test.ts`
- **Decision**:
  - Vite plugin `copy-jsroot-bundle` uses `buildStart()` hook (fires for both `dev` and
    `build`) to copy `node_modules/jsroot/build/jsroot.min.js` → `static/jsroot.min.js`.
    The static adapter then includes it in the deployment. `.gitignore` excludes it as a
    generated artifact.
  - `getJsroot()` is a per-instance function that first checks `globalThis.JSROOT` (set by
    the UMD script), then `_jsrootPromise` cache, then injects a `<script>` tag. This
    ensures jsroot is loaded exactly once even if the component mounts before the script
    completes.
  - `import type * as JSROOTNs from "jsroot"` provides TypeScript types without causing
    Vite to bundle jsroot's ESM modules. The `type JSROOTModule = typeof JSROOTNs` alias
    is used for cast sites.
  - `drawWithRetry` removed entirely — the root cause is fixed, retrying is no longer
    meaningful.
  - The existing `@resvg/resvg-js` alias remains in `vite.config.ts`, but it is no longer
    relevant to this fix because jsroot is now loaded via its pre-built UMD bundle instead
    of being processed through Rollup's ESM pipeline.
  - Tests: `vi.mock("$app/paths", () => ({ base: "" }))` added; `beforeAll` made async
    and sets `globalThis.JSROOT = await import("jsroot")` so the mocked JSROOT is found
    by `getJsroot()` without any script-tag injection in jsdom.
- **Result**: 1379/1379 tests pass. Fix is future-proof — works for any jsroot version
  whose UMD bundle is correctly ordered by jsroot's own build system.
