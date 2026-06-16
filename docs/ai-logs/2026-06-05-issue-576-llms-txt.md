# 2026-06-05 — Add llms.txt for LLM agents and web crawlers (Issue #576)

## Session Narrative

### Prompt 1: Work on issue 576, make a PR when ready

**AI response**: Issue #576 asks for an `llms.txt` at the repository root
following the [llmstxt.org](https://llmstxt.org/) spec, so that AI coding
agents and web-crawling LLMs get a concise entry point into the project
rather than ingesting the whole `docs/` tree.

Created `llms.txt` with:

- a one-paragraph project summary (Svelte 5, JSROOT, Emscripten WASM,
  client-side),
- a **Core technical constraints** block (Svelte 5 runes only, TS strict,
  Tailwind v4, shadcn-svelte + Bits UI, WASM only via the TS wrapper,
  Prettier / Conventional Commits),
- curated link sections for agent instructions (`CLAUDE.md`, `AGENTS.md`,
  `CHANGELOG-AI.md`), high-level docs, all 13 ADRs in `docs/decisions/`,
  feature specs, and an optional/roadmap section.

Updated `.github/workflows/deploy.yml` so the `Build SvelteKit app` step runs
`cp llms.txt build/llms.txt` after `pnpm build`. This copy-on-deploy approach
serves the file at the GitHub Pages root without relying on symlinks (which
break on Windows checkouts).

### Prompt 2: Watch the PR and address review comments

**AI response**: Subscribed to PR #707 activity. The Copilot reviewer raised
two points, both addressed:

1. **Relative links 404 when served from Pages** — the `docs/` tree is not
   deployed to GitHub Pages, so relative links in the file would resolve to
   `https://aptg.github.io/web_dev/docs/...` and 404 for web crawlers. Added an
   explicit note near the top instructing readers to resolve links against the
   canonical source repository (`https://github.com/APTG/dedx_web`) when the
   file is read from the deployed site. Kept the links relative so IDE plugins
   scanning a checkout (the primary audience) can open local files directly.
2. **Missing `**Log:**` line in `CHANGELOG-AI.md`** — added this session log
   file and linked it from the changelog entry to satisfy the documented entry
   format.

## Tasks

### Add `llms.txt` and wire it into the Pages deploy

- **Status**: completed
- **Stage**: Docs (Issue #576)
- **Files changed**: `llms.txt`, `.github/workflows/deploy.yml`,
  `CHANGELOG-AI.md`, `docs/ai-logs/2026-06-05-issue-576-llms-txt.md`,
  `docs/ai-logs/README.md`
- **Decision**: Copy `llms.txt` into `build/` during the deploy workflow rather
  than symlinking, to keep cross-platform compatibility. Links kept relative
  with an explicit "resolve against the source repo" note so the file works
  both in-repo (IDE plugins) and when crawled from the deployed site.
- **Issue**: The "live URL serves the file" acceptance criterion is only
  verifiable after merge, once the deploy workflow runs on `master`.
