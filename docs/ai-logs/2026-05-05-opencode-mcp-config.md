# 2026-05-05 — opencode MCP server configuration audit

## Session Narrative

### Prompt 1: Cross-check opencode AI configuration for MCP server usage

User asked to audit the opencode configuration (agents, skills, prompts) for MCP server
usage. Three MCP servers are configured: Playwright, Tailwind, and Svelte (via plugin).
Questions: are agents properly instructed to use them, and is Playwright MCP for
development-time browser control or for running E2E tests?

**AI response:**

Audited all relevant files: `opencode.json`, `AGENTS.md`, `.opencode/agents/implementer.md`,
`.opencode/agents/reviewer.md`, `.opencode/svelte.json`, `.opencode/prompts/run-feature.md`.

**Finding — Playwright MCP:** The user's intuition is correct. `@playwright/mcp@latest`
provides live browser-control tools (`browser_navigate`, `browser_screenshot`,
`browser_click`, etc.) to the AI agent for interactive visual verification during
development. It is entirely separate from `pnpm exec playwright test`, which runs the
project's E2E test suite in `tests/e2e/`. The old description ("Browser automation, E2E
test generation") was misleadingly close to the E2E test runner's description.

**Gaps identified:**
- Playwright MCP row in `AGENTS.md §5` did not clearly distinguish it from the E2E runner.
- Tailwind MCP row gave no instruction to actually query it (just "class reference").
- Neither Tailwind nor Playwright MCP was mentioned in the implementer agent prompt
  (`opencode.json`) or in `implementer.md` — both tools sat idle.
- Svelte MCP was already well-covered (explicit `svelte-autofixer` call instruction).
- `reviewer.md` and `run-feature.md` are intentionally unchanged (reviewer is diff-only).

**Changes made:**

1. **`AGENTS.md §5`** — expanded the Playwright and Tailwind table rows:
   - Playwright: now explicitly says "NOT the E2E test runner" and describes it as
     interactive browser control for visual verification during development.
   - Tailwind: now says "Query before writing utility classes — don't guess."

2. **`.opencode/agents/implementer.md`** — added a new "MCP tool usage" section before
   the Workflow steps, covering all three MCPs with concrete when-to-use guidance.
   The Playwright section gives a numbered workflow: start `pnpm dev` →
   `browser_navigate` → `browser_screenshot` → fix visuals → then run the test suite.

3. **`opencode.json` implementer prompt** — added an "Available MCP tools" paragraph
   directly in the active prompt text so the Qwen implementer sees it in-context,
   not only via the reference doc.

## Tasks

### Audit opencode MCP configuration and propose improvements

- **Status**: completed
- **Stage**: tooling
- **Files changed**:
  - `AGENTS.md`
  - `.opencode/agents/implementer.md`
  - `opencode.json`
- **Decision**: `reviewer.md` and `run-feature.md` left unchanged — reviewer is diff-only
  by design and should not use MCP tools; the orchestration template delegates MCP usage
  to the implementer.
- **Issue**: none
