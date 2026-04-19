# Documentation

Design documents and specifications for the dEdx Web redesign.

## Documents

| File | Purpose |
|------|---------|
| [00-redesign-plan.md](00-redesign-plan.md) | Full redesign plan with implementation stages, tech stack, and spec template |
| [01-project-vision.md](01-project-vision.md) | **Final v1** — Product vision: audience, core use cases, design principles, application structure |
| [02-tech-stack.md](02-tech-stack.md) | **Final v3** — Library inventory with version pins and rationale for every technology choice (incl. shadcn-svelte + Bits UI) |
| [03-architecture.md](03-architecture.md) | **Final v1** — SvelteKit project structure, WASM service layer, reactive state topology, routing, SSG constraints |
| [05-ui-wireframes.md](05-ui-wireframes.md) | Big-picture UI layout (Calculator page, Plot page, shell) with links to per-spec ASCII wireframes and responsive breakpoints |
| [06-wasm-api-contract.md](06-wasm-api-contract.md) | **Final v3** — TypeScript interface to libdedx via WebAssembly — type definitions, `LibdedxService` API, C function mapping |
| [07-testing-strategy.md](07-testing-strategy.md) | Test pyramid overview (Vitest unit/integration + Playwright E2E + axe-core a11y) with links to per-spec acceptance criteria |
| [08-deployment.md](08-deployment.md) | Deployment architecture — GitHub Pages, WASM build pipeline, phased CI (Stages 3–8), browser caching |
| [09-non-functional-requirements.md](09-non-functional-requirements.md) | **Final v1** — WCAG 2.1 AA, performance budgets, browser support, responsive breakpoints, security |
| [opencode-setup.md](opencode-setup.md) | opencode + Qwen (PLGrid) setup guide — MCP servers, env vars, session logging, troubleshooting |
| [10-terminology.md](10-terminology.md) | **Final v3** — Glossary of domain terms: §1 physics/end-user terms (stopping power, CSDA range, Bragg additivity, I-value, particle vs ion, MeV/nucl vs MeV/u, etc.); §2 developer/stack terms (WASM, Emscripten, runes, dedx_config, Entity, Series, StoredCompound, etc.) |
| [11-prototyping-spikes.md](11-prototyping-spikes.md) | **Final v1** — All four spikes complete (JSROOT+Svelte 5, WASM pipeline, module-level `$state`, Zarr v3 external data format) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| [04-feature-specs/](04-feature-specs/) | Per-feature detailed specs (entity selection, calculator, unit handling, …) |
| [decisions/](decisions/) | Architecture Decision Records (ADRs) — why SvelteKit, why JSROOT, WASM build pipeline |
| [progress/](progress/) | Stage completion logs — what was produced, key decisions, and what each next stage needs |
| [ai-logs/](ai-logs/) | Detailed AI session logs — prompt→response narratives for project continuity |
