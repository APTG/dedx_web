# 2026-04-18 — external-data review thread fixes

## Session Narrative

### Prompt 1: Apply requested changes from PR review thread
**AI response**: Reviewed all actionable review comments referenced from PR #353 and applied surgical documentation fixes across the affected files only. Updated the external-data spec to align the store layout with Spike 4 (energy grid in root attributes, no `energy/` array files), corrected the zarrita protocol API calls to match real Spike code (`FetchStore` + `open(root(...))` + `get(...)`), fixed per-ion shard chunk settings in the Python example, synchronized Spike 4 candidate table/request-count/file-count values with verdict data, updated stale spec version references, corrected a stage-progress version mismatch, and fixed a broken ADR anchor link. Validated by running unit tests (`CI=true npm test -- --watchAll=false`) successfully.

## Tasks

### PR #353 review-thread amendments
- **Status**: completed
- **Stage**: 2.5
- **Files changed**:
  - `docs/04-feature-specs/external-data.md`
  - `docs/11-prototyping-spikes.md`
  - `docs/progress/stage-2.md`
  - `docs/decisions/004-zarr-v3-external-format.md`
- **Decision**: Used root `webdedx.energyGrid` attributes (matching Spike 4 prototype/verdict behavior) instead of introducing additional `energy/` array fetches, to keep the 7-request cold-start and 578-file count internally consistent.
- **Issue**: None.
