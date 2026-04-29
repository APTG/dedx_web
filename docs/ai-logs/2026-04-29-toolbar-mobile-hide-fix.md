# 2026-04-29 — Toolbar mobile hide fix (E2E unblock)

**Model:** (Claude Sonnet 4.5 via Copilot coding agent)

## Session Narrative

### Prompt 1: "E2E tests are failing, check why and make necessary fixes"

PR #404 had just added two E2E test additions to `tests/e2e/toolbar.spec.ts`:
a mobile-viewport visibility check for the Export PDF/CSV buttons, and a
clipboard-content assertion on the Share URL button. The first new test
failed in CI:

```
Error: expect(locator).toBeHidden() failed
Expected: hidden
Received: visible
> 26 |     await expect(page.getByRole("button", { name: /export pdf/i })).toBeHidden();
```

Inspecting the failure trace, the rendered `<button>` carried
`group/button inline-flex shrink-0 …` from the shadcn Button base — but
**not** `hidden sm:inline-flex` from the user-supplied `class` prop.

Root cause: `src/lib/utils.ts`'s `cn()` is a plain `classes.filter(Boolean).join(" ")`
— it does **not** use `tailwind-merge`. So when `+layout.svelte` passed
`class="hidden sm:inline-flex"` to a Button whose base already contains
`inline-flex`, both ended up on the element. With Tailwind v4's source
order, `inline-flex` won and the buttons stayed visible at 375 px.

**Fix**: wrapped the two Export buttons in a `<div class="hidden sm:flex
items-center gap-2">` and removed the `class="hidden sm:inline-flex"` from
the buttons themselves. The wrapper has no conflicting display utility, so
`hidden` cleanly applies below the `sm` breakpoint.

The new test now exercises the actual responsive contract end-to-end and
matches what the PR description claimed.

## Tasks

### Toolbar mobile-hide refactor
- **Status**: completed
- **Stage**: 6.1 (Calculator post-merge follow-up)
- **Files changed**:
  - `src/routes/+layout.svelte` — wrap Export PDF / Export CSV buttons in a
    `hidden sm:flex` container
  - `tests/e2e/toolbar.spec.ts` — (already in PR) mobile-viewport assertion
    + clipboard-content assertion on Share URL
- **Decision**: kept the custom `cn()` as-is (not a regression — predates
  this PR; broader conversion to `tailwind-merge` is a separate change).
  The wrapper-element approach is the local minimum-risk fix and avoids
  touching every consumer of `cn()`.
- **Issue**: none — tests should pass; no other call site relied on the
  old per-button `hidden sm:inline-flex` class.
