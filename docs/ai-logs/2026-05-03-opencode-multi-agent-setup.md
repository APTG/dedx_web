# 2026-05-03 — opencode multi-agent setup (orchestrator/implementer/reviewer)

**Model:** (Claude Sonnet 4.6 via Claude Code)

## Session Narrative

### Prompt 1: User asked whether running multiple opencode agents in parallel would reduce the "model stuck, please continue" problem, and requested a full setup — orchestrator + implementer + reviewer agents, updated opencode-setup.md docs, and a new branch.

**AI response**: Started with a research phase: spawned two Explore agents in
parallel to review the AI session logs in `docs/ai-logs/`, `CHANGELOG-AI.md`,
the existing agent definitions in `.github/agents/`, the opencode plugin
source in `vendor/svelte-ai-tools/packages/opencode/`, and the current
`opencode.json` / `docs/opencode-setup.md`. Key findings:

- The "stuck" root cause is context overflow and task ambiguity in long
  single-agent sessions, not a latency or model quality issue.
- opencode supports custom agents in the `agent` key of `opencode.json`
  (same mechanism the `@sveltejs/opencode` plugin uses to register
  `svelte-file-editor`).
- The `@sveltejs/opencode` plugin defaults to the Anthropic model for
  `svelte-file-editor`. There was no `svelte.json` to override this — meaning
  every `.svelte` file edit was silently trying to call the Anthropic API,
  which fails on PLGrid. Fixed as part of this session.
- The existing Copilot agents (`.github/agents/researcher.md`,
  `spec-writer.md`) and prompts (`.github/prompts/`) established a good
  convention to follow for the new opencode agents.

Asked two clarifying questions before implementing: parallelism preference
(one session with sequential subagents vs. multiple terminals) and model
assignment. User chose sequential subagents + big model everywhere.

### Prompt 2: Implement the plan on a new branch.

**AI response**: Created `feat/opencode-multi-agent`. Implemented all files,
confirmed both JSON files are valid, and verified the 48 pre-existing lint
errors are not introduced by this PR (confirmed by stashing and re-running
`pnpm lint` on the base).

Key design decisions:

1. **Orchestration via AGENTS.md, not a separate "orchestrator agent"**: The
   main Qwen3.5-397B agent gets a new §6a in AGENTS.md that tells it to
   decompose tasks and call subagents. This means the user interacts with
   opencode exactly as before (paste one prompt, no special agent invocation)
   while the subagent pattern is applied transparently.

2. **`TASK DONE:` / `TASK BLOCKED:` completion signals**: Each subagent's
   prompt requires it to emit exactly one of these as its final message. The
   orchestrating main agent can parse these to decide whether to proceed or
   retry — no ambiguous "I've finished" narration that might get lost in a
   long response.

3. **`maxSteps` guards**: `implementer` is capped at 80 steps, `reviewer` at 30. If a task is too large to fit in 80 steps the implementer outputs
   `TASK BLOCKED: step limit reached` instead of looping forever. The right
   fix is to break the task smaller, not to raise the limit.

4. **`.opencode/svelte.json` PLGrid override**: Without this, `svelte-file-editor`
   silently tries the Anthropic API on every `.svelte` edit and fails. The
   `.opencode/svelte.json` file (the correct project-local path read by the plugin,
   per `config.ts:123`) points all subagent calls to
   `dedxweb/Qwen/Qwen3.5-397B-A17B-FP8`.

5. **`.gitignore` fix**: Previously `.opencode/` (entire dir) was ignored.
   Changed to `.opencode/tasks/` (runtime session state only) so the agent
   definitions and prompt templates are tracked in git.

### Prompt 3: Add proper AI logs for this session.

**AI response**: Created this log file, updated `CHANGELOG-AI.md`, and
updated `docs/ai-logs/README.md`.

### Prompt 4: User asked whether the svelte.json change would break VS Code + Claude Code / Copilot workflows, and flagged that AGENTS.md should be universal across tools.

**AI response**: Read `vendor/svelte-ai-tools/packages/opencode/config.ts` to
trace all `svelte.json` lookup paths. Found two bugs:

1. **`svelte.json` was in the wrong location.** The plugin only reads from
   `.opencode/svelte.json` (line 123: `join(process.cwd(), '.opencode', 'svelte.json')`).
   The file had been placed at the repo root and was silently never loaded.
   Moved to `.opencode/svelte.json`.

2. **AGENTS.md had unguarded opencode-specific sections.** §5 (MCP server
   config), §6a (orchestrator/subagent pattern), and §7 (opencode setup guide)
   contained instructions that only make sense inside an opencode session. If
   GitHub Copilot or another tool reads AGENTS.md, the subagent orchestration
   instructions in §6a could cause it to try calling non-existent subagents.
   Added `> **opencode only**` blockquote guards to all three sections. Made
   the §6 session-logging attribution line tool-generic (removed the
   `opencode + Qwen3.5-397B` hardcode).

VS Code + Claude Code and VS Code + Copilot are unaffected: Claude Code reads
`CLAUDE.md`, Copilot reads `.github/copilot-instructions.md`, and neither tool
reads `.opencode/svelte.json`.

## Tasks

### Research: analyse existing AI logs and opencode infrastructure

- **Status**: completed
- **Stage**: tooling
- **Files changed**: none (read-only research phase)
- **Decision**: used two parallel Explore subagents to keep the research fast
  and avoid polluting the main context with raw file dumps.

### Create feat/opencode-multi-agent branch and implement multi-agent setup

- **Status**: completed
- **Stage**: tooling
- **Files changed**:
  - `.opencode/svelte.json` (new) — PLGrid model override for `svelte-file-editor`
  - `opencode.json` — added `agent.implementer` and `agent.reviewer` sections
  - `.opencode/agents/implementer.md` (new) — implementer role docs + contract
  - `.opencode/agents/reviewer.md` (new) — reviewer role docs + contract
  - `.opencode/prompts/run-feature.md` (new) — session starter template
  - `.opencode/tasks/.gitkeep` (new) — placeholder for gitignored tasks dir
  - `AGENTS.md` — new §6a Multi-agent workflow
  - `docs/opencode-setup.md` — full rewrite with §6 multi-agent guide
  - `.gitignore` — changed `.opencode/` → `.opencode/tasks/`
- **Decision**: Orchestration behaviour lives in AGENTS.md (instructions to
  the main agent) rather than as a separate `orchestrator` agent. This keeps
  the user workflow unchanged — they select Qwen3.5-397B and paste one prompt.
- **Issue**: `pnpm lint` reports 48 pre-existing errors (confirmed by stash
  test). Not introduced by this PR.

### Write session log

- **Status**: completed
- **Stage**: tooling
- **Files changed**:
  - `docs/ai-logs/2026-05-03-opencode-multi-agent-setup.md` (this file)
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`

### Fix svelte.json location and guard AGENTS.md tool-specific sections

- **Status**: completed
- **Stage**: tooling
- **Files changed**:
  - `.opencode/svelte.json` — moved from `svelte.json` at repo root (wrong location)
  - `AGENTS.md` — added `> **opencode only**` guards to §5, §6a, §7; made §6 attribution tool-generic
  - `docs/opencode-setup.md` — updated all `svelte.json` path references to `.opencode/svelte.json`
- **Decision**: `svelte.json` at the root is not read by the plugin (lookup is
  hardcoded to `.opencode/svelte.json`). No functional change to VS Code tools —
  they never read this file.

### Address PR review feedback

- **Status**: completed
- **Stage**: tooling
- **Files changed**:
  - `opencode.json` — first iteration switched `baseURL`/`apiKey` to
    `{env:…}` substitution; **reverted in the next commit** at the user's
    request (they keep the API key in `~/.local/share/opencode/auth.json`,
    not env vars). Final state: hardcoded baseURL, no apiKey field.
  - `docs/opencode-setup.md` — rewrote §2 to document `opencode auth login`
    (no env vars).
  - `AGENTS.md` — same: pointed at `opencode auth login` instead of env vars.
  - `docs/ai-logs/README.md` — corrected `svelte.json` reference to
    `.opencode/svelte.json` so readers land in the right path.
- **Decision**: User explicitly preferred opencode's own auth store over env
  vars. The reviewer's option (a) (remove env var docs entirely) was the right
  call after all.

### Apply easy harness improvements + add prompt-authoring guide

- **Status**: completed
- **Stage**: tooling
- **Files changed**:
  - `opencode.json` — narrowed `reviewer` to **diff-only** review: dropped
    `pnpm lint` / `pnpm test` / `pnpm build` re-runs (the implementer already
    runs them at step 6 — duplicating wasted ~5–10 min of Qwen3.6-35B time
    per task). Reduced `maxSteps` 30 → 15. Set `edit: deny`, `webfetch: deny`
    for the reviewer (it should never modify files or hit the network).
    Slimmed `implementer` prompt to point at AGENTS.md instead of
    re-stating the Svelte 5 / TypeScript / Tailwind rules inline (was three
    sources of truth — AGENTS.md, `.opencode/agents/implementer.md`, and
    the inline prompt — guaranteed to drift).
  - `.opencode/agents/reviewer.md` — full rewrite explaining diff-only role,
    new permissions, and the 6-check list (acceptance criteria, Svelte 4
    regressions, `: any`, test coverage, dead code in diff).
  - `.opencode/agents/implementer.md` — added "Single source of truth"
    callout pointing at AGENTS.md §2.
  - `docs/opencode-prompt-authoring.md` — **new** doc: canonical prompt
    schema (header / context / AI-logging / task blocks with acceptance
    criteria + tests-first + implement bullets + Done-when), Claude
    meta-prompt for VS Code, launch line for opencode, anti-patterns,
    when-not-to-use guidance. Cross-references the existing reference
    example (`docs/ai-logs/prompts/2026-04-27-opencode-tasks.md`).
  - `docs/README.md` — added index entry for the new doc.
  - `AGENTS.md` §6a — updated subagent table to flag reviewer as diff-only;
    added pointer to the prompt-authoring guide from §7.
- **Decision**: Took the cheapest two harness wins from the previous PR
  comment (#1 dedup reviewer, #4 single-source-of-truth via AGENTS.md). Did
  not implement the YAML task-ledger schema, `dependsOn` / blocked-skip
  logic, or the post-commit-hook reviewer alternative — those are real
  changes that deserve their own PR with discussion. The prompt-authoring
  guide answers the user's separate question about how to draft prompts in
  Claude/VS Code.
