# ADR 003 — WASM Build Pipeline

**Status:** Accepted (14 April 2026)

---

## Context

The libdedx C library must be compiled to WebAssembly via **Emscripten 5.x**
and consumed by the SvelteKit application. The legacy `build_wasm.sh` script
established a working baseline but has several problems that need to be
redesigned for the new stack.

### Problems with the legacy build

| Problem | Detail |
|---------|--------|
| Non-modular JS output | `EXPORT_ES6=0` — outputs a CommonJS/global module; incompatible with ES module imports in SvelteKit / Vite |
| Embedded data | `--embed-file` bakes the libdedx data tables into the JS file as base64; inflates the JS bundle and prevents browser caching of the WASM binary separately |
| No TypeScript | The wrapper is plain JS (`WASMWrapper.js`); no types, no IDE support, no `tsc` validation |
| Copy-based deployment | Built files are manually copied to `src/Backend/` and `public/`; no integration with the Vite build graph |
| Missing functions | Does not export `dedx_get_density()`, `dedx_get_ion_nucleon_number()`, `dedx_get_ion_atom_mass()`, `dedx_get_program_version()`, or any inverse / custom compound functions required by the new API contract (`docs/06-wasm-api-contract.md`) |
| Modifies libdedx submodule would be required | To expose internal data (nucleon number, density, etc.) the legacy approach would require patching `libdedx/` — which is a tracked submodule and should not be modified |

### New requirements

From `docs/06-wasm-api-contract.md`:

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
  -s EXPORTED_FUNCTIONS="[
    _dedx_fill_program_list,
    _dedx_fill_material_list,
    _dedx_fill_ion_list,
    _dedx_get_ion_name,
    _dedx_get_material_name,
    _dedx_get_program_name,
    _dedx_get_min_energy,
    _dedx_get_max_energy,
    _dedx_get_stp_table,
    _dedx_get_csda_range_table,
    _dedx_get_stp_table_size,
    _dedx_fill_default_energy_stp_table,
    _dedx_get_inverse_stp,
    _dedx_get_inverse_csda,
    _dedx_get_bragg_peak_stp,
    _dedx_create_config,
    _dedx_free_config,
    _dedx_get_simple_stp,
    _dedx_get_simple_stp_for_program,
    _convert_units,
    _dedx_extra_get_ion_nucleon_number,
    _dedx_extra_get_ion_atom_mass,
    _dedx_extra_get_density,
    _dedx_extra_get_program_version,
    _dedx_extra_is_gas_default,
    _dedx_extra_inverse_stp_custom,
    _dedx_extra_inverse_csda_custom,
    _dedx_extra_bragg_peak_stp_custom,
    _malloc,
    _free
  ]" \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","lengthBytesUTF8","stringToUTF8"]' \
  -s ENVIRONMENT='web' \
  -s EXPORT_ES6=1 \
  -s MODULARIZE=1 \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  --preload-file libdedx/data@/data
```

Key flag decisions:

| Flag | Value | Reason |
|------|-------|--------|
| `EXPORT_ES6=1` | on | Required for SvelteKit/Vite ES module import |
| `MODULARIZE=1` | on | Wraps module in an async factory function; enables lazy init |
| `WASM=1` | on | Produce separate `.wasm` binary (not asm.js) |
| `ALLOW_MEMORY_GROWTH=1` | on | libdedx allocates variable-length arrays; static heap too small for large energy tables |
| `ENVIRONMENT='web'` | web | Strips Node.js I/O shims; reduces bundle size |
| `--preload-file` | data | Bundles the libdedx data directory into a virtual filesystem accessible to C code; uses `preload` (binary) rather than the legacy `embed` (base64 text) for correct memory layout |
| `-o *.mjs` | `.mjs` extension | Signals ES module to Node.js and bundlers; Vite treats it correctly |

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
- **Separate `.wasm` file** is cacheable by the browser; subsequent visits
  load the data tables from disk rather than re-downloading.
- **`dedx_extra.{h,c}` decouples** the new API surface from the upstream
  libdedx submodule — upstream merges are clean.
- **TypeScript wrapper** makes `LibdedxService` mockable; all unit tests run
  without a real WASM module.
- **Lazy initialization** means the WASM binary is not parsed until the user
  triggers a calculation or plot. The root layout load function calls
  `getService()` with a `browser` guard so the WASM module is never
  initialized during SSG prerendering.

### Negative / risks

- **`--preload-file` produces a separate `.data` payload** at Emscripten build
  time (e.g. `static/wasm/libdedx.data`). This file is fetched at runtime and
  mounted into the Emscripten virtual file system — it is a distinct deployment
  artifact separate from the `.wasm` binary. If libdedx data tables change,
  both the `.wasm` and `.data` files must be rebuilt and re-deployed. This is
  expected behavior for a data-heavy C library.
- **`dedx_extra` internal coupling** means `dedx_extra.c` will break if
  libdedx's internal struct layout changes. Mitigated by the test suite:
  `loader.ts` integration tests verify entity lists and density values against
  known fixtures on each build.
- **`ALLOW_MEMORY_GROWTH=1`** can cause performance hiccups on first growth.
  Acceptable for a calculator app where response latency is dominated by
  user think-time, not computation.
- **Build script maintenance.** The exported function list in `build.sh` must
  be kept in sync with `libdedx.ts`. A mismatch causes a runtime error on
  first use. Mitigated by the integration test that calls every public service
  method at startup.

---

## References

- `docs/06-wasm-api-contract.md` — full TypeScript types and service interface
- `build_wasm.sh` — legacy build script (reference; will be replaced in Stage 3)
- `src/Backend/WASMWrapper.js` — legacy wrapper (reference; will be replaced)
- `docs/03-architecture.md` §3 — WASM service layer design
- `docs/02-tech-stack.md` — Emscripten version pin
