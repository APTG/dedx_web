# Project: dEdx Web (libdedx web interface)

## Stack
- **SvelteKit** with **Svelte 5** (runes only) + **TypeScript** (strict)
- **Tailwind CSS** for styling
- **shadcn-svelte + Bits UI** for UI components ([ADR 005](../docs/decisions/005-shadcn-svelte-components.md))
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
> These commands apply to the **new SvelteKit project** (scaffolded in Stage 4).
> The legacy CRA app in the current `src/` uses npm; it is being replaced.
- `pnpm dev` — start dev server
- `pnpm build` — production build (static adapter for GitHub Pages)
- `pnpm test` — Vitest unit/integration tests
- `pnpm exec playwright test` — E2E tests
- `pnpm lint` — ESLint
- `pnpm format` — Prettier

## WASM
- libdedx is a git submodule in `libdedx/`
- Built with Docker (`emscripten/emsdk`) into an ES module
- TypeScript wrapper lives in `src/lib/wasm/`
- Old reference code: `src/Backend/WASMWrapper.js`, `build_wasm.sh`

## Working Process
- Check `docs/progress/` for completed stages before starting new work
- Check `CHANGELOG-AI.md` for recent AI session history
- One feature per chat session — reference the spec file, don't re-explain
- Commit after each working increment

## Cross-Spec Consistency
- When editing a spec, check all related specs for consistency (especially
  wireframes, unit names, type definitions, and conversion formulas)
- Key files that must stay in sync: `entity-selection.md`, `calculator.md`,
  `unit-handling.md`, `06-wasm-api-contract.md`
- Wireframes in entity-selection.md compact mode must match calculator.md layout
- Unit types, conversion factors, and dropdown options must match across all specs

## AI Session Logging (MANDATORY)

Every AI coding session MUST be logged for project continuity.

### Quick Reference
- **Changelog**: `CHANGELOG-AI.md` (repo root) — append one-line summaries at the top
- **Detailed logs**: `docs/ai-logs/YYYY-MM-DD-<slug>.md` — one file per session

### Changelog Entry Format (CHANGELOG-AI.md)
The changelog uses a markdown table. Append a new row at the top of the table body
(below the header row and separator):
```
| YYYY-MM-DD | N | <what was done> (<model> via <tool>) | [log](docs/ai-logs/YYYY-MM-DD-slug.md) |
```

The `(<model> via <tool>)` attribution is **mandatory** so multi-tool history stays
traceable. Examples: `(Claude Sonnet 4.6)` for Copilot, `(opencode + Qwen3.5-397B)`
for opencode against PLGrid llmlab. See `docs/00-redesign-plan.md` §4.2.

### Session Log Format (docs/ai-logs/)
Create `docs/ai-logs/YYYY-MM-DD-<slug>.md` at session start. Each log must include:
1. **Session narrative** — what the user asked and what the AI did, preserving the
   prompt→response history so future sessions understand the reasoning chain.
2. **Task entries** — one per completed unit of work:

```markdown
# <Date> — <Topic>

## Session Narrative
<!-- Summarize each user prompt and AI response/action in order -->

### Prompt 1: <summary of user request>
**AI response**: <what was done, key decisions, outcome>

### Prompt 2: ...
...

## Tasks

### <Task title>
- **Status**: completed | partial | blocked
- **Stage**: (from docs/00-redesign-plan.md)
- **Files changed**: list of paths
- **Decision**: any non-obvious choice and why
- **Issue**: anything unresolved
```

### Rules
- Check `docs/progress/` and `CHANGELOG-AI.md` at session start
- Use the slug from the feature spec filename when applicable
- For trivial changes (< 3 files, no decisions), a changelog entry alone is sufficient — skip the detailed log
- Commit messages still use Conventional Commits (`feat:`, `fix:`, etc.)

### README Maintenance
When adding or renaming docs, keep these index files in sync:
- `docs/README.md` — top-level document index
- `docs/04-feature-specs/README.md` — spec status table and planned specs
- `docs/ai-logs/README.md` — session log listing
