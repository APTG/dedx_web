# Documentation

Design documents and specifications for the dEdx Web redesign.

## Documents

| File | Purpose |
|------|---------|
| [00-redesign-plan.md](00-redesign-plan.md) | Full redesign plan with implementation stages, tech stack, and spec template |
| [01-project-vision.md](01-project-vision.md) | Product vision: audience, core use cases, design principles, application structure |
| [06-wasm-api-contract.md](06-wasm-api-contract.md) | TypeScript interface to libdedx via WebAssembly — type definitions, `LibdedxService` API, C function mapping |
| [10-terminology.md](10-terminology.md) | **Final v2** — Glossary of domain terms: §1 physics/end-user terms (stopping power, CSDA range, Bragg additivity, I-value, particle vs ion, MeV/nucl vs MeV/u, etc.); §2 developer/stack terms (WASM, Emscripten, runes, dedx_config, Entity, Series, StoredCompound, etc.) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| [04-feature-specs/](04-feature-specs/) | Per-feature detailed specs (entity selection, calculator, unit handling, …) |
| [progress/](progress/) | Stage completion logs — what was produced, key decisions, and what each next stage needs |
| [ai-logs/](ai-logs/) | Detailed AI session logs — prompt→response narratives for project continuity |
