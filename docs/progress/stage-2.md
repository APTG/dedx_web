# Stage 2 — Technical Architecture

> **Status:** Complete (14 April 2026)
>
> Stage 2 produced all architecture and decision documents required before
> implementation begins in Stage 3.

---

## Deliverables

All Stage 2 deliverables from `docs/00-redesign-plan.md §8` are complete.

| Document | Status | Notes |
|----------|--------|-------|
| [`docs/decisions/001-sveltekit-over-react.md`](../decisions/001-sveltekit-over-react.md) | Accepted | Full evaluation of React 18/Vite, Vue 3/Nuxt, Vanilla TS; chose SvelteKit 2 + Svelte 5 |
| [`docs/decisions/002-keep-jsroot.md`](../decisions/002-keep-jsroot.md) | Accepted | Full evaluation of Plotly, Chart.js, D3, Vega-Lite, Observable Plot; kept JSROOT 7 |
| [`docs/decisions/003-wasm-build-pipeline.md`](../decisions/003-wasm-build-pipeline.md) | Accepted | ES module output, `dedx_extra.{h,c}` shim, TypeScript wrapper, Emscripten flags |
| [`docs/02-tech-stack.md`](../02-tech-stack.md) | Draft v2 | Full library inventory: SvelteKit 2, Svelte 5, TypeScript 5, Tailwind 4, JSROOT 7, jsPDF 2, hyparquet 1, Vitest 4, Playwright 1, ESLint 9, Prettier 3, Emscripten 5.x, Node.js 24 LTS (24.14) |
| [`docs/03-architecture.md`](../03-architecture.md) | Draft v1 | Project directory layout, routing, WASM service layer, state topology, component tree, data flows, URL sync, SSG constraints, error handling, accessibility |

---

## Key Design Decisions Made in Stage 2

These decisions constrain implementation. Future sessions must not change them
without creating a new ADR version or spec revision.

| Decision | Where documented |
|----------|-----------------|
| **SvelteKit 2 + Svelte 5 runes only** — no `export let`, `$:`, `createEventDispatcher`, `svelte/store` | [ADR 001](../decisions/001-sveltekit-over-react.md), [02-tech-stack.md §1](../02-tech-stack.md#1-framework) |
| **JSROOT 7** — loaded lazily per-page; `JsrootPlot.svelte` owns its container `<div>` | [ADR 002](../decisions/002-keep-jsroot.md), [03-architecture.md §5](../03-architecture.md#5-component-tree) |
| **ES module WASM** — `EXPORT_ES6=1 MODULARIZE=1`; separate `.wasm` binary in `static/wasm/` | [ADR 003](../decisions/003-wasm-build-pipeline.md) |
| **`dedx_extra.{h,c}`** — thin shim for internal libdedx data; avoids modifying the submodule | [ADR 003](../decisions/003-wasm-build-pipeline.md) |
| **WASM init in root layout** — non-blocking `$effect` in `+layout.svelte`; `+layout.ts` returns `{}` synchronously; lazy singleton in `loader.ts` | [03-architecture.md §3](../03-architecture.md#3-wasm-service-layer), [§10](../03-architecture.md#10-ssg--static-adapter-constraints) |
| **`*.svelte.ts` state modules** — rune-aware linting via naming convention | [03-architecture.md §1](../03-architecture.md#1-project-structure) |
| **Compatibility matrix pre-built at init** — no WASM calls per render | [03-architecture.md §3](../03-architecture.md#3-wasm-service-layer) |
| **Custom material sentinel `CUSTOM_MATERIAL_ID = -1`** — routes to `calculateCustomCompound()` | [03-architecture.md §8](../03-architecture.md#8-custom-compounds) |
| **URL sync via `history.replaceState`** in root `$effect` | [03-architecture.md §9](../03-architecture.md#9-url-state-synchronization) |
| **300 ms debounce** on calculation `$effect` | [03-architecture.md §6](../03-architecture.md#6-data-flow-calculator-page) |
| **Okabe-Ito 8-color palette** for plot series (colorblind-safe) | [03-architecture.md §13](../03-architecture.md#13-accessibility-architecture) |
| **`noUncheckedIndexedAccess`** TypeScript flag enabled | [02-tech-stack.md §2](../02-tech-stack.md#2-language) |

---

## Stage 2.5 — Prototyping Spikes

Before Stage 3 begins, three prototyping spikes must pass to validate
high-risk architecture assumptions. See
[`docs/11-prototyping-spikes.md`](../11-prototyping-spikes.md) for full
specifications.

| Spike | Validates | Architecture section | Status |
|-------|-----------|---------------------|--------|
| JSROOT 7 + Svelte 5 `$effect` | Plot page DOM ownership, cleanup, re-draw | [03-architecture.md §5](../03-architecture.md#5-component-tree) | ✅ PASS ([log](../ai-logs/2026-04-14-spike1-jsroot-svelte5.md)) |
| WASM `--preload-file` on static hosting | Build pipeline + sub-path deployment | [ADR 003](../decisions/003-wasm-build-pipeline.md) | ⬜ pending |
| Module-level `$state` reactivity | Shared state topology across components | [03-architecture.md §4](../03-architecture.md#4-reactive-state-topology) | ⬜ pending |

**Gate:** All spikes must pass (or architecture docs amended) before
Stage 3 begins.

---

## Stage 3 Inputs

Stage 3 (WASM Build Pipeline Redesign) reads:

1. [`docs/06-wasm-api-contract.md`](../06-wasm-api-contract.md) — TypeScript types and `LibdedxService` interface to implement
2. [`docs/decisions/003-wasm-build-pipeline.md`](../decisions/003-wasm-build-pipeline.md) — Emscripten flags, `dedx_extra` rationale, output file locations
3. [`docs/03-architecture.md`](../03-architecture.md) §3 — WASM service layer design (`loader.ts`, `libdedx.ts`, mock)
4. [`docs/02-tech-stack.md`](../02-tech-stack.md) §7 — Emscripten version pin
