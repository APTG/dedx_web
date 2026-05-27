# 2026-05-26 — Advanced Search Syntax: Operators for Picker Tabs (#609)

## Session Narrative

### Prompt 1: Implement issue #609 — advanced search operators for picker tabs

**AI response**: Read issue #609 and explored the codebase to understand the
current `matches` functions in all three picker tab components.

Current state before this session:
- `particle-tab.svelte`: supports substring + `z=N` exact match only
- `material-tab.svelte`: supports substring only (no density operators)
- `program-tab.svelte`: supports substring against name + version only

Implemented the following enhancements:

1. **`particle-tab.svelte`** — extended `matches` to support Z inequality
   operators (`z>N`, `z>=N`, `z<N`, `z<=N`) using `atomicNumber(p)` so
   both built-in and external particles are handled uniformly. The existing
   `z=N` exact match was also switched to use `atomicNumber(p)` instead of
   the raw `p.id` reference (same behaviour, more consistent).

2. **`material-tab.svelte`** — added `ρ` (and ASCII alias `rho`) density
   operators: `ρ>N`, `ρ>=N`, `ρ<N`, `ρ<=N`, `ρ=N`. External-only materials
   without a declared density return `false` for any `ρ` operator.

3. **`program-tab.svelte`** — added `tag=<kind>` and `v=<string>` operators.
   `tag=fn` / `tag=tab` / `tag=data` / `tag=ext` filter by program kind badge
   (case-insensitive; `data` is an alias for `tab`). `v=<string>` matches
   programs whose version string contains the given substring.
   The `matches` function signature was extended to include
   `id: number | string` so `programKind()` can be called.

Added 13 new unit tests in `entity-selection-tabbed.test.ts` covering all
new operators. Updated `docs/04-feature-specs/entity-selection.md` with
operator tables and updated acceptance criteria checkboxes.

All static checks pass: format:check ✓, lint ✓, svelte-check ✓, 1469/1472
tests pass (3 pre-existing `guard-forbidden-files` signing failures in CI).

## Tasks

### Implement advanced search operators for particle/material/program pickers

- **Status**: completed
- **Stage**: Stage 5 (entity-selection)
- **Files changed**:
  - `src/lib/components/entity-selection/particle-tab.svelte`
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/lib/components/entity-selection/program-tab.svelte`
  - `src/tests/unit/entity-selection-tabbed.test.ts`
  - `docs/04-feature-specs/entity-selection.md`
- **Decision**: All operators are available in both basic and advanced mode
  (same as the existing `z=N` operator). They are power-user syntax that does
  not interfere with ordinary substring search for casual users.
- **Decision**: `rho` ASCII alias added for `ρ` to accommodate keyboards that
  cannot easily type the Greek letter.
- **Decision**: `tag=data` aliased to `tag=tab` because "DATA" is the badge
  text shown in the UI for TAB-kind programs, so users may type what they see.
