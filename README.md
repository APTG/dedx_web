# dEdx web

Calculate **charged-particle stopping powers** (dE/dx) and **CSDA ranges** directly in the browser — no installation required. Select a particle, a target material, and an energy range; get numerical results and interactive plots instantly. Based on the [libdedx](https://github.com/APTG/libdedx) library, running fully client-side via WebAssembly.

## Try it

| | URL | What's there | Last deployed |
|---|-----|-------------|---------------|
| **Development** | [aptg.github.io/web_dev](https://aptg.github.io/web_dev/) | Current work-in-progress — entity selection and energy input | 25 April 2026 |
| **Stable** | [aptg.github.io/web](https://aptg.github.io/web/) | Previous version (legacy React app — functional but outdated) | — |

> **Rewrite in progress:** The app is being rebuilt from scratch with a modern stack. Currently at Stage 5 of 8 — core UI components. The development site tracks the current state; the stable site will be updated when the rewrite reaches a full release.

## Related tools

- [PSTAR (NIST)](https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html) — proton stopping powers
- [ATIMA](https://www.isotopea.com/webatima/) — similar scope, different library

---

## For developers

### Run locally

Prerequisites: **Docker** (for the WASM build), **Node.js 24+**, **pnpm**.

```sh
# 1. Build the WASM module (pulls emscripten/emsdk:5.0.5, ~2 min first time)
cd wasm && ./build.sh

# 2. Install dependencies and start dev server
pnpm install && pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

```sh
# Production build (GitHub Pages sub-path)
BASE_PATH=/web_dev pnpm build
```

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
