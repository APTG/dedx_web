# 2026-05-16 — Load-external review follow-ups

## Session Narrative

### Prompt 1: Apply PR #521 review-thread fixes

**AI response**: Addressed the full review thread for the load-external feature with minimal, focused edits:
- Added stale-label safeguards (`ExternalDataService` now rejects same-label/different-source reuse; Calculator passes service-cached labels into modal uniqueness checks).
- Rebuilt external compatibility context reconciliation to fallback selections when removed external sources invalidate current particle/material/program picks.
- Made recents persistence best-effort (`localStorage.setItem` failures no longer block successful loads).
- Updated modal URL validation to enforce HTTPS `.webdedx` (plus localhost HTTP exception for local dev).
- Fixed local-directory source rendering in `ExternalSourcesPanel` so empty URL no longer renders as a broken self-link.
- Made URL share/filter logic case-insensitive for scheme checks.
- Refactored FSDH store range reads to use `File.slice()` and rethrow aborts instead of silently treating abort as file-missing.
- Added focused tests for modal flows, URL filter behavior, loader store-override metadata probing, directory-store caching/eviction, panel local-source rendering, and FSDH range/abort semantics.
- Synced docs index (`docs/ai-logs/README.md`) with missing prior log entry.
- Added a new `.opencode/lessons-learned.md` entry about best-effort persistence on success paths.

## Tasks

### PR #521 thread remediation

- **Status**: completed
- **Stage**: stage-5-entity-selection
- **Files changed**:
  - `src/routes/calculator/+page.svelte`
  - `src/lib/components/entity-selection/load-external-modal.svelte`
  - `src/lib/components/entity-selection/external-sources-panel.svelte`
  - `src/lib/external-data/service.ts`
  - `src/lib/external-data/fsdh-store.ts`
  - `src/lib/external-data/url.ts`
  - `src/tests/components/load-external-modal.test.ts`
  - `src/tests/unit/external-data-loader-store.test.ts`
  - `src/tests/unit/external-data-fsdh-store.test.ts`
  - `src/tests/unit/external-data-service.test.ts`
  - `src/tests/unit/external-data-url.test.ts`
  - `src/tests/unit/external-sources-panel.test.ts`
  - `docs/ai-logs/README.md`
  - `CHANGELOG-AI.md`
  - `.opencode/lessons-learned.md`
- **Decision**: Kept local directory descriptors URL-less (`url: ""`) and fixed rendering in the panel, instead of introducing a new descriptor schema variant, to keep URL codec/API surface unchanged.
- **Issue**: Targeted tests pass; Svelte emits `derived_inert` warnings in modal unit tests during teardown but assertions are stable and passing.
