# ADR 004 — External Data Storage Format: Zarr v3 Per-Ion Shards

**Status:** Accepted (18 April 2026)

---

## Context

The external-data feature ([`docs/04-feature-specs/external-data.md`](../04-feature-specs/external-data.md))
requires a browser-consumable storage format for user-hosted stopping-power
datasets (`.webdedx` stores). The format must satisfy:

| Requirement | Detail |
|-------------|--------|
| **Per-ion partial reads** | The user selects one particle at a time. Fetching all particles to read one must be avoided. |
| **HTTP Range Requests** | No server-side logic — data is served as static files from S3, GitHub Pages, or nginx. |
| **Browser JS reader ≤ 50 kB minified** | No native Node.js dependencies. The reader must work in a SvelteKit browser bundle. |
| **3-D array structure** | Shape `(n_particles, n_materials, n_energies)`. Two quantities: STP and (optionally) CSDA range. One shared energy coordinate per program. |
| **CORS-friendly** | All files served under a URL prefix with `Access-Control-Allow-Origin: *`. |

The original spec (`external-data.md` v1–v4) used **Apache Parquet** with the
`hyparquet` reader. Spike 4 (`prototypes/extdata-formats/`, 2026-04-18) evaluated
three candidates on a real S3 bucket with measured HTTP traffic.

---

## Alternatives Considered

### A. Apache Parquet + hyparquet (original spec)

| Property | Value |
|----------|-------|
| Cold-start bytes (S3, wifi) | **466 KB** — 320.8 KB footer + 145.2 KB row group |
| Per-ion fetch | 2 requests: footer Range + row-group Range |
| JS reader | `hyparquet` ~20 kB minified |
| Local file size | 87.86 MB (single file) |

**Problem:** Parquet stores statistics for every column cell in the footer; with
287 particles × 165 energies × 379 materials, this footer grows to 320.8 KB and
must be fetched in full before any row group can be located. This alone accounts
for 69% of the cold-start bytes.

### B. Zarr v3 single-shard + zarrita

| Property | Value |
|----------|-------|
| Cold-start bytes (browser, S3) | **230.2 KB** — 86.5 KB zarr.json + 1.3 KB array meta + 20 B HEAD + 4.5 KB ZEP2 index + 137.5 KB data |
| Per-ion fetch | 7 requests |
| ZEP2 shard index | **4.5 KB** (287 inner chunks × 16 B + 4 B CRC) |
| JS reader | zarrita core 38.62 kB |
| Local file size | 82.16 MB (6 files) |

**Problem:** A single-shard store places all 287 ions in one shard file. The
ZEP2 shard index must enumerate all inner chunks (287 × 16 + 4 = 4.5 KB)
before any one ion can be located. Simpler to deploy (fewer files) but adds
4.5 KB overhead per cold start.

### C. Zarr v3 per-ion shards + zarrita (adopted)

| Property | Value |
|----------|-------|
| Cold-start bytes (browser, S3) | **225.7 KB** — 86.5 KB zarr.json + 1.3 KB array meta + 0 B HEAD + **20 B** ZEP2 index + 137.5 KB data |
| Per-ion fetch | 7 requests |
| ZEP2 shard index | **20 B** (1 inner chunk × 16 B + 4 B CRC) |
| JS reader | zarrita core 38.62 kB (gzip 12.89 kB); LZ4 codec chunk 36.59 kB |
| Local file size | 82.16 MB (578 files for 287 particles × 1 program) |
| File count concern | ~2 + n\_programs × (2 × n\_particles + 2) files — confirmed OK on S3 and GitHub Pages (Spike 4 AC #12) |

---

## Decision

**Adopt Zarr v3 per-ion shards** (option C) as the `.webdedx` storage format,
with **zarrita 0.7.x** as the JS reader.

Shard configuration: `chunk_shape = (1, n_materials, n_energies)` so each shard
file contains exactly one particle's data for all materials and energies.
Codec: LZ4 (matched by zarrita's lz4 codec chunk, 36.59 kB).

---

## Rationale

### Why not Parquet?

Cold-start bytes are 52% less with Zarr per-ion (225.7 KB vs 466 KB). The
difference is dominated by Parquet's 320.8 KB footer, which scales with row group
count and cannot be avoided. Per-ion data size is 5.5% smaller (137.5 KB vs
145.2 KB) — a secondary benefit.

### Why per-ion over single-shard?

- **ZEP2 index overhead:** per-ion = 20 B (1 inner chunk); single = 4.5 KB (287
  inner chunks). Cold-start bytes: 225.7 KB vs 230.2 KB.
- **Simpler access pattern:** each file contains exactly one ion's data, which
  maps directly to the expected access pattern (user selects one particle).
- **CDN caching:** per-ion shard files have stable, predictable per-ion content;
  single-shard file content changes when any ion's data is updated.
- **Request count is equal** (7 each on fast wifi) — the per-ion shard index fetch
  (20 B Range) is negligible, not an extra round trip.

### zarrita vs hyparquet

zarrita core (38.62 kB) is larger than hyparquet (~20 kB) but within the ≤ 50 kB
gate criterion. The LZ4 codec chunk (36.59 kB) is an additional lazy-loaded chunk
(not in the initial parse path). The blosc (603 kB) and zstd (747 kB) codec chunks
are bundled by Vite but not needed for LZ4-encoded data — lazy-loading
investigation is a post-gate work item.

---

## Consequences

### Positive

- **52% fewer cold-start bytes** vs Parquet (225.7 KB vs 466 KB, S3/wifi measured).
- **No footer problem** — zarr.json root metadata (~86.5 KB) is structurally
  simpler than Parquet's footer and does not scale with row count or column count.
- **Per-ion access maps to user intent** — selecting a particle fetches exactly
  that particle's shard, with no wasted bytes.
- **Standard cloud-native format** — Zarr v3 is readable by zarr-python, zarrita,
  and other tools without webdedx-specific code. Python `zarr` library is used for
  store generation (converter tooling).
- **zarrita is pure JS** — no WebAssembly, no native bindings; works in all
  browser environments.

### Negative / risks

- **578 files per single-program dataset** (287 particles × 2 quantities + metadata).
  Confirmed non-blocking on S3 and GitHub Pages (Spike 4 AC #12). But the number
  scales with `n_programs × 2 × n_particles` — a 5-program dataset with 287
  particles would have ~2880 files. Upload tooling must handle bulk uploads cleanly.
- **zarrita v2 compat probe** — zarrita 0.7.1 fetches `.zattrs` and `.zgroup`
  on every `open(root(...))` call (2 extra 404 requests per store open). These are
  expected and handled silently, but add 2 requests to the cold-start count.
  Post-gate investigation item: check whether a zarrita flag can suppress them.
- **LZ4 codec chunk** (36.59 kB) is always needed for `.webdedx` data. If Vite
  lazy-loads it correctly, it does not inflate the initial bundle; if not, it adds
  36.59 kB to the parse path. Post-gate investigation item.
- **No single-file MIME type** — `.webdedx` is a directory, not a file. Users
  cannot "download" it as a single artifact; they must use the converter tooling
  or `rclone`/`aws s3 sync` to transfer the store.

---

## References

- [`docs/04-feature-specs/external-data.md`](../04-feature-specs/external-data.md) — full format specification
- [`prototypes/extdata-formats/VERDICT.md`](../../prototypes/extdata-formats/VERDICT.md) — benchmark results and acceptance criteria
- [`docs/11-prototyping-spikes.md`](../11-prototyping-spikes.md) — Spike 4 gate record
- [`docs/02-tech-stack.md` §6](../02-tech-stack.md#6-external-data-reader) — zarrita version pin
