# 2026-05-08 — Stage 6.10 preflight hardening (opencode workflow + WASM contract guards)

**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Implement post-mortem improvement plan before Stage 6.10

User requested implementation of the Stage 6.9 post-mortem plan focused on
opencode/local-model workflow hardening: generated-file safeguards, ABI contract
freezing, prompt/agent process updates, reviewer guard expansion, and
machine-checkable preflight checks.

**AI response:**

Implemented the plan as repository-level process/tooling updates:

1. Added a machine-checkable guard script for forbidden generated artifacts and
   vendor gitlink changes.
2. Added a shared inverse-ABI manifest consumed by `wasm/verify.mjs`.
3. Added a docs-drift checker for `docs/06-wasm-api-contract.md` against the
   shared ABI manifest.
4. Added a new CI preflight job that enforces guard and docs checks before test jobs.
5. Updated opencode orchestrator/implementer/reviewer docs with stricter
   decomposition, completion semantics, guard usage, and full E2E output policy.
6. Updated spec/prompt templates to require mode-transition scenarios and
   real-WASM smoke coverage for WASM-backed features.
7. Updated lessons learned with new entries covering generated-file guardrails,
   ABI source-of-truth, and mock-vs-real-WASM acceptance policy.
8. Corrected stale inverse API contract wording in `docs/06-wasm-api-contract.md`
   to reference flat wrappers.

## Tasks

### Add machine-checkable generated-file safeguards

- **Status**: completed
- **Stage**: process hardening (pre-Stage 6.10)
- **Files changed**:
  - `scripts/guard-forbidden-files.cjs` (new)
  - `package.json`
  - `.github/workflows/ci.yml`
- **Decision**: enforce both local staged-diff (`pnpm guard:staged`) and CI
  range-diff checks to catch accidental generated file/submodule pointer commits.
- **Issue**: none.

### Freeze inverse ABI contract and wire it into verification

- **Status**: completed
- **Stage**: process hardening (pre-Stage 6.10)
- **Files changed**:
  - `wasm/contract-manifest.json` (new)
  - `wasm/verify.mjs`
  - `scripts/check-wasm-contract-docs.cjs` (new)
  - `docs/06-wasm-api-contract.md`
  - `.github/workflows/ci.yml`
  - `package.json`
- **Decision**: scoped manifest to inverse-wrapper exports/service mapping (the
  drift root cause from PR #439) instead of attempting a full API manifest in one step.
- **Issue**: `pnpm wasm:verify` requires built WASM artifacts; local run failed
  until WASM build, and `pnpm wasm:build` failed due missing `libdedx` CMake
  source tree in this environment.

### Harden opencode orchestrator/agent/spec guidance

- **Status**: completed
- **Stage**: process hardening (pre-Stage 6.10)
- **Files changed**:
  - `AGENTS.md`
  - `.opencode/agents/implementer.md`
  - `.opencode/agents/reviewer.md`
  - `.opencode/prompts/run-feature.md`
  - `docs/04-feature-specs/_template.md`
  - `.opencode/lessons-learned.md`
- **Decision**: encoded push/auth failure as `TASK BLOCKED`, required guard
  invocation before commit, required non-truncated E2E failure output, and
  required mode-transition + real-WASM smoke expectations in templates.
- **Issue**: none.

### Validation

- **Status**: partial (environment-limited)
- **Stage**: process hardening (pre-Stage 6.10)
- **Commands run**:
  - `pnpm guard:staged` ✅
  - `pnpm wasm:check-doc-contract` ✅
  - `pnpm lint` ❌ (pre-existing unrelated errors in app code)
  - `pnpm test` ✅
  - `pnpm build` ✅
  - `pnpm wasm:verify` ❌ (missing `static/wasm/libdedx.mjs`)
  - `pnpm wasm:build` ❌ (`/src/libdedx` missing CMakeLists in this environment)
- **Issue**: lint and wasm build/verify failures are pre-existing/environmental
  relative to this process/docs/tooling-only change set.
