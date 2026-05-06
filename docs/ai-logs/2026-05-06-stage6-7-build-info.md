# AI Session Log — 2026-05-06-stage6-7-build-info

**Date:** 2026-05-06  
**Stage:** 6.7 — Build Info Badge (full implementation)  
**Model:** Qwen3.5-397B-A17B-FP8 via opencode  
**Branch:** `qwen/stage-6-7-build-info`  
**Prompt used:** `docs/ai-logs/prompts/2026-05-06-stage6-7-build-info-badge.md`

---

## Summary

Implemented the complete Build Info Badge feature according to the spec in `docs/04-feature-specs/build-info.md`. The feature displays deployment metadata (commit hash, date, branch) in the footer with a link to the GitHub commit.

## Tasks completed

### Task 1 — `scripts/deploy.cjs` — git metadata → `static/deploy.json`

**Files created/modified:**
- `scripts/deploy.cjs` — CommonJS script that extracts git metadata and writes `static/deploy.json`
- `src/tests/unit/build-info.test.ts` — Unit tests for `stripHeadsPrefix` function (4 tests)
- `package.json` — Added `"deploy-info": "node scripts/deploy.cjs"` script
- `eslint.config.js` — Added `scripts/**` to ignores

**Commit:** `6e55ade feat(build): add scripts/deploy.cjs — writes static/deploy.json at build time`

**Key implementation details:**
- `stripHeadsPrefix(ref)` strips `heads/` prefix from git refs, keeps `tags/` intact
- Script uses `execSync` which throws on non-zero exit (automatic error handling)
- Date is UTC ISO format: `new Date().toISOString().slice(0, 10)`
- Function exported for unit testing via CommonJS `exports`

---

### Task 2 — `BuildInfoBadge` component

**Files created:**
- `src/lib/components/build-info-badge.svelte` — Svelte 5 component
- `src/tests/components/build-info-badge.test.ts` — Component tests (5 tests)

**Commit:** `62e6a26 feat(ui): add BuildInfoBadge component — fetches deploy.json, renders commit/date/branch`

**Key implementation details:**
- Uses `$state` and `$effect` (Svelte 5 runes only, no `onMount`)
- Fetches `${base}/deploy.json` with `base` from `$app/paths`
- Silent failure: renders nothing on 404, timeout, or invalid JSON
- Tailwind classes: `text-xs text-muted-foreground whitespace-nowrap`
- Commit hash is a link with `target="_blank" rel="noopener noreferrer"`

**Test cases:**
1. Valid deploy.json → renders correct format
2. Valid deploy.json → link has correct href and target
3. Fetch 404 → renders nothing
4. Invalid JSON → renders nothing
5. Fetch throws → renders nothing

---

### Task 3 — Wire badge into footer + CI pre-build step

**Files modified:**
- `src/routes/+layout.svelte` — Added `BuildInfoBadge` import and render in footer
- `.github/workflows/deploy.yml` — Added pre-build step to run `node scripts/deploy.cjs`

**Commit:** `dc1dce6 feat(footer): render BuildInfoBadge; add deploy.json pre-build step to CI`

**Key implementation details:**
- Badge positioned bottom-left in footer alongside site title
- Badge absent on `pnpm dev` (fetch returns 404, silently handled)
- CI runs `deploy.cjs` before `pnpm build` for up-to-date metadata

---

### Task 4 — Playwright E2E tests

**Files created:**
- `tests/e2e/build-info.spec.ts` — E2E test suite (6 tests)

**Commit:** `df18252 test(e2e): add Playwright tests for build info badge (footer visibility + 404 fallback)`

**Test cases:**
1. Badge visible in footer with correct format
2. Commit hash is a link to correct GitHub URL
3. Badge is inside footer element
4. Badge visible on plot page (every route)
5. Badge absent on 404
6. Badge absent on malformed JSON

**Key patterns used:**
- `page.route()` to mock `/deploy.json` responses
- `expect.poll()` instead of `waitForTimeout`
- No `waitForTimeout` used (per standing rules)

---

### Additional commit

**Commit:** `d7491c9 chore(gitignore): add static/deploy.json to gitignore`

Added `/static/deploy.json` to `.gitignore` (build artifact, not committed)

---

### PR review fixes (2026-05-06, Claude Sonnet 4.5 via GitHub Copilot)

Addressed review feedback on PR #431:

- `git rm --cached static/deploy.json` — removed the accidentally-committed build artifact; `.gitignore` entry was already present but tracked files bypass it.
- Removed unused `dirname` import from `scripts/deploy.cjs` (only `resolve` is used).
- Updated `docs/ai-logs/prompts/2026-05-06-stage6-7-build-info-badge.md` — all `scripts/deploy.js` and `node scripts/deploy.js` references corrected to `deploy.cjs`.
- Corrected Task 1 commit description in this log (was `deploy.js`, actual file is `deploy.cjs`).
- Marked Stage 6.7 as ✅ in `docs/00-redesign-plan.md`; also fixed the `deploy.js` reference there to `deploy.cjs`.

---

## Test results

- **Vitest:** 729 tests pass (40 test files)
- **Playwright:** 6 tests pass (all E2E badge tests)
- **Build:** `pnpm build` succeeds
- **Lint:** Clean

---

## Acceptance criteria verification

All acceptance criteria from the feature spec met:

✅ `deploy.json` generated at build time with git metadata  
✅ `stripHeadsPrefix` handles `heads/`, `tags/`, and bare refs correctly  
✅ Badge renders commit/date/branch with GitHub link  
✅ Silent failure on fetch errors (404, timeout, invalid JSON)  
✅ Badge styled to match footer secondary text  
✅ Badge uses `base` prefix for sub-path deploys  
✅ E2E tests verify visibility, link attributes, and error handling  

---

## Attribution

(Qwen3.5-397B-A17B-FP8 via opencode)
