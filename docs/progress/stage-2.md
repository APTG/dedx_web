# Stage 2 — Technical Architecture

> **Status:** Complete (14 April 2026)
>
> Stage 2 produced all architecture and decision documents required before
> implementation begins in Stage 3. All documents are at Draft v1 status.

---

## Deliverables

All Stage 2 deliverables from `docs/00-redesign-plan.md §8` are complete.

| Document | Status | Notes |
|----------|--------|-------|
| [`docs/decisions/001-sveltekit-over-react.md`](../decisions/001-sveltekit-over-react.md) | Accepted | Full evaluation of React 18/Vite, Vue 3/Nuxt, Vanilla TS; chose SvelteKit 2 + Svelte 5 |
| [`docs/decisions/002-keep-jsroot.md`](../decisions/002-keep-jsroot.md) | Accepted | Full evaluation of Plotly, Chart.js, D3, Vega-Lite, Observable Plot; kept JSROOT 7 |
| [`docs/decisions/003-wasm-build-pipeline.md`](../decisions/003-wasm-build-pipeline.md) | Accepted | ES module output, `dedx_extra.{h,c}` shim, TypeScript wrapper, Emscripten flags |
| [`docs/02-tech-stack.md`](../02-tech-stack.md) | Draft v1 | Full library inventory: SvelteKit 2, Svelte 5, TypeScript 5, Tailwind 4, JSROOT 7, jsPDF 2, hyparquet 1, Vitest 2, Playwright 1, ESLint 9, Prettier 3, Emscripten 3.1.x |
| [`docs/03-architecture.md`](../03-architecture.md) | Draft v1 | Project directory layout, routing, WASM service layer, state topology, component tree, data flows, URL sync, SSG constraints, error handling, accessibility |

---

## Key Design Decisions Made in Stage 2

These decisions constrain implementation. Future sessions must not change them
without creating a new ADR version or spec revision.

| Decision | Where documented |
|----------|-----------------|
| **SvelteKit 2 + Svelte 5 runes only** — no `export let`, `$:`, `createEventDispatcher`, `svelte/store` | `ADR 001`, `02-tech-stack.md` §1 |
| **JSROOT 7** — loaded lazily per-page; `JsrootPlot.svelte` owns its container `<div>` | `ADR 002`, `03-architecture.md` §5 |
| **ES module WASM** — `EXPORT_ES6=1 MODULARIZE=1`; separate `.wasm` binary in `static/wasm/` | `ADR 003` |
| **`dedx_extra.{h,c}`** — thin shim for internal libdedx data; avoids modifying the submodule | `ADR 003` |
| **WASM init in root layout** — `+layout.ts` with `browser` guard; lazy singleton in `loader.ts` | `03-architecture.md` §3, §10 |
| **`*.svelte.ts` state modules** — rune-aware linting via naming convention | `03-architecture.md` §1 |
| **Compatibility matrix pre-built at init** — no WASM calls per render | `03-architecture.md` §3 |
| **Custom material sentinel `CUSTOM_MATERIAL_ID = -1`** — routes to `calculateCustomCompound()` | `03-architecture.md` §8 |
| **URL sync via `history.replaceState`** in root `$effect` | `03-architecture.md` §9 |
| **300 ms debounce** on calculation `$effect` | `03-architecture.md` §6 |
| **Okabe-Ito 8-color palette** for plot series (colorblind-safe) | `03-architecture.md` §13 |
| **`noUncheckedIndexedAccess`** TypeScript flag enabled | `02-tech-stack.md` §2 |

---

## Stage 3 Inputs

Stage 3 (WASM Build Pipeline Redesign) reads:

1. [`docs/06-wasm-api-contract.md`](../06-wasm-api-contract.md) — TypeScript types and `LibdedxService` interface to implement
2. [`docs/decisions/003-wasm-build-pipeline.md`](../decisions/003-wasm-build-pipeline.md) — Emscripten flags, `dedx_extra` rationale, output file locations
3. [`docs/03-architecture.md`](../03-architecture.md) §3 — WASM service layer design (`loader.ts`, `libdedx.ts`, mock)
4. [`docs/02-tech-stack.md`](../02-tech-stack.md) §7 — Emscripten version pin
