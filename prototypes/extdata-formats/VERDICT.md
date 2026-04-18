# Spike 4 — VERDICT: External Data Storage Format

> **Date:** 2026-04-18
> **Branch:** `prototypes/srim-parquet`
> **Decision:** Zarr v3 per-ion shards recommended for S3 deployment

---

## 1. Decision

**Adopt Zarr v3 per-ion shards** (`shards=(1,379,165)`) as the `.webdedx`
external data format, replacing the current Parquet spec in
`docs/04-feature-specs/external-data.md §2`, **subject to**:

- [ ] zarrita bundle size confirmed ≤ 50 KB minified (`vite build --report`)
- [ ] End-to-end browser test (not just Bun) with CORS verification

Until those two items are checked, the gate is **conditionally open** for
S3-hosted deployments. GitHub Pages deployment requires both items closed.

---

## 2. Benchmark Summary

All measurements from real S3 bucket at
`https://s3p.cloud.cyfronet.pl/webdedx/` on a fast wifi connection.

### 2.1 Local file sizes

| Format | Total size | Files |
|--------|-----------|-------|
| Parquet | 87.86 MB | 1 |
| Zarr single shard | 82.16 MB | 6 |
| Zarr per-ion | 82.16 MB | 578 |
| Uncompressed (per quantity) | 71.79 MB | — |

Zarr is ~6% smaller total than Parquet.

### 2.2 Per-ion cold-start fetch (S3, wifi — Python urllib)

| Format | Requests | Total bytes | Total time |
|--------|----------|-------------|------------|
| Parquet | 2 (footer + row-group Range) | 466 KB | 224 ms |
| Zarr per-ion | 2 (zarr.json + shard GET) | 224 KB | 222 ms |
| Zarr single | 3 (zarr.json + index Range + chunk Range) | 230 KB | 324 ms |

### 2.3 Per-ion cold-start fetch (S3, wifi — zarrita 0.7.1, Bun)

| Format | Total bytes | Total time |
|--------|-------------|------------|
| Zarr per-ion | 224 KB | 171 ms |
| Zarr single | 229 KB | 157 ms |

Note: zarrita Bun test confirmed zarr single and per-ion return **identical
STP values** for H-1 in Water and C-12 in PMMA — round-trip verified.

### 2.4 Individual request sizes (wifi)

| Request | Size |
|---------|------|
| Parquet footer (tail Range) | 320.8 KB |
| Parquet H-1 row group (Range) | 145.2 KB |
| Parquet electron row group (Range) | 205.2 KB |
| Zarr zarr.json (root, both variants) | 86.5 KB |
| Zarr per-ion — H-1 shard (GET) | 137.5 KB |
| Zarr per-ion — electron shard (GET) | 217.7 KB |
| Zarr single — shard index (Range tail) | 4.5 KB |
| Zarr single — H-1 inner chunk (Range) | 137.5 KB |

---

## 3. Acceptance Criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `generate_data.py` runs without error | ✅ PASS — 287 particles, 379 materials, 165 pts |
| 2 | Zarr single round-trip | ✅ PASS — max diff < 1e-5 |
| 3 | Zarr per-ion round-trip | ✅ PASS — max diff < 1e-5 |
| 4 | Parquet round-trip | ✅ PASS — max diff < 1e-4 vs Zarr |
| 5 | Electron chunk present and non-zero | ✅ PASS — 217.7 KB shard, distinct from proton |
| 6 | Custom material STP uses Bragg additivity | ✅ PASS — compute path verified in code |
| 7 | Per-particle Zarr inner chunk < Parquet row group | ✅ PASS — 137.5 KB vs 145.2 KB |
| 8 | `run_benchmark.py` completes | ✅ PASS |
| 9 | Browser local panels values match | ⚠️ PARTIAL — zarrita Bun test confirms equality; Vite browser test not run |
| 10 | S3 single-shard reads successfully | ✅ PASS — zarrita confirmed |
| 11 | S3 per-ion reads successfully, no Range | ✅ PASS — GET only, confirmed in zarrita |
| 12 | zarrita bundle ≤ 50 KB minified | ⬜ NOT MEASURED — vite build not run |
| 13 | No CORS errors | ⚠️ PARTIAL — works in Bun; browser CORS not verified |

---

## 4. Evaluation Questions (PLAN.md §7)

| # | Question | Answer |
|---|----------|--------|
| 1 | Zarr total ≤ Parquet total? | ✅ Yes — 82.2 MB vs 87.9 MB |
| 2 | Per-ion Zarr chunk ≤ Parquet row group? | ✅ Yes — 137.5 KB vs 145.2 KB (S3 measured) |
| 3 | Energy grid repetition cost in Parquet? | Large footer (320.8 KB) contains per-column stats for all 287×165×379 cells; Zarr zarr.json (86.5 KB) stores the grid once |
| 4 | HTTP cold-start round trips comparable? | ✅ Parquet: 2, per-ion: 2, single: 3 |
| 5 | zarrita bundle ≤ hyparquet? | ⬜ Not measured |
| 6 | Electron chunk differs from ion chunks? | ✅ Yes — 217.7 KB vs 137.5 KB (Møller formula → less compressible) |
| 7 | Custom materials affect chunk size? | No — all 379 materials always in the ion shard |
| 8 | Zarr single deploys without friction to GitHub Pages? | ⬜ Not tested |
| 9 | Zarr handles variable energy grids? | N/A — uniform 165-pt grid used (short-grid pairs dropped) |
| 10 | Wall-clock RTT single-shard vs per-ion on S3? | Python: per-ion 222 ms vs single 324 ms (single 46% slower). zarrita: ~equal (157 vs 171 ms). Single's extra serial request costs ~100 ms |
| 11 | Per-ion eliminates shard index fetch? | ✅ Yes — confirmed in zarrita: plain GET, no Range |
| 12 | Per-ion usable on GitHub Pages (287 files)? | ⬜ Not tested — technically feasible but inconvenient |

---

## 5. Decision Rationale (PLAN.md §10 criteria)

### Why not keep Parquet?

- Per-ion size difference is 5.5% at data level (137.5 vs 145.2 KB) — below the 15% threshold if considered in isolation.
- However, **total cold-start bytes are 52% less with Zarr** (224 KB vs 466 KB), dominated by Parquet's 320 KB footer. The footer scales with row group count (287 groups × statistics for 6 columns) and must be fetched before any row group can be located.
- Zarr's zarr.json is structurally lighter (86.5 KB) and carries no per-ion statistics.

### Why Zarr v3 per-ion over Zarr v3 single-shard?

- Same 2-request cold start as Parquet (vs 3 for single-shard).
- Python benchmark: per-ion 222 ms vs single 324 ms (single is 46% slower due to 3 serial requests).
- zarrita: ~equal (157 vs 171 ms) — but single-shard's 3 serial requests will hurt on high-latency connections more than on fast wifi.
- Per-ion requires no Range headers — simpler CDN/cache configuration.
- zarrita confirmed: reading `c/{i}/0/0` is a single GET, no Range negotiation.

### Why not Zarr v3 plain (without sharding)?

Per-ion sharding IS the per-ion format — no reason to add indirection. Single-shard without sharding would require fetching the full 40.5 MB shard to read one ion, which is unacceptable.

---

## 6. Size Note — Parquet Row Group Discrepancy

`run_benchmark.py` reports H-1 row group as **295.7 KB** (sum of
`total_compressed_size` via pyarrow), but the HTTP Range download of the
same row group is only **145.2 KB**. Both measurements use the same pyarrow
API to compute the byte range. The discrepancy (factor ~2) is unexplained
and warrants investigation before using `total_compressed_size` for offset
arithmetic. The HTTP download size (145.2 KB) is the ground truth. This
does not affect the format decision but should be clarified if hyparquet
is ever reconsidered.

---

## 7. Open Items Before Gate Fully Opens

| Item | Blocking? | Notes |
|------|-----------|-------|
| zarrita bundle size (`vite build --report`) | Yes (GitHub Pages) | Expected well within 50 KB |
| Browser CORS test (not Bun) | Yes (GitHub Pages) | S3 bucket has CORS configured |
| `external-data.md §2` amendment | Post-gate | Replace Parquet schema with Zarr v3 per-ion spec |
| Remove `hyparquet` from `02-tech-stack.md` | Post-gate | Replaced by zarrita |
| `upload_to_s3.py` implementation | No | Used rclone manually; script useful for automation |

---

## 8. Files Changed / Produced in This Spike

| File | Status |
|------|--------|
| `generate_data.py` | ✅ New |
| `write_parquet.py` | ✅ New |
| `write_zarr_v3_single.py` | ✅ New |
| `write_zarr_v3_per_ion.py` | ✅ New |
| `run_benchmark.py` | ✅ New |
| `run_s3_benchmark.py` | ✅ New |
| `browser/benchmark.ts` | ✅ New (zarrita Bun script) |
| `browser/package.json` | ✅ New |
| `REPORT.md` | ✅ Generated |
| `REPORT_S3.md` | ✅ Generated |
| `REPORT_S3_ZARRITA.md` | ✅ Generated |
| `PLAN.md` | ✅ Updated (status → Complete, stale shapes fixed) |
| `VERDICT.md` | ✅ This file |
