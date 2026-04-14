# AI Session Log — 2026-04-14 — Stage 2 Technical Architecture

**Date:** 14 April 2026
**Stage:** 2
**Output:** ADRs, `docs/02-tech-stack.md`, `docs/03-architecture.md`, `docs/progress/stage-2.md`

---

## Session Summary

Produced all Stage 2 deliverables from `docs/00-redesign-plan.md §8`:

1. **ADR 001** — SvelteKit over React: evaluated React 18/Vite, Vue 3/Nuxt,
   Vanilla TS; chose SvelteKit 2 + Svelte 5 runes for zero-VDOM output,
   file-based routing, static adapter, and runes-based reactive state.
2. **ADR 002** — Keep JSROOT: evaluated Plotly, Chart.js, D3, Vega-Lite,
   Observable Plot; kept JSROOT for native log-log axes, TMultiGraph API,
   physics-community familiarity, and built-in SVG export.
3. **ADR 003** — WASM Build Pipeline: documented legacy `build_wasm.sh`
   problems (non-ES-module, embedded data, missing functions); specified
   ES module output (`EXPORT_ES6=1 MODULARIZE=1`), separate `.wasm` binary,
   `wasm/dedx_extra.{h,c}` thin shim, TypeScript wrapper structure, and
   Vitest mock pattern.
4. **`docs/02-tech-stack.md`** — Full library inventory with version pins and
   rationale: SvelteKit 2, Svelte 5, TypeScript 5, Tailwind 4, JSROOT 7,
   jsPDF 2, hyparquet 1, Vitest 4, Svelte Testing Library 5, Playwright 1,
   ESLint 9, Prettier 3, svelte-check 4, Emscripten 5.x, Node.js 24 LTS.
5. **`docs/03-architecture.md`** — Full project directory layout; route map;
   static adapter constraints; WASM init lifecycle (layout load → loader
   singleton → `LibdedxServiceImpl.init()` → entity population); reactive
   state topology (5 modules: entities, selection, calculation, ui, url-sync);
   component tree; Calculator and Plot data flows; custom compound routing;
   URL sync with `history.replaceState`; accessibility architecture; performance
   table; error handling hierarchy.

---

## Key Decisions Made in Stage 2

| Decision | Location |
|----------|----------|
| SvelteKit 2 + Svelte 5 runes; no Svelte 4 patterns | ADR 001 |
| JSROOT 7 (lazy import, `JsrootPlot.svelte` wrapper with `untrack`) | ADR 002 |
| `EXPORT_ES6=1 MODULARIZE=1`; `dedx_extra.{h,c}` shim | ADR 003 |
| `*.svelte.ts` naming for state modules (rune-aware linting) | `03-architecture.md` §1 |
| Non-blocking WASM init in root `+layout.svelte` `$effect`; `+layout.ts` returns `{}` | `03-architecture.md` §10 |
| Compatibility matrix pre-built at init from entity lists | `03-architecture.md` §3 |
| Custom compounds route via `CUSTOM_MATERIAL_ID = -1` sentinel | `03-architecture.md` §8 |
| URL sync via `history.replaceState` in root `$effect` | `03-architecture.md` §9 |
| 300 ms debounce on calculation `$effect` | `03-architecture.md` §6 |
| Okabe-Ito colorblind-safe palette for plot series | `03-architecture.md` §13 |

---

## Files Created

| File | Change |
|------|--------|
| `docs/decisions/001-sveltekit-over-react.md` | **Created** |
| `docs/decisions/002-keep-jsroot.md` | **Created** |
| `docs/decisions/003-wasm-build-pipeline.md` | **Created** |
| `docs/02-tech-stack.md` | **Created** — Draft v1 |
| `docs/03-architecture.md` | **Created** — Draft v1 |
| `docs/progress/stage-2.md` | **Created** |
| `docs/ai-logs/2026-04-14-stage2-architecture.md` | **Created** — this file |
| `docs/ai-logs/README.md` | Prepended this session's row |
| `CHANGELOG-AI.md` | Prepended Stage 2 entry |

---

## Inputs Read

| File | Purpose |
|------|---------|
| `docs/progress/stage-1.md` | Stage 1 deliverables and key design decisions |
| `docs/00-redesign-plan.md` | §2 tech choices, §5 target directory structure, §8 Stage 2 deliverables |
| `docs/06-wasm-api-contract.md` | TypeScript types and LibdedxService interface |
| `docs/01-project-vision.md` | Audience, design principles, app structure |
| `build_wasm.sh` | Legacy Emscripten flags (reference for ADR 003) |
| `CHANGELOG-AI.md` | Log format reference |
| `docs/ai-logs/README.md` | Log index format reference |
| `docs/ai-logs/2026-04-14-stage1-complete.md` | Session log format reference |
