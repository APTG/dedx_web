# 2026-05-25 — Issue #587: Add linter/formatter/check to GitHub CI

## Session Narrative

### Prompt 1: Work on issue #587 and make a PR once ready

**AI response**: Read issue #587 and the comment proposing the solution. Added a
`static-analysis` job to `.github/workflows/ci.yml` that runs after
`workflow-guards` and executes `pnpm run format:check`, `pnpm run lint`, and
`pnpm run check` in sequence. Updated `unit-tests` to `needs:
[workflow-guards, static-analysis]` so heavy tests are skipped on trivially
malformed code (fail-fast principle). Created PR.

## Tasks

### Add static-analysis CI job

- **Status**: completed
- **Stage**: CI / infra
- **Files changed**: `.github/workflows/ci.yml`
- **Decision**: Made `unit-tests` depend on `static-analysis` (not `e2e-tests`,
  since E2E already needs `wasm-verify` which is a heavier gate). This keeps the
  dependency graph clean and ensures fast feedback on style errors.
