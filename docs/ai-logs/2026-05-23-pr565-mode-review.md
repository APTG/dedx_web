# 2026-05-23 — PR #565 mode review follow-up

## Session Narrative

### Prompt 1: Fix PR #565 review comments and additional mode feedback

**AI response**: Inspected PR #565 review comments, current changelog/progress,
and the URL schema docs/tests. Updated the v2 URL contract so
`mode=basic|advanced` is explicit again, calculator operation moved to
`calc=forward|range|inverse-stp`, and advanced compare-across supports
axis-specific plural lists (`particles=`, `materials=`, `programs=`) gated by
matching `across=`. Applied remaining review cleanups in tests and ADR text,
updated cross-spec banners/indexes, added a lessons-learned entry, and validated
with targeted calculator URL unit tests plus Prettier. `pnpm check` still fails
on pre-existing unrelated Svelte/TypeScript diagnostics in entity-selection,
external-data, and calculator components.

## Tasks

### URL schema mode correction

- **Status**: completed
- **Stage**: Schema work / PR #565
- **Files changed**:
  - `docs/04-feature-specs/shareable-urls.md`
  - `docs/04-feature-specs/shareable-urls-formal.md`
  - `docs/04-feature-specs/entity-selection.md`
  - `docs/04-feature-specs/README.md`
  - `docs/04-feature-specs/advanced-options.md`
  - `docs/04-feature-specs/custom-compounds.md`
  - `docs/04-feature-specs/inverse-lookups.md`
  - `docs/04-feature-specs/multi-program.md`
  - `docs/00-redesign-plan.md`
  - `docs/decisions/006-url-schema-v2.md`
  - `src/tests/unit/calculator-url.test.ts`
  - `.opencode/lessons-learned.md`
- **Decision**: Keep `mode=basic|advanced` as the explicit picker-mode token and
  introduce `calc=` for forward/range/inverse-STP operation to avoid overloading
  one URL key.
- **Issue**: `pnpm check` remains blocked by unrelated pre-existing diagnostics.
