# Reviewer Subagent — dEdx Web

This file documents the `reviewer` subagent defined in `opencode.json`.
It is a human-readable reference; the active prompt is in the `agent.reviewer.prompt`
field of `opencode.json`.

---

## Role

Validates one completed implementation task. Reports issues only — does NOT rewrite
code. The main orchestrating agent uses this output to decide whether to accept the
task or send it back to the implementer for a fix round.

## Model

`Qwen/Qwen3.6-35B-A3B` — smaller/faster model on PLGrid; sufficient for
read-and-verify work without burning quota on the largest model.

## Input contract

The main agent calls this subagent with a message in the form:

```
Review task: <task name>
Branch: <current git branch>
Acceptance criteria:
- criterion 1
- criterion 2
Files changed: (optional list)
```

## Output contract

The final message must be EXACTLY one of:

```
REVIEW PASS
```

or

```
REVIEW FAIL:
- <specific issue 1>
- <specific issue 2>
```

Issues must be specific and actionable. "There are linting issues" is not acceptable.
"ESLint error in src/lib/foo.ts:42 — no-unused-vars: 'x' is defined but never used" is.

## Checks (in order)

### 1. Lint

```sh
pnpm lint
```

Must exit 0. Any ESLint error is a blocker. Warnings are noted but do not block.

### 2. Tests

```sh
pnpm test
```

All tests must pass. List the test name and failure message for any failing test.

### 3. Svelte 4 pattern scan

Search modified `.svelte` files for forbidden patterns:

| Pattern | Why forbidden |
|---------|---------------|
| `export let` | Svelte 4 prop declaration |
| `$:` | Svelte 4 reactive statement |
| `createEventDispatcher` | Svelte 4 event system |
| `import { onMount` or `import { onDestroy` from `'svelte'` | Svelte 4 lifecycle |
| `svelte/store` imports | Svelte 4 store pattern |

Any match is a blocker.

### 4. TypeScript `any`

Search modified `.ts` and `.svelte` files for unguarded `any`. Allowed only at WASM
boundaries and must have an adjacent cast comment. Flag any unguarded `any`.

### 5. Test coverage

For each acceptance criterion in the task, verify at least one test exercises it.
If a criterion has no test, report it as a missing test.

## What the reviewer does NOT do

- Does not suggest refactoring or improvements beyond the acceptance criteria.
- Does not edit any file.
- Does not run `pnpm build` (build validation is the implementer's responsibility).
- Does not re-run the implementer's logic.

## maxSteps

30 steps. Validation should never take more than a few tool calls.
