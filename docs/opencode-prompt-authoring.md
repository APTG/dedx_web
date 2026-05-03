# Authoring opencode prompts (Claude / VS Code workflow)

> **Audience:** the dEdx Web maintainer (and future contributors) who use Claude
> in VS Code to *generate* the multi-task prompt files that opencode + Qwen then
> *execute* on PLGrid.
>
> **Why this doc exists:** the prompt files under
> [`docs/ai-logs/prompts/`](ai-logs/prompts/) — especially
> [`2026-04-27-opencode-tasks.md`](ai-logs/prompts/2026-04-27-opencode-tasks.md) —
> are already the de-facto standard for opencode work in this repo. This
> document codifies that standard so every new prompt has the same shape and
> opencode's `implementer`/`reviewer` subagents can parse it deterministically.

---

## TL;DR

1. Open Claude (or any other "thinking" model — GPT-5, Gemini 2.5 Pro) in VS Code.
2. Paste the **meta-prompt** from §3 below, filling in the spec path and goal.
3. Claude produces a markdown file matching the **canonical prompt schema** (§2).
4. Save it as `docs/ai-logs/prompts/YYYY-MM-DD-<slug>.md`.
5. Hand it to opencode by pasting the orchestrator-launch line from §4.
6. After the opencode session finishes, commit the prompt file alongside the
   ai-log so future sessions can see exactly what was asked.

You should always go through this two-step funnel (Claude → file → opencode).
**Do not try to draft prompts directly inside opencode** — Qwen3.5 is a strong
implementer but a weak prompt designer, and you'll burn quota iterating on
phrasing. Claude / GPT-5 do the design once for free in VS Code.

---

## 1. Why a schema at all?

Three reasons:

1. **The `implementer` subagent has a fixed input contract** (see
   [`.opencode/agents/implementer.md`](../.opencode/agents/implementer.md) §
   "Input contract"). If your prompt file mirrors that contract per task, the
   orchestrator can copy-paste each task block verbatim into the subagent
   call — no transformation, no ambiguity.
2. **Resumability.** If a session crashes mid-way (PLGrid timeout, opencode
   restart, you close the laptop), a structured prompt file lets the next
   session pick up at "task N" instead of re-deriving state from `git log`.
3. **Diffability.** Tasks with explicit acceptance criteria and "tests first"
   blocks make code review tractable — you can read the prompt and the diff
   side-by-side and see whether the spec was actually followed.

---

## 2. Canonical prompt schema

Every prompt file under `docs/ai-logs/prompts/` should have this structure.
Sections marked **(required)** are mandatory; **(optional)** can be skipped if
not relevant to the session.

### 2.1 Header (required)

```markdown
# opencode task prompt — YYYY-MM-DD

> **Model:** Qwen3.5-397B-A17B-FP8        # (or 122B for cheap tasks)
> **Session type:** Multi-task implementation | Single feature | Refactor | Doc
> **Branch:** qwen/<slug>
> **MCPs needed:** playwright | tailwind | svelte | (none)
> **TDD rule:** Write the failing test(s) first, then minimal impl. (or omit)
```

### 2.2 Context (required)

A numbered list of files the agent must read **before writing any code**, in
order of importance. Always include `AGENTS.md` first if it's not already in
the agent's automatic context.

```markdown
## Context

Read at session start (in order):
1. AGENTS.md — stack, Svelte 5 rules, build commands
2. <spec file path> §<exact section heading>
3. <related file 1>
4. <related file 2>

Key source files:
- <path 1>
- <path 2>

Test files:
- <path 1>
- <path 2>

Run tests:
\```sh
pnpm test                        # Vitest unit
pnpm exec playwright test        # E2E (needs WASM in static/wasm/)
\```
```

### 2.3 AI logging reminder (required for sessions that change code/docs)

One paragraph pointing to the logging rules; do NOT re-paste them.

```markdown
## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(which refers to `.github/copilot-instructions.md` § "AI Session Logging").
Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.
```

### 2.4 Task blocks (required, repeat for each task)

This is the heart of the file. Each task block must be **directly pasteable
into the `implementer` subagent**, so use the exact field names the subagent
parses.

```markdown
---

## Task N — <one-line task name>

**Spec:** <path to spec>:§<section heading> (cite the version if the spec is
versioned, e.g. "v4 §3").

### Acceptance criteria

- <observable criterion 1 — must be testable>
- <observable criterion 2>
- <criterion 3>

### Step Na — tests first (`<test file path>`)

\```
"input 1" → expected output 1
"input 2" → expected output 2
\```

(Or a markdown table, if there are many cases.)

### Step Nb — implement

In `<source file 1>`:
- <surgical change 1>
- <surgical change 2>

In `<source file 2>`:
- <surgical change 1>

### Done when

`pnpm test` is green, then commit:
\```
<conventional-commits message>
\```
```

**Why this shape works:**
- `Acceptance criteria` is exactly what the `reviewer` subagent grades against.
- `Step Na — tests first` enforces TDD without a separate prose paragraph.
- `Step Nb — implement` is "surgical bullet points", not narrative — Qwen
  follows bullets faithfully and hallucinates on prose.
- `Done when` gives the implementer an unambiguous "TASK DONE:" trigger.

### 2.5 Cross-task notes (optional)

If task N depends on task N-1's output, say so explicitly:

```markdown
> **Depends on Task 4** — uses the new `setRowUnit` signature.
```

The orchestrator (and a future task-ledger schema) can use these to skip
dependents when an upstream task is `BLOCKED`.

---

## 3. Meta-prompt for Claude (in VS Code)

Paste this into Claude when you want it to draft a new opencode prompt file.
Fill in the bracketed bits before sending.

````markdown
You are drafting an opencode task prompt for the dEdx Web project. Read
`docs/opencode-prompt-authoring.md` §2 for the canonical schema and follow it
exactly. Read `docs/ai-logs/prompts/2026-04-27-opencode-tasks.md` for a
reference example.

Goal: [one-paragraph description of what we want opencode + Qwen to do]

Spec(s) to implement: [path(s) under docs/04-feature-specs/]

Constraints:
- [any design decisions already made — e.g. "use existing X", "do not touch Y"]
- [any acceptance test phrasing the user explicitly wants]

Output:
- A single markdown file ready to save under
  `docs/ai-logs/prompts/YYYY-MM-DD-<slug>.md` with today's date.
- Header per §2.1 (Qwen3.5-397B unless I say otherwise).
- Context block per §2.2 — you must read the spec(s) and pick the actual
  source/test file paths from the repo, not invented ones.
- One Task block per atomic unit of work (3–7 tasks total). Each task must
  fit in a single `implementer` subagent call (≤ ~10 file edits).
- For every task: acceptance criteria, "tests first" block with concrete
  input/output examples, "implement" block with surgical bullet points,
  and a Conventional Commits message.

Do NOT execute any of the work. Do NOT modify the repo. Just produce the
markdown.
````

If the goal is small (one or two file changes, no tests), skip this and write
the prompt by hand — the funnel is overkill.

---

## 4. Launching the prompt in opencode

Once the prompt file is saved, start a new opencode session and paste:

```
Read docs/ai-logs/prompts/<filename>.md and act as the orchestrator described
in AGENTS.md §6a. For each Task block:

1. Update .opencode/tasks/<branch>.md (create it if missing).
2. Call the 'implementer' subagent with the task block (Spec / Acceptance
   criteria / Step lists), unchanged.
3. Wait for TASK DONE: or TASK BLOCKED:.
4. On TASK DONE, call the 'reviewer' subagent with the task name + acceptance
   criteria. On REVIEW FAIL, retry the implementer up to 2 times.
5. After all tasks: write the CHANGELOG-AI row and the docs/ai-logs/ entry
   per the AI Logging section in the prompt file.

Proceed autonomously. Do not ask for confirmation between tasks.
```

That's it. The orchestrator handles the rest.

---

## 5. Anti-patterns to avoid

- **Free-prose tasks** — "Add a typo-suggestion feature to the parser" without
  acceptance criteria and example inputs. Qwen will invent a plausible but
  wrong API. Always include the table of input → expected output.
- **Mega-tasks** — one Task block that touches 20+ files. Split it. The
  `implementer` has `maxSteps: 80` and a 131k context window; it will run out
  of one or both on a mega-task.
- **Re-pasting AGENTS.md content into the prompt** — duplicates that drift over
  time. Reference AGENTS.md by section heading instead.
- **Asking Qwen to design the API** — phrase it as "implement this signature"
  or "extend this map", never "design a system that does X".
- **No commit message** — without an explicit Conventional Commits string at
  the end of the task, Qwen sometimes commits with a prose summary that fails
  commitlint.
- **Vague "make sure it works"** — replace with "Done when: `pnpm test` is
  green and `<file>:<test name>` passes."

---

## 6. When NOT to use the orchestrator at all

Sometimes you don't need the multi-agent harness. Use a plain opencode
session (no subagents) when:

- The change is < 3 files and has no tests to write (e.g. a doc edit, a
  config bump, a tailwind class swap).
- You are debugging — the round-trip cost of orchestrator → implementer →
  reviewer slows iteration. Open a single session, attach to it, and drive it
  interactively.
- The spec is so vague that you'd be writing the prompt as you go. In that
  case, draft the spec first (in `docs/04-feature-specs/`), commit it, *then*
  generate the opencode prompt against the committed spec.

---

## 7. Cross-references

- `.opencode/agents/implementer.md` — input/output contract
- `.opencode/agents/reviewer.md` — input/output contract (diff-only as of 2026-05)
- `.opencode/prompts/run-feature.md` — orchestrator launch template
- `AGENTS.md` §6a — multi-agent workflow rules (opencode-only)
- `docs/opencode-setup.md` — environment setup (PLGrid auth, MCP servers)
- `docs/ai-logs/prompts/2026-04-27-opencode-tasks.md` — reference example
