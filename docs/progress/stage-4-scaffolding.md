# Stage 4: SvelteKit Scaffolding — COMPLETE ✅

**Status:** Complete  
**Completed:** 2026-04-21  
**Stage Lead:** opencode + Qwen3.5-397B  

---

## Summary

Successfully scaffolded a new SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS 4 project to replace the legacy React codebase. All development tooling, configuration files, core routes, state management, and WASM API stubs are in place.

See also:
- [Stage 4 entry in 00-redesign-plan.md](../00-redesign-plan.md) — Original stage requirements
- [Architecture overview](../03-architecture.md) — Component tree and state topology
- [Tech stack](../02-tech-stack.md) — Library versions and rationale

---

## Completed Items

### ✅ Core Setup

1. **Package.json** — All dependencies installed:
   - SvelteKit 2.x, Svelte 5.x (runes only)
   - Tailwind CSS 4.x via `@tailwindcss/vite`
   - TypeScript 5.x with strict mode
   - Vitest (unit testing), Playwright (E2E testing)
   - ESLint 9.x (flat config), Prettier
   - Optional: bits-ui, JSROOT, jsPDF, zarrita

2. **SvelteKit Configuration** ([`svelte.config.js`](../../svelte.config.js)):
   - Static adapter with 404 fallback
   - GitHub Pages deployment ready
   - Prerendering enabled for all routes

3. **Build Tooling**:
   - [`vite.config.ts`](../../vite.config.ts) — Tailwind plugin, Vitest integration
   - [`tsconfig.json`](../../tsconfig.json) — Strict TypeScript (`noUncheckedIndexedAccess`, etc.)
   - [`eslint.config.js`](../../eslint.config.js) — TypeScript + Svelte flat config
   - [`.prettierrc`](../../.prettierrc) — 100 char width, Svelte plugin
   - [`playwright.config.ts`](../../playwright.config.ts) — Multi-browser E2E testing

### ✅ Directory Structure

```
src/
├── app.css              # Tailwind import
├── app.html             # HTML template
├── lib/
│   ├── components/      # Shared UI components (Stage 5)
│   ├── export/          # CSV/PDF export utilities
│   ├── state/           # Svelte 5 runes state modules
│   │   ├── entities.svelte.ts     # Programs, particles, materials
│   │   ├── selection.svelte.ts    # Selected entity IDs
│   │   ├── calculation.svelte.ts  # Energy input, results
│   │   ├── ui.svelte.ts           # WASM flags, advanced mode
│   │   └── url-sync.ts            # URL serialization
│   ├── units/           # Unit conversion utilities
│   │   └── energy.ts              # MeV, MeV/u, MeV/nucl parsing
│   ├── wasm/            # WASM loader and API contract
│   │   ├── types.ts               # Full TypeScript API
│   │   ├── loader.ts              # Lazy singleton WASM init
│   │   ├── libdedx.ts             # LibdedxServiceImpl (stub)
│   │   └── __mocks__/             # Vitest mocks
│   ├── components/
│   │   └── jsroot-helpers.ts      # JSROOT plot wrapper
│   └── export/
│       └── csv.ts                 # CSV generation
├── routes/
│   ├── +layout.svelte   # App shell, nav, WASM status
│   ├── +layout.ts       # Empty load() for SSG
│   ├── +page.svelte     # Redirect to /calculator
│   ├── +error.svelte    # Error boundary
│   ├── calculator/
│   │   └── +page.svelte
│   ├── plot/
│   │   └── +page.svelte
│   └── docs/
│       ├── +page.svelte
│       ├── user-guide/
│       │   └── +page.svelte
│       └── technical/
│           └── +page.svelte
└── tests/
    ├── setup.ts                    # Vitest setup
    └── unit/
        └── energy-parser.test.ts   # Unit tests
tests/
└── e2e/
    └── basic.spec.ts               # Playwright E2E tests
static/
├── favicon.ico
├── favicon.svg
└── site.webmanifest
```

### ✅ State Management

All state modules use **Svelte 5 `.svelte.ts` runes patterns** (see [`src/lib/state/`](../../src/lib/state/)):

- [`entities.svelte.ts`](../../src/lib/state/entities.svelte.ts) — Entity lists and compatibility matrix
- [`selection.svelte.ts`](../../src/lib/state/selection.svelte.ts) — Selected program/particle/material IDs
- [`calculation.svelte.ts`](../../src/lib/state/calculation.svelte.ts) — Energy input, advanced options, results
- [`ui.svelte.ts`](../../src/lib/state/ui.svelte.ts) — `wasmReady`, `wasmError`, `isAdvancedMode` flags
- [`url-sync.ts`](../../src/lib/state/url-sync.ts) — URL serialization/deserialization utilities

### ✅ WASM API Stubs (see [`src/lib/wasm/`](../../src/lib/wasm/))

- [`types.ts`](../../src/lib/wasm/types.ts) — Complete TypeScript API contract (re-exported from docs)
- [`loader.ts`](../../src/lib/wasm/loader.ts) — Lazy singleton WASM initialization with `$effect`
- [`libdedx.ts`](../../src/lib/wasm/libdedx.ts) — `LibdedxServiceImpl` with malloc/free patterns (stub)
- [`__mocks__/libdedx.ts`](../../src/lib/wasm/__mocks__/libdedx.ts) — Vitest mock with fixture data

### ✅ Utility Modules (see [`src/lib/`](../../src/lib/))

- [`energy.ts`](../../src/lib/units/energy.ts) — Unit conversion (MeV, MeV/u, MeV/nucl)
- [`csv.ts`](../../src/lib/export/csv.ts) — CSV generation for export
- [`jsroot-helpers.ts`](../../src/lib/components/jsroot-helpers.ts) — JSROOT plot wrapper utilities

### ✅ Routes

All routes configured with `export const prerender = true` via `+page.ts` files:

- `/` — Redirects to `/calculator` (meta refresh + client-side navigation)
- `/calculator` — Calculator placeholder
- `/plot` — Plot placeholder
- `/docs` — Documentation landing
- `/docs/user-guide` — User guide placeholder
- `/docs/technical` — Technical reference placeholder
- `+error.svelte` — Error boundary with proper error handling

### ✅ Tests

**Unit Tests (Vitest)**:
- ✅ [`energy-parser.test.ts`](../../src/tests/unit/energy-parser.test.ts) — 3 tests passing

**E2E Tests (Playwright)**:
- ✅ [`basic.spec.ts`](../../tests/e2e/basic.spec.ts) — 4 tests passing (Chromium only):
  - Homepage redirects to calculator
  - Calculator page loads
  - Plot page loads
  - Docs page loads

### ✅ CI/CD Ready

- `pnpm build` — Outputs to `build/` (static site)
- `pnpm preview` — Production preview server
- `pnpm test` — Vitest unit tests
- `pnpm test:e2e` — Playwright E2E tests
- `pnpm lint` — ESLint passes (0 errors)
- `pnpm check` — svelte-check runs (vendor noise expected)

---

## Known Issues / Notes

1. **svelte-check vendor noise** — `pnpm check` shows errors from `vendor/` and `prototypes/` submodules but `src/` code is valid. This is expected and documented (see [Testing Strategy](../07-testing-strategy.md) §4.2).

2. **WASM module 404** — E2E tests show 404 errors for `/wasm/libdedx.mjs` because the actual WASM file doesn't exist yet (Stage 6). The mock handles unit tests.

3. **Static adapter limitations** — Server-side redirects don't work with static adapter; homepage redirect uses meta refresh + client-side `goto()`.

4. **Browser test scope** — E2E tests run on Chromium only (Firefox/WebKit require additional system dependencies not available in current environment).

---

## Verification Commands

All commands pass ✅:

```bash
pnpm build          # ✅ Static site output
pnpm preview        # ✅ Production server
pnpm test           # ✅ 3 unit tests pass
pnpm test:e2e       # ✅ 4 E2E tests pass
pnpm lint           # ✅ 0 errors
```

---

## Next Stage

**Stage 5: Core Shared Components** — Implement shadcn-svelte components (Button, Select, Card, etc.), energy input form, entity selector dropdowns, and results table with CSV export.

See [Stage 5 requirements](../00-redesign-plan.md) and [Feature Specs](../04-feature-specs/README.md) for details.

---

## Files Modified/Created

**Configuration:**
- [`package.json`](../../package.json)
- [`svelte.config.js`](../../svelte.config.js)
- [`vite.config.ts`](../../vite.config.ts)
- [`tsconfig.json`](../../tsconfig.json)
- [`eslint.config.js`](../../eslint.config.js)
- [`.prettierrc`](../../.prettierrc)
- [`playwright.config.ts`](../../playwright.config.ts)

**Source Files:** 20+ files across `src/`

**Tests:**
- [`src/tests/setup.ts`](../../src/tests/setup.ts)
- [`src/tests/unit/energy-parser.test.ts`](../../src/tests/unit/energy-parser.test.ts)
- [`tests/e2e/basic.spec.ts`](../../tests/e2e/basic.spec.ts)

**Static Assets:**
- [`static/favicon.ico`](../../static/favicon.ico)
- [`static/favicon.svg`](../../static/favicon.svg)
- [`static/site.webmanifest`](../../static/site.webmanifest)

---

**Session Logs:**
- [2026-04-21-stage4-dev-fixes.md](../ai-logs/2026-04-21-stage4-dev-fixes.md) — Dev server fixes (prerender directive, Vite warnings)
- See also [CHANGELOG-AI.md](../../CHANGELOG-AI.md) for full Stage 4 session history
