# Project: dEdx Web (libdedx web interface)

## Stack
- **SvelteKit** with **Svelte 5** (runes only) + **TypeScript** (strict)
- **Tailwind CSS** for styling
- **JSROOT** for physics plots
- **libdedx** C library compiled to **WebAssembly** via Emscripten (Docker-based build)
- **Vitest** + Playwright for testing
- **Node 24 LTS**

## Svelte 5 Rules (CRITICAL)
- Use runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable`
- **Never** use Svelte 4 patterns: no `export let`, no `$:`, no `createEventDispatcher()`,
  no `onMount`/`onDestroy` imports, no `svelte/store` auto-subscriptions
- See: https://svelte.dev/docs/svelte/v5-migration-guide

## Code Style
- Prettier defaults: double quotes, semicolons, 2-space indent
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`

## Key Docs
- Full redesign plan: [docs/00-redesign-plan.md](../docs/00-redesign-plan.md)
- Feature specs: `docs/04-feature-specs/*.md`
- WASM API contract: `docs/06-wasm-api-contract.md`
- Architecture: `docs/03-architecture.md`

## Build Commands
- `npm run dev` — start dev server
- `npm run build` — production build (static adapter for GitHub Pages)
- `npm run test` — Vitest unit/integration tests
- `npx playwright test` — E2E tests
- `npm run lint` — ESLint
- `npm run format` — Prettier

## WASM
- libdedx is a git submodule in `libdedx/`
- Built with Docker (`emscripten/emsdk`) into an ES module
- TypeScript wrapper lives in `src/lib/wasm/`
- Old reference code: `src/Backend/WASMWrapper.js`, `build_wasm.sh`

## Working Process
- Check `docs/progress/` for completed stages before starting new work
- One feature per chat session — reference the spec file, don't re-explain
- Commit after each working increment
