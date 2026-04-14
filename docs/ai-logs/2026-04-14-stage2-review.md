# AI Session Log — 2026-04-14 — Stage 2 Review: Tech Stack & Architecture Weak Points

**Date:** 14 April 2026
**Stage:** 2
**Output:** `docs/02-tech-stack.md`, `docs/03-architecture.md`, `docs/09-non-functional-requirements.md`, `docs/decisions/003-wasm-build-pipeline.md`, `docs/progress/stage-2.md`

---

## Session Summary

Second Stage 2 session — peer review of all Stage 2 documents against five
identified issues. All changes are editorial/correctness fixes to existing
documents; no new files created.

---

## Issues Addressed

### 1. Node.js version inconsistency (stage-2.md vs tech stack doc)

`docs/progress/stage-2.md` named "Node.js 25" in the tech-stack notes column.
Node.js 25 is the odd-numbered Current release line (no LTS). The correct
pin is Node.js 24 LTS (24.14). Fixed in `stage-2.md`. The WASM init description
in the same table also used the old "blocking `+layout.ts` with `browser` guard"
language — updated to reflect the non-blocking `$effect` approach decided in
the previous session.

### 2. WASM `+layout.ts` contradiction in `docs/03-architecture.md` §10

§3 explicitly states that a blocking `load()` in `+layout.ts` was rejected (it
forces Documentation page to wait for WASM). §10 showed the rejected pattern as
a code example with a `browser` guard. Fixed: §10 now shows an empty `load()` that
returns `{}` and explains why no browser guard is needed (`$effect` is inherently
browser-only — never runs during SSG prerendering).

### 3. Web Worker strategy missing from architecture doc

All WASM calls run synchronously on the main thread. For the current workload
(500-point calculations, max 8 series) this is acceptable (< 160 ms worst case
for an 8-series plot re-render). The architecture doc did not discuss or dismiss
Web Worker offloading.

Added to `docs/03-architecture.md` §3: "WASM on the main thread — Web Worker
strategy" subsection with:
- Workload estimates (single calculation < 20 ms; 8-series plot < 160 ms)
- Deferred decision rationale (main-thread blocking within acceptable budgets)
- Concrete migration path: `ENVIRONMENT='web,worker'`, no SharedArrayBuffer
  needed (GitHub Pages lacks COOP/COEP headers), `calculate()` → `Promise<T>`
  interface upgrade, Comlink for Worker proxy

Updated §12 Performance Considerations table: expanded WASM binary size row
and added "Main-thread computation" row referencing the migration path.

### 4. Browser caching strategy missing from specs

The app has `site.webmanifest` but no Service Worker. `libdedx.wasm` and
`libdedx.data` in `static/wasm/` use un-hashed filenames; GitHub Pages applies
`Cache-Control: max-age=600, must-revalidate`. Unlike SvelteKit's `_app/` assets
(content-hashed, long-lived cache), WASM files re-validate every 10 minutes.

Added `docs/09-non-functional-requirements.md` §3.1 "Browser caching":
- First load vs repeat visit vs post-deploy behavior table
- Re-validation cost (304, a few ms) — acceptable for infrequent scientific tool
- Service Worker deferred: offline not a v1 requirement; stale WASM risk with
  physics data updates requires versioned cache key if ever implemented

### 5. Emscripten changelog — relevant entries for ADR 003

Read `docs/resources/emscripten-changelog.md`. Three entries relevant to the
project:

- **4.0.12 / 5.0.0**: `MODULARIZE=1` factory always returns a `Promise` —
  `loader.ts`'s `await factory.default({...})` is correct.
- **4.0.17**: `-sENVIRONMENT=worker` alone now disallowed — must use
  `web,worker`. Documents the flag change for future Web Worker migration.
- **5.0.6** (in development): Node minimum for generated code raised to v18.3.0 —
  Node 24 in CI has ample margin.

Added "Emscripten changelog notes" subsection to ADR 003 Decision section.
Updated `docs/02-tech-stack.md` §7 Emscripten: pin now shows current stable
**5.0.5** (03 April 2026) plus a changelog-impact table.

---

## Files Changed

| File | Change |
|------|--------|
| `docs/progress/stage-2.md` | "Node.js 25" → "Node.js 24 LTS (24.14)"; WASM init row updated to non-blocking description |
| `docs/03-architecture.md` | §10: replaced contradictory blocking `+layout.ts` code; §3: added Web Worker strategy subsection; §12: expanded WASM binary size row, added main-thread computation row |
| `docs/09-non-functional-requirements.md` | Added §3.1 "Browser caching" subsection |
| `docs/02-tech-stack.md` | §7 Emscripten: added current stable version 5.0.5; added changelog-impact table |
| `docs/decisions/003-wasm-build-pipeline.md` | Added "Emscripten changelog notes" subsection in Decision section |

---

## Inputs Read

| File | Purpose |
|------|---------|
| `docs/resources/emscripten-changelog.md` | Emscripten 5.x changelog — identified 3 relevant entries |
| `docs/progress/stage-2.md` | Found Node.js 25 inconsistency |
| `docs/03-architecture.md` | Full review for §10 contradiction and insertion points |
| `docs/09-non-functional-requirements.md` | Found missing caching section |
| `docs/02-tech-stack.md` | §7 Emscripten section |
| `docs/decisions/003-wasm-build-pipeline.md` | ADR 003 for changelog notes insertion |
| `docs/06-wasm-api-contract.md` | `LibdedxService` interface — confirmed synchronous `calculate()` return type |
