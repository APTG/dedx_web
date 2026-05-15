# 2026-05-15 — Dependabot tooling bump CI fixes

## Session Narrative

### Prompt 1: Fix failing unit and E2E tests on the Dependabot tooling-bump PR and explain whether code changes are needed

**AI response**: Investigated the failing CI workflow run for the Dependabot branch and pulled failed job logs. The failures were in `Install dependencies` for both unit and E2E jobs, not in the test execution itself. The root cause was `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` because lockfiles contained `overrides:` blocks while manifests lacked matching `pnpm.overrides`. Added matching overrides in root and `prototypes/wasm-preload/app` manifests.

### Prompt 2: Validate the fixes and ensure compatibility with the bumped tooling

**AI response**: Re-ran `pnpm install --frozen-lockfile` successfully. Then ran unit tests and found additional Vitest 4 incompatibility in PDF tests (`jsPDF` constructor mock shape). Updated two PDF unit tests to use constructor-compatible function mocks. Re-ran targeted PDF tests, full `pnpm test`, and `pnpm build`; all passed locally (with expected Node engine warning because local sandbox uses Node 20 while project targets Node 24).

## Tasks

### Fix frozen lockfile mismatch after grouped dependency bump

- **Status**: completed
- **Stage**: maintenance
- **Files changed**:
  - `package.json`
  - `prototypes/wasm-preload/app/package.json`
- **Decision**: Kept lockfile-introduced security overrides and mirrored them into manifests instead of dropping lockfile override blocks, so frozen installs remain deterministic and secure.
- **Issue**: None.

### Fix Vitest 4 PDF mock constructor compatibility

- **Status**: completed
- **Stage**: maintenance
- **Files changed**:
  - `src/tests/unit/calculator-pdf.test.ts`
  - `src/tests/unit/plot-pdf.test.ts`
- **Decision**: Applied the smallest behavior-preserving change by using constructor-compatible function implementations in mocked `jspdf` default export, avoiding production code changes.
- **Issue**: None.

### Record review pitfall for future sessions

- **Status**: completed
- **Stage**: maintenance
- **Files changed**:
  - `.opencode/lessons-learned.md`
- **Decision**: Added a focused entry documenting frozen-lockfile override mismatch prevention for future Dependabot/tooling bump PRs.
- **Issue**: None.
