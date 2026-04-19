# Vendor Library Reference

This directory contains shallow git submodules for the key third-party libraries
used in dEdx Web. They exist so that AI coding agents (Qwen, Copilot, Claude) can
read source, TypeScript types, and docs **locally** without hitting the web.

---

## jsroot — `vendor/jsroot/`

**What:** JSROOT 7 — the physics-community standard plotting library from CERN.
Used by this project to render `TGraph` / `TMultiGraph` plots on log-log axes.

**Why submodule:** JSROOT's public web docs are sparse; the primary API reference
is in the source and the docs/ folder. Qwen/Copilot cannot reliably fetch from
`root.cern` at session time.

| Resource | Path |
|----------|------|
| README | [vendor/jsroot/readme.md](jsroot/readme.md) |
| Full API narrative | [vendor/jsroot/docs/JSROOT.md](jsroot/docs/JSROOT.md) |
| HTTP server integration | [vendor/jsroot/docs/HttpServer.md](jsroot/docs/HttpServer.md) |
| Main module reference | [vendor/jsroot/docs/main.md](jsroot/docs/main.md) |
| TypeScript types | [vendor/jsroot/types.d.ts](jsroot/types.d.ts) |
| Changelog | [vendor/jsroot/changes.md](jsroot/changes.md) |
| Package manifest | [vendor/jsroot/package.json](jsroot/package.json) |

**Most important for this project:**
- `types.d.ts` — full TypeScript API surface (draw, create, JSROOT settings)
- `docs/JSROOT.md` — narrative covering `draw()`, `TGraph`, `TMultiGraph`, painter lifecycle
- `readme.md` — quick-start examples including ES module import pattern

**Project integration:** ADR [002-keep-jsroot.md](../docs/decisions/002-keep-jsroot.md),
architecture [§5 component tree](../docs/03-architecture.md), Spike 1 in
[11-prototyping-spikes.md](../docs/11-prototyping-spikes.md).

---

## zarrita — `vendor/zarrita/`

**What:** zarrita.js 0.7.x — a minimal TypeScript Zarr v3 reader with zero
runtime dependencies. Used to read `.webdedx` stores (Zarr v3 per-ion shards)
in the browser via HTTP Range Requests.

**Why submodule:** zarrita is newer than most LLM training cuts; its sharding
and codec API is not well-known. The TypeScript source is the authoritative
spec for how to open stores, read arrays, and use LZ4 codecs.

| Resource | Path |
|----------|------|
| README | [vendor/zarrita/packages/zarrita/README.md](zarrita/packages/zarrita/README.md) |
| Changelog | [vendor/zarrita/packages/zarrita/CHANGELOG.md](zarrita/packages/zarrita/CHANGELOG.md) |
| TypeScript source root | [vendor/zarrita/packages/zarrita/src/](zarrita/packages/zarrita/src/) |
| open / create API | [vendor/zarrita/packages/zarrita/src/open.ts](zarrita/packages/zarrita/src/open.ts) |
| Codec definitions | [vendor/zarrita/packages/zarrita/src/codecs/](zarrita/packages/zarrita/src/codecs/) |
| FetchStore + other storage | [vendor/zarrita/packages/@zarrita-storage/](zarrita/packages/@zarrita-storage/) |
| Metadata types | [vendor/zarrita/packages/zarrita/src/metadata.ts](zarrita/packages/zarrita/src/metadata.ts) |
| Index exports | [vendor/zarrita/packages/zarrita/src/index.ts](zarrita/packages/zarrita/src/index.ts) |
| Package manifest | [vendor/zarrita/package.json](zarrita/package.json) |

**Most important for this project:**
- `src/open.ts` — `open(store, { kind: 'array' | 'group' })` API
- `src/codecs/` — LZ4 codec (used in `.webdedx` format per ADR 004)
- `packages/@zarrita-storage/` — `FetchStore` for HTTP Range Request reads

**Project integration:** ADR [004-zarr-v3-external-format.md](../docs/decisions/004-zarr-v3-external-format.md),
feature spec [external-data.md](../docs/04-feature-specs/external-data.md).

---

## Emscripten — no submodule (too large)

The emscripten-core/emscripten repository has ~50 000 files; even a depth-1
shallow clone exceeds 200 MB, making it unsuitable as a submodule.

**What is available locally:**

| Resource | Path |
|----------|------|
| Emscripten version changelog | [docs/resources/emscripten-changelog.md](../docs/resources/emscripten-changelog.md) |
| WASM build ADR (flags, pipeline) | [docs/decisions/003-wasm-build-pipeline.md](../docs/decisions/003-wasm-build-pipeline.md) |
| Legacy build script (reference) | [build_wasm.sh](../build_wasm.sh) |

**Where to find Emscripten docs online (for reference):**
- Compiler flags: `src/settings.js` in emscripten-core/emscripten on GitHub
- Official docs: https://emscripten.org/docs/tools_reference/emcc.html
- ES module output: search `EXPORT_ES6`, `MODULARIZE` in settings.js

**Key flags used in this project** (from ADR 003):
`EXPORT_ES6=1`, `MODULARIZE=1`, `ENVIRONMENT=web`, `-sFILESYSTEM=0`,
`-sEXPORTED_FUNCTIONS`, `-sEXPORTED_RUNTIME_METHODS`.
