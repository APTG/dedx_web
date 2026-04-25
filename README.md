# dEdx web

Calculate **charged-particle stopping powers** (dE/dx) and **CSDA ranges** directly in the browser — no installation required. Select a particle, a target material, and an energy range; get numerical results and interactive plots instantly. Based on the [libdedx](https://github.com/APTG/libdedx) library, running fully client-side via WebAssembly.

## Try it

| | URL | What's there | Last deployed |
|---|-----|-------------|---------------|
| **v2 (development)** | [aptg.github.io/web_dev](https://aptg.github.io/web_dev/) | Work-in-progress rewrite — entity selection and energy input | 25 April 2026 |
| **v1.1.0 (stable)** | [aptg.github.io/web](https://aptg.github.io/web/) | Last stable release — fully functional but based on the old React stack | 1 April 2022 |

## Why v2?

v1.1.0 (April 2022) has several limitations: no unit handling, React 17 class components with no TypeScript, and plots that do not meet the needs of typical physics workflows.

v2 is a ground-up rewrite addressing all of the above. It is also an experiment in **AI-assisted (vibe-coded) development** — the codebase is written by AI agents (GitHub Copilot, Claude Code, opencode) guided by spec-driven prompts, with human review. Currently at Stage 5 of 8. v2.0.0 will replace the stable site on first production release.

## Related tools

- [PSTAR (NIST)](https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html) — proton stopping powers
- [ATIMA](https://www.isotopea.com/webatima/) — similar scope, different library

---

## For developers

### Run locally

Prerequisites: **Docker** (for the WASM build), **Node.js 24+**, **pnpm**.

```sh
(cd wasm && ./build.sh)
pnpm install && pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The first `build.sh` run pulls `emscripten/emsdk:5.0.5` and takes ~2 min.

### Documentation

| | |
|---|---|
| [Redesign plan](docs/00-redesign-plan.md) | Stage-by-stage implementation plan and current status |
| [Project vision](docs/01-project-vision.md) | Target audience, core use cases, design principles |
| [Feature specs](docs/04-feature-specs/) | Per-feature specs with acceptance criteria |
| [WASM API contract](docs/06-wasm-api-contract.md) | TypeScript ↔ libdedx interface |
| [Deployment](docs/08-deployment.md) | GitHub Pages pipeline and CI |
| [AI changelog](CHANGELOG-AI.md) | Log of all AI-assisted sessions |

### Team

Developed by [Piotr Połeć](https://github.com/piotrpolec) and [Marek Ślązak](https://github.com/Mexolius) under supervision of [Leszek Grzanka](https://github.com/grzanka)
