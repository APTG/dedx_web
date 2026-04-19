# Vendor Library Reference

Shallow git submodules for third-party libraries used in dEdx Web.
AI coding agents (Qwen via opencode, Copilot, Claude) can read source,
TypeScript types, and documentation **locally** without web access —
important for offline environments such as PLGrid llmlab sessions.

---

## jsroot — `vendor/jsroot/`

**What:** JSROOT 7 — the CERN physics plotting library. Used for `TGraph` /
`TMultiGraph` log-log plots.

| Resource | Path |
|----------|------|
| README | [jsroot/readme.md](jsroot/readme.md) |
| Full API narrative | [jsroot/docs/JSROOT.md](jsroot/docs/JSROOT.md) |
| TypeScript types | [jsroot/types.d.ts](jsroot/types.d.ts) |
| Changelog | [jsroot/changes.md](jsroot/changes.md) |

**Project integration:** [ADR 002](../docs/decisions/002-keep-jsroot.md),
[architecture §5](../docs/03-architecture.md),
[Spike 1](../docs/11-prototyping-spikes.md).

---

## zarrita — `vendor/zarrita/`

**What:** zarrita.js 0.7.x — Zarr v3 TypeScript reader, zero dependencies.
Used to read `.webdedx` stores (per-ion shards) via HTTP Range Requests.

| Resource | Path |
|----------|------|
| README | [zarrita/packages/zarrita/README.md](zarrita/packages/zarrita/README.md) |
| `open()` API | [zarrita/packages/zarrita/src/open.ts](zarrita/packages/zarrita/src/open.ts) |
| Codec definitions (LZ4) | [zarrita/packages/zarrita/src/codecs/](zarrita/packages/zarrita/src/codecs/) |
| FetchStore | [zarrita/packages/@zarrita-storage/](zarrita/packages/@zarrita-storage/) |
| Index exports | [zarrita/packages/zarrita/src/index.ts](zarrita/packages/zarrita/src/index.ts) |

**Project integration:** [ADR 004](../docs/decisions/004-zarr-v3-external-format.md),
[external-data.md](../docs/04-feature-specs/external-data.md).

---

## svelte — `vendor/svelte/`

**What:** Svelte 5 monorepo — TypeScript source + full documentation.
Added specifically to help AI agents avoid Svelte 4 → 5 migration pitfalls
(runes vs `export let`, `$effect` vs `onMount`, etc.) in offline environments.

| Resource | Path |
|----------|------|
| README | [svelte/README.md](svelte/README.md) |
| **Runes docs** (Svelte 5) | [svelte/documentation/docs/02-runes/](svelte/documentation/docs/02-runes/) |
| Legacy patterns (Svelte 4) | [svelte/documentation/docs/99-legacy/](svelte/documentation/docs/99-legacy/) |
| Template syntax | [svelte/documentation/docs/03-template-syntax/](svelte/documentation/docs/03-template-syntax/) |
| Runtime / lifecycle | [svelte/documentation/docs/06-runtime/](svelte/documentation/docs/06-runtime/) |
| Reference | [svelte/documentation/docs/98-reference/](svelte/documentation/docs/98-reference/) |
| Core TypeScript source | [svelte/packages/svelte/src/](svelte/packages/svelte/src/) |

**Key files for Svelte 4 vs 5 disambiguation:**

| Topic | File |
|-------|------|
| What are runes? | [02-runes/01-what-are-runes.md](svelte/documentation/docs/02-runes/01-what-are-runes.md) |
| `$state` | [02-runes/02-$state.md](svelte/documentation/docs/02-runes/02-$state.md) |
| `$derived` | [02-runes/03-$derived.md](svelte/documentation/docs/02-runes/03-$derived.md) |
| `$effect` (replaces `onMount`) | [02-runes/04-$effect.md](svelte/documentation/docs/02-runes/04-$effect.md) |
| `$props` (replaces `export let`) | [02-runes/05-$props.md](svelte/documentation/docs/02-runes/05-$props.md) |
| Legacy `export let` (Svelte 4) | [99-legacy/03-legacy-export-let.md](svelte/documentation/docs/99-legacy/03-legacy-export-let.md) |
| Legacy `$:` reactive (Svelte 4) | [99-legacy/02-legacy-reactive-assignments.md](svelte/documentation/docs/99-legacy/02-legacy-reactive-assignments.md) |

**Note:** When internet is available, the `@sveltejs/opencode` plugin (configured
in `opencode.json`) provides a live MCP server with semantic doc search and the
`svelte-autofixer` tool — superior to reading static files. Use the local docs
when running offline (e.g., PLGrid llmlab).

---

## svelte-ai-tools — `vendor/svelte-ai-tools/`

**What:** The official Svelte AI tooling monorepo by the Svelte core team.
Contains the `@sveltejs/opencode` plugin used in `opencode.json`.

| Resource | Path |
|----------|------|
| README | [svelte-ai-tools/README.md](svelte-ai-tools/README.md) |
| opencode plugin README | [svelte-ai-tools/packages/opencode/README.md](svelte-ai-tools/packages/opencode/README.md) |
| MCP server implementation | [svelte-ai-tools/packages/mcp-server/src/](svelte-ai-tools/packages/mcp-server/src/) |
| stdio transport binary | [svelte-ai-tools/packages/mcp-stdio/](svelte-ai-tools/packages/mcp-stdio/) |
| CLAUDE.md (dev setup) | [svelte-ai-tools/apps/mcp-remote/CLAUDE.md → ](svelte-ai-tools/CLAUDE.md) |

**opencode plugin features** (configured via `opencode.json` + `.opencode/svelte.json`):
- `list-sections` — find Svelte 5 doc sections
- `get-documentation` — retrieve full doc content for a section
- `svelte-autofixer` — analyze Svelte code, detect Svelte 4 patterns, suggest Svelte 5 fixes
- `playground-link` — generate Svelte Playground links
- `svelte-file-editor` subagent — auto-used when editing `.svelte` / `.svelte.ts` files

**MCP endpoint:** `https://mcp.svelte.dev/mcp` (requires internet — not available on PLGrid).

---

## Emscripten — no submodule (too large)

The emscripten-core/emscripten repository is ~200 MB at depth-1. Not worth
adding as a submodule; relevant docs are already in the project:

| Resource | Path |
|----------|------|
| Emscripten version changelog | [docs/resources/emscripten-changelog.md](../docs/resources/emscripten-changelog.md) |
| WASM build ADR (flags, pipeline) | [docs/decisions/003-wasm-build-pipeline.md](../docs/decisions/003-wasm-build-pipeline.md) |
| Legacy build script | [build_wasm.sh](../build_wasm.sh) |

Key compiler flags used in this project: `EXPORT_ES6=1`, `MODULARIZE=1`,
`ENVIRONMENT=web`, `-sFILESYSTEM=0`. Online reference: `src/settings.js` in
`emscripten-core/emscripten`.

---

## MCP servers (no submodule — run via npx)

Configured in [`opencode.json`](../opencode.json):

| MCP server | npx package | Purpose |
|-----------|-------------|---------|
| Svelte | `@sveltejs/opencode` plugin | Svelte 5 docs, autofixer, file-editor subagent |
| Tailwind CSS | `tailwindcss-mcp-server` | Tailwind v4 class lookup, config reference |
| Playwright | `@playwright/mcp` | Browser automation, E2E test generation |
