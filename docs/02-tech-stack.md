# Technology Stack — webdedx

> **Status:** Final v3 (19 April 2026)
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

### TypeScript 6 (strict mode)

| Item | Value |
|------|-------|
| Package | `typescript` |
| Pin | `^6.x` |

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

**Notes on TypeScript 6 (bumped from 5.9.3 in #408):** v6 is primarily a
strictness/cleanup release rather than a new-feature release; we did not adopt
any new language constructs. Two TS 6 changes did require code adjustments and
are worth keeping in mind for future contributors:

- **Named value/type exports from `*.svelte` files via wildcard module
  declarations are no longer resolved (TS2614).** Co-located helpers (e.g.
  `buttonVariants`, prop types) must live in a sibling `*.variants.ts` /
  `*.types.ts` file and be re-imported by the component, not exported from the
  `.svelte` file itself. See `src/lib/components/ui/button/`.
- **`exactOptionalPropertyTypes` is enforced more aggressively in object
  spreads.** Spreading `{ error: undefined }` onto a type with `error?: string`
  is now a type error; clone-and-`delete` (or a conditional spread) instead.

CI runs `pnpm typecheck` (`svelte-kit sync && tsc --noEmit`) in the
`unit-tests` job so strict-mode regressions surface on every PR. `pnpm check`
(svelte-check) is the more thorough local check — it validates `.svelte` files
as well — but it currently reports pre-existing rune-typing noise and is not
yet wired into CI.

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

### shadcn-svelte + Bits UI

| Item | Value |
|------|-------|
| CLI package | `shadcn-svelte` (via `pnpm dlx shadcn-svelte@latest`) |
| Runtime package | `bits-ui` |
| Runtime pin | `^1.x` |
| ADR | [ADR 005](decisions/005-shadcn-svelte-components.md) |

shadcn-svelte is the UI component library for dEdx Web. The CLI copies component
source into `src/lib/components/ui/` — the project owns the code and can
customise it. Only **Bits UI** (the headless primitive layer) is a runtime
dependency.

Bits UI provides WCAG 2.1 AA-compliant focus management, keyboard navigation,
and ARIA attributes for every interactive component (combobox, dialog, accordion,
table, toast). Components are tree-shaken; only imported primitives enter the
bundle.

shadcn-svelte is Tailwind-first (no extra styling system) and fully supports
Svelte 5 runes and Tailwind v4.

Initialise once during Stage 4 scaffold:

```sh
pnpm dlx shadcn-svelte@latest init
```

Add components per feature (see [ADR 005](decisions/005-shadcn-svelte-components.md)
integration plan):

```sh
pnpm dlx shadcn-svelte@latest add combobox accordion dialog table
```

---

## 4. Plotting

### JSROOT 7

| Item | Value |
|------|-------|
| Package | `jsroot` |
| Pin | `~7.x.y` (pin to a validated minor/patch release; avoid `^7.x`) |
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
See [`03-architecture.md` §5](03-architecture.md#5-component-tree).

---

## 5. PDF Export

### jsPDF 4

| Item | Value |
|------|-------|
| Package | `jspdf` |
| Pin | `^4.x` |

Used for Calculator and Plot PDF export (see [`04-feature-specs/export.md`](04-feature-specs/export.md)).
`jsPDF` produces PDF programmatically from JS — no server, no headless browser.
The PDF content (metadata block, table, chart SVG embedded as image) is
assembled in a utility module (`src/lib/export/pdf.ts`).

---

## 6. External Data Parsing

### zarrita

| Item | Value |
|------|-------|
| Package | `zarrita` |
| Pin | `^0.7.x` (validated: 0.7.1) |
| ADR | Spike 4 verdict — `prototypes/extdata-formats/VERDICT.md` |

Pure-JS Zarr v3 reader for the `.webdedx` external data format
(see [`04-feature-specs/external-data.md`](04-feature-specs/external-data.md)). Supports Zarr v3 with ZEP2
sharding — per-ion shard files enable partial reads via HTTP Range Requests.
Bundle size: zarrita core 38.62 kB minified (gzip 12.89 kB); LZ4 codec chunk
36.59 kB (required for reading LZ4-compressed `.webdedx` stores).

Spike 4 validated zarrita 0.7.1 against a real S3 bucket with 287 particles ×
379 materials × 165 energy points. Cold-start sequence: 7 HTTP requests
(2 × Zarr v2 compat probe 404, zarr.json root 86.5 KB, array zarr.json 1.3 KB,
HEAD probe, 20-byte ZEP2 shard index Range, 137.5 KB data Range). See
[`prototypes/extdata-formats/VERDICT.md §2.5`](../prototypes/extdata-formats/VERDICT.md)
for measured request sequence.

> External data loading is a later-stage feature. `zarrita` is listed here
> for completeness; the Stage 3–4 scaffolding does not need to install it yet.

> **Note:** `vite build` bundles blosc (603 kB) and zstd (747 kB) codec chunks
> alongside the lz4 codec. These are expected to be lazy-loaded and not eagerly
> included for LZ4-only `.webdedx` stores — verify before production build.

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
WASM module — no mocks. See [`07-testing-strategy.md`](07-testing-strategy.md) for the test plan.

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

Dev server: `pnpm dev` (HMR enabled).
Production build: `pnpm build` (static bundle in `build/`).
Type check: `pnpm check` (runs `svelte-check` + `tsc --noEmit`).

### `svelte-check`

| Item | Value |
|------|-------|
| Package | `svelte-check` |
| Pin | `^4.x` |

Validates TypeScript types inside `.svelte` files. Runs as part of `pnpm
check` and in CI before the build step.

---

## 11. CI/CD

### GitHub Actions

All CI runs in GitHub-hosted runners. The pipeline (Stage 8) will execute:

1. `eslint .` — lint
2. `prettier --check .` — format check
3. `pnpm check` — `svelte-check` + `tsc --noEmit`
4. `vitest run` — unit + integration tests
5. `playwright test` — E2E tests (against local `vite preview`)
6. `wasm/build.sh` — compile WASM (only on WASM-relevant file changes)
7. `pnpm build` — SvelteKit static build
8. Deploy `build/` to GitHub Pages

See [`08-deployment.md`](08-deployment.md) for the full workflow YAML.

---

## 12. Package Manager

> **Note:** The legacy CRA application in the current `src/` tree uses npm
> (`package-lock.json`). The new SvelteKit application (scaffolded in Stage 4)
> replaces it entirely and uses **pnpm** from day one.

### pnpm

| Item | Value |
|------|-------|
| Tool | `pnpm` |
| Pin | `^10.x` (latest stable as of April 2026) |
| Lock file | `pnpm-lock.yaml` (committed) |
| Activation | `corepack enable && corepack use pnpm@latest` — Node 24 ships corepack |

pnpm is used over npm for three reasons:

1. **Strict dependency resolution.** pnpm's `node_modules` layout does not
   hoist transitive dependencies. If a package is not in `package.json`, it
   cannot be imported — catching phantom dependency bugs early (npm silently
   allows this).
2. **Speed and disk efficiency.** pnpm uses a content-addressable global store
   with hard links. Installs are 2–3× faster than npm; the prototype spikes
   (each with its own `node_modules`) benefit especially.
3. **Compatibility.** Unlike Yarn Berry's PnP mode, pnpm uses a standard
   `node_modules` directory. JSROOT, Emscripten's generated `.mjs` glue, and
   Playwright all work without configuration.

`package.json` declares the package manager via the `packageManager` field
(consumed by corepack):

```json
{
  "packageManager": "pnpm@10.x.x"
}
```

CI uses `pnpm/action-setup` before `actions/setup-node` with
`cache: 'pnpm'`.

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
| `typescript` | `^6.x` | Language |
| `tailwindcss` | `^4.x` | Styling |
| `shadcn-svelte` CLI | `@latest` (via `pnpm dlx`) | UI component scaffolding (source copied) |
| `bits-ui` | `^1.x` | Headless UI primitives (runtime) |
| `jsroot` | `^7.x` | Physics plotting |
| `jspdf` | `^4.x` | PDF export |
| `zarrita` | `^0.7.x` | Zarr v3 reader (external data) |
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
| [decisions/005-shadcn-svelte-components.md](decisions/005-shadcn-svelte-components.md) | UI component library decision (shadcn-svelte + Bits UI) |
| [03-architecture.md](03-architecture.md) | Project structure, store topology, routing |
| [06-wasm-api-contract.md](06-wasm-api-contract.md) | TypeScript types for the WASM wrapper |
| [08-deployment.md](08-deployment.md) | GitHub Actions workflow |
| [09-non-functional-requirements.md](09-non-functional-requirements.md) | Performance budgets, browser support |
