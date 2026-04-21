# WASM web target + CI artifact wiring

**Date:** 21 April 2026  
**Branch:** `fix/wasm-web-ci`  
**Model:** Claude Sonnet 4.6 via Claude Code

---

## Context

After Stage 4 scaffolding was merged, two Stage 3→4 transition items remained open:

1. `wasm/build.sh` output was `wasm/output/` with `ENVIRONMENT=node` — suitable for
   `verify.mjs` in Node.js but not served by SvelteKit.
2. `static/wasm/` was empty — the app had WASM 404s at runtime and in E2E tests.
3. `ci.yml` `e2e-tests` job ran `pnpm build` + Playwright without WASM files present;
   the two CI jobs were fully independent (no artifact sharing).

The user observed the gap from the Stage 3 plan: *"Output: ES module `.mjs` + `.wasm`"*
and asked whether it was included in GitHub Actions.

---

## Changes

### `wasm/build.sh`
- `ENVIRONMENT=node` → `ENVIRONMENT='web,node'`
  - `web` satisfies ADR 003 (browser-compatible ES module)
  - `node` preserves `verify.mjs` Node.js compatibility without a second build
- `OUTPUT_DIR` changed from `$SCRIPT_DIR/output` → `$REPO_ROOT/static/wasm`
- Comments updated to reflect the new output path and rationale for `web,node`

### `wasm/verify.mjs`
- `outputDir` updated from `resolve(__dirname, 'output')` to
  `resolve(__dirname, '..', 'static', 'wasm')`
- Error message updated: `Run wasm/build.sh first` (was `./build.sh`)

### `.gitignore`
- Replaced `wasm/output/` (no longer created) with
  `/static/wasm/libdedx.mjs` and `/static/wasm/libdedx.wasm`

### `.github/workflows/ci.yml`
- `wasm-verify` job: renamed to "WASM Build + Contract Verification"; added
  `mkdir -p static/wasm` before the build; added **`wasm-binaries` artifact upload**
  (`static/wasm/libdedx.{mjs,wasm}`, 1-day retention).
- `e2e-tests` job: added `needs: [wasm-verify]`; added **artifact download step**
  (`wasm-binaries` → `static/wasm/`) before `pnpm build` and Playwright.
- `unit-tests` job: unchanged (Vitest uses mocks, no WASM needed).

### Docs
- `docs/progress/stage-3.md` — "Known Transition Items" section updated to
  "Transition Items (resolved post-Stage 4)".
- `docs/00-redesign-plan.md` — Stage 3 transition note updated to "(resolved)".
- `docs/ai-logs/README.md` — indexed the raw Qwen Stage 4 scaffold session log.
- `session-ses_24fd.md` (repo root) → `docs/ai-logs/2026-04-21-stage4-scaffold-qwen-session.md`

---

## Verification

Local verification of `verify.mjs` path change requires a WASM build (Docker).
CI will verify on the next push to `fix/wasm-web-ci`.

The `unit-tests` job is unaffected — Vitest mocks bypass WASM entirely.
