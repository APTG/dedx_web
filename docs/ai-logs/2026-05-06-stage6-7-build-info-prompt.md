# 2026-05-06 — Stage 6.7 Build Info Badge — opencode prompt authoring

## Session Narrative

### Prompt 1: draft opencode prompt for Stage 6.7

User asked to identify the next task from `docs/00-redesign-plan.md` and draft
an opencode prompt file following the schema in `docs/opencode-prompt-authoring.md`.

**AI response**: Read the redesign plan and confirmed Stage 6.7 (Build Info
Badge) is the recommended next task — standalone with no dependencies.
Read `docs/04-feature-specs/build-info.md` Final v1, the reference prompt
`docs/ai-logs/prompts/2026-04-27-opencode-tasks.md`, and the existing footer
in `src/routes/+layout.svelte` (lines 205–212) to understand what already
exists. Noted that `base` from `$app/paths` is already imported in the layout
and must be prepended to the fetch URL for sub-path deploy correctness.
Produced `docs/ai-logs/prompts/2026-05-06-stage6-7-build-info-badge.md` with
3 tasks (deploy script, component, layout+CI wiring) following the canonical
schema.

### Prompt 2: add E2E tests and AI log

User asked to add proper E2E test instructions to the prompt and create the AI
session log.

**AI response**: Updated the prompt file to add Task 4 (Playwright E2E tests),
using `page.route()` to mock `/deploy.json` so tests are reliable without
requiring a real `static/deploy.json`. Added 6 test cases covering: correct
badge text, commit link href and `target="_blank"`, badge inside `<footer>`,
badge on multiple routes, 404 fallback (badge absent), malformed JSON fallback.
Added `expect.poll` pattern per the `.opencode/agents/implementer.md`
no-`waitForTimeout` rule. Updated MCP list and final checklist accordingly.
Created this session log, updated `CHANGELOG-AI.md` and `docs/ai-logs/README.md`.

## Tasks

### Draft opencode prompt for Stage 6.7

- **Status**: completed
- **Stage**: Stage 6.7 (from `docs/00-redesign-plan.md`)
- **Files changed**:
  - `docs/ai-logs/prompts/2026-05-06-stage6-7-build-info-badge.md` (created)
- **Decision**: Used `page.route()` for E2E mocking rather than relying on a
  physical `static/deploy.json` fixture — makes tests portable across machines
  and CI environments where the script hasn't been run yet.
- **Decision**: Structured as 4 tasks (deploy script → component → layout+CI →
  E2E) rather than 3, to give the implementer a clean commit boundary between
  the functional code and the Playwright suite.
