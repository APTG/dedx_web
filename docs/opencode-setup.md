# opencode Setup Guide for dEdx Web

This guide covers configuring [opencode](https://opencode.ai) to work with the
dEdx Web project: PLGrid Qwen models, all MCP servers, and the multi-agent
orchestrator/implementer/reviewer workflow that lets Qwen sessions run to
completion without manual "please continue" interventions.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| opencode | latest | `npm install -g opencode-ai` or see [opencode.ai](https://opencode.ai) |
| Node.js | 24 LTS | [nodejs.org](https://nodejs.org) or `nvm install 24` |
| pnpm | 9+ | `npm install -g pnpm` |
| Docker | 24+ | Required only for WASM builds (Stage 3+) |
| Git | 2.38+ | For sparse submodule support |

Verify:
```sh
opencode --version
node --version   # should print v24.x
pnpm --version   # should print 9.x
```

---

## 1. Clone the repo with submodules

```sh
git clone --recurse-submodules https://github.com/APTG/web_dev.git dedx_web
cd dedx_web
pnpm install
```

If you cloned without `--recurse-submodules`:
```sh
git submodule update --init --recursive
```

### What the vendor submodules provide

See [`vendor/README.md`](../vendor/README.md) for the full index. Summary:

| Submodule | Purpose for AI agents |
|-----------|----------------------|
| `vendor/jsroot` | JSROOT 7 TypeScript types + API narrative |
| `vendor/zarrita` | zarrita 0.7.x source (Zarr v3 reader) |
| `vendor/svelte` | Svelte 5 docs (`documentation/docs/`) including runes + legacy guide |
| `vendor/svelte-ai-tools` | `@sveltejs/opencode` plugin source |
| `vendor/shadcn-svelte` | shadcn-svelte component templates |
| `vendor/bits-ui` | Bits UI headless primitive source |

---

## 2. PLGrid credentials

The PLGrid llmlab endpoint URL is hard-coded in `opencode.json`
(`provider.dedxweb.options.baseURL` = `https://llmlab.plgrid.pl/api/v1`). Override
it only by editing the file if PLGrid publishes a new endpoint.

The **API key is not stored in this repo and is not read from an env var**.
Authenticate once with:

```sh
opencode auth login
```

opencode writes the key to `~/.local/share/opencode/auth.json` (per-user, outside
the repo). All sessions on that machine pick it up automatically. Never commit
the key, never paste it into `.env`, and never reference it from `opencode.json`.

Verify the endpoint URL and model name against the current PLGrid llmlab
documentation — the model ids in `opencode.json` were confirmed in April 2026
and may have been updated since.

---

## 3. MCP servers

`opencode.json` (committed at repo root) configures all MCP servers
automatically. You do not need to edit it for standard use.

### 3.1 Svelte MCP (via `@sveltejs/opencode` plugin)

The `@sveltejs/opencode` plugin is declared in `opencode.json` and runs the
Svelte MCP server as a local stdio process.

**What it provides:**
- `list-sections` — find Svelte 5 documentation sections
- `get-documentation` — retrieve full doc for a section
- `svelte-autofixer` — analyse `.svelte` code, detect Svelte 4 patterns
- `playground-link` — generate Svelte Playground links
- `svelte-file-editor` subagent — automatically used when editing `.svelte` /
  `.svelte.ts` files

**PLGrid model override (`.opencode/svelte.json`):** The `@sveltejs/opencode`
plugin defaults to the Anthropic model for its `svelte-file-editor` subagent.
On PLGrid that would fail because no Anthropic API key is available.
`.opencode/svelte.json` (committed in `.opencode/`) overrides this to use
`Qwen3.5-397B` from the PLGrid provider — no manual action required.

**No additional setup needed** — opencode downloads and caches `@sveltejs/mcp`
on first run.

**Offline / PLGrid fallback:** If `npx` cannot reach npm (e.g., on a PLGrid
compute node), read Svelte 5 docs directly from
`vendor/svelte/documentation/docs/02-runes/` and the legacy guide from
`vendor/svelte/documentation/docs/99-legacy/`.

### 3.2 Tailwind MCP (`tailwindcss-mcp-server`)

Configured in `opencode.json` as an `npx` invocation. Provides Tailwind v4
class lookup and configuration reference. No setup needed.

### 3.3 Playwright MCP (`@playwright/mcp`)

Configured in `opencode.json` as an `npx` invocation. Provides browser
automation and E2E test generation.

**First-time setup** (install Playwright and its browsers):
```sh
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

If `--with-deps` fails (common on Linux Mint due to an unrelated apt GPG issue):
```sh
pnpm exec playwright install chromium
```

### 3.4 shadcn MCP — not applicable

The official `shadcn` MCP server is React-only. Do not run `pnpm dlx shadcn@latest mcp init`.
The Svelte MCP (`svelte-autofixer`) and `vendor/shadcn-svelte/` already provide
what AI agents need.

---

## 4. Start a session

```sh
cd /path/to/dedx_web
opencode
```

opencode reads `opencode.json` and `.opencode/svelte.json` automatically and
loads `AGENTS.md` as context.

### Selecting the Qwen model

In the opencode UI, select the **PLGrid** provider and one of:

| Model | Context | Best for |
|-------|---------|---------|
| `Qwen/Qwen3.5-397B-A17B-FP8` | 131 K | Main orchestrator, implementer subagent |
| `Qwen/Qwen3.5-122B-A10B` | 131 K | Medium tasks, fallback |
| `Qwen/Qwen3.6-35B-A3B` | 80 K | Quick fixes, reviewer subagent |

**Always use `Qwen3.5-397B` as your main session model.** The subagents
`implementer` and `reviewer` have their models fixed in `opencode.json` regardless
of what you select in the UI.

---

## 5. Branch naming for Qwen sessions

Per [`docs/00-redesign-plan.md §4.2`](00-redesign-plan.md):

```sh
git checkout -b qwen/<stage-or-feature>
# e.g.
git checkout -b qwen/stage-7-plots
git checkout -b qwen/feature-export-pdf
```

Time-box each attempt (suggested: one working day per stage). If the branch
does not pass `pnpm lint && pnpm test && pnpm build` within the time-box,
abandon and resume on `master` with Copilot.

---

## 6. Multi-agent workflow

### Why

A single Qwen agent handling a multi-task feature spec will stall: the
conversation grows until it fills the context window, the model loses track
of what is done vs. pending, and you end up typing "please continue" every
few minutes.

The solution is the **orchestrator + subagent pattern**:

```
Your session (Qwen3.5-397B acts as orchestrator)
├── decomposes spec into 3–7 atomic tasks
├── calls 'implementer' subagent → task 1   (fresh context, Qwen3.5-397B)
├── calls 'reviewer'    subagent → task 1   (fresh context, Qwen3.6-35B)
├── calls 'implementer' subagent → task 2
├── calls 'reviewer'    subagent → task 2
└── writes CHANGELOG-AI.md + session log
```

Each subagent starts with an empty conversation — it can never overflow context.
Each has a bounded task with an explicit completion signal (`TASK DONE:` /
`TASK BLOCKED:`). The orchestrator tracks progress in
`.opencode/tasks/<branch>.md` so it never gets confused about what is done.

### How to start a feature session

1. Check out your branch:
   ```sh
   git checkout -b qwen/feature-name
   ```

2. Open [`.opencode/prompts/run-feature.md`](../.opencode/prompts/run-feature.md),
   copy the template block, fill in `{{SPEC_PATH}}` and `{{BRANCH_NAME}}`, and
   paste into opencode.

3. Walk away. The orchestrator runs the full implementation loop without asking for
   confirmation between tasks.

4. When opencode finishes, check the session log at `docs/ai-logs/` and review the
   branch with `pnpm lint && pnpm test && pnpm build`.

### Example filled prompt

```
Implement the feature described in docs/04-feature-specs/export.md.

Branch: qwen/export-csv-pdf

## Instructions

Act as orchestrator for this session. Proceed autonomously through all steps below
without asking me for confirmation between them.

### Step 1 — Read context
Read: docs/04-feature-specs/export.md, docs/03-architecture.md,
docs/06-wasm-api-contract.md, docs/progress/

### Step 2 — Decompose
Identify 3–7 atomic tasks. Write them to .opencode/tasks/export-csv-pdf.md.

### Step 3 — For each task
a. Call 'implementer' subagent with: task name, spec section, branch, acceptance criteria.
b. Call 'reviewer' subagent to validate. If REVIEW FAIL, retry implementer (max 2×).
c. Mark task done or blocked, move to next.

### Step 4 — Session log
Write CHANGELOG-AI.md entry and docs/ai-logs/YYYY-MM-DD-export-csv-pdf.md.
```

### Agent reference

| Agent | Model | `maxSteps` | Role |
|-------|-------|-----------|------|
| `implementer` | Qwen3.5-397B | 80 | Writes code + tests, runs lint/test/build, commits |
| `reviewer` | Qwen3.6-35B | 30 | Runs lint/test, reports issues, does not edit |
| `svelte-file-editor` | Qwen3.5-397B | 30 | Auto-invoked for `.svelte` file edits |

Full agent documentation: [`.opencode/agents/`](../.opencode/agents/)

### The `maxSteps` guard

Each subagent has a step limit. If the implementer hits 80 steps without
finishing it outputs `TASK BLOCKED: step limit reached`. This prevents infinite
loops. If you see this regularly for a particular task, break that task into
two smaller ones.

### Running tasks in parallel (advanced)

For independent tasks you can run multiple opencode sessions simultaneously in
separate terminal windows:

1. Run the orchestrator for decomposition only (tell it to stop after writing
   `.opencode/tasks/<branch>.md` and exit).
2. Open N terminals. In each one, start `opencode`, check out a sub-branch
   (`qwen/feature-task-N`), and paste a direct implementer prompt:

   ```
   You are the implementer for dEdx Web.
   Task: <task N from .opencode/tasks/<branch>.md>
   Spec section: <path and heading>
   Branch: qwen/feature-task-N
   Acceptance criteria:
   - ...

   Complete the task autonomously. Output TASK DONE: or TASK BLOCKED: when finished.
   ```

3. After all terminals finish, review each sub-branch and merge into the main
   feature branch.

---

## 7. Mandatory session logging

Every opencode session **must** produce:

1. A new row at the top of `CHANGELOG-AI.md`:
   ```
   | YYYY-MM-DD | <stage> | <description> (opencode + Qwen3.5-397B) | [log](...) |
   ```
2. A session log at `docs/ai-logs/YYYY-MM-DD-<slug>.md`.

See `.github/copilot-instructions.md § AI Session Logging` for the exact format.
The `(opencode + Qwen3.5-397B)` attribution in every entry is **mandatory**.

---

## 8. Key project files to read at session start

opencode loads `AGENTS.md` automatically. That file points to:

1. `.github/copilot-instructions.md` — stack, Svelte 5 rules, build commands
2. `docs/00-redesign-plan.md` — full project plan
3. `docs/progress/` — completed stages (check before starting new work)
4. `CHANGELOG-AI.md` — recent AI session history

The most common mistake is writing Svelte 4 patterns (`export let`, `$:`,
`createEventDispatcher`). The `svelte-file-editor` subagent runs
`svelte-autofixer` automatically on every `.svelte` file you edit — it will
catch regressions before you commit.

---

## 9. Troubleshooting

### `svelte-file-editor` tries to use anthropic and fails

**Cause:** `.opencode/svelte.json` is missing or the `model` override is not set.
**Fix:** Confirm `.opencode/svelte.json` exists with `"model": "dedxweb/Qwen/Qwen3.5-397B-A17B-FP8"`.

### `@sveltejs/mcp` npx download fails

**Cause:** No internet / npm registry blocked.
**Fix:** On PLGrid compute nodes, use `vendor/svelte/documentation/` as the
offline fallback and set `"mcp": { "type": "local", "enabled": false }` in
`.opencode/svelte.json` temporarily.

### Playwright MCP errors: browsers not installed

```sh
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

### Implementer subagent outputs `TASK BLOCKED: step limit reached`

**Cause:** The task is too large for 80 steps.
**Fix:** Break the task into two smaller subtasks in the orchestrator decomposition.
Alternatively, raise `maxSteps` for the `implementer` in `opencode.json` (but
prefer smaller tasks — it produces cleaner commits).

### Submodules missing / empty

```sh
git submodule update --init --recursive
```

### opencode version mismatch with `opencode.json` schema

```sh
npm install -g opencode-ai@latest
```
