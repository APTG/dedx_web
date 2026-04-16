# 2026-04-15 — Stage 2.6: Apply Documentation Amendments

## Session Narrative

### Prompt 1: Apply Stage 2.6 findings to all affected markdown documents

**User request:** Read the notes from Stage 2.6, especially the
`libdedx-investigation` sub-directory. Apply all suggested amendments
carefully to all markdown documents where needed: project vision, tech stack,
WASM API contract, architecture, and all feature specs. Check for consistency.

**AI response:**

Read all relevant source material before making any changes:
- `docs/00-redesign-plan.md` — Stage 2.6 description
- `docs/ai-logs/2026-04-15-libdedx-investigation-phase1.md`
- `docs/ai-logs/2026-04-15-libdedx-investigation-phase2.md`
- `docs/ai-logs/2026-04-15-libdedx-investigation-completion.md`
- `docs/ai-logs/2026-04-15-stage26-review-fixes.md`
- `prototypes/libdedx-investigation/VERDICT.md`
- `docs/decisions/003-wasm-build-pipeline.md`
- `docs/06-wasm-api-contract.md`
- `docs/04-feature-specs/entity-selection.md`
- `docs/03-architecture.md`
- `docs/11-prototyping-spikes.md`
- `docs/progress/stage-2.md`

All 8 amendments listed in `VERDICT.md §2` were applied. Summary of each change:

**1. `docs/decisions/003-wasm-build-pipeline.md` (ADR 003)**
- Removed `--preload-file libdedx/data@/data` from the `emcc` flags block.
- Changed `EXPORTED_FUNCTIONS` format to JSON-quoted strings (Emscripten 5.x
  requirement verified in Phase 2).
- Added explanatory note after the flags block explaining why `--preload-file`
  is unnecessary.
- Added `EXPORTED_FUNCTIONS` JSON-format requirement to the Emscripten
  changelog section (before the MODULARIZE/Promise entry).
- Removed the `--preload-file` row from the "Key flag decisions" table.
- Removed the entire "Negative risks — `--preload-file` produces a separate
  `.data` payload" paragraph (obsolete).
- Updated WASM binary size budget: Phase 2 measured 457 KB `.wasm` + 13 KB
  `.mjs`; removed `libdedx.data ≤ 5 MB` ceiling.
- Updated `locateFile` risk note: removed `.data` references (only `.wasm` is
  located).
- Updated "Positive" consequence: "Separate `.wasm` binary" — clarified that
  all data is compiled in and no `.data` sidecar exists.

**2. `docs/06-wasm-api-contract.md`**
- Bumped status to v3 (15 April 2026) with Stage 2.6 amendment summary.
- §1 Design Decisions ESTAR row: completely rewritten — NOT IMPLEMENTED in
  libdedx v1.4.0 with explanation of `dedx.c:587` guard.
- §5 WASM Build Requirements: replaced `--embed-file data@data/` row with
  "(none)" entry explaining data compiled in; added EXPORTED_FUNCTIONS JSON
  format requirement row; updated output file sizes to measured values.
- §9 Q2 ESTAR: replaced "Resolution: Include" with "Resolution (revised):
  NOT IMPLEMENTED" — detailed runtime observations, UI handling requirements,
  note about future libdedx releases.
- Added new §10 "Runtime API Behaviour — Stage 2.6 Findings" with 7
  subsections: ALL-CAPS material names, empty electron name, ICRU (ID=9)
  exclusion, MSTAR ion list Z=2–18, DEFAULT coverage Z=1–112, runtime material
  counts per program, PSTAR H₂O reference STP confirmation.
- Old §10 (Thin C Wrappers) renumbered to §11; §4.5 cross-reference updated.

**3. `docs/04-feature-specs/entity-selection.md`**
- Bumped version to v6 (15 April 2026).
- Particle Selector "Special" row: rewritten — Electron is always greyed out
  (not greyed out only when ESTAR is incompatible). Added tooltip text.
- Auto-select resolution chain: Electron bullet rewritten — "N/A — ESTAR not
  implemented in libdedx v1.4.0."
- Acceptance criterion for Electron: rewritten to match always-greyed behaviour.
- Added Stage 2.6 particle-count clarification block to the Compatibility
  Matrix section: per-program ion counts table, MSTAR special case note.

**4. `docs/03-architecture.md`**
- `static/wasm/` directory tree: removed `libdedx.data` entry; added measured
  sizes to `.mjs` and `.wasm` entries; added "(no .data sidecar)" note.
- WASM init lifecycle diagram: updated fetch labels with measured sizes.
- `locateFile` paragraph: added sentence confirming no `.data` sidecar and
  referencing Stage 2.6 Phase 2 confirmation.
- Performance Considerations table, WASM binary size row: updated from
  "~1–3 MB + libdedx.data ~2–4 MB" to measured "457 KB + 13 KB (~200 KB
  gzip total)".

**5. `docs/11-prototyping-spikes.md`**
- Motivation table Spike 2 row: appended "Stage 2.6 supersedes" note.
- Added new "Stage 2.6: libdedx Data Source Investigation (Gate)" section
  before "Related Documents": status table, gate rule amendment for Stage 3,
  ESTAR implications, cross-references to investigation artefacts.

## Tasks

### Apply Stage 2.6 amendments to all affected documentation
- **Status:** completed
- **Stage:** 2.6 (post-investigation)
- **Files changed:**
  - `docs/decisions/003-wasm-build-pipeline.md`
  - `docs/06-wasm-api-contract.md`
  - `docs/04-feature-specs/entity-selection.md`
  - `docs/03-architecture.md`
  - `docs/11-prototyping-spikes.md`
  - `docs/ai-logs/2026-04-15-doc-amendments-stage26.md` (this file)
  - `docs/ai-logs/README.md`
  - `CHANGELOG-AI.md`
- **Decision:** Applied all 8 amendments from `VERDICT.md §2`. No new
  architectural decisions made — this session only synchronises documentation
  with verified runtime facts from Stage 2.6.
- **Issue:** None.
