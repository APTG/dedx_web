# dEdx web

An online interface of the libdEdx library for calculating charged-particle stopping powers and CSDA ranges.

## Live deployments

| Environment | URL | Updated on |
|-------------|-----|------------|
| **Development** | [aptg.github.io/web_dev](https://aptg.github.io/web_dev/) | every push to `master` [![Deploy](https://github.com/APTG/dedx_web/actions/workflows/deploy.yml/badge.svg)](https://github.com/APTG/dedx_web/actions/workflows/deploy.yml) |
| **Production** | [aptg.github.io/web](https://aptg.github.io/web/) | git tag `v*` |

## Local development

Prerequisites: **Docker** (for the WASM build), **Node.js 24+**, **pnpm**.

**1. Build WASM** (requires Docker; pulls `emscripten/emsdk:5.0.5`, ~2 min first time):

```sh
cd wasm && ./build.sh
```

Output: `static/wasm/libdedx.mjs` + `static/wasm/libdedx.wasm`

**2. Install dependencies and start the dev server:**

```sh
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

**3. Production build** (with the GitHub Pages sub-path):

```sh
BASE_PATH=/web_dev pnpm build
```

Output in `build/`. Verify the WASM contract first: `node wasm/verify.mjs`.

## Documentation

Design documents for the ongoing redesign live in [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [Redesign Plan](docs/00-redesign-plan.md) | Implementation stages, tech stack, spec template |
| [Project Vision](docs/01-project-vision.md) | Audience, core use cases, design principles |
| [WASM API Contract](docs/06-wasm-api-contract.md) | TypeScript ↔ libdedx WebAssembly interface |
| [Deployment](docs/08-deployment.md) | GitHub Pages pipeline, WASM build, CI |
| [Feature Specs](docs/04-feature-specs/) | Per-feature specs (entity selection, calculator, unit handling) |
| [AI Session Logs](docs/ai-logs/) | Detailed AI coding session logs |
| [AI Changelog](CHANGELOG-AI.md) | Summary table of all AI-assisted sessions |

## Technologies

| Layer | Choice |
|-------|--------|
| Framework | **SvelteKit** with **Svelte 5** (TypeScript) |
| Plotting | **JSROOT** (physics community standard) |
| Styling | **Tailwind CSS** + **shadcn-svelte** |
| WASM | **Emscripten 5.x** — libdedx compiled to `.mjs` + `.wasm` |
| Deployment | **GitHub Pages** (static adapter) |
| Testing | **Vitest** (unit/integration) + **Playwright** (E2E) |

## Related projects

- [PSTAR (NIST)](https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html)
- [ATIMA](https://www.isotopea.com/webatima/)

## Team and Supervisor

Developed by [Piotr Połeć](https://github.com/piotrpolec) and [Marek Ślązak](https://github.com/Mexolius) under supervision of [Leszek Granka](https://github.com/grzanka)
