# Spike 2: WASM `--preload-file` on SvelteKit Static Adapter — Verdict

**Date:** 2026-04-14
**Emscripten version:** emsdk 5.0.5
**libdedx version:** v1.4.0 (git submodule)

## Build Artifact Sizes

| Build | libdedx.mjs | libdedx.wasm | libdedx.data |
|-------|------------|-------------|-------------|
| `--preload-file` | 153 KB | 15 KB | 1.5 MB (sidecar) |
| `--embed-file` | 146 KB | 1.5 MB | (none — embedded in .wasm) |

Note: `--preload-file` keeps the data as a separate `.data` sidecar fetched at runtime.
`--embed-file` bakes the data into the `.wasm` binary itself.

## Build Correction

The spike spec's `EXPORTED_RUNTIME_METHODS` list omitted `HEAP32`, which the
`+page.svelte` test code accesses directly (`module.HEAP32.buffer`). The final
build command adds `HEAP32` to the list:

```
-s "EXPORTED_RUNTIME_METHODS=[ccall,cwrap,UTF8ToString,HEAP32]"
```

This is a minor fix to the loader pattern; the `locateFile` override and
`--preload-file` mechanism itself worked exactly as specified in ADR 003.

## Test Results

### Scenario A — Dev server (`pnpm dev`, root path, port 5174)

- `libdedx.mjs`: HTTP 200, `text/javascript`
- `libdedx.wasm`: HTTP 200, `application/wasm`
- `libdedx.data`: HTTP 200, `(no content-type — Vite omits it for unknown extensions)`
- `locateFile` produced: `http://127.0.0.1:5174/wasm/libdedx.data` ✓
- Programs loaded: **10** (ASTAR, PSTAR, ESTAR, MSTAR, ICRU73_OLD, ...)
- No CORS errors, no console errors

### Scenario B — Static build, root path (`python3 -m http.server 4000`)

- `libdedx.mjs`: HTTP 200, `text/javascript`
- `libdedx.wasm`: HTTP 200, `application/wasm`
- `libdedx.data`: HTTP 200, `application/octet-stream`
- `locateFile` produced: `http://127.0.0.1:4000/wasm/libdedx.data` ✓
- Programs loaded: **10**
- No CORS errors, no console errors

### Scenario C — Static build, sub-path (`/dedx_web/`, port 4001)

Built with `BASE_PATH=/dedx_web pnpm build`. Served via `python3 -m http.server 4001`
with files at `/tmp/ghpages/dedx_web/`.

- `libdedx.mjs`: HTTP 200, `text/javascript`
- `libdedx.wasm`: HTTP 200, `application/wasm`
- `libdedx.data`: HTTP 200, `application/octet-stream`
- `locateFile` produced: `http://127.0.0.1:4001/dedx_web/wasm/libdedx.data` ✓
- Programs loaded: **10**
- No CORS errors, no console errors

## Acceptance Criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Dev server loads — status "OK — 10 programs loaded"; 10 program names visible | **PASS** |
| 2 | Static build (root path) loads — same result, served by Python http.server on port 4000 | **PASS** |
| 3 | Static build (sub-path) loads — same result, served at `/dedx_web/` sub-path | **PASS** |
| 4 | `.data` file fetched — `libdedx.data` returned HTTP 200 in all three scenarios | **PASS** |
| 5 | No CORS errors — no CORS-related console errors in any scenario | **PASS** |
| 6 | `locateFile` paths correct — `.wasm` and `.data` URLs correctly include the base path (`/dedx_web/` in Scenario C) | **PASS** |

## Conclusion

**`--preload-file` works correctly in all three deployment scenarios**, including
the critical GitHub Pages sub-path case (`/dedx_web/`). The `locateFile` override
in `loader.ts` (using `${base}/wasm/${f}`) correctly resolves both `.wasm` and
`.data` file URLs for all base path configurations.

The `.data` MIME type served by static hosts (`application/octet-stream`) is
acceptable — Emscripten's runtime fetches it as a binary blob regardless of
content type.

**ADR 003 decision to switch from `--embed-file` to `--preload-file` is
validated. No amendment required.**

The only adjustment needed vs. the ADR/architecture docs is that `loader.ts`
must export `HEAP32` in `EXPORTED_RUNTIME_METHODS` if the loader accesses
`module.HEAP32` directly. If the loader uses only `ccall`/`cwrap`/`UTF8ToString`,
this is not needed.
