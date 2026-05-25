# 2026-05-25 — PR #581 workflow/doc clarification

## Session Narrative

### Prompt 1: Clarify whether explicit workflow `deploy.json` steps are still needed after adding `prebuild`

**AI response**: Reviewed `package.json`, `ci.yml`, `s3-e2e.yml`,
`deploy.yml`, `playwright.config.ts`, and the technical docs. Confirmed that
`pnpm build` now always runs `node scripts/deploy.cjs` via `prebuild`, so the
explicit `Write deploy.json` workflow steps had become redundant.

### Prompt 2: Clarify whether `pnpm build` must run before `pnpm test:e2e`

**AI response**: Verified from `playwright.config.ts` that Playwright starts
`pnpm preview`, not `pnpm build`, so `pnpm test:e2e` still requires a current
`build/` directory. Updated the testing/deployment docs and README to document
the correct local/CI sequence.

### Prompt 3: Validate the clarified workflow

**AI response**: Ran `corepack pnpm build` on a clean dependency install and
confirmed that `static/deploy.json` and `build/deploy.json` are generated with
no explicit workflow step. A narrow Playwright build-info run additionally
showed a pre-existing local-environment issue when WASM assets are missing, so
the validation conclusion for this change is based on the successful build and
generated deploy metadata, which is the behavior affected by the workflow/docs
cleanup.

## Tasks

### Remove redundant deploy-info workflow steps and document the required E2E flow

- **Status**: completed
- **Stage**: CI / docs
- **Files changed**: `.github/workflows/ci.yml`, `.github/workflows/s3-e2e.yml`, `.github/workflows/deploy.yml`, `docs/07-testing-strategy.md`, `docs/08-deployment.md`, `README.md`, `.opencode/lessons-learned.md`, `CHANGELOG-AI.md`, `docs/ai-logs/2026-05-25-pr581-workflow-doc-clarification.md`, `docs/ai-logs/README.md`
- **Decision**: Removed the duplicate workflow steps instead of leaving them for “extra safety” because `prebuild` is now the single source of truth and the redundant steps only made the docs and CI semantics harder to understand.
- **Issue**: A narrow local Playwright build-info validation reported a pre-existing missing-WASM problem on a clean checkout; this change does not modify WASM setup, and the relevant `deploy.json` generation behavior was still verified by the successful `pnpm build`.
