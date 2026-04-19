# Session log: vendor submodules + opencode setup

**Date:** 2026-04-19  
**Model:** Claude Sonnet 4.6 via Claude Code  
**Branch:** `copilot/update-documentation-state-review`

---

## What was asked

Two consecutive prompts expanding on the previous session's documentation work:

**Prompt 1:** Generate `AGENTS.md` for Qwen/opencode; add git submodules for
jsroot, zarrita/emscripten "or others" so Qwen can read docs offline; create
missing `05-ui-wireframes.md`, `07-testing-strategy.md`, `08-deployment.md`
(big-picture text + links to specs/ADRs).

**Prompt 2:** Check if other libraries (Svelte) should be added; rename
`LIBRARIES.md` → `README.md` in vendor/; add Svelte submodule; configure
Svelte MCP (`sveltejs/ai-tools`) in opencode; assess Tailwind MCP and
Playwright MCP.

---

## What was done

### Submodules added (all `shallow = true` in `.gitmodules`)

| Submodule | Repo | Size | Purpose |
|-----------|------|------|---------|
| `vendor/jsroot` | root-project/jsroot | ~20 MB | JSROOT 7 TypeScript types + docs |
| `vendor/zarrita` | manzt/zarrita.js | ~3 MB | zarrita 0.7.x TypeScript source |
| `vendor/svelte-ai-tools` | sveltejs/ai-tools | ~5 MB | `@sveltejs/opencode` plugin source |
| `vendor/svelte` | sveltejs/svelte | 52 MB | Svelte 5 source + full documentation |

**Emscripten** not added as submodule — working tree is ~200 MB even at
depth=1. Key flags already documented in ADR 003; changelog already in
`docs/resources/emscripten-changelog.md`.

### New files created

| File | Purpose |
|------|---------|
| `vendor/README.md` | Full index of vendor submodules (renamed from LIBRARIES.md) |
| `AGENTS.md` | opencode/Qwen entry point: docs index, Svelte 5 rules, vendor reference, MCP guide, provider setup |
| `opencode.json` | Per-repo opencode config: PLGrid provider (env vars), `@sveltejs/opencode` plugin, Tailwind + Playwright MCPs |
| `.opencode/svelte.json` | Svelte plugin config: remote MCP, subagent enabled, both skills |
| `docs/05-ui-wireframes.md` | Big-picture UI layout with links to per-spec wireframes |
| `docs/07-testing-strategy.md` | Test pyramid (Vitest + Playwright + axe-core) with links to per-spec AC |
| `docs/08-deployment.md` | Deployment pipeline (GitHub Pages, WASM build, CI) with links to ADRs |

### `.gitignore` updated

Added `!.opencode/svelte.json` exception — session state in `.opencode/`
stays ignored, but the committed svelte plugin config is tracked.

### `docs/00-redesign-plan.md` updated

- §4 file tree updated to include `05-ui-wireframes.md`, `07-testing-strategy.md`,
  `08-deployment.md`, and a note about `vendor/` submodules + `AGENTS.md`.
- §4.2 setup checklist updated: opencode.json and AGENTS.md items marked ✅ with
  links; model id updated to `Qwen/Qwen3.5-397B-A17B-FP8`.

---

## MCP server decisions

| MCP | Decision | Reason |
|-----|----------|--------|
| Svelte (`@sveltejs/opencode` plugin) | ✅ Configured via plugin in `opencode.json` | Provides `svelte-autofixer` (Svelte 4→5 detection), `svelte-file-editor` subagent, doc search |
| Tailwind CSS (`tailwindcss-mcp-server`) | ✅ Configured via npx in `opencode.json` | Class lookup for Tailwind v4 |
| Playwright (`@playwright/mcp`) | ✅ Configured via npx in `opencode.json` | E2E test generation, browser automation |
| Svelte local submodule (`vendor/svelte`) | ✅ Added | Offline fallback for PLGrid sessions (no internet); `documentation/docs/02-runes/` and `99-legacy/` are the key sections |

**PLGrid offline caveat:** The Svelte MCP server at `mcp.svelte.dev` is
unreachable from PLGrid compute nodes (egress restricted). For PLGrid Qwen
sessions, the local `vendor/svelte/documentation/` docs replace the MCP server.
Tailwind and Playwright MCPs are also unavailable unless packages are pre-cached.

---

## Key finding: sveltejs/ai-tools structure

The `sveltejs/ai-tools` repo is a monorepo with two delivery modes:
1. **Remote HTTP** — production at `https://mcp.svelte.dev/mcp` (used by default)
2. **Local stdio** — `packages/mcp-stdio/` publishes `@sveltejs/mcp` to npm;
   runnable via `npx @sveltejs/mcp@latest` or via `mcp.type: "local"` in
   `.opencode/svelte.json`

The `@sveltejs/opencode` package (`packages/opencode/`) is the opencode plugin
that wires both modes automatically based on the `svelte.json` config.

The production server requires Turso DB + Voyage AI embeddings — not suitable
for local self-hosting. Use `mcp.type: "local"` if internet is available but
mcp.svelte.dev is blocked.
