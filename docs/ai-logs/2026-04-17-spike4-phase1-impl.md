# 2026-04-17 — Spike 4: Phase 1 Implementation

## Session Narrative

### Prompt: Implement Phase 1 prototype scripts

**User requests:**
1. Adjust the plan to use the exact 165-point SRIM energy grid (dropping variable-length pairs), include `csda_range` column, and keep consistent grid for all rows.
2. Implement all Phase 1 scripts.

---

## Plan amendments applied

- **§2.5 Energy Grid**: replaced 100-point `geomspace` with exact 165-point SRIM-2013 values (0.0011–2000 MeV/u). Confirmed via analysis of the real Parquet file that all 165-point pairs share an identical grid (verified across all 37,628 row groups); 86 pairs with shorter grids are simply omitted from the synthetic data — no NaN padding needed.
- **Array shapes**: all `(287, 379, 100)` → `(287, 379, 165)` throughout PLAN.md.
- **`csda_range`**: added as second quantity alongside `stp` in both Zarr (separate array per group) and Parquet (6th column, `DOUBLE`). Parquet schema now exactly matches the real SRIM file: `program, particle, material, energy, stopping_power, csda_range`.
- **Uncompressed sizes updated**: ~72 MB per quantity (×2 for both = ~144 MB).

---

## Tasks

### `generate_data.py`

**Purpose:** Single source of truth. Imports used by all three writers.

**Key contents:**
- `ENERGIES`: 165-point array, exact SRIM-2013 values.
- `STABLE_ISOTOPES`: 286 entries, `(Z, A, symbol)` from AME2020/NUBASE2020.
- `ELECTRON`: special lepton entry.
- `PARTICLES`: 287 entries (isotopes + electron).
- `LIBDEDX_MATERIALS`: 279 entries parsed from `dedx_program_const.h` (regex on `dedx_program_available_materials[0]`) and `dedx_metadata.h` (density + I-value). Elements get `composition=[(Z,1.0)]`; ICRU compounds use `i_value_eV` from metadata directly.
- `CUSTOM_MATERIALS`: 100 entries (18 alloys, 10 scintillators, 8 ceramics, 9 semiconductors, 7 polymers, 8 biological, 6 medical, 6 shielding, 5 liquids, 6 detector gases, 4 nuclear, 6 optical, 4 geological + 3 added to reach 100: FR4, PolystyreneFoam, SiliconeRubber).
- `compute_stp_array()`: Bethe-Bloch for heavy ions, Møller formula for electron. Uses `i_value_eV` from metadata for libdedx materials; Bragg-Kleeman `I_eff` for custom materials.
- `compute_csda_range_array(stp)`: cumulative trapezoidal integral of `1/STP` over `ENERGIES`.

**Bugs fixed during implementation:**
- `-1` sentinel in C array parsed as `1` by `re.findall(r'\d+', ...)` — fixed by using `re.findall(r'-?\d+', ...)` and filtering `> 0`.
- ICRU compound materials have no `composition` key — added `i_value_eV` fallback path; used `75.0 eV` for materials missing both.

---

### `write_parquet.py`

One row group per particle (287), each with 379 × 165 = 62,535 rows.
zstd level 5 compression with dictionary encoding on string columns.

**Output:** `data/srim_synthetic.webdedx.parquet` — **87.9 MB**

---

### `write_zarr_v3_single.py`

`shards=(287,379,165)`, `chunks=(1,379,165)`. Writes `stp` and `csda_range`
arrays in a loop. One shard file per quantity.

**Output:** `data/srim_synthetic_single.zarr/` — **82.2 MB**, 6 files
- `srim-2013/stp/c/0/0/0`: 40.5 MB
- `srim-2013/csda_range/c/0/0/0`: 41.6 MB

---

### `write_zarr_v3_per_ion.py`

`shards=(1,379,165)`, `chunks=(1,379,165)`. 287 shard files per quantity.

**Output:** `data/srim_synthetic_per_ion.zarr/` — **82.2 MB**, 578 files
- `stp/c/0/0/0` (H-1): 137.5 KB
- `stp/c/286/0/0` (electron): 217.7 KB

---

### `run_benchmark.py`

Produces `REPORT.md` with full size table and round-trip consistency check.

**Round-trip result:** PASS — Zarr single vs per-ion max diff < 1e-5; Parquet vs Zarr max diff < 1e-4.

---

## Key benchmark findings

| Format | Total | Per-ion fetch | Cold requests |
|--------|-------|---------------|---------------|
| Parquet | 87.9 MB | 296–411 KB (row group) | 2 |
| Zarr single | 82.2 MB | 4.5 KB index + Range to inner chunk | 3 per quantity |
| Zarr per-ion | 82.2 MB | 138–218 KB per quantity | 2 per quantity |

- Zarr per-ion shard is **~2× smaller** than the equivalent Parquet row group.
- Zarr single shard is **~50% smaller** total vs Parquet.
- Electron shard is ~58% larger than proton shard (different STP formula → less compressible).

---

## Files changed

- `prototypes/extdata-formats/generate_data.py` — new
- `prototypes/extdata-formats/write_parquet.py` — new
- `prototypes/extdata-formats/write_zarr_v3_single.py` — new
- `prototypes/extdata-formats/write_zarr_v3_per_ion.py` — new
- `prototypes/extdata-formats/run_benchmark.py` — new
- `prototypes/extdata-formats/PLAN.md` — §2.5 energy grid, §3 shapes/sizes, §5.1–5.4 updated
- `CHANGELOG-AI.md` — new row
- `docs/ai-logs/2026-04-17-spike4-phase1-impl.md` — this file
- `docs/ai-logs/README.md` — new entry

## Pending (Phase 2+)

- `upload_to_s3.py` — requires user to provide S3 bucket + credentials
- `browser/` app — Phase 3 (after S3 upload)
- `VERDICT.md` — after browser tests complete
