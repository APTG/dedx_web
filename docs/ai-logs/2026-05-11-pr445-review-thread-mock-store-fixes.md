# 2026-05-11 — PR #445 review-thread mock/store fixes

**Model:** GPT-5.5 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: apply latest review-thread comments

User asked to apply the comments from the latest PR #445 review thread.

**AI response**: Fixed the mocked custom inverse methods in `LibdedxServiceImpl` so they use their actual `params` argument instead of referencing an undefined variable, added runtime contract coverage for both custom inverse mock paths, and made `customCompounds.create()` / `update()` sort cloned element arrays so caller-owned arrays are not mutated. Added regression coverage that verifies create/update preserve caller array order while stored compounds remain sorted. Validation: targeted Vitest for custom compounds + service interface contract passed, and `pnpm lint` passed with existing warnings only.

## Tasks

### Fix mocked custom inverse methods and store element sorting side effects

- **Status**: completed
- **Stage**: 6.10
- **Files changed**:
  - `src/lib/wasm/__mocks__/libdedx.ts`
  - `src/lib/state/custom-compounds.svelte.ts`
  - `src/tests/unit/custom-compounds.test.ts`
  - `src/tests/contracts/service-interface.contract.test.ts`
- **Decision**: Added both implementation fixes and focused regression tests because the mock typo would only fail at runtime and the sort mutation affected caller-owned state rather than stored output.
- **Issue**: None.
