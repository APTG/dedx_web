# Session starter — implement a feature

Copy this template into opencode, fill in the placeholders, and paste.
The main agent will act as orchestrator: decompose, implement, review, log — without
asking for confirmation between steps.

---

````
Implement the feature described in {{SPEC_PATH}}.

Branch: qwen/{{BRANCH_NAME}}

## Instructions

Act as orchestrator for this session. Proceed autonomously through all steps below
without asking me for confirmation between them.

### Step 1 — Read context

Read in order:
1. {{SPEC_PATH}}
2. docs/03-architecture.md (component tree and data flow)
3. docs/06-wasm-api-contract.md (LibdedxService interface)
4. docs/progress/ — check what is already done so you do not reimplement it

### Step 2 — Decompose

Identify 3–7 atomic implementation tasks from the spec.
Write the task list to .opencode/tasks/{{BRANCH_NAME}}.md using this format:

```markdown
# Tasks — {{BRANCH_NAME}}

## Status: in-progress

| # | Task | Status |
|---|------|--------|
| 1 | <task name> | pending |
| 2 | <task name> | pending |
...
````

Do not start implementation edits before this task file exists.

### Step 3 — Implement and review (repeat for each task)

For each task in order:

a. Update .opencode/tasks/{{BRANCH_NAME}}.md: set task status to "in-progress".

b. Call the 'implementer' subagent with this message:

```
Task: <task name>
Spec section: <exact path + section heading>
Branch: qwen/{{BRANCH_NAME}}
Acceptance criteria:
- <criterion from spec>
```

c. Wait for the implementer to output TASK DONE: or TASK BLOCKED:.

The implementer must:
- run `pnpm guard:staged` before commit,
- run at least one real-WASM `@smoke` acceptance path when the feature is
  WASM-backed (no runtime `page.addInitScript` mock injection in acceptance tests),
- include full (non-truncated) failure output if any E2E run fails.

d. If TASK DONE:

- Call the 'reviewer' subagent with:
  ```
  Review task: <task name>
  Branch: qwen/{{BRANCH_NAME}}
  Acceptance criteria:
  - <same criteria as above>
  ```
- If reviewer outputs REVIEW PASS → update task status to "done", move to next task.
- If reviewer outputs REVIEW FAIL → call implementer again with the reviewer's
  issue list appended. Allow max 2 retries. If still failing, mark task "blocked".

e. If TASK BLOCKED: → update task status to "blocked", move to next task.

### Step 4 — Session log

After all tasks are done or blocked:

1. Prepend a row to CHANGELOG-AI.md:

   ```
   | YYYY-MM-DD | <stage> | <what was done> (opencode + Qwen3.5-397B) | [log](docs/ai-logs/YYYY-MM-DD-{{BRANCH_NAME}}.md) |
   ```

2. Create docs/ai-logs/YYYY-MM-DD-{{BRANCH_NAME}}.md with:
   - Session narrative (what was done, key decisions)
   - Task table: task name, status (completed/blocked), files changed

3. Update docs/ai-logs/README.md and docs/README.md indexes.

### Step 5 — Completion semantics

- If any task cannot be pushed due to auth/protection/network, final status must be
  `TASK BLOCKED: push/auth failure` (never `TASK DONE`).
- If a guard fails (`pnpm guard:staged` or CI forbidden-file checks), stop and split
  scope instead of bypassing.

```

---

## Example filled prompt

```

Implement the feature described in docs/04-feature-specs/export.md.

Branch: qwen/export-csv-pdf

## Instructions

Act as orchestrator for this session. Proceed autonomously through all steps below
without asking me for confirmation between them.

### Step 1 — Read context

...

```

---

## Parallel session variant

If you want to run tasks in parallel across multiple terminal windows:

1. Run the orchestrator for Step 1 and Step 2 only (ask it to stop after writing
   the task list).
2. Open N terminals and paste one task each as a direct implementer prompt:

```

You are the implementer for dEdx Web.
Task: <task name from .opencode/tasks/{{BRANCH_NAME}}.md>
Spec section: <path>
Branch: qwen/{{BRANCH_NAME}}-task-N
Acceptance criteria:

- ...
  Complete the task autonomously. Output TASK DONE: or TASK BLOCKED: when finished.

```

3. After all parallel sessions finish, run a final reviewer session on each branch,
then merge into the main feature branch.
```
