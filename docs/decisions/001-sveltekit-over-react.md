# ADR 001 — SvelteKit over React

**Status:** Accepted (14 April 2026)

---

## Context

The current web frontend is React 17 with Create React App (CRA), class
components, Bootstrap CSS, and no TypeScript. It is broken in production and
unmaintained.

The redesign begins from scratch. We need a framework for a **client-side-only
static site** that:

- Deploys to GitHub Pages as a pure static bundle (no Node server).
- Handles three routes (Calculator, Plot, Documentation).
- Integrates cleanly with a WebAssembly module loaded on first page visit.
- Supports TypeScript in strict mode throughout.
- Scales gracefully as new features are added (custom compounds, advanced
  options, multi-program comparison, shareable URLs).
- Produces a small, performant bundle — the WASM binary is already several
  megabytes; the JS framework should not add significant overhead.

### Candidates evaluated

| Framework | Notes |
|-----------|-------|
| **React 18 + Vite** | Familiar to many web developers; large ecosystem. CRA dead — would need Vite or Next.js. Next.js adds SSR complexity for a static site; Vite + React is viable but we would bring our own router and state solution. |
| **SvelteKit + Svelte 5** | Compile-time framework; no virtual DOM; built-in routing and SSG adapter; TypeScript first-class. Svelte 5 replaces the store module with fine-grained runes — exactly the state model needed for reactive WASM calls. |
| **Vue 3 + Nuxt** | Similar trade-offs to SvelteKit; less familiar; Composition API is verbose compared to runes. |
| **Vanilla TS + Vite** | Maximum control; no framework conventions — too much boilerplate for a multi-route app with a shared state tree. |

---

## Decision

Use **SvelteKit** with **Svelte 5** and TypeScript strict mode.

Deploy via **`@sveltejs/adapter-static`** to produce a pure static bundle
compatible with GitHub Pages.

Use only **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`,
`$bindable`) — no Svelte 4 patterns (`export let`, `$:`, `createEventDispatcher`,
`svelte/store` with `$` auto-subscription).

---

## Consequences

### Positive

- **No virtual DOM.** Svelte compiles to vanilla DOM operations; the runtime
  is a few kilobytes. The WASM binary already dominates bundle size — the
  framework must not compete.
- **File-based routing.** SvelteKit's `src/routes/` convention maps one-to-one
  to our three pages without needing an explicit router library.
- **Static adapter.** `@sveltejs/adapter-static` produces `index.html` files
  in `build/` — deployable to GitHub Pages with a single `gh-pages` action step.
- **Runes = clean reactive state.** `$state` and `$derived` replace both
  component state and the entire Svelte 4 store module. Entity lists, selection
  state, calculation results, and URL-sync all use the same primitive — no
  impedance mismatch when passing state between components and the WASM service
  layer.
- **TypeScript first-class.** SvelteKit scaffolds with strict TypeScript;
  `svelte-check` validates component types; `tsc --noEmit` integrates into CI.
- **SSG constraint is a feature.** GitHub Pages' static-only constraint forces
  a clean client-side architecture: all computation is WASM, state is URL-encoded,
  nothing depends on a server.
- **Accessible defaults.** Svelte's compiled output uses native HTML elements;
  WCAG 2.1 AA compliance is easier to achieve than with heavily abstracted React
  component libraries.

### Negative / risks

- **Svelte 5 is newer than Svelte 4** in the AI training corpus. Copilot
  instructions (`.github/copilot-instructions.md`) explicitly list forbidden
  Svelte 4 patterns to prevent regression. Code review must catch `export let`
  and `$:` usage.
- **Smaller ecosystem.** React has more third-party component libraries.
  This matters little here — we need custom physics UI, not a component library.
- **JSROOT lifecycle management** requires a dedicated Svelte wrapper (see
  [ADR 002](002-keep-jsroot.md)) because JSROOT manipulates the DOM directly.
  This is a one-time cost, not a framework limitation.
- **Team familiarity.** Contributors coming from a React background will need
  to learn runes. The learning curve is shallow: runes are simpler than React
  hooks, but they are different.

---

## References

- [Svelte 5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- `docs/00-redesign-plan.md` §2 — locked technology choices
- `docs/09-non-functional-requirements.md` — performance budgets, WCAG
- `docs/02-tech-stack.md` — version pins and dev tooling
