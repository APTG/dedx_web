# dEdx Web — AI Agent Context

This file is loaded automatically by **opencode** (and compatible agents such
as Qwen running via opencode) at session start. It points to the authoritative
docs — do not duplicate content here.

> **Claude Code users:** read [`CLAUDE.md`](CLAUDE.md) instead — it is the
> self-contained Claude Code entry point for this project.

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

| Use                                                    | Never use                                     |
| ------------------------------------------------------ | --------------------------------------------- |
| `$state`, `$derived`, `$effect`, `$props`, `$bindable` | `export let`, `$:`, `createEventDispatcher()` |
| `$effect` for lifecycle                                | `onMount` / `onDestroy` from `svelte`         |
| Module-level fine-grained reactivity                   | `svelte/store` auto-subscriptions             |

If you have the Svelte MCP server available, call `svelte-autofixer` on any
`.svelte` file you write to catch Svelte 4 regressions before committing.
When offline (PLGrid), read [`vendor/svelte/documentation/docs/02-runes/`](vendor/svelte/documentation/docs/02-runes/)
and [`vendor/svelte/documentation/docs/99-legacy/`](vendor/svelte/documentation/docs/99-legacy/).

---

## 3. Key docs index

| Topic                           | File                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Architecture & component tree   | [`docs/03-architecture.md`](docs/03-architecture.md)                               |
| UI layout & wireframes          | [`docs/05-ui-wireframes.md`](docs/05-ui-wireframes.md)                             |
| WASM / Emscripten API contract  | [`docs/06-wasm-api-contract.md`](docs/06-wasm-api-contract.md)                     |
| Testing strategy                | [`docs/07-testing-strategy.md`](docs/07-testing-strategy.md)                       |
| Deployment                      | [`docs/08-deployment.md`](docs/08-deployment.md)                                   |
| Non-functional requirements     | [`docs/09-non-functional-requirements.md`](docs/09-non-functional-requirements.md) |
| Feature specs (one per feature) | [`docs/04-feature-specs/`](docs/04-feature-specs/)                                 |
| Architecture decisions (ADRs)   | [`docs/decisions/`](docs/decisions/)                                               |
| Glossary                        | [`docs/10-terminology.md`](docs/10-terminology.md)                                 |
| Prototype spikes & results      | [`docs/11-prototyping-spikes.md`](docs/11-prototyping-spikes.md)                   |
| Completed stages                | [`docs/progress/`](docs/progress/)                                                 |
| AI session log                  | [`CHANGELOG-AI.md`](CHANGELOG-AI.md)                                               |

---

## 4. Vendor library docs (local, no web access needed)

Third-party library source and docs are in [`vendor/`](vendor/) as shallow git
submodules. Full index: [`vendor/README.md`](vendor/README.md).

| Library           | Role                                       | Key resource                                                                                                           |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| JSROOT 7          | Physics plotting (`TGraph`, `TMultiGraph`) | [`vendor/jsroot/types.d.ts`](vendor/jsroot/types.d.ts), [`vendor/jsroot/docs/JSROOT.md`](vendor/jsroot/docs/JSROOT.md) |
| zarrita 0.7.x     | Zarr v3 browser reader                     | [`vendor/zarrita/packages/zarrita/src/open.ts`](vendor/zarrita/packages/zarrita/src/open.ts)                           |
| **Svelte 5**      | Framework source + docs                    | [`vendor/svelte/documentation/docs/`](vendor/svelte/documentation/docs/)                                               |
| svelte-ai-tools   | MCP server / opencode plugin               | [`vendor/svelte-ai-tools/packages/opencode/README.md`](vendor/svelte-ai-tools/packages/opencode/README.md)             |
| **shadcn-svelte** | UI components (ADR 005)                    | [`vendor/shadcn-svelte/packages/registry/`](vendor/shadcn-svelte/packages/registry/)                                   |
| **Bits UI**       | Headless primitives under shadcn-svelte    | [`vendor/bits-ui/packages/bits-ui/src/lib/bits/`](vendor/bits-ui/packages/bits-ui/src/lib/bits/)                       |
| Emscripten        | (no submodule — too large)                 | [`docs/decisions/003-wasm-build-pipeline.md`](docs/decisions/003-wasm-build-pipeline.md)                               |

---

## 5. MCP servers

> **opencode only** — this section applies only to opencode sessions.
> VS Code (Claude Code, Copilot) and other tools manage their own MCP configuration
> and do not read `opencode.json`.

[`opencode.json`](opencode.json) configures the MCP/tooling setup and the
PLGrid provider. Tailwind and Playwright are started via `npx`. The Svelte MCP
is provided through the `@sveltejs/opencode` plugin, but its exact transport /
mode depends on the local opencode configuration rather than this file alone.

| MCP                                      | Availability                                                                                     | What it provides                                                                                                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Svelte** (`@sveltejs/opencode` plugin) | Plugin-managed; check local opencode/Svelte MCP configuration for transport and offline behavior | Svelte 5 docs, `svelte-autofixer`, `svelte-file-editor` subagent                                                                                                                                                                                                            |
| **Tailwind** (`tailwindcss-mcp-server`)  | npx (needs internet first run)                                                                   | Tailwind v4 class/token lookup. **Query before writing utility classes** — don't guess; ask the MCP for the correct v4 class name, spacing scale, or color token.                                                                                                           |
| **Playwright** (`@playwright/mcp`)       | npx (needs internet first run)                                                                   | Interactive browser control during **development** (navigate, click, screenshot, accessibility snapshot). Use to visually verify a UI component against the running dev server. **NOT the E2E test runner** — run `pnpm exec playwright test` for the project's test suite. |

**PLGrid / offline sessions:** the Tailwind and Playwright MCP servers will
fail offline on the very first run if `npx` cannot reach npm. Once their
packages are cached they work offline. For Svelte, verify the local plugin/MCP
setup in your environment. As an additional fallback, read Svelte 5 docs
directly from [`vendor/svelte/`](vendor/svelte/) (committed as a shallow
submodule).

Provider credentials are managed by opencode itself — run `opencode auth login`
once and the API key is stored under `~/.local/share/opencode/auth.json`. The
PLGrid base URL is hard-coded in `opencode.json`. Do not put the API key in
env vars or in the repo.

See [`docs/opencode-setup.md §2`](docs/opencode-setup.md) for details.

---

## 6. Working process

### ⚠ Branching (MANDATORY — do this before any code)

**NEVER commit or push directly to `master`.** Branch protection is enabled on
the remote and will reject any direct push. If you get a rejection, do **NOT**
force-push — stop and output `TASK BLOCKED: cannot push to master`.

Before writing any code:

1. `git checkout -b qwen/<slug>` — create the feature branch.
2. `git push -u origin qwen/<slug>` — publish it immediately.

If the branch already exists: `git checkout qwen/<slug>` before making any commits.

Branch naming: `qwen/<stage-or-feature>` (see [`docs/00-redesign-plan.md §4.2`](docs/00-redesign-plan.md)).

### Other working rules

- **MUST READ before each task:** [`.opencode/lessons-learned.md`](.opencode/lessons-learned.md)
  — concrete pitfalls with ✅/❌ code examples from past PRs. Every PR-review fix
  you produce must add at least one new entry to that file.
- **Check progress first:** [`docs/progress/`](docs/progress/) lists completed stages.
- **One feature per session** — reference the spec file, do not re-explain.
- **Commit after each working increment** using Conventional Commits
  (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- **Log every session** — append a row to `CHANGELOG-AI.md` and create a file in
  `docs/ai-logs/YYYY-MM-DD-<slug>.md`. Include the tool + model attribution in
  every entry — see `.github/copilot-instructions.md § AI Session Logging` for the
  exact format per tool (opencode, Copilot, Claude Code).

---

## 6a. Multi-agent workflow (orchestrator pattern)

> **opencode only** — this section applies only to opencode sessions using the
> `implementer` and `reviewer` subagents defined in `opencode.json`. If you are
> running as Claude Code, GitHub Copilot, or any other tool, skip this section
> and implement directly per § 6.

> Use this when you receive a feature spec to implement. This workflow prevents
> context overflow and eliminates the need for manual "please continue" prompts.

**You are the orchestrator.** Do NOT implement everything in a single long conversation.
Instead, decompose the spec into atomic tasks and delegate each to the `implementer`
and `reviewer` subagents.

### How to start

The user will paste a prompt based on
[`.opencode/prompts/run-feature.md`](.opencode/prompts/run-feature.md).
That prompt tells you the spec path, branch name, and acceptance criteria.

### Orchestration loop (repeat for each task)

```
1. Write .opencode/tasks/<branch>.md  — task list with statuses
2. For each task:
   a. Call 'implementer' subagent → receives ONE task, outputs TASK DONE: or TASK BLOCKED:
   b. Call 'reviewer'    subagent → validates, outputs REVIEW PASS or REVIEW FAIL: <issues>
   c. If REVIEW FAIL → call implementer again with the issue list (max 2 retries)
   d. Mark task done or blocked, move to next
3. When all tasks complete → write CHANGELOG-AI.md row + session log
```

**Mandatory gate:** do not start implementation edits before `.opencode/tasks/<branch>.md`
exists and contains the atomic checklist for this branch.

### Rules for the orchestrator

- **Never ask for confirmation between tasks.** Proceed autonomously.
- **Never implement code yourself** — that is the implementer's job.
- **Keep each implementer call to ONE task** (one commit boundary).
- **Track state in `.opencode/tasks/<branch>.md`** so you can resume if the
  session is interrupted.
- If a task is blocked after 2 retries, mark it blocked and continue to the next.
  Do not spend the whole session on one stuck task.
- **Completion semantics are strict:** if push/auth fails, output
  `TASK BLOCKED: push/auth failure` (never `TASK DONE`).

### Subagent reference

| Agent                | Model        | Role                                                                                                       |
| -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `implementer`        | Qwen3.5-397B | Writes code, tests, commits for ONE task                                                                   |
| `reviewer`           | Qwen3.6-35B  | **Diff-only** review against acceptance criteria — does NOT re-run lint/test (the implementer already did) |
| `svelte-file-editor` | Qwen3.5-397B | (auto) edits `.svelte` files with MCP validation                                                           |

Full agent documentation: [`.opencode/agents/`](.opencode/agents/)
Full setup guide: [`docs/opencode-setup.md`](docs/opencode-setup.md)
Authoring new task prompts (Claude → file → opencode funnel):
[`docs/opencode-prompt-authoring.md`](docs/opencode-prompt-authoring.md)

---

## 7. opencode full setup guide

> **opencode only** — applies only to opencode sessions.

See [`docs/opencode-setup.md`](docs/opencode-setup.md) for step-by-step
instructions covering: prerequisites, submodule init, PLGrid auth (no env
vars), all MCP servers, selecting the Qwen model, branch naming, session
logging, and troubleshooting.

To author a new multi-task prompt for opencode (the recommended workflow is
"draft in Claude / VS Code, then hand the file to opencode"), see
[`docs/opencode-prompt-authoring.md`](docs/opencode-prompt-authoring.md) for
the canonical schema and the Claude meta-prompt.

---

## 8. Copilot agent files (`.github/agents/`)

These are available for Copilot agent sessions (not opencode):

- [`researcher.agent.md`](.github/agents/researcher.agent.md) — read-only codebase exploration
- [`spec-writer.agent.md`](.github/agents/spec-writer.agent.md) — drafting/editing docs
