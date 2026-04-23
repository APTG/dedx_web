# 2026-04-23 — Stage 5 merge-ready follow-up (auto-select label + E2E readiness)

## Session Narrative

### Prompt 1: Bring PR to merge-ready state; implement remaining blockers end-to-end

**AI response**: Read the requested source/spec/test files, verified branch state (orphaned modules already removed, runtime IDs already aligned), and confirmed current CI status with GitHub Actions runs (develop branch successful; current branch runs in progress).

### Prompt 2: Fix product gaps and strengthen tests

**AI response**: Updated compact-mode Program combobox behavior and labels:

- Auto-select trigger now shows the resolved concrete program name (e.g. `Auto-select → ICRU49`, `Auto-select → MSTAR`), not only the `Auto-select →` prefix.
- Program section labels changed to spec-required text: `Tabulated data` and `Analytical models`.
- Added concise in-code rationale comments for auto-select runtime display and hidden `DEDX_ICRU` behavior.

Strengthened unit tests in `entity-selection-comboboxes.test.ts` to:

- assert full resolved auto-select label (including concrete program name),
- verify label updates when particle/material change,
- verify Material groups (`Elements` / `Compounds`) as accessible groups,
- verify Program grouping labels match spec (`Tabulated data` / `Analytical models`).

### Prompt 3: Tighten weak WASM E2E readiness assertion

**AI response**: Replaced `loadingBanner.or(errorBanner)` logic in `tests/e2e/layout.spec.ts` with a strict readiness test that requires all 3 entity selectors to be visible. Added separate skipped placeholder for explicit error-state coverage until deterministic WASM-failure injection exists.

### Prompt 4: Sync spec with runtime reality and keep logs consistent

**AI response**: Updated `docs/04-feature-specs/entity-selection.md` to remove runtime claims that ICRU 90 is currently available in libdedx v1.4.0, added a runtime note explaining the mismatch versus aspirational wireframe text, and aligned examples/AC wording to `ICRU49` where referring to current runtime behavior.

## Validation

- `corepack pnpm test -- entity-selection-comboboxes` ✅
- `corepack pnpm exec playwright test tests/e2e/layout.spec.ts tests/e2e/entity-selection.spec.ts` ⚠️ failed in local environment due missing runtime WASM binaries (`GET /wasm/libdedx.*` 404), so calculator selectors never become visible locally. This is an environment limitation in this sandbox clone (no `static/wasm` artifact), not a test-runner availability issue.

## Tasks

### Auto-select label rendering + program grouping labels

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `src/lib/components/entity-selection-comboboxes.svelte`
  - `src/tests/unit/entity-selection-comboboxes.test.ts`
- **Decision**: Use `Auto-select → ${resolvedProgram.name}` for visible trigger text to satisfy AC and prevent prefix-only regressions.
- **Issue**: none.

### WASM E2E readiness assertion hardening

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `tests/e2e/layout.spec.ts`
- **Decision**: Main readiness test now asserts real calculator readiness (selectors visible) and no longer passes on error UI.
- **Issue**: local sandbox lacks wasm artifacts, so this stricter test fails locally as expected.

### Spec/runtime consistency updates

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `docs/04-feature-specs/entity-selection.md`
- **Decision**: Keep aspirational ICRU90 mention only inside explicit runtime note context; align active behavior examples and AC text with current runtime availability.
- **Issue**: none.
