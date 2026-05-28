# Session Log: Issue #635 Stale Playwright Builds

**Date:** 2026-05-28
**Task:** https://github.com/APTG/dedx_web/issues/635
**Model/Agent:** Gemini 3.1 Pro via Antigravity

## Summary
Addressed issue #635 regarding stale builds when running Playwright E2E tests locally. AI agents and developers were getting confused by testing against an old production build because `vite preview` was used.

## Actions Taken
1. Added Entry 69 to `.opencode/lessons-learned.md` documenting the stale-build trap and the rule to keep E2E scripts clean while letting Playwright `webServer.command` handle local (non-CI) builds.
2. Updated `playwright.config.ts` to keep `package.json` E2E scripts clean and run `pnpm build && pnpm preview --host 127.0.0.1` via Playwright `webServer.command` for local (non-CI) runs.
3. Created a new configuration file `playwright.dev.config.ts` targeting the Vite dev server on port 5173. This provides HMR and immediate feedback for rapid local testing using `pnpm exec playwright test --config=playwright.dev.config.ts`.
4. Logged the AI session to `CHANGELOG-AI.md`.
5. Disabled automatic HTML report generation for local Playwright test runs (using `reporter: process.env.CI ? "html" : "list"` in both config files) so that the local process doesn't hang indefinitely serving the report after a test failure.
