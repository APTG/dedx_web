# dEdx Web — Claude Code instructions

> This file is loaded automatically by **Claude Code** at session start.
> For opencode/Qwen sessions use `AGENTS.md`. For GitHub Copilot use
> `.github/copilot-instructions.md`.

---

## Stack

- **SvelteKit** with **Svelte 5** (runes only) + **TypeScript** (strict)
- **Tailwind CSS v4** for styling — CSS variables defined in `src/app.css`
- **shadcn-svelte + Bits UI** for UI components ([ADR 005](docs/decisions/005-shadcn-svelte-components.md))
- **JSROOT** for physics plots
- **libdedx** C library compiled to **WebAssembly** via Emscripten (Docker-based build)
- **Vitest** + **Playwright** for testing
- **Node 24 LTS**, package manager **pnpm**

---

## Svelte 5 Rules (CRITICAL)

Use runes exclusively. **Never** use Svelte 4 patterns.

| Use (Svelte 5) | Never use (Svelte 4) |
|---|---|
| `$state`, `$derived`, `$effect`, `$props`, `$bindable` | `export let`, `$:` reactive statements |
| `$effect` for lifecycle | `onMount` / `onDestroy` from `svelte` |
| Module-level fine-grained reactivity | `svelte/store` auto-subscriptions |
| | `createEventDispatcher()` |

Vendor source + docs are in `vendor/svelte/` if you need to check implementation details.

---

## Code Style

- **Prettier**: double quotes, semicolons, 2-space indent
- **Commits**: Conventional Commits — `feat:`, `fix:`, `docs:`, `chore:`, `test:`
- Comments only where the WHY is non-obvious; never narrate what the code does

---

## Build & Test Commands

```sh
pnpm dev                          # dev server
pnpm build                        # production build (static adapter → GitHub Pages)
pnpm test                         # Vitest unit + integration tests
pnpm exec playwright test         # E2E tests (requires built WASM in static/wasm/)
pnpm lint                         # ESLint
pnpm format                       # Prettier
```

WASM binaries are not built in CI by default for unit tests — the mock in
`src/lib/wasm/__mocks__/` covers unit and integration tests.  
E2E tests need `static/wasm/libdedx.mjs` + `static/wasm/libdedx.wasm`; download
from the latest successful `build-wasm` CI artifact if missing locally.

---

## WASM

- libdedx is a git submodule in `libdedx/`
- Built with Docker (`emscripten/emsdk`) — see `docs/decisions/003-wasm-build-pipeline.md`
- TypeScript wrapper: `src/lib/wasm/` — do not call libdedx C functions directly from components
- API contract: `docs/06-wasm-api-contract.md`
- Bits UI headless primitives source: `vendor/bits-ui/packages/bits-ui/src/lib/bits/` — useful when debugging component behaviour

---

## Key Docs

| Topic | File |
|-------|------|
| Redesign plan (stage-by-stage) | [`docs/00-redesign-plan.md`](docs/00-redesign-plan.md) |
| Architecture & component tree | [`docs/03-architecture.md`](docs/03-architecture.md) |
| Feature specs | [`docs/04-feature-specs/`](docs/04-feature-specs/) |
| WASM API contract | [`docs/06-wasm-api-contract.md`](docs/06-wasm-api-contract.md) |
| Testing strategy | [`docs/07-testing-strategy.md`](docs/07-testing-strategy.md) |
| Completed stages | [`docs/progress/`](docs/progress/) |
| ADRs | [`docs/decisions/`](docs/decisions/) |
| Glossary | [`docs/10-terminology.md`](docs/10-terminology.md) |
| AI session log | [`CHANGELOG-AI.md`](CHANGELOG-AI.md) |

---

## Working Process

1. **Read `CHANGELOG-AI.md` and `docs/progress/`** at session start — understand what stage is active and what was done last.
2. **One feature per session** — reference the spec file by path; do not re-explain it.
3. **Commit after each working increment** using Conventional Commits.
4. **Log every session** — see the mandatory AI logging section below.

---

## Cross-Spec Consistency

When editing a spec, check all related specs for consistency:

- Key files that must stay in sync: `entity-selection.md`, `calculator.md`, `unit-handling.md`, `06-wasm-api-contract.md`
- Wireframes in `entity-selection.md` compact mode must match `calculator.md` layout
- Unit types, conversion factors, and dropdown options must match across all specs

---

## ⚠ AI Session Logging (MANDATORY)

Every Claude Code session that changes code or docs **must** be logged. This is how the
project maintains continuity across tools and contributors.

### At session start

Check `CHANGELOG-AI.md` (top rows) and `docs/progress/` to understand recent history.

### What to create

**1. Changelog row** — prepend to the top of the table body in `CHANGELOG-AI.md`:

```
| YYYY-MM-DD | N | <what was done> (Claude Sonnet 4.6 via Claude Code) | [log](docs/ai-logs/YYYY-MM-DD-slug.md) |
```

The `(Claude Sonnet 4.6 via Claude Code)` attribution is **mandatory** for traceability.
Replace the model name if you are running on a different Claude version.

**2. Session log file** — create `docs/ai-logs/YYYY-MM-DD-<slug>.md`:

```markdown
# YYYY-MM-DD — <Topic>

## Session Narrative

### Prompt 1: <summary of user request>
**AI response**: <what was done, key decisions, outcome>

### Prompt 2: ...

## Tasks

### <Task title>
- **Status**: completed | partial | blocked
- **Stage**: (from docs/00-redesign-plan.md)
- **Files changed**: list of paths
- **Decision**: any non-obvious choice and why
- **Issue**: anything unresolved
```

### Rules

- For trivial changes (< 3 files, no decisions) a changelog row alone is sufficient — skip the detailed log.
- Use the slug from the feature spec filename when applicable (e.g. `entity-selection`, `calculator`).
- Commit messages use Conventional Commits; the log captures the *why*.

### Keep these index files in sync when adding/renaming docs

- `docs/README.md` — top-level document index
- `docs/04-feature-specs/README.md` — spec status table
- `docs/ai-logs/README.md` — session log listing
