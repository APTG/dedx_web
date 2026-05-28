# Session Log: Issue #635 Stale Playwright Builds

**Date:** 2026-05-28
**Task:** https://github.com/APTG/dedx_web/issues/635
**Model/Agent:** Gemini 3.1 Pro via Antigravity

## Summary
Addressed issue #635 regarding stale builds when running Playwright E2E tests locally. AI agents and developers were getting confused by testing against an old production build because `vite preview` was used.

## Actions Taken
1. Added Entry 69 to `.opencode/lessons-learned.md` documenting the requirement to run `pnpm build` before running Playwright E2E tests, preventing future AI agent loops.
2. Updated `package.json` testing scripts (`test:e2e`, `test:e2e:smoke`, `test:e2e:nightly`, `test:e2e:s3`) to automatically prepend `pnpm build && ` before running `playwright test`.
3. Created a new configuration file `playwright.dev.config.ts` targeting the Vite dev server on port 5173. This provides HMR and immediate feedback for rapid local testing using `pnpm exec playwright test --config=playwright.dev.config.ts`.
4. Logged the AI session to `CHANGELOG-AI.md`.
5. Disabled automatic HTML report generation for local Playwright test runs (using `reporter: process.env.CI ? "html" : "list"` in both config files) so that the local process doesn't hang indefinitely serving the report after a test failure.
