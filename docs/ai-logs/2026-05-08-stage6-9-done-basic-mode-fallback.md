# 2026-05-08 — Stage 6.9 done: basic-mode tab fallback fix + Scenario 4 E2E

**Model:** Claude Sonnet 4.6 via Claude Code

## Session Narrative

### Prompt 1: Mark 6.9 done; verify basic-mode gate works when on Range tab

User asked to:
1. Mark 6.9 as done in the redesign plan
2. Check whether there are good E2E tests for the flow: visit advanced mode → switch to Range tab → go back to basic mode
3. Fix if broken, then mark done

**AI response:**

Read the spec (§1 Feature Gate) and found:

> "When the user disables Advanced mode while an Inverse tab is active,
> the view switches back to the Forward tab automatically."

Checked `tests/e2e/inverse-lookups.spec.ts` — the "Advanced Mode Gate"
`test.describe` had one test (Scenario 4 part 1: tabs absent in basic mode)
but nothing for the "switch back while Range tab is active" flow.

## Bug Found

Template content guards in `src/routes/calculator/+page.svelte`:

```svelte
<!-- Forward tab content -->
{#if !inverseLookupState || inverseLookupState.activeTab === "forward"}

<!-- Range tab content -->
{#if inverseLookupState && inverseLookupState.activeTab === "csda"}

<!-- Inverse STP tab content -->
{#if inverseLookupState && inverseLookupState.activeTab === "stp"}
```

None of these checked `isAdvancedMode.value`. So when the user:
1. Enabled advanced mode
2. Clicked Range tab (`activeTab = "csda"`)
3. Switched back to basic mode

The tab switcher disappeared (it's inside `{#if isAdvancedMode.value}`) but
the Range content kept rendering because `activeTab` was still "csda" and
the guard didn't check the mode.

## Tasks

### Fix template guards (primary fix)

- **Status**: completed
- **Stage**: 6.9
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: Guard all three content blocks on `isAdvancedMode.value` in
  addition to `activeTab`. This is the reliable defensive fix — no dependency
  on effect ordering.

Changes (lines ~1086–1218):
```diff
- {#if !inverseLookupState || inverseLookupState.activeTab === "forward"}
+ {#if !inverseLookupState || !isAdvancedMode.value || inverseLookupState.activeTab === "forward"}

- {#if inverseLookupState && inverseLookupState.activeTab === "csda"}
+ {#if isAdvancedMode.value && inverseLookupState && inverseLookupState.activeTab === "csda"}

- {#if inverseLookupState && inverseLookupState.activeTab === "stp"}
+ {#if isAdvancedMode.value && inverseLookupState && inverseLookupState.activeTab === "stp"}
```

### Add $effect to reset activeTab on mode change

- **Status**: completed
- **Stage**: 6.9
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: Added a `$effect` before the multi-program state effect that
  calls `inverseLookupState.setActiveTab("forward")` when `isAdvancedMode.value`
  becomes false. This keeps the state internally consistent (URL codec already
  checks `isAdvancedMode.value` before emitting `imode`, so it's a secondary
  concern, but still good practice).
- **Issue**: Svelte 5 short-circuit dependency tracking meant the effect alone
  was not reliable as the primary fix; the template guard is authoritative.

### Add Scenario 4 E2E test

- **Status**: completed
- **Stage**: 6.9
- **Files changed**: `tests/e2e/inverse-lookups.spec.ts`
- **Decision**: Added "Advanced-mode gate: switching to Basic while on Range tab
  shows Forward content @regression" inside the existing "Advanced Mode Gate"
  `test.describe`. Verifies: tab buttons gone, result-table visible.

### Mark 6.9 done in redesign plan

- **Status**: completed
- **Files changed**: `docs/00-redesign-plan.md`, `CHANGELOG-AI.md`
- **Decision**: Updated status row for 6.9 to ✅, updated sub-stage range in
  the status paragraph, removed 6.9 from recommended implementation order.

## Test Results

- 834 unit tests pass
- 126/126 E2E pass (4 skipped — WASM binary absent in test env)
- Full `pnpm build` succeeds
