# 2026-05-25 — Changelog Bullet Format Migration

## Session Narrative

### Prompt 1: Fix new PR review comment about changelog formatting instability

**AI response**: Investigated the referenced CI/static-analysis failure with GitHub Actions tools and confirmed the failing step was `prettier --check .`, specifically flagging `CHANGELOG-AI.md`. Then migrated `CHANGELOG-AI.md` from a fragile markdown table to a bullet-list structure to avoid table-separator drift and markdown-column corruption during formatting.

### Prompt 2: Update agent instructions to use the new format

**AI response**: Updated AI-facing instruction documents to replace "row in table" guidance with "prepend bullet entry" guidance and provided explicit bullet templates in the docs so future AI sessions produce formatter-stable changelog edits.

## Tasks

### Migrate changelog structure

- **Status**: completed
- **Stage**: Stage 8 / docs maintenance
- **Files changed**: `CHANGELOG-AI.md`
- **Decision**: Chose a simple bullet list (`date + stage + summary + log`) to eliminate table parsing/separator problems that repeatedly break `pnpm run format:check`.
- **Issue**: None.

### Sync AI instruction docs with new changelog contract

- **Status**: completed
- **Stage**: Stage 8 / docs maintenance
- **Files changed**: `.github/copilot-instructions.md`, `CLAUDE.md`, `AGENTS.md`, `docs/opencode-setup.md`, `docs/00-redesign-plan.md`, `.opencode/lessons-learned.md`
- **Decision**: Updated all direct changelog-format instructions and conflict-resolution guidance so tooling and contributors use one consistent format.
- **Issue**: None.
