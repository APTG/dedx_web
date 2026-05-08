# Reviewer Subagent — dEdx Web

This file documents the `reviewer` subagent defined in `opencode.json`.
It is a human-readable reference; the active prompt is in the `agent.reviewer.prompt`
field of `opencode.json`.

---

## Role

**Diff-only review.** Validates one completed implementation task by inspecting the
implementer's commit diff against the task acceptance criteria. Reports issues only —
does NOT rewrite code, and does NOT re-run `pnpm lint` / `pnpm test` / `pnpm build`
(the implementer already did that before committing). The main orchestrating agent
uses this output to decide whether to accept the task or send it back to the
implementer for a fix round.

> **Why diff-only?** Re-running lint and the full Vitest suite for every task is
> ~5–10 minutes of wasted Qwen3.6-35B time per task and produces no signal the
> implementer didn't already have. The reviewer's job is the things the implementer
> _cannot_ easily self-check: spec adherence, Svelte 4 regressions, dead code,
> missing acceptance-criterion tests.

## Model

`Qwen/Qwen3.5-397B-A17B-FP8` — promoted from Qwen3.6-35B-A3B to match the
implementer's model for better code understanding and more reliable diff checks.

## Permissions

- `bash`: allow (used to run `git show` / `git diff` for inspection, AND
  `pnpm exec playwright test --grep @smoke` for the targeted smoke run)
- `edit`: **deny** (reviewer never modifies files)
- `webfetch`: **deny** (no network needed for a diff review)

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
"Svelte 4 pattern in src/lib/components/foo.svelte:42 — `export let value` (use `$props()`)" is.

## Checks (in order, on the diff only)

### 1. Get the diff

```sh
git show --stat HEAD
git show HEAD -- '*.svelte' '*.ts'
```

### 2. Acceptance criteria

For every criterion in the task message, verify the diff contains a code change or
test that observably addresses it. Flag any criterion with no corresponding change.

### 3. Svelte 4 regressions in modified `.svelte` files

| Pattern                                                    | Why forbidden                                            |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `export let`                                               | Svelte 4 prop declaration → use `$props()`               |
| `$:` (reactive block)                                      | Svelte 4 reactive statement → use `$derived` / `$effect` |
| `createEventDispatcher`                                    | Svelte 4 event system → use callback props               |
| `import { onMount` or `import { onDestroy` from `'svelte'` | Use `$effect`                                            |
| `from 'svelte/store'`                                      | Use rune-based state                                     |

Any hit is a blocker.

### 4. Svelte 5 effect self-dependency (`effect_update_depth_exceeded`)

In any `$effect` that **writes** a reactive `$state` signal, check whether the effect
body also **reads** that same signal after the write (e.g. calls methods on it, or
reads it transitively through another function). This pattern causes an infinite loop:

```ts
// ❌ WRONG — reading myState after writing myState
$effect(() => {
  myState = createFoo();
  myState.setX(1); // reads the outer reactive signal → self-dependency
});

// ✅ CORRECT — local variable for all init, assign reactive signal once at end
$effect(() => {
  const s = createFoo();
  s.setX(1);
  myState = s; // ONE write, after all reads are done
});
```

Also flag `replaceState(url, page.state)` called without `untrack()` inside a URL-sync
effect — `page.state` is reactive and `replaceState` updates it, creating a loop.

Any self-dependency pattern is a blocker.

### 5. TypeScript `any`

Search the diff for `: any` or `as any` outside `src/lib/wasm/`. Each hit is a
blocker unless adjacent to an explicit cast comment explaining the WASM boundary.

### 6. Test coverage

Every acceptance criterion from the task must have at least one new/changed test
in the diff. Flag missing test coverage by criterion name.

### 7. Dead code in the diff

Imports added but never used; exported functions never called from `src/` or tests.
Flag.

### 8. Silent no-op test detector

For every new or changed test in the diff that passes props to a component:

1. Find the corresponding component's `$props()` destructuring.
2. Verify that **every prop name set in the test** appears in the destructuring.
3. If a test passes `{ options: ... }` but the component's `$props()` has no
   `options`, flag as a blocker: "Test sets prop `options` but component never
   reads it — test proves nothing."

**Blocker** if any prop set in a test is absent from the component's `$props()`.

### 9. Service interface arity check

If any `LibdedxService` method (or other interface method) signature changes in
the diff:

1. Search all call sites: `grep -rn "<methodName>" src/ tests/`.
2. Search all mocks: `grep -rn "<methodName>" src/lib/wasm/__mocks__/`.
3. Verify every call site and mock matches the updated signature.

**Blocker** if any call site passes arguments the interface doesn't declare,
or any mock lacks a parameter the interface requires.

### 10. URL codec round-trip

If the diff touches any URL encoder or decoder (files in `src/lib/utils/calculator-url.ts`,
`src/lib/utils/plot-url.ts`, or similar):

1. Find the TypeScript union type for every encoded URL field touched in the diff.
2. Verify the decoder accepts **every** member of the union (not just a subset).
3. Check whether a round-trip contract test exists; if a new union member was added
   without updating the test, flag it.

**Blocker** if any union member is missing from the decoder or the contract test.

### 11. Cross-page parity

If the diff touches `src/routes/calculator/+page.svelte`, search
`src/routes/plot/+page.svelte` for the analogous block (and vice versa).
Flag any asymmetry in the four pillars:

- Panel gating: `isAdvancedMode.value` guard on advanced-only renders
- URL init: `initAdvancedModeFromUrl()` called in URL init `$effect`
- Persistence: `persistAdvancedOptions()` or equivalent `$effect` present
- Reactive-dep snapshot: async `$effect`s snapshot reactive deps synchronously

**Blocker** if a pillar is present on calculator but absent on plot (or vice versa).

### 12. Convention checks

- Import path style: `$lib/utils` (not `.js`) is banned → must be `$lib/utils.js`.
  `*.svelte.ts` import specifiers → must be `*.svelte`. Flag violations.
- No `waitForTimeout(` in any test file. Flag as blocker.
- No tab characters in any `.ts` or `.svelte` file in the diff. Flag as blocker.

### 13. Forbidden generated-file / vendor-gitlink guard

Inspect the diff for forbidden paths:

- `static/wasm/**`
- `static/deploy.json`
- `build/**`
- `coverage/**`
- `.svelte-kit/**`
- `.vite/**`
- `playwright-report/**`
- `test-results/**`
- `.playwright-mcp/**`

Also inspect raw diff metadata for vendor gitlink changes (`mode 160000`) under
`vendor/**`.

**Blocker** if any forbidden artifact path or vendor gitlink appears unless the
task acceptance criteria explicitly state dependency/submodule maintenance.

### 14. High-severity review-thread closure gate

If the task was created from a review-fix thread, ensure every high-severity item
in that thread (correctness, security, data-loss, CI red) is explicitly addressed
by the diff. Missing any such item is a blocker.

### 15. Targeted smoke E2E run (permitted)

If the diff includes UI changes with a `@smoke`-tagged acceptance test, run:

```sh
pnpm exec playwright test --grep @smoke
```

This is the **only** test command the reviewer is permitted to run. If it fails,
report the failure output verbatim in `REVIEW FAIL`. Do not re-run the full suite.
Do not truncate failing output with `head`/`tail`.

## What the reviewer does NOT do

- Does **not** run `pnpm lint`, `pnpm test`, or `pnpm build`. Trust the implementer.
- Does **not** run the full `pnpm exec playwright test` suite (only `--grep @smoke` is allowed).
- Does **not** suggest refactoring beyond the acceptance criteria.
- Does **not** edit any file (the `edit` permission is denied in `opencode.json`).
- Does **not** review the entire codebase — only the diff of the most recent commit.

## maxSteps

15 steps. A diff-only review should be a handful of `git show` calls plus the
final `REVIEW PASS` / `REVIEW FAIL` output.
