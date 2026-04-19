# dEdx Web — AI Agent Context

This file is loaded automatically by **opencode** (and compatible agents such
as Qwen running via opencode) at session start. It points to the authoritative
docs — do not duplicate content here.

---

## 1. Start here

Read these two files first, in order:

1. [`.github/copilot-instructions.md`](.github/copilot-instructions.md) —
   stack, Svelte 5 rules, code style, build commands, AI logging conventions.
2. [`docs/00-redesign-plan.md`](docs/00-redesign-plan.md) —
   full project plan, stage-by-stage strategy, multi-tool workflow (§4.2).

---

## 2. Critical: Svelte 5 runes only

> **NEVER** use Svelte 4 patterns. This project uses Svelte 5 exclusively.

| Use | Never use |
|-----|-----------|
| `$state`, `$derived`, `$effect`, `$props`, `$bindable` | `export let`, `$:`, `createEventDispatcher()` |
| `$effect` for lifecycle | `onMount` / `onDestroy` from `svelte` |
| Module-level fine-grained reactivity | `svelte/store` auto-subscriptions |

---

## 3. Key docs index

| Topic | File |
|-------|------|
| Architecture & component tree | [`docs/03-architecture.md`](docs/03-architecture.md) |
| UI layout & wireframes | [`docs/05-ui-wireframes.md`](docs/05-ui-wireframes.md) |
| WASM / Emscripten API contract | [`docs/06-wasm-api-contract.md`](docs/06-wasm-api-contract.md) |
| Testing strategy | [`docs/07-testing-strategy.md`](docs/07-testing-strategy.md) |
| Deployment | [`docs/08-deployment.md`](docs/08-deployment.md) |
| Non-functional requirements | [`docs/09-non-functional-requirements.md`](docs/09-non-functional-requirements.md) |
| Feature specs (one per feature) | [`docs/04-feature-specs/`](docs/04-feature-specs/) |
| Architecture decisions (ADRs) | [`docs/decisions/`](docs/decisions/) |
| Glossary | [`docs/10-terminology.md`](docs/10-terminology.md) |
| Prototype spikes & results | [`docs/11-prototyping-spikes.md`](docs/11-prototyping-spikes.md) |
| Completed stages | [`docs/progress/`](docs/progress/) |
| AI session log | [`CHANGELOG-AI.md`](CHANGELOG-AI.md) |

---

## 4. Vendor library docs (local, no web access needed)

Third-party library source and docs are available as git submodules in
[`vendor/`](vendor/). See [`vendor/LIBRARIES.md`](vendor/LIBRARIES.md) for
the full index. Quick reference:

| Library | Role | Key file |
|---------|------|----------|
| JSROOT 7 | Physics plotting (`TGraph`, `TMultiGraph`) | [`vendor/jsroot/types.d.ts`](vendor/jsroot/types.d.ts) |
| JSROOT docs | API narrative | [`vendor/jsroot/docs/JSROOT.md`](vendor/jsroot/docs/JSROOT.md) |
| zarrita 0.7.x | Zarr v3 browser reader | [`vendor/zarrita/packages/zarrita/src/index.ts`](vendor/zarrita/packages/zarrita/src/index.ts) |
| Emscripten | WASM build tool (no submodule — too large) | [`docs/resources/emscripten-changelog.md`](docs/resources/emscripten-changelog.md) |

Emscripten key flags reference: [`vendor/LIBRARIES.md § Emscripten`](vendor/LIBRARIES.md).

---

## 5. Working process

- **Check progress first:** [`docs/progress/`](docs/progress/) lists completed stages.
- **One feature per session** — reference the spec file, do not re-explain.
- **Commit after each working increment** using Conventional Commits
  (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- **Log every session** — append a row to `CHANGELOG-AI.md` and create a file in
  `docs/ai-logs/YYYY-MM-DD-<slug>.md`. Attribution `(opencode + Qwen3.5-397B)` is
  mandatory — see `.github/copilot-instructions.md § AI Session Logging`.
- **Branch naming for Qwen sessions:** `qwen/<stage-or-feature>` (see
  [`docs/00-redesign-plan.md §4.2`](docs/00-redesign-plan.md)).

---

## 6. Copilot agent files (`.github/agents/`)

These are available for Copilot agent sessions (not opencode):

- [`researcher.agent.md`](.github/agents/researcher.agent.md) — read-only codebase exploration
- [`spec-writer.agent.md`](.github/agents/spec-writer.agent.md) — drafting/editing docs
