# Technology Stack — webdedx

> **Status:** Draft v2 (14 April 2026)
>
> Documents every library and tool in the stack, the version pin, and the
> rationale for choosing it. Rationale summaries refer to the relevant ADR
> where a full justification exists.

---

## 1. Framework

### SvelteKit 2 + Svelte 5

| Item | Value |
|------|-------|
| Package | `@sveltejs/kit` |
| Pin | `^2.x` (latest stable) |
| Svelte engine | `svelte ^5.x` |
| ADR | [ADR 001](decisions/001-sveltekit-over-react.md) |

SvelteKit provides file-based routing, server-side rendering (unused here but
available), and a static adapter for GitHub Pages. Svelte 5 replaces the store
module with runes — a single reactive primitive that covers component state,
shared state, and derived values without needing a separate state library.

**Svelte 5 — required patterns:**

| Use this | Not this |
|----------|----------|
| `let x = $state(v)` | `let x = v` (non-reactive) |
| `let y = $derived(expr)` | `$: y = expr` |
| `$effect(() => { … })` | `onMount` / `onDestroy` |
| `{ …props }: Props = $props()` | `export let prop` |
| `$bindable()` for two-way | `bind:` on `export let` |

No `svelte/store` usage. No `createEventDispatcher()`. No Svelte 4 lifecycle
imports.

### `@sveltejs/adapter-static`

| Item | Value |
|------|-------|
| Package | `@sveltejs/adapter-static` |
| Pin | `^3.x` |

Produces a static `build/` directory of pre-rendered HTML + JS + CSS. Required
for GitHub Pages deployment. All routes must be pre-renderable at build time —
no server-side dynamic data is needed (all computation is WASM).

In `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      fallback: '404.html'   // GitHub Pages 404 fallback for client-side navigation
    }),
    prerender: { handleHttpError: 'warn' }
  }
};
```

---

## 2. Language

### TypeScript 5 (strict mode)

| Item | Value |
|------|-------|
| Package | `typescript` |
| Pin | `^5.x` |

All source files are `.ts` or `.svelte` (with `<script lang="ts">`).

`tsconfig.json` settings that must not be relaxed:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

`noUncheckedIndexedAccess` is critical — WASM array returns are indexed
frequently; this flag prevents silent `undefined` access bugs.

---

## 3. Styling

### Tailwind CSS 4

| Item | Value |
|------|-------|
| Package | `tailwindcss` |
| Pin | `^4.x` |
| PostCSS integration | `@tailwindcss/vite` |

Utility-first CSS. Chosen because:

- No CSS file bloat — only used classes are emitted.
- Dark-mode support via `dark:` variant (not required for v1, but the
  design must not preclude it — hardcoded colors are forbidden).
- Responsive utilities (`sm:`, `md:`, `lg:`) map cleanly to the three
  breakpoints specified in [`09-non-functional-requirements.md`](09-non-functional-requirements.md).
- No design-system lock-in; webdedx uses a custom scientific-minimal visual
  identity.

Tailwind is configured in `tailwind.config.js`. The content glob covers
`./src/**/*.{svelte,ts}`.

---

## 4. Plotting

### JSROOT 7

| Item | Value |
|------|-------|
| Package | `jsroot` |
| Pin | `^7.x` |
| ADR | [ADR 002](decisions/002-keep-jsroot.md) |

The physics-community standard for ROOT-style interactive plots. Loaded
lazily on the Plot page via dynamic import to avoid adding parse cost to
the Calculator page initial load.

```ts
// Lazy import — only executes when Plot page is first visited
const JSROOT = await import('jsroot');
```

JSROOT is not Svelte-aware; a dedicated `JsrootPlot.svelte` wrapper component
owns the container `<div>` and manages the JSROOT lifecycle through `$effect`.
See [`03-architecture.md` §4](03-architecture.md#4-reactive-state-topology).

---

## 5. PDF Export

### jsPDF 2

| Item | Value |
|------|-------|
| Package | `jspdf` |
| Pin | `^2.x` |

Used for Calculator and Plot PDF export (see [`04-feature-specs/export.md`](04-feature-specs/export.md)).
`jsPDF` produces PDF programmatically from JS — no server, no headless browser.
The PDF content (metadata block, table, chart SVG embedded as image) is
assembled in a utility module (`src/lib/export/pdf.ts`).

---

## 6. External Data Parsing

### hyparquet

| Item | Value |
|------|-------|
| Package | `hyparquet` |
| Pin | `^1.x` |

Pure-JS Apache Parquet reader for the `.webdedx.parquet` external data format
(see [`04-feature-specs/external-data.md`](04-feature-specs/external-data.md)). Supports HTTP Range Request
partial reads — only the requested row group (one table per particle-material
pair) is downloaded.

> External data loading is a later-stage feature. `hyparquet` is listed here
> for completeness; the Stage 3–4 scaffolding does not need to install it yet.

---

## 7. WebAssembly Toolchain

### Emscripten 5.x

| Item | Value |
|------|-------|
| Tool | `emscripten` (system install or Docker) |
| Pin | `5.x` — current stable: **5.0.5** (03 April 2026) |
| ADR | [ADR 003](decisions/003-wasm-build-pipeline.md) |

Compiles `libdedx.a` + `wasm/dedx_extra.c` to `libdedx.mjs` + `libdedx.wasm`.
The WASM binary is placed in `static/wasm/` so SvelteKit serves it as a
static asset.

Emscripten is a **system-level tool**, not an npm package. The build is invoked
via `wasm/build.sh`. CI installs Emscripten from the
[emsdk](https://github.com/emscripten-core/emsdk) Docker image.

The exact Emscripten version is pinned in `wasm/build.sh` and in the GitHub
Actions workflow (`08-deployment.md` — planned). Emscripten 5.x dropped several
legacy flags (`LEGACY_RUNTIME`, old `FS` API paths) and tightened the ES module
output — the `build.sh` flags are written against 5.x. Breaking changes in
Emscripten's JS glue code require a wrapper update.

**Changelog notes relevant to this project** (from [`resources/emscripten-changelog.md`](resources/emscripten-changelog.md)):

| Version | Change | Impact |
|---------|--------|--------|
| 4.0.12 / 5.0.0 | `MODULARIZE=1` factory always returns a `Promise`, even when `WASM_ASYNC_COMPILATION=0` | `loader.ts` uses `await factory.default({...})` — correct |
| 4.0.17 | `-sENVIRONMENT=worker` alone is disallowed; must use `web,worker` | If Web Worker support is ever added (see `03-architecture.md §3`), change `ENVIRONMENT='web'` to `ENVIRONMENT='web,worker'` |
| 5.0.6 (dev) | Minimum Node.js for generated code bumped to v18.3.0 | Node 24 used in CI and tests is well within limits |

---

## 8. Testing

### Vitest 4

| Item | Value |
|------|-------|
| Package | `vitest` |
| Pin | `^4.x` |

Unit and integration tests. Vitest is Vite-native — it reuses the Vite
transform pipeline, so Svelte components and TypeScript are tested without
a separate compilation step.

Configuration in `vite.config.ts` (inside the `test` key):

```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/tests/setup.ts'],
  coverage: { provider: 'v8', reporter: ['text', 'lcov'] }
}
```

WASM module tests use the real module (loaded once per test suite) to catch
`dedx_extra.c` API regressions. Component tests mock the WASM service via
`src/lib/wasm/__mocks__/libdedx.ts`.

### Svelte Testing Library

| Item | Value |
|------|-------|
| Package | `@testing-library/svelte` |
| Pin | `^5.x` |

Component tests render Svelte components into jsdom and assert on accessible
roles and text. Avoids testing implementation details (no component instance
queries).

### Playwright 1.x

| Item | Value |
|------|-------|
| Package | `@playwright/test` |
| Pin | `^1.x` |

End-to-end tests against a built static site served locally. Tests the real
WASM module — no mocks. See `07-testing-strategy.md` (planned) for the test plan.

---

## 9. Linting and Formatting

### ESLint 9 + `eslint-plugin-svelte`

| Item | Value |
|------|-------|
| Package | `eslint`, `eslint-plugin-svelte`, `@typescript-eslint/eslint-plugin` |
| Pin | `eslint ^9.x`, plugins at their latest compatible version |
| Config file | `eslint.config.js` (flat config) |

Uses `svelte/recommended` preset plus custom rules:

- Forbid Svelte 4 patterns: `export let` in component scripts triggers a lint
  error (Copilot instructions reinforce this; ESLint enforces it in CI).
- `@typescript-eslint/no-explicit-any` — error.
- `@typescript-eslint/strict` preset enabled.

### Prettier + `prettier-plugin-svelte`

| Item | Value |
|------|-------|
| Package | `prettier`, `prettier-plugin-svelte` |
| Pin | `prettier ^3.x` |
| Config file | `.prettierrc` |

All `.svelte`, `.ts`, `.js`, `.json`, `.md` files are formatted by Prettier.
CI runs `prettier --check .`; the commit hook runs `prettier --write`.

`.prettierrc` settings:

```json
{
  "singleQuote": false,
  "semi": true,
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [
    { "files": "*.svelte", "options": { "parser": "svelte" } }
  ]
}
```

---

## 10. Build and Dev

### Vite 6 (via SvelteKit)

SvelteKit uses Vite as its underlying bundler. No direct Vite configuration is
required beyond what `svelte.config.js` and `vite.config.ts` expose.

Dev server: `npm run dev` (HMR enabled).
Production build: `npm run build` (static bundle in `build/`).
Type check: `npm run check` (runs `svelte-check` + `tsc --noEmit`).

### `svelte-check`

| Item | Value |
|------|-------|
| Package | `svelte-check` |
| Pin | `^4.x` |

Validates TypeScript types inside `.svelte` files. Runs as part of `npm run
check` and in CI before the build step.

---

## 11. CI/CD

### GitHub Actions

All CI runs in GitHub-hosted runners. The pipeline (Stage 8) will execute:

1. `eslint .` — lint
2. `prettier --check .` — format check
3. `npm run check` — `svelte-check` + `tsc --noEmit`
4. `vitest run` — unit + integration tests
5. `playwright test` — E2E tests (against local `vite preview`)
6. `wasm/build.sh` — compile WASM (only on WASM-relevant file changes)
7. `npm run build` — SvelteKit static build
8. Deploy `build/` to GitHub Pages

See `08-deployment.md` (planned) for the full workflow YAML.

---

## 12. Package Manager

### npm

The project uses `npm` with a committed `package-lock.json`. `pnpm` or `yarn`
are not prohibited, but the lock file must not be mixed — pick one and commit
it. npm is the default for GitHub Actions' Node.js setup action.

---

## 13. Node.js

| Item | Value |
|------|-------|
| Version | `24 LTS` — current patch: **24.14** |
| Engine field | `package.json` `"engines": { "node": "^24" }` |
| Current "Current" release | 25.9 (odd-numbered, no LTS; not used) |
| Migration target | `^26` — Node.js 26 released April 2026; enters Active LTS October 2026 |

Node.js 24 (currently at 24.14) is the Active LTS line used for all CI and
contributor environments. Node.js 25.9 is the current "Current" release —
odd-numbered, no long-term support guarantee, not used here. Node.js 26 was
released in April 2026 and will enter Active LTS in October 2026.

Notable features in use:

- **Built-in `fetch` + `WebSocket`** — no polyfill needed in tests or scripts.
- **V8 12.x** — ships `using` / `await using` (Explicit Resource Management
  proposal); usable in TypeScript 5.2+ with `"useDefineForClassFields": true`.
- **Improved `node:test` runner** — considered for fast isolated unit tests
  outside Vitest where WASM mocking is not required.

**Migration note:** Node.js 26 enters Active LTS in October 2026. At that
point, update `"engines"` to `"^24 || ^26"` first (validate CI), then drop
`^24` once the team has confirmed no regressions.

---

## 14. Version Summary Table

| Package | Pin | Role |
|---------|-----|------|
| `@sveltejs/kit` | `^2.x` | Framework |
| `svelte` | `^5.x` | UI compiler |
| `@sveltejs/adapter-static` | `^3.x` | Static site output |
| `typescript` | `^5.x` | Language |
| `tailwindcss` | `^4.x` | Styling |
| `jsroot` | `^7.x` | Physics plotting |
| `jspdf` | `^2.x` | PDF export |
| `hyparquet` | `^1.x` | Parquet reader (external data) |
| `vitest` | `^4.x` | Unit/integration tests |
| `@testing-library/svelte` | `^5.x` | Component tests |
| `@playwright/test` | `^1.x` | E2E tests |
| `eslint` | `^9.x` | Linting |
| `eslint-plugin-svelte` | latest compat | Svelte lint rules |
| `@typescript-eslint/eslint-plugin` | latest compat | TypeScript lint rules |
| `prettier` | `^3.x` | Formatting |
| `prettier-plugin-svelte` | latest compat | Svelte formatter |
| `svelte-check` | `^4.x` | Component type checking |
| Emscripten | `5.x` | WASM compiler (system tool) |
| Node.js | `24 LTS` (24.14) | Runtime |

---

## 15. Related Documents

| Document | Purpose |
|----------|---------|
| [decisions/001-sveltekit-over-react.md](decisions/001-sveltekit-over-react.md) | Full rationale for SvelteKit |
| [decisions/002-keep-jsroot.md](decisions/002-keep-jsroot.md) | Full rationale for JSROOT |
| [decisions/003-wasm-build-pipeline.md](decisions/003-wasm-build-pipeline.md) | WASM build flags and dedx_extra rationale |
| [03-architecture.md](03-architecture.md) | Project structure, store topology, routing |
| [06-wasm-api-contract.md](06-wasm-api-contract.md) | TypeScript types for the WASM wrapper |
| [08-deployment.md](08-deployment.md) | GitHub Actions workflow |
| [09-non-functional-requirements.md](09-non-functional-requirements.md) | Performance budgets, browser support |
