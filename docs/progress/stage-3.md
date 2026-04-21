---
# Stage 3 — WASM Build Pipeline Redesign

> **Status:** Complete (21 April 2026)
>
> Stage 3 established the new Emscripten build pipeline, the `wasm/` directory
> structure, and the CI verification workflow. All 67 TypeScript contract checks pass.

---

## Deliverables

| Artifact | Status | Notes |
|----------|--------|-------|
| `wasm/build.sh` | ✅ | Emscripten 5.0.5 Docker build; outputs `wasm/output/libdedx.{mjs,wasm}` |
| `wasm/dedx_extra.h` | ✅ | Thin shim exposing 4 internal libdedx functions |
| `wasm/dedx_extra.c` | ✅ | Implementation; avoids modifying the libdedx submodule |
| `wasm/verify.mjs` | ✅ | 67-check contract verification script (RED→GREEN gate) |
| `.github/workflows/ci.yml` | ✅ | CI job: build WASM + run verify.mjs on push/PR to master |
| `.github/workflows/test_and_deploy.yml` | ✅ deleted | Legacy CRA workflow removed |

---

## Verification Results (GREEN phase)

| Category | Checks |
|----------|--------|
| Exported C functions | 31/31 ✓ |
| Emscripten runtime methods | 8/8 ✓ |
| LibdedxService method coverage | 17/17 ✓ |
| Method signature validation | 5/5 ✓ |
| Error handling contract | 2/2 ✓ |
| Energy unit conversion | 2/2 ✓ |
| Advanced options (stateful API) | 2/2 ✓ |

Build output sizes: `libdedx.wasm` 463 KB · `libdedx.mjs` 15 KB.

---

## Known Transition Items (resolved in Stage 4)

| Item | Current state | Target (Stage 4) |
|------|--------------|-----------------|
| WASM output location | `wasm/output/` | `static/wasm/` (after SvelteKit scaffolding) |
| Emscripten `ENVIRONMENT` flag | `node` (required for verify.mjs in Node.js) | `web` (production SvelteKit build) |

See `docs/decisions/003-wasm-build-pipeline.md` for the full flag rationale.

---

## Session Logs

- [2026-04-20 — Stage 3 GREEN phase + CI](../ai-logs/2026-04-20-stage3-wasm.md) (Qwen3.5-397B via opencode)
- [2026-04-21 — Stage 3.7 legacy cleanup + plan update](../ai-logs/2026-04-21-stage3-cleanup.md) (Claude Sonnet 4.6 via Claude Code)

---

## Stage 4 Inputs

Stage 4 (Project Scaffolding) reads:

1. [`docs/02-tech-stack.md`](../02-tech-stack.md) — full library inventory
2. [`docs/03-architecture.md`](../03-architecture.md) — SvelteKit project structure, routing, state topology
3. [`docs/decisions/003-wasm-build-pipeline.md`](../decisions/003-wasm-build-pipeline.md) — WASM output location, `ENVIRONMENT` flag, `locateFile` pattern
4. `public/favicon.ico` and `public/webdEdx_logo.svg` — move to `static/` in Stage 4
