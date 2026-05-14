# 2026-05-14 — External Data Selector Docs and Menu Fix

## Session Narrative

### Prompt 1: Fix external data user docs and selector visibility

**AI response**: Inspected the Stage 7.5 external-data implementation, verified the current branch PR (#476), and ran the existing baseline validation after enabling Corepack/pnpm and installing locked dependencies. Diagnosed that external sources were loaded and attributed, but Calculator and Plot selector components only rendered built-in program/material/particle lists. Updated entity selection state to expose compatible external programs and external-only particles/materials, wired Calculator comboboxes and Plot panels to render "External" groups, and added unit/component regression coverage with mock external metadata. Added the requested user-guide instructions with a copy-pasteable SRIM URL, synchronized external-data/entity-selection specs, and added the PR to the Stage 8 redesign table.

## Tasks

### External selector visibility

- **Status**: completed
- **Stage**: 8 (Open Beta & User Feedback)
- **Files changed**: `src/lib/state/entity-selection.svelte.ts`, `src/lib/state/calculator.svelte.ts`, `src/lib/components/entity-selection-comboboxes.svelte`, `src/lib/components/entity-selection-panels.svelte`, `src/tests/unit/entity-selection-state.test.ts`, `src/tests/unit/entity-selection-comboboxes.test.ts`, `src/tests/unit/entity-selection-panels.test.ts`, `src/tests/unit/external-entity-fixtures.ts`
- **Decision**: Kept Auto-select built-in-only per `external-data.md`, but rendered compatible external programs explicitly under an External group. External-only entities are selectable where the loaded external compatibility context supports them.
- **Issue**: None.

### Documentation and tracking

- **Status**: completed
- **Stage**: 8 (Open Beta & User Feedback)
- **Files changed**: `src/routes/docs/user-guide/+page.svelte`, `docs/04-feature-specs/external-data.md`, `docs/04-feature-specs/entity-selection.md`, `docs/00-redesign-plan.md`, `CHANGELOG-AI.md`, `docs/ai-logs/README.md`, `docs/ai-logs/2026-05-14-external-data-selector-docs.md`
- **Decision**: Documented the issue URL as a valid external-source-loading URL that leaves built-in ICRU 49 selected; users can then choose SRIM from the Program selector once loaded.
- **Issue**: None.
