# 2026-05-29 — Refactor URL parser to the formal §6 layered architecture (Issue #477)

## Session Narrative

### Prompt 1–5: Feasibility, plan, grammar design

The maintainer asked whether #477 could be done in a single PR by Claude Opus 4.8,
and to prepare an action plan. Investigation found the issue (written 2026-05-14)
had gone stale: it assumed v1 was frozen and `migrateUrl` was a stub, but the
codebase had already moved to `urlv=2` and the spec to v7, whose §5 conformance
vectors require real v2 behaviour. Surfaced the contradiction; the maintainer
decided **v2-only, drop v1 backward-compat** (show an "unsupported" message),
and to adjust the specs.

Iterated on the parser design with the maintainer:

- They wanted the grammar visible in source and an AST (not a flat token record),
  and chose a **parsing library** (Peggy) with AST types in a separate module.
- They emphasised **precise, span-accurate error messages** pointing at the exact
  offending spot in a malformed URL.

The full plan + error-reporting design was posted to the issue
(comment 4572154960).

### Prompt 6: Implement end-to-end (this session)

Implemented on `claude/beautiful-brahmagupta-U0LKH`, committing per increment,
opening draft PR #659 after the first push, keeping GHA static + unit + E2E green.

## Tasks

### Layered URL parser (parseQuery → resolveState → canonicalize) + diagnostics

- **Status**: implemented (core complete; behaviour-preserving)
- **Stage**: Refactoring (issue #477)
- **Files changed**:
  - `src/lib/utils/url-grammar.peggy` — executable PEG grammar (v2), structured
    AST with graceful raw-fallback for malformed list values.
  - `src/lib/utils/url-ast.ts` — AST node types with per-node `SourceSpan`.
  - `src/lib/utils/url-parse.ts` — `parseQuery(string | URLSearchParams)`; throws
    `UrlParseError` (fatal diagnostic) on genuinely broken structure.
  - `src/lib/utils/url-diagnostics.ts` — `Diagnostic`, `renderCaret`,
    `friendlyExpected`.
  - `src/lib/utils/url-shared.ts` — `buildTokenView` (last-wins, decoded, mirrors
    `URLSearchParams.get`), `parseCustomCompound`, strict number parsers,
    `encodeMatElements` — de-duplicates calculator/plot internals.
  - `src/lib/utils/calculator-url.ts`, `plot-url.ts` — `decode*` now wrap
    `parseQuery` + exported `resolveCalculatorState` / `resolvePlotState`.
  - `src/lib/utils/url-version.ts` — `MIN_SUPPORTED_URL_MAJOR = 2`, `migrateUrl`
    identity seam.
  - `src/lib/components/url-version-warning-banner.svelte` — version-aware copy
    (older majors → "no longer supported").
  - `vite.config.ts` — inline Peggy loader (shared by Vitest); no committed
    generated parser. `src/lib/utils/url-grammar.d.ts` types the import for tsc.
  - Tests: `url-parse.test.ts`, `url-diagnostics.test.ts`, `url-shared.test.ts`,
    `url-resolve.test.ts`, extended `url-version.test.ts`.
  - Docs: `src/routes/docs/technical/+page.svelte` (published grammar + diagnostics
    page), `docs/04-feature-specs/shareable-urls-formal.md` (v8: v1 retired §3.4,
    version step §3.1.5, diagnostics §3.9, implemented architecture §6).
- **Decision**: Preserve observable URL behaviour rather than rewrite the wire
  format to the aspirational `uanchor`/`calc`/`runit` v2 tokens. The grammar
  models the **currently emitted** param set; the existing ~1600-test suite is
  the oracle. The resolvers read through a decoded last-wins `TokenView`, so
  `t.get(key)` ≡ the legacy `params.get(key)` and ports are mechanical.
  `parseQuery` keeps ALL duplicates in the AST; last-wins is a resolver concern
  (§3.2), keeping the parser pure.
- **Decision**: List-bearing params parse into structured items only when the
  whole value is clean; otherwise the rule falls back to a verbatim `raw` value
  that the resolver splits exactly as the legacy decoder did — guaranteeing
  byte-identical behaviour while still giving a structured AST for clean input.
- **Issue / remaining**: Wiring the resolver `diagnostics` list into a richer UI
  banner (beyond the version banner) is left as a follow-up; the version-mismatch
  path already covers v1/unsupported links. The full v2 canonical-schema
  modernisation (always-emit `uanchor`, `calc`/`runit`/`sunit`) remains out of
  scope per the maintainer's decision and can be a separate issue.
- **Verification**: `pnpm test` (1624 passing; the only failures are the
  pre-existing sandbox git-signing issue in `guard-forbidden-files.test.ts`),
  `pnpm run check`, `pnpm lint`, `pnpm run format:check`, and `pnpm build` all
  pass locally. CI (static-analysis, unit, all 3 E2E shards, WASM, CodeQL) was
  green on the foundation commit.
