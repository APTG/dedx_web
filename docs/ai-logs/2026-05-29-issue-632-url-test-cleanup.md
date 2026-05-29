# 2026-05-29 — Clean up legacy URL tests (Issue #632)

## Session Narrative

### Prompt 1: Work on issue #632 — clean up legacy URL tests; ensure v2 unit tests cover all necessary scenarios; make a PR

**AI response**: Read issue #632, the test file `src/tests/unit/calculator-url.test.ts`, the
source `src/lib/utils/calculator-url.ts`, and the spec `docs/04-feature-specs/shareable-urls.md`.

Identified all `urlv=1` occurrences in the test file and classified each as:
- *Non-migration* (urlv=1 was incidental, not testing v1-specific params) → updated to `urlv=2`
- *Migration-specific* (used v1-only params like `qfocus=`) → moved to the migration `describe` block

Also identified missing v2 coverage: `mode=basic` explicit decode, `across=programs`
encode/decode, and `urlv=2` canonical decode.

## Tasks

### Reclassify `urlv=1` tests in `describe("decodeCalculatorUrl")`

- **Status**: completed
- **Files changed**: `src/tests/unit/calculator-url.test.ts`
- **Decision**: Changed `urlv=1` to `urlv=2` in 3 tests where urlv was incidental.
  Removed 2 tests that used v1-only `qfocus=both` param (moved to migration section
  with improved descriptions).
- **Tests changed**:
  - "decodes basic params" — urlv=1 → urlv=2
  - "decodes advanced mode with invalid program IDs" — urlv=1 → urlv=2; dropped incidental `qfocus=both`
  - "decodeCalculatorUrl returns advancedOptions only in advanced mode" — urlv=1 → urlv=2

### Replace v1 "parses all advanced options" test with v2 equivalent

- **Status**: completed
- **Decision**: Removed the v1 version from `describe("decodeCalculatorUrl")` and added a clean
  `urlv=2` version ("decodeCalculatorUrl parses all advanced options correctly (v2 canonical params)").
  Moved the v1 version to the migration section under "v1 parses all advanced options with qfocus=both".

### Remove v1 round-trip test from `describe("decodeCalculatorUrl")`

- **Status**: completed
- **Decision**: Moved "URL round-trip: encode(decode(url)) preserves all advanced options" (which used
  `urlv=1&qfocus=both`) to the migration section as "v1 round-trip: qfocus=both normalises to default
  and all advanced options are preserved". Added assertion that `qshow` is absent after round-trip.

### Improve migration section label and block comment

- **Status**: completed
- **Decision**: Rewrote the migration `describe` block comment to clearly state: these tests
  verify backward-compatibility for old bookmarks; they do NOT reflect the canonical v2 encoding.
  Listed the key v1→v2 renames/removals.

### Update `describe("unknown params dropped")` section

- **Status**: completed
- **Decision**: Added comment explaining that `urlv=1` in the existing test is intentional (tests
  the v1→v2 upgrade path). Added a sister test with `urlv=2` input to show unknown params are
  dropped even without the upgrade path.

### Add missing v2 tests

- **Status**: completed
- **Tests added**:
  - "explicit mode=basic is treated as basic mode (not advanced)" — in `describe("decodeCalculatorUrl")`
  - "unknown params absent from encoded output with urlv=2 input" — in `describe("unknown params dropped")`
  - "v1 round-trip: qfocus=both normalises to default and all advanced options are preserved" — in migration
  - "v1 parses all advanced options with qfocus=both (legacy qfocus param)" — in migration
  - "emits across=programs when across is program" — in `describe("encodeCalculatorUrl — multi-particle")`
  - "decodes across=programs and populates selectedProgramIds" — in `describe("decodeCalculatorUrl — multi-particle")`
  - "accepts legacy singular across=program for backward compatibility" — in `describe("decodeCalculatorUrl — multi-particle")`

### Result

- Net: deleted 2 tests, added 8 tests (+6 total). All 1581 tests pass (pre-existing 3 failures
  unrelated: git-signing infrastructure in CI).
- `pnpm format` and `pnpm run format:check` both clean.
