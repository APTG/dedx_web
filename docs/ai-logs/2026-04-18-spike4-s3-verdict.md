# 2026-04-18 — Spike 4: S3 Benchmarks + Verdict

## Session Narrative

### Context

Continuation of Spike 4 (external data storage format). Phase 1 (data
generation + local benchmarks) and data upload to Cyfronet S3 were
completed in the previous session. This session covers S3 accessibility
verification, HTTP benchmarks over real S3 connections (mobile and wifi),
zarrita JS benchmarks, and writing the final VERDICT.

---

### S3 Verification

Files confirmed publicly accessible at `https://s3p.cloud.cyfronet.pl/webdedx/`:

| File | URL | Status |
|------|-----|--------|
| `srim_synthetic_single.zarr/zarr.json` | `…/srim_synthetic_single.zarr/zarr.json` | ✅ 86.5 KB |
| `srim_synthetic_per_ion.zarr/zarr.json` | `…/srim_synthetic_per_ion.zarr/zarr.json` | ✅ 86.5 KB |
| `srim_synthetic.webdedx.parquet` | `…/srim_synthetic.webdedx.parquet` | ✅ 87.86 MB |

Bucket is `webdedx` (not `yaptide/webdedx/` — the `yaptide:` rclone remote
maps directly to the bucket name). Files were uploaded with `--s3-acl
public-read` via rclone.

---

### S3 HTTP Benchmark (`run_s3_benchmark.py`)

New script written: `run_s3_benchmark.py`. Measures actual HTTP fetch times
using Python `urllib.request` with Range headers. Uses local file for
Parquet row-group offset computation (identical bytes to S3 copy).

**Mobile connection:**

| Format | Cold start (zarr.json + H-1 data) | Bytes |
|--------|-----------------------------------|-------|
| Parquet | ~2951 ms | 466 KB |
| Zarr per-ion | ~2250 ms | 224 KB |
| Zarr single | ~1532 ms | 230 KB |

**Wifi connection (2026-04-18 07:31 UTC):**

| Format | Cold start | Bytes |
|--------|------------|-------|
| Parquet | 224 ms | 466 KB |
| Zarr per-ion | 222 ms | 224 KB |
| Zarr single | 324 ms | 230 KB |

Wifi shows all formats at comparable latency; Parquet transfers 2× more
bytes (dominated by its 320.8 KB footer, which is the index for all 287
row groups). Zarr zarr.json is 86.5 KB by comparison.

---

### zarrita Benchmark (`browser/benchmark.ts`)

New Bun script written. Uses `zarrita` 0.7.1 (latest). Intercepts `fetch`
to track bytes downloaded per operation.

Queries:
- H-1 (proton, ion index 0) in Water (mat index 275)
- C-12 (carbon-12, ion index 9) in PMMA (mat index 222)

**Mobile connection:**

| Format | Cold start |
|--------|------------|
| Zarr per-ion | 2006 ms |
| Zarr single | 1067 ms |

**Wifi connection:**

| Format | Cold start |
|--------|------------|
| Zarr per-ion | 171 ms |
| Zarr single | 157 ms |

STP values identical between per-ion and single-shard variants in both runs
— round-trip consistency confirmed via zarrita.

Notable: C-12 second fetch in single-shard = 16 ms (shard index already
cached from H-1 fetch; only one Range request needed for data).

---

### Consistency Fixes to PLAN.md

Eight stale references to the old 100-energy-point shape were found and
corrected:

- `shards=(287,379,100)` → `(287,379,165)` in §1 and §4
- `shards=(1,379,100)` → `(1,379,165)` in §1, §4, §5.3b
- `~55–85 KB` → `~140–220 KB` (actual measured values)
- `379 × 100 energy values` → `379 × 165 energy values` in §7
- Status line: `Plan (2026-04-17)` → `Complete (2026-04-18)`

---

### VERDICT

`VERDICT.md` written. Key findings:

**Decision: Zarr v3 per-ion shards recommended for S3 deployment.**

Rationale:
1. Cold-start total bytes: Zarr 224 KB vs Parquet 466 KB — 52% less, due
   to Parquet's 320 KB footer (stores per-column stats for all 287 ions).
2. Cold-start latency (wifi): essentially equal (~220 ms for both 2-request
   formats; single-shard 324 ms due to 3 serial requests).
3. zarrita confirmed working in JS (Bun; ZEP2 sharding verified via Range
   requests on single-shard and plain GET on per-ion).
4. Per-ion access pattern: 2 requests (zarr.json + GET c/{i}/0/0), no Range
   headers needed, simpler CDN configuration.

Open gate items (not blocking S3, blocking GitHub Pages):
- zarrita bundle ≤ 50 KB minified (`vite build --report`)
- Browser CORS test (not Bun)

---

### Note: Parquet Row Group Size Discrepancy

`run_benchmark.py` reports H-1 row group = 295.7 KB (from pyarrow
`total_compressed_size`), but actual HTTP download = 145.2 KB. Factor ~2
difference. Root cause not identified. HTTP download size is ground truth.
Does not affect the format decision.

---

## Files Changed

- `prototypes/extdata-formats/run_s3_benchmark.py` — new
- `prototypes/extdata-formats/browser/package.json` — new
- `prototypes/extdata-formats/browser/benchmark.ts` — new
- `prototypes/extdata-formats/REPORT_S3.md` — generated
- `prototypes/extdata-formats/REPORT_S3_ZARRITA.md` — generated
- `prototypes/extdata-formats/VERDICT.md` — new
- `prototypes/extdata-formats/PLAN.md` — status + 8 stale shape references
- `CHANGELOG-AI.md` — new row
- `docs/ai-logs/2026-04-18-spike4-s3-verdict.md` — this file
- `docs/ai-logs/README.md` — new entry
