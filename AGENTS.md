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

If you have the Svelte MCP server available, call `svelte-autofixer` on any
`.svelte` file you write to catch Svelte 4 regressions before committing.
When offline (PLGrid), read [`vendor/svelte/documentation/docs/02-runes/`](vendor/svelte/documentation/docs/02-runes/)
and [`vendor/svelte/documentation/docs/99-legacy/`](vendor/svelte/documentation/docs/99-legacy/).

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

Third-party library source and docs are in [`vendor/`](vendor/) as shallow git
submodules. Full index: [`vendor/README.md`](vendor/README.md).

| Library | Role | Key resource |
|---------|------|--------------|
| JSROOT 7 | Physics plotting (`TGraph`, `TMultiGraph`) | [`vendor/jsroot/types.d.ts`](vendor/jsroot/types.d.ts), [`vendor/jsroot/docs/JSROOT.md`](vendor/jsroot/docs/JSROOT.md) |
| zarrita 0.7.x | Zarr v3 browser reader | [`vendor/zarrita/packages/zarrita/src/open.ts`](vendor/zarrita/packages/zarrita/src/open.ts) |
| **Svelte 5** | Framework source + docs | [`vendor/svelte/documentation/docs/`](vendor/svelte/documentation/docs/) |
| svelte-ai-tools | MCP server / opencode plugin | [`vendor/svelte-ai-tools/packages/opencode/README.md`](vendor/svelte-ai-tools/packages/opencode/README.md) |
| **shadcn-svelte** | UI components (ADR 005) | [`vendor/shadcn-svelte/packages/registry/`](vendor/shadcn-svelte/packages/registry/) |
| **Bits UI** | Headless primitives under shadcn-svelte | [`vendor/bits-ui/packages/bits-ui/src/lib/bits/`](vendor/bits-ui/packages/bits-ui/src/lib/bits/) |
| Emscripten | (no submodule — too large) | [`docs/decisions/003-wasm-build-pipeline.md`](docs/decisions/003-wasm-build-pipeline.md) |

---

## 5. MCP servers (opencode.json)

[`opencode.json`](opencode.json) configures the MCP/tooling setup and the
PLGrid provider. Tailwind and Playwright are started via `npx`. The Svelte MCP
is provided through the `@sveltejs/opencode` plugin, but its exact transport /
mode depends on the local opencode configuration rather than this file alone.

| MCP | Availability | What it provides |
|-----|-------------|-----------------|
| **Svelte** (`@sveltejs/opencode` plugin) | Plugin-managed; check local opencode/Svelte MCP configuration for transport and offline behavior | Svelte 5 docs, `svelte-autofixer`, `svelte-file-editor` subagent |
| **Tailwind** (`tailwindcss-mcp-server`) | npx (needs internet first run) | Tailwind v4 class reference |
| **Playwright** (`@playwright/mcp`) | npx (needs internet first run) | Browser automation, E2E test generation |

**PLGrid / offline sessions:** the Tailwind and Playwright MCP servers will
fail offline on the very first run if `npx` cannot reach npm. Once their
packages are cached they work offline. For Svelte, verify the local plugin/MCP
setup in your environment. As an additional fallback, read Svelte 5 docs
directly from [`vendor/svelte/`](vendor/svelte/) (committed as a shallow
submodule).

Provider credentials must be set as env vars before starting opencode:
```sh
export PLGRID_LLMLAB_BASE_URL=https://...   # PLGrid llmlab endpoint
export PLGRID_LLMLAB_API_KEY=...            # never commit this
```
See [`docs/00-redesign-plan.md §4.2`](docs/00-redesign-plan.md) for the full
setup procedure and egress notes.

---

## 6. Working process

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

## 7. opencode full setup guide

See [`docs/opencode-setup.md`](docs/opencode-setup.md) for step-by-step
instructions covering: prerequisites, submodule init, env var setup, all MCP
servers, selecting the Qwen model, branch naming, session logging, and
troubleshooting.

---

## 8. Copilot agent files (`.github/agents/`)

These are available for Copilot agent sessions (not opencode):

- [`researcher.agent.md`](.github/agents/researcher.agent.md) — read-only codebase exploration
- [`spec-writer.agent.md`](.github/agents/spec-writer.agent.md) — drafting/editing docs
