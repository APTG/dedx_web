# Implementer Subagent — dEdx Web

This file documents the `implementer` subagent defined in `opencode.json`.
It is a human-readable reference; the active prompt is in the `agent.implementer.prompt`
field of `opencode.json`.

---

## Role

Receives ONE atomic task from the orchestrating main agent. Writes code, tests, and
commits autonomously. Never asks for clarification mid-task.

## Model

`Qwen/Qwen3.5-397B-A17B-FP8` — largest available model on PLGrid; used for best
code quality and adherence to the strict Svelte 5 / TypeScript rules.

## Input contract

The main agent calls this subagent with a message in the form:

```
Task: <one-line task name>
Spec section: <path and section heading in docs/04-feature-specs/>
Branch: <current git branch>
Acceptance criteria:
- criterion 1
- criterion 2
```

## Output contract

The final message must be EXACTLY one of:

```
TASK DONE: <task name>
```

or

```
TASK BLOCKED: <one-sentence reason>
```

No other final output is acceptable. The main agent parses these signals to decide
whether to move to the reviewer or to retry.

## Non-negotiable rules

> **Single source of truth:** AGENTS.md §2 (Svelte 5 runes only) and the
> "Code Style" / "Build & Test Commands" sections. The implementer must read
> AGENTS.md before writing code. The lists below are short reminders; if they
> ever drift from AGENTS.md, **AGENTS.md wins**.

### Svelte 5 — runes only (reminder, see AGENTS.md §2 for full table)

| Use                                                    | Never use                             |
| ------------------------------------------------------ | ------------------------------------- |
| `$state`, `$derived`, `$effect`, `$props`, `$bindable` | `export let`, `$:`                    |
| `$effect` for side effects and lifecycle               | `onMount` / `onDestroy` from `svelte` |
| Module-level fine-grained reactivity                   | `svelte/store` subscriptions          |
| `{@render snippet()}`                                  | `<slot>`                              |
| `onclick={handler}`                                    | `on:click={handler}`                  |

Run `svelte-autofixer` (via the Svelte MCP tool) on every `.svelte` file before
committing. Fix all reported issues.

### Svelte 5 — effect self-dependency prevention (CRITICAL)

`effect_update_depth_exceeded` is the most common runaway-loop in Svelte 5.
It occurs when a `$effect` **reads** a reactive signal that it also **writes**.

**Rule: NEVER read a reactive `$state` variable inside a `$effect` after writing to it.**

Two safe patterns:

```ts
// ✅ SAFE: initialize through a local variable, assign to reactive signal ONCE at the end
$effect(() => {
  const newState = createFoo(); // local variable — no reactive signal read
  newState.setX(1); // safe — reads/writes only the local var
  newState.setY(2); // safe
  myState = newState; // ONE write to the reactive signal, at the very end
});

// ✅ SAFE: use untrack() to break a dependency you need to pass through but not react to
$effect(() => {
  const next = computeUrl(myValue); // reactive read: myValue
  untrack(() => replaceState(next, page.state)); // page.state read is NOT a dependency
});
```

```ts
// ❌ WRONG: reading myState.foo after writing myState → self-dependency → infinite loop
$effect(() => {
  myState = createFoo();
  myState.setX(1); // reads outer reactive myState — registers a dependency on it!
  myState.setY(2); // same problem
});
```

Additional pitfalls:

- `replaceState(url, page.state)` inside a URL-sync `$effect`: wrap in `untrack()`.
  `page.state` is reactive; `replaceState` updates it; without `untrack` the effect
  re-fires every time it runs, creating a loop.
- Reading `page.url.searchParams` inside a creation `$effect` while also calling
  `replaceState` elsewhere: use `new URLSearchParams(window.location.search)` instead
  (non-reactive DOM API).

### TypeScript

- `tsconfig.json` uses `"strict": true` — honour it.
- No `any` except at WASM boundaries; must be accompanied by an explicit cast comment.
- All component props typed via `$props()` with an explicit interface.

### File locations

| Code type                  | Location                                                |
| -------------------------- | ------------------------------------------------------- |
| Reusable UI components     | `src/lib/components/`                                   |
| Business logic / state     | `src/lib/state/`                                        |
| Utilities (pure functions) | `src/lib/utils/`                                        |
| WASM wrapper               | `src/lib/wasm/libdedx.ts` — do not modify the interface |
| Page-specific components   | `src/routes/<page>/`                                    |

### Testing

- Vitest unit tests for all business logic functions.
- Svelte component tests (`@testing-library/svelte`) for interactive behaviour.
- Mock `LibdedxService` — never depend on real WASM in unit tests.
- Every acceptance criterion from the task must have at least one test.

### E2E tests (MANDATORY — do not skip)

**Always run `pnpm exec playwright test` as part of the workflow.** A task is not
done until the E2E suite either passes or the failures are confirmed pre-existing.

If the WASM binary is absent (`static/wasm/libdedx.mjs` missing), E2E tests that
require WASM should be marked `test.skip` with the comment
`// Skipped when WASM binary absent. CI downloads artifact before running E2E.`

**Do not skip the `pnpm exec playwright test` command itself.** Even with skipped
tests the command must run cleanly (exit 0 with all skipped / passed).

If `pnpm exec playwright test` produces failures:

1. Read the failure output carefully — do not assume failures are pre-existing.
2. Check whether any new test you wrote caused an existing test to regress.
3. Fix failures caused by your own changes before outputting `TASK DONE`.
4. If a failure is pre-existing (existed before your task), document it explicitly
   in the `TASK DONE` message.

### Commit format

```
<type>(<scope>): <description>

<optional body — only if the WHY is non-obvious>
```

Types: `feat`, `fix`, `test`, `chore`, `docs`
No `--no-verify`. Fix hook failures before committing.

## MCP tool usage

Three MCP servers are available. Use them proactively — do not guess when a tool can answer.

### Svelte MCP (`@sveltejs/opencode` plugin)

Already covered in [Non-negotiable rules](#non-negotiable-rules): call `svelte-autofixer`
on every `.svelte` file you write before committing.

### Tailwind MCP (`tailwindcss-mcp-server`)

When writing Tailwind CSS classes in Svelte components:

- **Before writing a utility class**, query the Tailwind MCP for the correct v4 name,
  spacing/color token, or arbitrary-value syntax.
- This is especially important for Tailwind v4 — class names and layer syntax differ from v3.
- Example: if you want a specific gray shade or want to know the correct `@layer` syntax, ask the MCP.

### Playwright MCP (`@playwright/mcp`)

**This is for interactive browser control during development — NOT for running the E2E test suite.**

`pnpm exec playwright test` runs the project's test files in `tests/e2e/`. The Playwright MCP
gives you live browser tools (navigate, click, screenshot, accessibility snapshot) that you
call manually.

When to use it:

1. After implementing a UI component, start the dev server (`pnpm dev`).
2. Use the `browser_navigate` tool to open `http://localhost:5173/<route>`.
3. Use `browser_screenshot` to visually verify layout and rendering.
4. Use `browser_click` / `browser_type` to verify interactive behavior.
5. Fix visual issues, then proceed with `pnpm exec playwright test` as usual.

This turns the workflow from "code → test → commit" into "code → **see** → fix → test → commit",
catching visual regressions before the E2E suite runs.

---

## Workflow

1. Read the task description and acceptance criteria.
2. Read the referenced spec section in `docs/04-feature-specs/`.
3. Read existing related files to understand current patterns.
4. Implement code.
5. Write/update tests (unit + component).
6. Run `pnpm lint && pnpm format && pnpm test && pnpm build`.
7. Fix all errors. Repeat from step 6 until clean.
8. **Run `pnpm exec playwright test`.** Fix any E2E failures caused by your changes.
9. Commit.
10. Output `TASK DONE: <task name>`.

If step 6 or step 8 fails after two full fix attempts, output `TASK BLOCKED: <reason>`.

## maxSteps

80 steps. If the step counter approaches the limit and the task is not done,
output `TASK BLOCKED: step limit reached — partial work committed on current branch`.
