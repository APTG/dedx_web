# ADR 003 — WASM Build Pipeline

**Status:** Accepted (14 April 2026)

---

## Context

The libdedx C library must be compiled to WebAssembly via **Emscripten 5.x**
and consumed by the SvelteKit application. The legacy `build_wasm.sh` script
established a working baseline but has several problems that need to be
redesigned for the new stack.

### Problems with the legacy build

| Problem                                      | Detail                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-modular JS output                        | `EXPORT_ES6=0` — outputs a CommonJS/global module; incompatible with ES module imports in SvelteKit / Vite                                                                                                                                                                  |
| Embedded data                                | `--embed-file` bakes the libdedx data tables into the JS file as base64; inflates the JS bundle and prevents browser caching of the WASM binary separately                                                                                                                  |
| No TypeScript                                | The wrapper is plain JS (`WASMWrapper.js`); no types, no IDE support, no `tsc` validation                                                                                                                                                                                   |
| Copy-based deployment                        | Built files are manually copied to `src/Backend/` and `public/`; no integration with the Vite build graph                                                                                                                                                                   |
| Missing functions                            | Does not export `dedx_get_density()`, `dedx_get_ion_nucleon_number()`, `dedx_get_ion_atom_mass()`, `dedx_get_program_version()`, or any inverse / custom compound functions required by the new API contract ([`docs/06-wasm-api-contract.md`](../06-wasm-api-contract.md)) |
| Modifies libdedx submodule would be required | To expose internal data (nucleon number, density, etc.) the legacy approach would require patching `libdedx/` — which is a tracked submodule and should not be modified                                                                                                     |

### New requirements

From [`docs/06-wasm-api-contract.md`](../06-wasm-api-contract.md):

1. **ES module output** — SvelteKit imports the WASM wrapper as a standard ES
   module; Vite optimizes and bundles it. Requires `EXPORT_ES6=1 MODULARIZE=1`.
2. **Separate `.wasm` file** — loaded at runtime via `fetch()` in the
   Emscripten module factory; enables browser caching, HTTP/2 parallel fetch,
   and avoids embedding megabytes of binary data into the JS parse path.
3. **Thin C shim — `wasm/dedx_extra.{h,c}`** — exposes functions not in the
   public libdedx API without modifying the submodule:
   - `dedx_get_ion_nucleon_number(programId, ionId)` — mass number A
   - `dedx_get_ion_atom_mass(programId, ionId)` — atomic mass in u
   - `dedx_get_density(programId, materialId)` — material density in g/cm³
   - `dedx_get_program_version(programId)` — version string
   - `dedx_is_gas_default(materialId)` — aggregate state lookup
   - `getInverseStpCustomCompound()` — inverse STP for custom compounds
   - `getInverseCsdaCustomCompound()` — inverse CSDA for custom compounds
   - `getBraggPeakStpCustomCompound()` — Bragg peak STP for custom compounds
4. **TypeScript wrapper** — `src/lib/wasm/libdedx.ts` implements
   `LibdedxService`; `src/lib/wasm/types.ts` re-exports all shared types.
   The wrapper is mockable in Vitest (dependency injection via the service
   interface).
5. **Build script** — `wasm/build.sh` (or CMake integration) produces
   `static/wasm/libdedx.mjs` + `static/wasm/libdedx.wasm` in the SvelteKit
   `static/` directory so Vite serves them without further processing.

---

## Decision

### Emscripten flags

```bash
emcc libdedx.a wasm/dedx_extra.c \
  -I libdedx/include \
  -I wasm/ \
  -o static/wasm/libdedx.mjs \
  -s EXPORTED_FUNCTIONS='["_dedx_fill_program_list","_dedx_fill_material_list","_dedx_fill_ion_list","_dedx_get_ion_name","_dedx_get_material_name","_dedx_get_program_name","_dedx_get_min_energy","_dedx_get_max_energy","_dedx_get_stp_table","_dedx_get_csda_range_table","_dedx_get_stp_table_size","_dedx_fill_default_energy_stp_table","_dedx_get_inverse_stp","_dedx_get_inverse_csda","_dedx_get_bragg_peak_stp","_dedx_create_config","_dedx_free_config","_dedx_get_simple_stp","_dedx_get_simple_stp_for_program","_convert_units","_dedx_extra_get_ion_nucleon_number","_dedx_extra_get_ion_atom_mass","_dedx_extra_get_density","_dedx_extra_get_program_version","_dedx_extra_is_gas_default","_dedx_extra_inverse_stp_custom","_dedx_extra_inverse_csda_custom","_dedx_extra_bragg_peak_stp_custom","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","lengthBytesUTF8","stringToUTF8","HEAP32","HEAPF32","HEAPF64"]' \
  -s ENVIRONMENT='web,node' \
  -s EXPORT_ES6=1 \
  -s MODULARIZE=1 \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1
```

> **Stage 2.6 finding:** `--preload-file` is **not needed**. All libdedx
> stopping-power tables are compiled into the WASM binary as static C arrays
> (`dedx_data_access.c` has zero `fopen()` calls). The `.data` sidecar from
> the Spike 2 prototype contained only the raw source `.dat` files that the
> library never reads at runtime. Omitting `--preload-file` reduces the
> deployment from three files to two: `libdedx.mjs` (13 KB) + `libdedx.wasm`
> (457 KB). See `prototypes/libdedx-investigation/REPORT.md` §7.

Key flag decisions:

| Flag                     | Value            | Reason                                                                                                                            |
| ------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `EXPORT_ES6=1`           | on               | Required for SvelteKit/Vite ES module import                                                                                      |
| `MODULARIZE=1`           | on               | Wraps module in an async factory function; enables lazy init                                                                      |
| `WASM=1`                 | on               | Produce separate `.wasm` binary (not asm.js)                                                                                      |
| `ALLOW_MEMORY_GROWTH=1`  | on               | libdedx allocates variable-length arrays; static heap too small for large energy tables                                           |
| `ENVIRONMENT='web,node'` | web,node         | Single build works in browser runtime and Node.js verification (`wasm/verify.mjs`), at the cost of a slightly larger JS glue file |
| `-o *.mjs`               | `.mjs` extension | Signals ES module to Node.js and bundlers; Vite treats it correctly                                                               |

### Emscripten changelog — notes affecting this build

These are entries from [`emscripten-changelog.md`](https://github.com/emscripten-core/emscripten/blob/main/ChangeLog.md) that directly
bear on the flags and patterns in this ADR:

**`EXPORTED_FUNCTIONS` must use JSON-quoted names (Emscripten 5.x).**
Emscripten 5.x requires each function name in `EXPORTED_FUNCTIONS` to be a
quoted JSON string: `'["_func1","_func2"]'`. The legacy format `[_func1,_func2]`
(unquoted identifiers) compiles silently but produces an empty WASM binary of
~241 bytes with no exports — the link succeeds but no C functions are callable
from JS. The `build.sh` in `prototypes/libdedx-investigation/wasm-runtime/`
uses a Docker-mounted inner script to safely pass this JSON array through
`docker run` without shell quoting conflicts. The production `wasm/build.sh`
must use the same pattern. Verified in Stage 2.6 Phase 2.

**`MODULARIZE=1` factory always returns a Promise (4.0.12 / 5.0.0).**
Starting with 4.0.12, the factory function generated by `-sMODULARIZE=1`
unconditionally returns a `Promise`, even when `WASM_ASYNC_COMPILATION` is
disabled. This is because other features (network file loading, `addRunDependency`)
may also make module creation async. The `loader.ts` pattern `await factory.default({...})`
is correct for all Emscripten 5.x releases.

**`ENVIRONMENT='worker'` is disallowed (4.0.17).**
`-sENVIRONMENT=worker` alone is now an error; the correct flag for a build
that runs in both page and Worker contexts is `-sENVIRONMENT=web,worker`.
The current build uses `-sENVIRONMENT=web,node` to support both browser runtime
and Node.js verification in CI. If Web Worker offloading is added in a future stage
(see [`03-architecture.md` §3](../03-architecture.md#3-wasm-service-layer)), the flag must change to `web,worker,node` (or use split targets).

**Minimum Node.js for generated code bumped to v18.3.0 (5.0.6, in development).**
Emscripten 5.0.6 raises the minimum Node.js version that can execute the
generated JS glue code. Node 24 (used in CI and Vitest) satisfies this with
substantial margin.

### `dedx_extra` rationale

The libdedx submodule is a tracked external dependency. Patching it to expose
internal data would:

1. Create merge conflicts on every upstream update.
2. Fork the library in a way that is hard to review or upstream.

`wasm/dedx_extra.{h,c}` lives in this repository (not in `libdedx/`) and is
compiled alongside `libdedx.a`. It accesses internal libdedx structs via the
same include path used by the library itself — a deliberate, documented
coupling that is isolated to one file per side.

When libdedx's public API eventually exposes these functions natively, the
`dedx_extra` wrappers can be removed with no changes to the TypeScript layer
(the service interface is stable).

### TypeScript wrapper structure

```
src/lib/wasm/
├── types.ts        — re-exports all types from 06-wasm-api-contract.md
├── loader.ts       — lazy singleton: importScripts + module factory
└── libdedx.ts      — implements LibdedxService against the loaded module
```

`loader.ts` exports a `getService(): Promise<LibdedxService>` function.
The first call compiles and initializes the WASM module; subsequent calls
return the cached singleton. This lazy pattern prevents WASM from being
loaded during SSG prerendering (where browser APIs are unavailable), and
means the first WASM call is deferred until the user actually triggers a
calculation or plot — avoiding unnecessary load for SSG build passes.

### Test mock

A `src/lib/wasm/__mocks__/libdedx.ts` file implements `LibdedxService` with
static fixture data. Vitest's module mock system substitutes it transparently;
no network or WASM load occurs in unit tests.

---

## Consequences

### Positive

- **ES module import** works directly in SvelteKit/Vite with no custom plugin.
- **Separate `.wasm` binary** is cacheable by the browser independently from
  the JS glue (`.mjs`); subsequent visits load from disk. No `.data` sidecar —
  all stopping-power tables are compiled into the `.wasm` binary itself.
- **`dedx_extra.{h,c}` decouples** the new API surface from the upstream
  libdedx submodule — upstream merges are clean.
- **TypeScript wrapper** makes `LibdedxService` mockable; all unit tests run
  without a real WASM module.
- **Lazy initialization** means the WASM binary is not parsed until the user
  triggers a calculation or plot. The root layout load function calls
  `getService()` with a `browser` guard so the WASM module is never
  initialized during SSG prerendering.

### Negative / risks

- **`dedx_extra` internal coupling** means `dedx_extra.c` will break if
  libdedx's internal struct layout changes. Mitigated by the test suite:
  `loader.ts` integration tests verify entity lists and density values against
  known fixtures on each build.
- **WASM binary size budget.** Stage 2.6 Phase 2 measured the monolithic build
  at **13 KB `.mjs` + 457 KB `.wasm`** (470 KB total; ~200 KB gzip). The
  ceiling is `libdedx.wasm` ≤ 3 MB, consistent with the TTI ≤ 3.5 s target on
  3G Fast (see
  [`docs/09-non-functional-requirements.md` §3](../09-non-functional-requirements.md#3-performance)).
  No `.data` sidecar. CI should report artifact sizes after each WASM build;
  adding exported functions or debug symbols that push past the threshold
  requires explicit sign-off against the performance budget.
- **Exported function list drift.** The `EXPORTED_FUNCTIONS` list in
  `wasm/build.sh` and the `LibdedxService` interface in `src/lib/wasm/libdedx.ts`
  must stay in sync. A mismatch causes a silent `undefined` at the call site
  or a link-time error. The integration test (calls every public service method
  on startup) catches runtime failures but not link-time omissions — a missing
  underscore-prefixed symbol is not detected until the first call. Stronger
  mitigation: `wasm/build.sh` should be generated or validated by a script that
  reads the exported method names from `libdedx.ts` and cross-checks them
  against the C headers. Until that script exists, every change to
  `LibdedxService` must be accompanied by a manual update to the
  `EXPORTED_FUNCTIONS` list and a WASM rebuild before merging.
- **`locateFile` and URL-encoded base paths.** `loader.ts` constructs the
  `.wasm` path as `` `${base}/wasm/${f}` `` where `base` comes from
  `$app/paths`. GitHub Pages repository names are restricted to alphanumeric
  characters and hyphens (e.g. `dedx_web`) — URL-safe by construction. If the
  deployment base path ever includes characters that need percent-encoding
  (spaces, `#`, `?`), the template-literal concatenation will produce an
  invalid URL. This is an unlikely edge case for the current deployment target
  but should be noted if the app is ever hosted under a non-standard path.
- **`ALLOW_MEMORY_GROWTH=1`** can cause performance hiccups on first growth.
  Acceptable for a calculator app where response latency is dominated by
  user think-time, not computation.

---

## References

- [`docs/06-wasm-api-contract.md`](../06-wasm-api-contract.md) — full TypeScript types and service interface
- [`build_wasm.sh`](../../build_wasm.sh) — legacy build script (reference; will be replaced in Stage 3)
- [`src/Backend/WASMWrapper.js`](../../src/Backend/WASMWrapper.js) — legacy wrapper (reference; will be replaced)
- [`docs/03-architecture.md` §3](../03-architecture.md#3-wasm-service-layer) — WASM service layer design
- [`docs/02-tech-stack.md` §7](../02-tech-stack.md#7-webassembly-toolchain) — Emscripten version pin
