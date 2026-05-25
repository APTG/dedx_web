# 2026-05-25 — Issue #563: Spec updates + 7 ADRs + formatting guideline

## Session Narrative

### Prompt 1: Work on issue #563; add formatting guideline to AI instruction files

**AI response**: Read issue #563 (docs and ADR sweep), reviewed all four spec
files to be updated, examined existing ADR format in `docs/decisions/`, and
checked all three AI instruction files (CLAUDE.md, AGENTS.md,
copilot-instructions.md).

Added a `pnpm format` before-commit rule to all three AI instruction files so
that Claude Code, opencode/Qwen, GitHub Copilot, and Antigravity all format
markdown files (especially CHANGELOG-AI.md) before committing.

Created 7 ADRs (007–013) in `docs/decisions/`:

- 007: Drop Columns Dropdown — picker membership = column presence
- 008: Drop Unit Button Between Picker and Results — replaced by unit-anchor-strip
- 009: No Autofocus on Cold Load — result-viewer page, not input form
- 010: Inline Unit Grammar — whitespace-tolerant, case-insensitive, ASCII-only, 15-token
- 011: Compare-Across Visible Strip — 4-button pill radiogroup in Advanced toolbar
- 012: Inverse STP Sticky High-E Default — high-E first, low-E reveals on ambiguous rows
- 013: Mode Tab Naming — Energy → / Range → / STP → with desktop sublabels

Updated four spec docs to match shipped Stage 8 behaviour:

- `calculator.md` v9: added §Defaults, §Modes (tab names with ADR 013 link),
  updated §2 (unit-anchor strip, ADR 008 link), updated URL State section to v2
  params, cross-linked ADRs 009–010.
- `multi-program.md` v4: replaced `qfocus=` (3-state) with `qshow=` (2-state),
  removed `hidden_programs=` from URL table and state model, removed Columns…
  dropdown section (replaced with Column Membership note + ADR 007 link),
  updated wireframe, updated all acceptance criteria.
- `export.md` v7: clarified that `qshow=` is presentation-only and CSV always
  exports both quantity groups regardless. Added ADR 006 cross-link.
- `entity-selection.md`: replaced the outdated "Compare across: dropdown" bullet
  with the shipped 4-button compare-across strip description + ADR 011 link.

Ran `pnpm format` before committing; `pnpm run format:check` passes (0 issues).

## Tasks

### Add formatting guideline to AI instruction files

- **Status**: completed
- **Stage**: Infra / project conventions
- **Files changed**: `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- **Decision**: Used `pnpm format` as the canonical command (prettier --write .)
  with `pnpm run format:check` for verification. The user's original phrasing
  `pnpm run format:check --write` passes extra args to prettier; the cleaner
  documented form is `pnpm format`.

### Create 7 ADRs

- **Status**: completed
- **Stage**: Docs / Stage 8
- **Files changed**:
  - `docs/decisions/007-drop-columns-dropdown.md`
  - `docs/decisions/008-drop-unit-button-between-picker-and-results.md`
  - `docs/decisions/009-no-autofocus-on-cold-load.md`
  - `docs/decisions/010-inline-unit-grammar.md`
  - `docs/decisions/011-compare-across-visible-strip.md`
  - `docs/decisions/012-inverse-stp-sticky-high-e-default.md`
  - `docs/decisions/013-mode-tab-naming.md`
- **Decision**: Used `docs/decisions/` (not `docs/05-adr/` as mentioned in the
  issue) for consistency with the six existing ADRs.

### Update spec docs

- **Status**: completed
- **Stage**: Docs / Stage 8
- **Files changed**:
  - `docs/04-feature-specs/calculator.md` (v8 → v9)
  - `docs/04-feature-specs/multi-program.md` (v3 → v4)
  - `docs/04-feature-specs/export.md` (v6 → v7)
  - `docs/04-feature-specs/entity-selection.md` (compare-across strip section)
- **Issue**: `spec-calculator-v2.md` was not found in the repo root; the
  acceptance criterion "move or mark as superseded" is already satisfied
  (the file was never committed or was already removed before this session).
