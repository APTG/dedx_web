# 2026-04-15 — Stage 2.6: libdedx Data Source Investigation (Phase 2)

## Session Narrative

### Prompt 1: Continue with implementation of Phase 2

**User request:** Continue with implementation of Phase 2 (WASM runtime verification)
of the Stage 2.6 investigation.

**AI response (this session):**

Read the following to orient:
- `prototypes/wasm-preload/VERDICT.md` — Spike 2 build artifacts and emcc commands
- `prototypes/libdedx-investigation/REPORT.md` — Phase 1 findings and Phase 2 plan
- `libdedx/src/CMakeLists.txt` — C source file list (`dedx_objects` OBJECT library)
- `libdedx/include/dedx_wrappers.h` — `dedx_get_stp_table_size`, `dedx_get_simple_stp_for_program`
- `libdedx/include/dedx.h` — `dedx_get_program_list`, `dedx_get_ion_list`, `dedx_get_material_list`

**Critical finding before building:** `libdedx/src/dedx.c` lines 587–589:
```c
} else if (prog == DEDX_ESTAR) {
    *err = DEDX_ERR_ESTAR_NOT_IMPL;
    return -1;
}
```
ESTAR is **explicitly not implemented** in libdedx v1.4.0. This is not a `.dat` file
access problem. The `dedx_estar.h` header contains the tabulated data but is never used.

**Build investigation:** The Spike 2 `preload/libdedx.wasm` (15 KB) is tiny because
the old builds embedded raw `.dat` source files (1.5 MB sidecar / 1.5 MB in-wasm) rather
than using the compiled-in C arrays. A fresh build without any file embedding produces
a properly-sized WASM (456 KB).

**Build fix required:** Emscripten 5.0.5 requires JSON-quoted function names in the
`EXPORTED_FUNCTIONS` array: `["_func1","_func2"]`. The old bracket-only format
`[_func1,_func2]` compiles silently but produces an empty 241-byte WASM with no exports.
The `build.sh` uses a mounted inner script (bash heredoc with single-quoted delimiter)
to safely pass JSON arrays to emcc inside `docker run`.

**Implementation steps:**
1. Created `prototypes/libdedx-investigation/wasm-runtime/` prototype directory.
2. Wrote `build.sh` — Docker + emscripten/emsdk:5.0.5 compiles libdedx without
   `--preload-file` or `--embed-file`; uses mounted inner script to avoid quoting issues.
3. Wrote `verify.mjs` — Node.js ESM test runner with 8 test sections, 24 checks.
4. Ran `./build.sh` → `output/libdedx.mjs` (13 KB) + `output/libdedx.wasm` (456 KB).
5. Ran `node verify.mjs` → **24/24 PASS**.

**Initial verify.mjs failures (corrected):**
- `readIntList()` was treating `-1` sentinel as a valid value (both 0 and -1 are used
  as sentinels in libdedx); fixed to stop at `v <= 0`.
- MSTAR check incorrectly expected Z=1 in the runtime ion list; MSTAR starts at Z=2.
- PSTAR material count check incorrectly expected exactly 74; runtime returns 78.
- Ion 1001 (electron) has no name in libdedx; check updated to accept empty string.

## Tasks

### Phase 2 — WASM Runtime Verification

- **Status:** completed
- **Stage:** 2.6
- **Branch:** `stage/3-wasm-pipeline`
- **Files created:**
  - `prototypes/libdedx-investigation/wasm-runtime/build.sh` (new)
  - `prototypes/libdedx-investigation/wasm-runtime/verify.mjs` (new)
  - `prototypes/libdedx-investigation/wasm-runtime/.gitignore` (new)
  - `prototypes/libdedx-investigation/wasm-runtime/output/` (gitignored, built)
  - `docs/ai-logs/2026-04-15-libdedx-investigation-phase2.md` (new)
- **Files updated:**
  - `prototypes/libdedx-investigation/REPORT.md` — §8 updated (Phase 2 row), §10 written
  - `docs/progress/stage-2.md` — Phase 2 findings table added; gate changed to OPEN
  - `CHANGELOG-AI.md` — new row for Phase 2
  - `docs/ai-logs/README.md` — new entry

### Key findings

1. **ESTAR is NOT IMPLEMENTED in libdedx v1.4.0** (confirmed at runtime).
   `dedx.c:587` explicitly returns `DEDX_ERR_ESTAR_NOT_IMPL`. The `.dat` file question
   is moot — there is no code path that reads ESTAR data regardless of build flags.
   `dedx_get_stp_table_size(3, 1001, 276) = -1`. `dedx_get_material_list(ESTAR) = []`.

2. **No `--preload-file` needed** — confirmed at runtime. The 456 KB `.wasm` binary
   loads and returns correct STP values from compiled-in C arrays alone.
   Actual WASM bundle: 13 KB `.mjs` + 456 KB `.wasm` (no `.data` sidecar).

3. **MSTAR runtime ion list: Z=2–18** (17 ions). `dedx_get_ion_list(MSTAR)` returns
   only the special-cased ions. Higher Z (Z>18) is supported via general polynomial
   scaling in `dedx_mpaul.c` but not enumerated. The TypeScript wrapper cannot rely on
   the runtime ion list to discover MSTAR coverage; it must know the full Z=1–98 range.

4. **Runtime material counts differ from static analysis.**
   All tabulated programs return 78 via `dedx_get_material_list()`. DEFAULT returns 279.
   ESTAR returns 0. The function returns materials with density metadata, not strictly
   those with tabulated STP data. Runtime counts are authoritative for the API.

5. **Material names are ALL-CAPS** (`"WATER"`, `"GRAPHITE"`, etc.). The TypeScript
   wrapper must apply display formatting. Electron (ID=1001) has no name
   (`dedx_get_ion_name(1001) = ""`); hard-code `"Electron"` in the wrapper.

6. **ICRU auto-select (ID=9) IS in the program list.** The TypeScript wrapper must
   filter it out of the UI program picker even though `dedx_get_program_list()` includes it.

7. **PSTAR H₂O reference STP confirmed:** 7.28614 MeV·cm²/g at 100 MeV/nucl
   (Δ −0.19% vs NIST 7.3). Data pipeline from C arrays through WASM to Node.js
   introduces no significant precision loss.

8. **Emscripten 5.0.5 EXPORTED_FUNCTIONS format:** Must use JSON with quoted names
   `["_func1","_func2"]`. The old format `[_func1,_func2]` compiles without error but
   produces an empty WASM binary (241 bytes). The `build.sh` uses a mounted inner
   script to safely pass this JSON inside `docker run`.

### Required amendments (Phase 2 additions)

| Document | Amendment |
|----------|-----------|
| `docs/decisions/003-wasm-build-pipeline.md` | Add Phase 2 findings; note actual WASM size 456 KB; note Emscripten 5.x EXPORTED_FUNCTIONS JSON format requirement |
| `docs/04-feature-specs/entity-selection.md` | ESTAR: treat as incompatible for all combinations (grey out); MSTAR: Z>18 available but not in API ion list |
| `docs/06-wasm-api-contract.md` | ESTAR: present in program list, returns error for all calculations; MSTAR ion list: Z=2–18 only from API; material names: all-caps; electron name: empty (hard-code "Electron") |

### Verify output (24/24 PASS)

```
=== 1. Library version: 0.0.0-unknown ===
=== 2. Program list: 10 programs (IDs 1-7, 9, 100, 101) ===
=== 3. ESTAR: dedx_get_stp_table_size(3,1001,276) = -1 (DEDX_ERR_ESTAR_NOT_IMPL) ===
=== 4. MSTAR ions: 17 ions, Z=2–18 ===
=== 5. Material counts: DEFAULT=279, tabulated=78, ESTAR=0 ===
=== 6. Material names: HYDROGEN, HELIUM, CARBON, WATER, GRAPHITE ✓ ===
=== 7. Ion names: HYDROGEN, HELIUM, CARBON, "" (electron) ✓ ===
=== 8. PSTAR H₂O 100 MeV/nucl: 7.28614 MeV·cm²/g (Δ −0.19%) ✓ ===
```

### Phase 3 plan (not required — Stage 3 gate is open)

Phase 3 (per-program WASM splitting) was planned in the original Stage 2.6 spec but is
not recommended. The monolithic build (456 KB `.wasm`) is well within acceptable limits.
See `REPORT.md §7.4` for the full reasoning.
