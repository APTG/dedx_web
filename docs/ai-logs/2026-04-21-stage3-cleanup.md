# Stage 3.7: Legacy Code Removal + Plan Update

**Date:** 2026-04-21
**Stage:** 3.7 (Legacy Cleanup — moved forward from Stage 9)
**Model:** (Claude Sonnet 4.6 via Claude Code)

---

## Summary

Removed the old React/CRA source base that was conflicting with Stage 3
implementation work. Updated the redesign plan to reflect the early removal
and documented the two WASM transition items that need to be addressed in Stage 4.

---

## WASM Cross-Check Findings

Cross-checked the current `wasm/` directory against ADR 003 (`docs/decisions/003-wasm-build-pipeline.md`).

| Check | Finding |
|-------|---------|
| `wasm/dedx_extra.{h,c}` location | ✅ Correct — `wasm/` per ADR 003 |
| `wasm/verify.mjs` location | ✅ Correct — `wasm/` per plan §8 Stage 3 |
| `wasm/build.sh` output path | ⚠️ `wasm/output/` — ADR 003 target is `static/wasm/` |
| `ENVIRONMENT` flag | ⚠️ `node` — ADR 003 specifies `web` for production |
| `.data` sidecar | ✅ Not produced — correct, no `--preload-file` |
| `wasm/output/` content | Not present (build not run since merge) — expected |

### Why the discrepancies are intentional (for now)

**Output location (`wasm/output/` vs `static/wasm/`):** The `static/` directory
does not exist yet — SvelteKit is scaffolded in Stage 4. Outputting to
`wasm/output/` is the correct interim behaviour so `verify.mjs` can run without
SvelteKit present. Stage 4 must update `build.sh` to output to `static/wasm/`.

**`ENVIRONMENT=node`:** `verify.mjs` loads `libdedx.mjs` in Node.js. A build with
`ENVIRONMENT=web` strips Node.js I/O shims and will fail under Node. The current
`node` flag is the only way to keep CI verification working before the SvelteKit
app exists. Stage 4 must introduce a production build target with `ENVIRONMENT=web`.

Both items are documented in `docs/progress/stage-3.md` and in `docs/00-redesign-plan.md`
§8 (Stage 3 transition note).

---

## Files Removed

| Path | Reason |
|------|--------|
| `src/` (entire tree) | Legacy React codebase — App.js, Backend/, Components/, Styles/, `__test__/`, index.js, reportWebVitals.js, setupTests.js, logo.svg |
| `public/index.html` | CRA HTML entry point — replaced by SvelteKit in Stage 4 |
| `public/logo192.png` | CRA default React logo |
| `public/logo512.png` | CRA default React logo |
| `public/manifest.json` | CRA PWA manifest |
| `public/robots.txt` | CRA default robots.txt |
| `build_wasm.sh` | Legacy Emscripten build script — superseded by `wasm/build.sh` |

## Files Kept

| Path | Reason |
|------|--------|
| `public/favicon.ico` | Project favicon — to be copied to `static/` in Stage 4 |
| `public/webdEdx_logo.svg` | Project logo — to be copied to `static/` in Stage 4 |

---

## Docs Updated

| File | Change |
|------|--------|
| `docs/00-redesign-plan.md` | Stage 3 marked ✅; Stage 3.7 block added with removal list and WASM transition note; Stage 9 updated to reflect early completion |
| `docs/progress/stage-3.md` | Created — Stage 3 completion record with verification results and Stage 4 transition items |

---

## References

- `docs/00-redesign-plan.md` §8 — Stage 3 and Stage 3.7
- `docs/decisions/003-wasm-build-pipeline.md` — WASM flag rationale and output location
- `docs/progress/stage-3.md` — Stage 3 completion record
