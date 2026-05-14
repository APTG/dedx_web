# 2026-05-14 — PR #465 Code Quality follow-ups

## Session Narrative

### Prompt 1: Check all `github-code-quality` PR comments

**AI response**: Fetched PR #465 review threads and identified six unresolved `github-code-quality` comments. Removed the unused external loader root metadata constant, removed the unused `convertEnergyGrid` test import, simplified redundant null checks in calculator type guards and entity-selection material fallback logic, and removed the always-true PDG null guard. Re-ran lint and targeted external-data tests successfully.

## Tasks

### Static-analysis cleanup

- **Status**: completed
- **Stage**: 7.5 external data
- **Files changed**: `src/lib/external-data/loader.ts`, `src/tests/unit/external-data-loader.test.ts`, `src/lib/state/calculator.svelte.ts`, `src/lib/state/entity-selection.svelte.ts`, `src/lib/state/external-compatibility.ts`
- **Decision**: Applied only behavior-preserving cleanup requested by the bot comments; no runtime logic was intentionally changed.
- **Issue**: None.
