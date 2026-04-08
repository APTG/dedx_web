# 2026-04-08 — Shareable URLs

## Session Narrative

### Prompt 1: Write `docs/04-feature-specs/shareable-urls.md` as a full Stage 1 feature spec
**AI response**: Drafted a full spec file covering canonical URL state contract across Calculator and Plot pages, basic vs advanced mode behavior, shared vs page-specific params, deep-link and history behavior, calculator mixed-unit encoding (`energies` + `eunit`), plot `series` encoding, validation/normalization, shareability/security requirements, compatibility/versioning notes, concrete fixtures, round-trip tests, invalid recovery examples, and a cross-spec consistency checklist.

### Prompt 2: Fix contract ambiguities and canonicalization/program-ID inconsistencies
**AI response**: Applied targeted fixes in `shareable-urls.md`:
- Added `mode=advanced` explicitly to the advanced-mode example where required.
- Unified canonicalization policy to always include explicit defaulted page-state params in canonical URLs.
- Corrected program IDs in assumptions/examples to match `06-wasm-api-contract.md` constants (`PSTAR=2`, `ICRU=9`, `BETHE_EXT00=101`).
- Updated affected calculator and plot examples and bumped spec status to Draft v2.

### Prompt 3: Add missing AI log entries/references and check consistency of all specs
**AI response**: Synchronized documentation indexes and logs:
- Added changelog entry in `CHANGELOG-AI.md` for the Shareable URLs session.
- Added this detailed session file and linked it in `docs/ai-logs/README.md`.
- Updated `docs/04-feature-specs/README.md` to include `shareable-urls.md` (Draft v2) and removed it from planned specs.
- Replaced stale TODO links in `calculator.md` with active links to `shareable-urls.md`.
- Corrected lingering stale program-ID URL examples in `multi-program.md` (`9,2,101` / `hidden_programs=101`) to keep all Stage 1 specs aligned with `06-wasm-api-contract.md`.
- Ran cross-spec grep checks for stale `shareable-urls` TODO references and advanced URL parameter consistency.

### Prompt 4: Add URL parameter spec versioning with user warning for incompatible versions
**AI response**: Extended `shareable-urls.md` to Draft v3 with an explicit versioned URL contract using `urlv` (major version), canonical inclusion of `urlv=1`, version negotiation rules (`CURRENT_URL_MAJOR`, `MIN_SUPPORTED_URL_MAJOR`), migration-chain behavior for older supported majors, and mandatory warning/recovery UX for unsupported major mismatches. Updated canonical examples, acceptance criteria, changelog, and spec indexes accordingly.

## Tasks

### Shareable URLs Spec Draft v1
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/shareable-urls.md`
- **Decision**: Use one canonical URL contract document as the normative source for Calculator + Plot URL behavior.
- **Issue**: Follow-up consistency fixes were required after review (addressed in v2).

### Shareable URLs Spec Draft v2 Consistency Pass
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/shareable-urls.md`
- **Decision**: Canonical URLs include explicit defaulted page-state params for deterministic sharing and stable round-trips.
- **Decision**: Fixture IDs must always match WASM contract constants when examples are normative.
- **Issue**: None remaining from the reported review items.

### Logging + Index Synchronization
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/04-feature-specs/README.md`
  - `docs/04-feature-specs/calculator.md`
  - `docs/04-feature-specs/multi-program.md`
  - `docs/ai-logs/2026-04-08-shareable-urls.md`
- **Decision**: Promote `shareable-urls.md` from planned list to active spec index immediately after creation.
- **Issue**: `docs/progress/` directory is referenced in the redesign plan but is not present in this repository snapshot; no progress file update was possible in this session.

### Shareable URLs Spec Draft v3 (URL Versioning)
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/shareable-urls.md`
  - `docs/04-feature-specs/README.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-04-08-shareable-urls.md`
- **Decision**: Introduce `urlv` as a URL-contract major version and require it in canonical URLs.
- **Decision**: On unsupported major mismatch, do not silently parse; show warning with explicit recovery actions.
- **Issue**: None.
