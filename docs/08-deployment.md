# Deployment

> **Status:** Reference document (19 April 2026)
>
> This document gives the big-picture deployment architecture for dEdx Web.
> The authoritative technical decisions live in the ADRs and the redesign plan
> stage definitions listed below. The legacy CI workflow
> (`.github/workflows/test_and_deploy.yml`) is **deleted at the start of
> Stage 3** — it was written for the old React/CRA app. The replacement
> `ci.yml` is added in Stage 3 and expanded through Stage 8 (see §5).

---

## 1. Deployment target

The application is deployed as a **fully static site on GitHub Pages**.
There is no server, no API, no database. All computation happens in the
browser via WebAssembly.

Two deployment environments exist (inherited from the legacy app; will be
preserved in the redesign):

| Environment | Repository | Trigger |
|-------------|-----------|---------|
| Development (`web_dev`) | `APTG/web_dev` | Push to `master` (see note ¹) |
| Production (`web`) | `APTG/web` | Git tag `v*` |

> **¹ Early deploy phase (pre-Stage 4):** Until Stage 8, the `web_dev` deploy
> triggers on `develop` instead of `master` and pushes a placeholder page.
> See §5.1 for details.

**Decision rationale:** [ADR 001 — SvelteKit over React](decisions/001-sveltekit-over-react.md)
chose SvelteKit with its static adapter precisely because GitHub Pages
requires zero server-side runtime. The `@sveltejs/adapter-static` adapter
pre-renders all routes at build time.

---

## 2. Build pipeline overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3 — WASM build (Docker / Emscripten 5.x)                  │
│   docker run emscripten/emsdk                                   │
│   → wasm/build.sh                                               │
│   → static/wasm/libdedx.mjs  (ES module glue, ~13 KB)          │
│   → static/wasm/libdedx.wasm (WASM binary, ~457 KB)            │
└────────────────────────┬────────────────────────────────────────┘
                         │ pre-built artifacts committed / uploaded
┌────────────────────────▼────────────────────────────────────────┐
│ Stage 4–7 — SvelteKit build (pnpm build)                        │
│   vite + @sveltejs/adapter-static                               │
│   → build/  (static HTML/JS/CSS + wasm/ passthrough)           │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ Stages 3–8 — CI (GitHub Actions, phased — see §5)              │
│   Stage 3: node wasm/verify.mjs                                 │
│   Stage 4: + lint + check + build                               │
│   Stage 5: + pnpm test (Vitest)                                 │
│   Stage 7: + pnpm exec playwright test                          │
│   Stage 8: + deploy → APTG/web_dev (master) / APTG/web (tag)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. WASM build

The libdedx C library is compiled to WebAssembly using **Emscripten 5.x** in
a Docker container (`emscripten/emsdk`). The build produces two artifacts:

- `static/wasm/libdedx.mjs` — Emscripten ES module glue (~13 KB).
- `static/wasm/libdedx.wasm` — WebAssembly binary (~457 KB). All stopping-power
  data tables are compiled in as static C arrays — no `.data` sidecar file.

Key Emscripten flags: `EXPORT_ES6=1`, `MODULARIZE=1`, `ENVIRONMENT=web,node`.
The `node` component preserves `verify.mjs` Node.js
compatibility without a separate build. See [ADR 003 — WASM Build Pipeline](decisions/003-wasm-build-pipeline.md)
for the full flag set and rationale.

A thin C shim (`wasm/dedx_extra.{h,c}`) exposes functions not in the public
libdedx API without modifying the submodule. The TypeScript contract is in
[06-wasm-api-contract.md](06-wasm-api-contract.md).

Build verification: `node wasm/verify.mjs` calls exported functions and checks
physically plausible return values.

---

## 4. SvelteKit static build

SvelteKit with `@sveltejs/adapter-static` generates a `build/` directory of
static HTML, JS (content-hashed), and CSS files. The WASM artifacts in
`static/wasm/` are passed through un-hashed — they are too large for inline
embedding and their cache behaviour is acceptable. See
[09-non-functional-requirements.md §3.1](09-non-functional-requirements.md).

**Base path:** The app is served from a sub-path on GitHub Pages
(`/web_dev/` or `/web/`). `%sveltekit.assets%` resolves this at build time.
See [03-architecture.md](03-architecture.md) for the Vite config details.

---

## 5. CI (phased — starts Stage 3)

`.github/workflows/test_and_deploy.yml` (legacy React/CRA) is **deleted at the
start of Stage 3**. A new `ci.yml` is added in its place and expanded at each
stage so that every PR has a gate matching the current scope of the project:

| Stage | New steps added to `ci.yml` |
|-------|-----------------------------|
| **3** | Create workflow; `node wasm/verify.mjs` (WASM artifact smoke-test) |
| **4** | `pnpm install`, `pnpm lint`, `pnpm check` (svelte-check + tsc), `pnpm build` |
| **5** | `pnpm test` (Vitest — first unit tests written in this stage) |
| **7** | `pnpm exec playwright install --with-deps`, `pnpm exec playwright test` |
| **8** | Deploy job: push `build/` → `APTG/web_dev` (master) / `APTG/web` (v* tag) |

Every PR triggers the full `ci` job at whatever steps the current stage has added.
The Stage 8 deploy job in `ci.yml` runs only on `master` push or `v*` tag —
never on PRs. The earlier `develop`-triggered placeholder deploy is a separate
workflow described in §5.1.

### §5.1 Early deploy phase (develop branch, through Stage 7)

Before the Stage 8 deploy job exists (Stages 3.8 through end of Stage 7), a
separate workflow `.github/workflows/deploy.yml` deploys a static
"Under Construction" placeholder from the `develop` branch.

**Rationale:**
- Establishes the `dedx_web → web_dev` pipeline early so it is well-tested
  before Stage 8 makes it load-bearing.
- Makes the `web_dev` site immediately visible to collaborators.
- Confirms PAT, GitHub Pages, and `gh-pages` branch configuration before the
  real build is available.

**Trigger:** push to `develop`.
**Content:** static `index.html` with a link to `docs/00-redesign-plan.md`.
**Authentication:** PAT stored as `WEB_DEV_DEPLOY_TOKEN` secret in the
`dedx_web` repo (fine-grained, `Contents: Read and write` on `APTG/web_dev`).
**Environment:** GitHub Environment `dev` (created in `dedx_web` repo settings)
provides deployment tracking and the live URL `https://aptg.github.io/web_dev/`
in the GitHub UI.

**One-time repo setup:**

1. Create a fine-grained PAT with `Contents: Read and write` scoped to
   `APTG/web_dev`. In `dedx_web` repo: Settings → Secrets and variables →
   Actions → New repository secret → name `WEB_DEV_DEPLOY_TOKEN`.
2. In `APTG/web_dev` repo: Settings → Pages → Source: Deploy from branch →
   Branch: `gh-pages`, folder: `/ (root)`.
3. In `dedx_web` repo: Settings → Environments → New environment → name `dev`.
   Protection rules are optional at this stage.

**Stage 8 migration:** change the trigger from `develop` to `master` + `v*`
tags, replace the placeholder build step with `pnpm build`, and add the
production deploy job targeting `APTG/web`. The `deploy.yml` file contains
a Phase 1 / Phase 2 comment header with the exact diff to apply.

### Final pipeline (Stage 8)

```yaml
on:
  push:
    branches: [master]
    tags: ['v*']
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: node wasm/verify.mjs                       # Stage 3
      - run: pnpm install                               # Stage 4
      - run: pnpm lint                                  # Stage 4
      - run: pnpm check                                 # Stage 4
      - run: pnpm build                                 # Stage 4
      - run: pnpm test                                  # Stage 5
      - run: pnpm exec playwright install --with-deps   # Stage 7
      - run: pnpm exec playwright test                  # Stage 7

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/master' || startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - deploy build/ to APTG/web_dev (master) or APTG/web (v* tag) via gh-pages
```

---

## 6. Browser caching

GitHub Pages serves all assets with `Cache-Control: max-age=600, must-revalidate`.
SvelteKit's `_app/immutable/` assets (content-hashed filenames) receive
`max-age=31536000` from the browser on re-validation — effectively permanent
cache after the first conditional request.

The WASM files (`libdedx.mjs`, `libdedx.wasm`) are served un-hashed and
therefore subject to the 10-minute `max-age`. After that, the browser
re-validates via ETag (a `304 Not Modified` response is cheap).

A Service Worker for offline / cache-first WASM loading is **not implemented
in v1**. See [09-non-functional-requirements.md §3.1](09-non-functional-requirements.md)
for the reasoning.

---

## 7. Cross-references

| Topic | Canonical location |
|-------|--------------------|
| Deployment target decision | [ADR 001 — SvelteKit over React](decisions/001-sveltekit-over-react.md) |
| WASM build flags and rationale | [ADR 003 — WASM Build Pipeline](decisions/003-wasm-build-pipeline.md) |
| WASM TypeScript API contract | [06-wasm-api-contract.md](06-wasm-api-contract.md) |
| Performance budgets (FCP, TTI) | [09-non-functional-requirements.md §3](09-non-functional-requirements.md) |
| Browser caching details | [09-non-functional-requirements.md §3.1](09-non-functional-requirements.md) |
| Browser support matrix | [09-non-functional-requirements.md §4](09-non-functional-requirements.md) |
| Stage 8 scope | [00-redesign-plan.md §8](00-redesign-plan.md) |
| Legacy CI workflow (deleted in Stage 3) | [.github/workflows/test_and_deploy.yml](../.github/workflows/test_and_deploy.yml) |
