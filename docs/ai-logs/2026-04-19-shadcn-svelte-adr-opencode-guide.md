# Session log: shadcn-svelte ADR + opencode setup guide

**Date:** 2026-04-19  
**Model:** Claude Sonnet 4.6 via Claude Code  
**Branch:** `copilot/update-documentation-state-review`

---

## What was asked

1. Create a short ADR for the shadcn-svelte decision.
2. Add needed repos as submodules or MCP servers so opencode works easily with
   shadcn-svelte.
3. Add a README/guide explaining how to configure opencode for this project
   and how to set up all tools.

Additionally: switch Svelte MCP to `type: "local"` (user wants to run the
server locally, not connect to `mcp.svelte.dev`).

---

## What was done

### `.opencode/svelte.json` updated

Changed `"mcp": { "type": "remote" }` → `"type": "local"`. The
`@sveltejs/opencode` plugin now runs `npx @sveltejs/mcp@latest` as a local
stdio process — no internet connection required for the Svelte MCP.

### New submodules added (`shallow = true`)

| Submodule | Repo | Size | Key content |
|-----------|------|------|-------------|
| `vendor/shadcn-svelte` | huntabyte/shadcn-svelte | 36 MB | Component templates, CLI source, registry |
| `vendor/bits-ui` | huntabyte/bits-ui | 11 MB | 44 headless primitive components |

### New files

| File | Purpose |
|------|---------|
| `docs/decisions/005-shadcn-svelte-components.md` | ADR — why shadcn-svelte, alternatives rejected, integration plan per stage |
| `docs/opencode-setup.md` | Full setup guide: prerequisites, env vars, all MCP servers, session workflow, troubleshooting |

### Files updated

| File | Change |
|------|--------|
| `vendor/README.md` | Added shadcn-svelte and bits-ui sections with component tables |
| `AGENTS.md` | Added shadcn-svelte + bits-ui to vendor table; added §7 linking to setup guide |
| `docs/README.md` | Added `opencode-setup.md` entry |
| `docs/00-redesign-plan.md` | ADR list updated with ADR 005 |
| `.gitmodules` | `shallow = true` added for both new submodules |

---

## ADR 005 summary

**Decision:** Adopt shadcn-svelte + Bits UI as the UI component library.

**Key reasons:**
- All needed components already exist (Combobox, Accordion, Dialog, Table,
  Dropdown, Toast) and are WCAG 2.1 AA compliant via Bits UI primitives
- Tailwind already in stack — no new styling system
- Ownership model: components are copied into project, not a runtime import
- Svelte 5 + Bits UI v1.0 compatible
- AI agents have local source in `vendor/shadcn-svelte/` + `vendor/bits-ui/`

**shadcn MCP clarification:** The `shadcn` MCP server (`ui.shadcn.com/docs/mcp`)
is React-only. Running `pnpm dlx shadcn@latest mcp init` does not apply to this
project. The Svelte MCP (`svelte-autofixer`) handles Svelte component guidance.

---

## opencode setup guide scope

`docs/opencode-setup.md` covers:
1. Prerequisites (opencode, Node 24, pnpm, Docker)
2. Clone with `--recurse-submodules`
3. PLGrid env vars (`PLGRID_LLMLAB_BASE_URL`, `PLGRID_LLMLAB_API_KEY`)
4. All three MCP servers (Svelte local, Tailwind npx, Playwright npx)
5. shadcn MCP clarification (React-only, not applicable)
6. Starting a session, selecting the Qwen model
7. Branch naming (`qwen/<stage-or-feature>`)
8. Mandatory session logging
9. Key files to read at session start
10. Troubleshooting (env vars, npx failures, missing submodules)
