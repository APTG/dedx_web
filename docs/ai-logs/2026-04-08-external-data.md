# 2026-04-08 — External Data

## Session Narrative

### Prompt 1: Add user-hosted external stopping-power/range data feature
**AI response**: Asked 15 clarifying questions across data model, file format, hosting, security, URL state, and scope. User answered all questions:
- Both stopping powers and CSDA ranges in the file.
- External dataset defines its own particles and materials.
- Appears as additional program(s) alongside built-in data.
- Each plot series uses its own native energy grid.
- File declares its own units for stopping power and range.
- HTTP Range Requests for partial reads.
- No caching across page loads.
- Document CORS as a hosting requirement.
- Full validation: structural, physics, and DoS limits.
- Visual distinction for external entities.
- Multiple `extdata` URL parameters supported.
- Blocking error when source unreachable.
- External URLs persisted in shared links.
- Spec now, implement later.
- Tooling spec included (Python CLI: `srim2webdedx`, `csv2webdedx`, `webdedx-inspect`).

### Prompt 2: Draft the spec
**AI response**: Created `docs/04-feature-specs/external-data.md` (Draft v1) with 14 sections covering:
- Binary `.webdedx` file format: 4-byte header-length prefix + JSON index header + contiguous Float64 table data.
- HTTP Range Request protocol for partial table fetching.
- `extdata` URL parameter contract (multiple sources, canonical ordering, ABNF extension).
- Entity merging + ID namespacing (`ext:{sourceIndex}:{entityId}`).
- Loading lifecycle with blocking errors and recovery actions.
- Structural validation, DoS size limits, and physics validation.
- UI treatment: 🔗 badges, "External" groups, dashed plot lines, source attribution panel.
- Calculator integration (log-log interpolation on external tables).
- Plot integration (native grid per series, dashed lines).
- Security: no code execution, input sanitization, CORS/mixed-content documentation.
- Converter tooling spec: YAML manifest → `.webdedx` binary.
- Acceptance criteria and cross-spec consistency checklist.

Also updated:
- Project vision `01-project-vision.md` with §4.7 "External / User-Hosted Data".
- Spec index `04-feature-specs/README.md` with new "Later-Stage Specs" section.
- Changelog and AI log index.

## Tasks

### External Data Spec Draft v1
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications (implementation deferred)
- **Files changed**:
  - `docs/04-feature-specs/external-data.md` (created)
  - `docs/01-project-vision.md`
  - `docs/04-feature-specs/README.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-04-08-external-data.md` (created)
- **Decision**: Separate spec file (not folded into existing specs) because external data introduces new concerns: network I/O, binary file format, CORS, trust model, converter tooling.
- **Decision**: Binary container with JSON index header + Float64 table data, accessed via HTTP Range Requests. Chosen over directory-of-files for single-URL simplicity and efficient partial reads.
- **Decision**: String-based entity IDs with `ext:{sourceIndex}:{entityId}` namespacing to avoid collision with libdedx's numeric IDs.
- **Decision**: Auto-select never resolves to external programs — users must explicitly choose external data.
- **Decision**: External series rendered as dashed lines; external entities marked with 🔗 icon in selectors.
- **Issue**: Material matching heuristic (exact name vs formula vs density) left as open question for future refinement.

### External Data: Custom Format → Apache Parquet (Draft v2)
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/external-data.md`
  - `docs/01-project-vision.md`
  - `docs/04-feature-specs/README.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-04-08-external-data.md`
- **Decision**: Replaced the custom binary container (4-byte length prefix + JSON header + Float64 arrays) with standard Apache Parquet. Rationale: avoids reinventing a binary format, gives users free inspection via DuckDB/Pandas/PyArrow, simplifies converter tooling (thin PyArrow wrappers), and `hyparquet` provides ~15 KB pure-JS reader with native Range Request support.
- **Decision**: Chose `hyparquet` over Apache Arrow JS (~200 KB) and h5wasm (~1 MB WASM) for minimal bundle size in a browser-first app.
- **Decision**: File extension `.webdedx.parquet` — keeps project branding while being recognizable as standard Parquet.
