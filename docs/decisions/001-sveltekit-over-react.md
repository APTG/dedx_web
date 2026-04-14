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
| **React 19 + Vite** | Familiar to many web developers; large ecosystem. React 19 is the current stable release (Dec 2024); the existing app uses React 17 (CRA, dead). A clean-slate rebuild targets the current stable — React 18 would be an immediate downgrade. CRA is dead — clean-slate requires Vite or Next.js. Next.js adds SSR complexity for a static site; Vite + React is viable but requires a separate router (React Router 7) and a state solution. |
| **SvelteKit + Svelte 5** | Compile-time framework; no virtual DOM; built-in routing and SSG adapter; TypeScript first-class. Svelte 5 replaces the store module with fine-grained runes — exactly the state model needed for reactive WASM calls. Note: SvelteKit's primary value proposition (SSR, streaming, form actions) is entirely unused in a static-adapter deployment. The project uses SvelteKit as a Vite scaffold with file-based routing and a static output pass. |
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
- **Runes = the decisive differentiator.** The app has three routes — routing
  overhead is trivial in any framework, and a SPA (Vite + React Router) would
  handle it equally well. The real difference is state management. React
  requires three distinct patterns for one conceptual problem: `useState` /
  `useReducer` for component-local state, a separate library (Zustand, Jotai,
  Redux) for shared state, and `useMemo` / `useCallback` for derived values —
  three mental models, three lifecycle rules, a hard boundary between
  component-local and global state. Svelte 5 runes (`$state`, `$derived`,
  `$effect`) work identically inside `.svelte` components and in standalone
  `.svelte.ts` modules. Entity lists, selection state, calculation results, and
  URL-sync all use the same primitive; values cross the component/service
  boundary without any change in pattern or lifecycle rule.
- **TypeScript first-class.** SvelteKit scaffolds with strict TypeScript;
  `svelte-check` validates component types; `tsc --noEmit` integrates into CI.
- **Static adapter aligns with deployment constraints.** The GitHub Pages
  target mandates a pure static bundle. A SPA (Vite + React Router) also
  satisfies this, but requires a plugin or custom Vite config to emit
  per-route `index.html` files for client-side navigation. SvelteKit's
  `adapter-static` handles this natively: `export const prerender = true` on
  each route is the entire configuration. This is a convenience advantage, not
  a fundamental one. The stronger argument is that the static constraint
  enforces architectural clarity: server-only patterns cannot be reached for,
  so all logic is provably client-side and WASM-driven.
- **Compile-time a11y warnings.** `svelte-check` includes accessibility rules
  equivalent to `eslint-plugin-jsx-a11y`: missing `alt` attributes, invalid
  `role` values, and unlabelled interactive elements are caught before runtime.
  React requires `@angular/core`-style ESLint plugin configuration to reach the
  same coverage. The practical compliance work — ARIA attributes, focus
  management, keyboard navigation — is identical in both frameworks; Svelte
  surfaces mistakes earlier.

### Negative / risks

- **Svelte 5 is newer than Svelte 4** in the AI training corpus.
  [`.github/copilot-instructions.md`](../../.github/copilot-instructions.md)
  explicitly lists forbidden Svelte 4 patterns to prevent regression. Code
  review must catch `export let` and `$:` usage.
- **Smaller ecosystem.** React has more third-party component libraries.
  This matters little here — we need custom physics UI, not a component library.
- **JSROOT lifecycle management** requires a dedicated Svelte wrapper (see
  [ADR 002](002-keep-jsroot.md)) because JSROOT manipulates the DOM directly.
  This is a one-time cost, not a framework limitation.
- **SvelteKit's primary value proposition is entirely unused.** SSR, streaming
  responses, and server-side form handling — SvelteKit's main differentiators
  over a plain Vite scaffold — are all bypassed by `adapter-static`. The
  project uses SvelteKit as a Vite scaffold with file-based routing and a
  static output pass. Future contributors must not attempt to add `+server.ts`
  routes, `load()` functions that call external services, or server-only
  modules; none of these work under the static adapter. This is an explicit,
  deliberate trade-off, not an oversight.
- **Team familiarity.** Contributors coming from a React background will need
  to learn runes. The learning curve is shallow: runes are simpler than React
  hooks, but they are different.

---

## References

- [Svelte 5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [`docs/00-redesign-plan.md` §2](../00-redesign-plan.md#2-technology-choices) — locked technology choices
- [`docs/09-non-functional-requirements.md`](../09-non-functional-requirements.md) — performance budgets, WCAG
- [`docs/02-tech-stack.md`](../02-tech-stack.md) — version pins and dev tooling
