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
| Development (`web_dev`) | `APTG/web_dev` | Push to `master` |
| Production (`web`) | `APTG/web` | Git tag `v*` |

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

Key Emscripten flags: `EXPORT_ES6=1`, `MODULARIZE=1`, `ENVIRONMENT=web`,
`-sFILESYSTEM=0`. See [ADR 003 — WASM Build Pipeline](decisions/003-wasm-build-pipeline.md)
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
`static/wasm/` are passed through un-hashed (they are too large for inline
embedding and their cache behaviour is acceptable — see
[09-non-functional-requirements.md §3.1](09-non-functional-requirements.md)).

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
The deploy job runs only on `master` push or `v*` tag — never on PRs.

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
