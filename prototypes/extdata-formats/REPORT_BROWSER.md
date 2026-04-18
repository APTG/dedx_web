# Spike 4 — Browser Benchmark Report

**Date:** Sat, 18 Apr 2026 11:21:48 GMT  
**Runtime:** Chrome (browser) via Vite dev server  
**Base URL:** `https://s3p.cloud.cyfronet.pl/webdedx`  
**zarrita version:** 0.7.1  
**Vite build:** zarrita chunk 38.62 kB minified (gzip 12.89 kB)  
**CORS:** ✅ No errors — S3 CORS config working  

---

## Per-Request Breakdown

Range headers captured via `globalThis.fetch` interceptor.  
TTFB / transfer size not available (S3 does not send `Timing-Allow-Origin: *`).  
For full headers and timing phases, see DevTools HAR export (`spike4-zarr-2026-04-18T11-21-56.har.json`).

### Per-ion Zarr

| URL (…/srim_synthetic_per_ion.zarr/) | Range header | Bytes | Duration | Operation |
|--------------------------------------|--------------|-------|----------|-----------|
| `.zattrs` | — | 0.2 KB | 54 ms | root zarr.json |
| `.zgroup` | — | 0.2 KB | 14 ms | root zarr.json |
| `zarr.json` | — | 86.5 KB | 67 ms | root zarr.json |
| `srim-2013/stp/zarr.json` | — | 1.3 KB | 15 ms | stp/zarr.json |
| `srim-2013/stp/c/0/0/0` | — | 0.0 KB | 14 ms | H-1 shard (HEAD probe) |
| `srim-2013/stp/c/0/0/0` | `bytes=140812-140831` | 0.0 KB | 55 ms | H-1 shard (ZEP2 index, 20 B) |
| `srim-2013/stp/c/0/0/0` | `bytes=0-140811` | 137.5 KB | 27 ms | H-1 shard (data) |
| `srim-2013/stp/c/9/0/0` | — | 0.0 KB | 17 ms | C-12 shard (HEAD probe) |
| `srim-2013/stp/c/9/0/0` | `bytes=140589-140608` | 0.0 KB | 14 ms | C-12 shard (ZEP2 index, 20 B) |
| `srim-2013/stp/c/9/0/0` | `bytes=0-140588` | 137.3 KB | 17 ms | C-12 shard (data) |

### Single-shard Zarr

| URL (…/srim_synthetic_single.zarr/) | Range header | Bytes | Duration | Operation |
|--------------------------------------|--------------|-------|----------|-----------|
| `.zattrs` | — | 0.2 KB | 55 ms | root zarr.json |
| `.zgroup` | — | 0.2 KB | 53 ms | root zarr.json |
| `zarr.json` | — | 86.5 KB | 34 ms | root zarr.json |
| `srim-2013/stp/zarr.json` | — | 1.3 KB | 15 ms | stp/zarr.json |
| `srim-2013/stp/c/0/0/0` | — | 0.0 KB | 14 ms | H-1 shard (HEAD probe) |
| `srim-2013/stp/c/0/0/0` | `bytes=40506358-40510953` | 4.5 KB | 13 ms | H-1 shard (ZEP2 index, 4596 B) |
| `srim-2013/stp/c/0/0/0` | `bytes=0-140811` | 137.5 KB | 22 ms | H-1 data |
| `srim-2013/stp/c/0/0/0` | `bytes=1267161-1407749` | 137.3 KB | 18 ms | C-12 data (index cached) |

---

## Operation Summary

| Operation | Bytes | Duration | Notes |
|-----------|-------|----------|-------|
| per-ion / root zarr.json | 86.9 KB | 139 ms | .zattrs + .zgroup + zarr.json (3 requests) |
| per-ion / stp/zarr.json | 1.3 KB | 16 ms | array metadata |
| per-ion / H-1 GET stp/c/0/0/0 | 137.5 KB | 132 ms | HEAD + ZEP2 index (20 B) + data Range |
| per-ion / C-12 GET stp/c/9/0/0 | 137.3 KB | 51 ms | HEAD + ZEP2 index (20 B) + data Range |
| single / root zarr.json | 86.9 KB | 142 ms | .zattrs + .zgroup + zarr.json (3 requests) |
| single / stp/zarr.json | 1.3 KB | 16 ms | array metadata |
| single / H-1 Range: shard-index + data chunk | 142.0 KB | 52 ms | HEAD + ZEP2 index (4.5 KB) + data Range |
| single / C-12 Range: data chunk only (index cached) | 137.3 KB | 20 ms | shard index in zarrita cache |

---

## Cold-Start Budget — first H-1 STP fetch

(root zarr.json + stp/zarr.json + H-1 shard)

| Format | HTTP requests | Total bytes | Total time | Python S3 baseline |
|--------|---------------|-------------|------------|--------------------|
| Zarr per-ion | 7 | 225.7 KB | 287 ms | 224 KB / 222 ms |
| Zarr single-shard | 7 | 230.2 KB | 210 ms | 230 KB / 324 ms |

Byte totals match Python S3 baseline within measurement variance.  
Both variants issue 7 HTTP requests (steps detailed in VERDICT.md §2.5).

---

## STP Verification

### H-1 → Water (mat index 275)

| E (MeV/u) | Per-ion STP | Single STP | Match |
|-----------|-------------|------------|-------|
| 0.0011 | 2600.5818 | 2600.5818 | ✓ |
| 0.003 | 1144.2577 | 1144.2577 | ✓ |
| 0.025 | 190.7122 | 190.7122 | ✓ |
| 0.120 | 873.9947 | 873.9947 | ✓ |
| 2.0 | 648.7191 | 648.7191 | ✓ |
| 10 | 190.2801 | 190.2801 | ✓ |
| 200 | 21.1617 | 21.1617 | ✓ |
| 2000 | 4.3220 | 4.3220 | ✓ |

### C-12 → PMMA (mat index 222)

| E (MeV/u) | Per-ion STP | Single STP | Match |
|-----------|-------------|------------|-------|
| 0.0011 | 7801.7451 | 7801.7451 | ✓ |
| 0.003 | 3432.7729 | 3432.7729 | ✓ |
| 0.025 | 572.1365 | 572.1365 | ✓ |
| 0.120 | 2749.9910 | 2749.9910 | ✓ |
| 2.0 | 1955.0308 | 1955.0308 | ✓ |
| 10 | 572.4982 | 572.4982 | ✓ |
| 200 | 63.6020 | 63.6020 | ✓ |
| 2000 | 12.9841 | 12.9841 | ✓ |

All 16 values identical between per-ion and single-shard variants.

---

## Bundle Size (`vite build --report`)

| Chunk | Size (minified) | Gzipped | Notes |
|-------|-----------------|---------|-------|
| zarrita core | 38.62 kB | 12.89 kB | **AC #12 PASS** (≤ 50 kB gate) |
| lz4 codec | 36.59 kB | 16.06 kB | Required for ZEP2 + LZ4 data |
| main app | 9.28 kB | 4.02 kB | benchmark + UI logic |
| blosc codec | 603.44 kB | 204.72 kB | ⚠️ in build; verify lazy-loaded for LZ4-only stores |
| zstd codec | 747.49 kB | 241.91 kB | ⚠️ in build; verify lazy-loaded for LZ4-only stores |

Practical cold-start JS footprint for LZ4 Zarr: zarrita + lz4 = **75.2 kB** minified (28.95 kB gzipped).  
blosc/zstd should not load unless Zarr metadata requests those codecs; investigate before production.
