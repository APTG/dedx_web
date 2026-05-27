# 2026-05-27 — Extract Duplicated Utilities (#626)

## Session Narrative

### Prompt 1: Implement issue #626 — extract remaining duplicated utilities

**AI response**: Implemented all three refactorings described in the issue:

1. **`slug()` extraction** — created `src/lib/export/utils.ts` exporting a single `slug(name)` helper. Updated `csv.ts` and `pdf.ts` to import it and removed their local inner-function definitions.

2. **`asBuiltinMaterial()` / `asBuiltinParticle()` extraction** — created `src/lib/utils/entity-type-guards.ts` with both type-narrowing helpers. Updated `calculator.svelte.ts` to import from the new module, removed the now-unused `MaterialEntity` import.

3. **`validateEntityArray()` extraction** — added a private `validateEntityArray()` helper to `validation.ts` that handles the structural checks shared by both the particles and materials blocks (non-empty array, max-length guard, per-item object check, duplicate-id tracking). The per-field validation loops retain their own logic since fields differ.

All static checks pass (`pnpm lint`, `pnpm format:check`). All unit and integration tests pass (the 3 pre-existing `guard-forbidden-files` infrastructure failures are unrelated).

## Tasks

### Extract `slug()` to `src/lib/export/utils.ts`

- **Status**: completed
- **Files changed**: `src/lib/export/utils.ts` (new), `src/lib/export/csv.ts`, `src/lib/export/pdf.ts`

### Extract `asBuiltinMaterial` / `asBuiltinParticle` to shared module

- **Status**: completed
- **Files changed**: `src/lib/utils/entity-type-guards.ts` (new), `src/lib/state/calculator.svelte.ts`

### Extract `validateEntityArray()` in validation.ts

- **Status**: completed
- **Files changed**: `src/lib/external-data/validation.ts`
