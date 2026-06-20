# dEdx web

Calculate **charged-particle stopping powers** (dE/dx) and **CSDA ranges** directly in the browser — no installation required. Select a particle, a target material, and an energy range; get numerical results and interactive plots instantly. Based on the [libdedx](https://github.com/APTG/libdedx) library, running fully client-side via WebAssembly.

## Try it

### v2 (development)

**[aptg.github.io/web_dev](https://aptg.github.io/web_dev/)**

Open beta candidate — Stage 7 complete; Stage 8 user-feedback cycle active. Deployed continuously from `master`.

### v1.1.0 (stable)

**[aptg.github.io/web](https://aptg.github.io/web/)**

Last stable release — fully functional but based on the old React stack. Released 1 April 2022.

## Why v2?

v1.1.0 (April 2022) has several limitations: no unit handling, React 17 class components with no TypeScript, and plots that do not meet the needs of typical physics workflows.

v2 is a ground-up rewrite addressing all of the above. It is also an experiment in **AI-assisted (vibe-coded) development** — the codebase is written by AI agents (GitHub Copilot, Claude Code, opencode) guided by spec-driven prompts, with human review. Stage 7 (E2E tests, UI polish, WASM error handling, and external `.webdedx` data) is complete; the app is now entering Stage 8 open beta and user feedback. v2.0.0 will replace the stable site on first production release.

## Related tools

- [PSTAR (NIST)](https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html) — proton stopping powers
- [ATIMA](https://www.isotopea.com/webatima/) — similar scope, different library

---

## For developers

### Run locally (v2)

Prerequisites: **Docker** (for the WASM build), **Node.js 24+**, **pnpm**.

Build the WASM module (requires Docker; pulls `emscripten/emsdk:5.0.5`, ~2 min on first run):

```sh
(cd wasm && ./build.sh)
```

Install dependencies and start the dev server:

```sh
pnpm install && pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

### Documentation

Full technical documentation — architecture, WASM API, build pipeline, testing strategy, and developer guides — is available at:

**[aptg.github.io/web_dev/docs/technical](https://aptg.github.io/web_dev/docs/technical)**

### Team

v1 was developed by [Piotr Połeć](https://github.com/piotrpolec) and [Marek Ślązak](https://github.com/Mexolius) under supervision of [Leszek Grzanka](https://github.com/grzanka).

v2 is led by [Leszek Grzanka](https://github.com/grzanka) with AI assistants (GitHub Copilot, Claude Code, opencode).
