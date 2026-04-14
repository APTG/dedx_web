# 2026-04-14 — Spike 2: WASM `--preload-file` on SvelteKit Static Adapter

## Session Narrative

### Prompt 1: Run Spike 2 (wasm-preload) prototype
**AI response**: Claude Sonnet 4.6 implemented Spike 2 on branch `spike/wasm-preload`
exactly as specified in `docs/11-prototyping-spikes.md §Spike 2`. Steps taken:

**Step 1 — WASM builds (Docker, emscripten/emsdk:5.0.5):**
- Built `libdedx.a` from the `libdedx/` submodule (v1.4.0) using `emcmake cmake`
  inside the Docker image.
- Built `preload/libdedx.{mjs,wasm,data}` with `--preload-file /src/libdedx/data@/data`.
- Built `embed/libdedx.{mjs,wasm}` with `--embed-file /src/libdedx/data@/data`.
- Both builds required the `libdedx.a` path to be given as an absolute path
  (`/src/output/libdedx.a`) rather than a relative one.
- Both builds required adding `HEAP32` to `EXPORTED_RUNTIME_METHODS` (see below).

**Step 2 — SvelteKit app:**
- Scaffolded with `pnpm dlx sv create app --template minimal --types ts`.
- Installed `@sveltejs/adapter-static`.
- Wrote `svelte.config.js` with `adapter-static` and `BASE_PATH` env var support.
- Added `src/routes/+layout.ts` with `export const prerender = true` (required
  for static adapter).
- Copied `preload/libdedx.{mjs,wasm,data}` to `app/static/wasm/`.
- Implemented `app/src/routes/+page.svelte` with `locateFile` override.

**Step 3 — Testing (headless Playwright/Chromium):**
- `pnpm dlx serve` chose random ports, ignoring `-l 4000`; switched to
  `python3 -m http.server` for reliable port binding.
- Installed Playwright and Chromium headless shell to automate all three
  scenarios.

**Scenario A (dev server, port 5174):** `pnpm dev` — 10 programs loaded, all
WASM assets HTTP 200, no CORS errors.

**Scenario B (static root, port 4000):** `pnpm build` + `python3 -m http.server`
— 10 programs loaded, `libdedx.data` served as `application/octet-stream`, no
CORS errors.

**Scenario C (sub-path `/dedx_web/`, port 4001):** `BASE_PATH=/dedx_web pnpm build`
+ files copied to `/tmp/ghpages/dedx_web/` and served — 10 programs loaded,
`locateFile` correctly produced `http://…/dedx_web/wasm/libdedx.data`, no CORS
errors.

## Tasks

### Spike 2 — WASM `--preload-file` on SvelteKit Static Adapter
- **Status**: completed
- **Stage**: 2.5
- **Branch**: `spike/wasm-preload`
- **Files changed**:
  - `prototypes/wasm-preload/.gitignore`
  - `prototypes/wasm-preload/VERDICT.md`
  - `prototypes/wasm-preload/app/svelte.config.js`
  - `prototypes/wasm-preload/app/src/routes/+layout.ts`
  - `prototypes/wasm-preload/app/src/routes/+page.svelte`
  - `prototypes/wasm-preload/app/static/wasm/libdedx.{mjs,wasm,data}`
  - (scaffolding: `package.json`, `pnpm-lock.yaml`, etc.)
- **Finding: `HEAP32` must be in `EXPORTED_RUNTIME_METHODS`.** The spec's
  `+page.svelte` accesses `module.HEAP32` directly. The original Emscripten
  flags in ADR 003 do not include `HEAP32`; it must be added explicitly:
  `"EXPORTED_RUNTIME_METHODS=[ccall,cwrap,UTF8ToString,HEAP32]"`. This is a
  correction to the loader pattern, not to the `--preload-file` mechanism.
- **Finding: `pnpm dlx serve` ignores port arguments.** The `serve` package
  (v14+) assigns random ports regardless of `-l`/`--listen`/`-p` flags in this
  environment. Use `python3 -m http.server PORT --bind 127.0.0.1` as a reliable
  alternative for local static serving tests.
- **Finding: `.data` MIME type is acceptable.** Vite dev server returns no
  content-type for `.data` files; Python's http.server returns
  `application/octet-stream`. Emscripten's runtime fetches the file as a binary
  blob and does not check the MIME type, so both are fine.
- **Verdict**: All 6 acceptance criteria PASS. `--preload-file` works correctly
  in all three deployment scenarios. ADR 003 requires no amendment.
