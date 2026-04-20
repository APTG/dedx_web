# opencode Setup Guide for dEdx Web

This guide walks through configuring [opencode](https://opencode.ai) to work
with the dEdx Web project, including all MCP servers and the PLGrid Qwen model.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| opencode | latest | `npm install -g opencode-ai` or see [opencode.ai](https://opencode.ai) |
| Node.js | 24 LTS | [nodejs.org](https://nodejs.org) or `nvm install 24` |
| pnpm | 9+ | `npm install -g pnpm` |
| Docker | 24+ | Required only for WASM builds (Stage 3+) |
| Git | 2.38+ | For sparse submodule support |

Verify:
```sh
opencode --version
node --version   # should print v24.x
pnpm --version   # should print 9.x
```

---

## 1. Clone the repo with submodules

```sh
git clone --recurse-submodules https://github.com/APTG/web_dev.git dedx_web
cd dedx_web
pnpm install
```

If you cloned without `--recurse-submodules`:
```sh
git submodule update --init --recursive
```

### What the vendor submodules provide

See [`vendor/README.md`](../vendor/README.md) for the full index. Summary:

| Submodule | Purpose for AI agents |
|-----------|----------------------|
| `vendor/jsroot` | JSROOT 7 TypeScript types + API narrative |
| `vendor/zarrita` | zarrita 0.7.x source (Zarr v3 reader) |
| `vendor/svelte` | Svelte 5 docs (`documentation/docs/`) including runes + legacy guide |
| `vendor/svelte-ai-tools` | `@sveltejs/opencode` plugin source |
| `vendor/shadcn-svelte` | shadcn-svelte component templates |
| `vendor/bits-ui` | Bits UI headless primitive source |

---

## 2. Set environment variables

Create a `.env.local` file at the repo root (gitignored) **or** export in your
shell. Never commit credentials.

```sh
# PLGrid llmlab — OpenAI-compatible endpoint for Qwen3.5
export PLGRID_LLMLAB_BASE_URL="https://<plgrid-llmlab-endpoint>/v1"
export PLGRID_LLMLAB_API_KEY="your-plgrid-api-key"
```

Verify the endpoint URL and model name against the current PLGrid llmlab
documentation — the model id `Qwen/Qwen3.5-397B-A17B-FP8` was confirmed in
the Spike 1 and Spike 3 logs (April 2026); it may have been updated since.

---

## 3. MCP servers

`opencode.json` (committed at repo root) configures all MCP servers
automatically. You do not need to edit it for standard use.

### 3.1 Svelte MCP (local, via `@sveltejs/opencode` plugin)

The `@sveltejs/opencode` plugin is declared in `opencode.json`. For standard
use, opencode runs the Svelte MCP server as a local stdio process via
`npx @sveltejs/mcp@latest` — no external connection required.

**What it provides:**
- `list-sections` — find Svelte 5 documentation sections
- `get-documentation` — retrieve full doc for a section
- `svelte-autofixer` — analyse `.svelte` code, detect Svelte 4 patterns
- `playground-link` — generate Svelte Playground links
- `svelte-file-editor` subagent — automatically used when editing `.svelte` /
  `.svelte.ts` files

**No setup needed** — opencode downloads and caches `@sveltejs/mcp` on first run.

**Offline / PLGrid fallback:** If `npx` cannot reach npm (e.g., on a PLGrid
compute node), read Svelte 5 docs directly from
`vendor/svelte/documentation/docs/02-runes/` and the legacy guide from
`vendor/svelte/documentation/docs/99-legacy/`.

### 3.2 Tailwind MCP (`tailwindcss-mcp-server`)

Configured in `opencode.json` as an `npx` invocation. Provides Tailwind v4
class lookup and configuration reference.

**No setup needed** — opencode runs it via `npx -y tailwindcss-mcp-server`.

### 3.3 Playwright MCP (`@playwright/mcp`)

Configured in `opencode.json` as an `npx` invocation. Provides browser
automation and E2E test generation.

**First-time setup** (install Playwright and its browsers):
```sh
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

### 3.4 shadcn MCP — not applicable

The official `shadcn` MCP server (`ui.shadcn.com/docs/mcp`) is React-only and
does not support shadcn-svelte. Do not run `pnpm dlx shadcn@latest mcp init`.
The Svelte MCP (`svelte-autofixer`) and the `vendor/shadcn-svelte/` submodule
already give AI agents the component context they need.

---

## 4. Start a session

```sh
cd /path/to/dedx_web
opencode
```

opencode reads `opencode.json` automatically and loads `AGENTS.md` as context.

### Selecting the Qwen model

In the opencode UI, select the **PLGrid** provider and the
`Qwen/Qwen3.5-397B-A17B-FP8` model. 

---

## 5. Branch naming for Qwen sessions

Per [`docs/00-redesign-plan.md §4.2`](00-redesign-plan.md):

```sh
git checkout -b qwen/<stage-or-feature>
# e.g.
git checkout -b qwen/stage-4-sveltekit
git checkout -b qwen/feature-calculator
```

Time-box each attempt (suggested: one working day per stage). If the branch
does not pass `pnpm lint && pnpm test && pnpm build` within the time-box,
abandon and resume on `master` with Copilot.

---

## 6. Mandatory session logging

Every opencode session **must** produce:

1. A new row at the top of `CHANGELOG-AI.md`:
   ```
   | YYYY-MM-DD | <stage> | <description> (opencode + Qwen3.5-397B) | [log](...) |
   ```
2. A session log at `docs/ai-logs/YYYY-MM-DD-<slug>.md`.

See `.github/copilot-instructions.md § AI Session Logging` for the exact format.
The `(opencode + Qwen3.5-397B)` attribution in every entry is **mandatory**.

---

## 7. Key project files to read at session start

opencode loads `AGENTS.md` automatically. That file points to:

1. `.github/copilot-instructions.md` — stack, Svelte 5 rules, build commands
2. `docs/00-redesign-plan.md` — full project plan
3. `docs/progress/` — completed stages (check before starting new work)
4. `CHANGELOG-AI.md` — recent AI session history

The most common mistake is writing Svelte 4 patterns (`export let`, `$:`,
`createEventDispatcher`). If the Svelte MCP is available, call
`svelte-autofixer` on every `.svelte` file before committing.

---

## 8. Troubleshooting

### `@sveltejs/mcp` npx download fails

Check internet connectivity. On PLGrid compute nodes, npm registry may be
blocked — use `vendor/svelte/documentation/` as the offline fallback and
remove the `@sveltejs/opencode` plugin from `opencode.json` temporarily.

### Playwright MCP errors: browsers not installed

`@playwright/test` must be installed before the browsers can be downloaded:

```sh
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

If `--with-deps` fails with exit code 100 (common on Linux Mint due to an unrelated apt repo GPG issue), skip it — Playwright's bundled Chromium is self-contained:

```sh
pnpm exec playwright install chromium
```

On Linux Mint 22.x the installer prints `BEWARE: your OS is not officially supported … ubuntu24.04-x64 fallback` — this is expected and harmless; Mint 22 is based on Ubuntu 24.04.

### Submodules missing / empty

```sh
git submodule update --init --recursive
```

### opencode version mismatch with `opencode.json` schema

```sh
npm install -g opencode-ai@latest
```
