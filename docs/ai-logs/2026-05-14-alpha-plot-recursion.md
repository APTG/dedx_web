# 2026-05-14 — Alpha plot recursion fix

## Session Narrative

### Prompt 1: Fix alpha particle plot preview recursion

**AI response**: Investigated the reported `/plot?particle=2&material=276&program=auto&stp_unit=kev-um&xscale=log&yscale=log` failure. Used semantic code search first, inspected the Plot page, JSROOT wrapper, WASM service, and existing plot tests. Checked CI via GitHub Actions: the initial run was action-required/no jobs, then the rerun succeeded and provided WASM artifacts. Baseline `pnpm check`, `pnpm lint`, and plot-related Vitest passed after installing locked dependencies; the sandbox warns because it has Node 20 while the project expects Node 24.

Identified that `LibdedxServiceImpl.getPlotData()` used a hardcoded `0.001–1000 MeV/nucl` grid instead of the per-program/per-particle WASM tabulated range. For alpha auto-select this resolves to ICRU49, where out-of-range energies can surface as `too much recursion`. Updated built-in and custom-compound plot data generation to use `getMinEnergy()`/`getMaxEnergy()`, added a focused unit regression with a range-checking fake WASM module, and added an E2E regression for the exact reported URL. Downloaded the successful CI `wasm-binaries` artifact for local real-WASM verification, built the app, ran the focused Playwright test, and captured a screenshot at `/tmp/dedx-alpha-plot.png` showing the preview without the failure alert.

## Tasks

### Fix plot data energy range

- **Status**: completed
- **Stage**: maintenance / open beta feedback
- **Files changed**: `src/lib/wasm/libdedx.ts`, `src/tests/unit/wasm-plot-data.test.ts`, `tests/e2e/plot.spec.ts`, `CHANGELOG-AI.md`, `docs/ai-logs/2026-05-14-alpha-plot-recursion.md`, `docs/ai-logs/README.md`
- **Decision**: Reused the existing WASM `getMinEnergy()` and `getMaxEnergy()` contract rather than adding UI-side special cases for alpha particles. This keeps all plot series inside libdedx's tabulated range for the selected program/particle pair.
- **Issue**: Local validation produced Node engine warnings because the sandbox has Node 20.20.2; project scripts still passed where run. The Playwright MCP browser profile was locked, so the UI screenshot was captured with the Playwright CLI instead.
