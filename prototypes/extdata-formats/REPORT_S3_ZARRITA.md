# Spike 4 — S3 Zarrita Benchmark

**Date:** Sat, 18 Apr 2026 07:31:27 GMT  
**Runtime:** Bun (Node-compatible JS)  
**Base URL:** `https://s3p.cloud.cyfronet.pl/webdedx`  
**Zarrita version:** 0.7.1

## Per-ion Zarr

| Request | Size | Latency | Notes |
|---------|------|---------|-------|
| zarr-per-ion / zarr.json (root) | 86.9 KB | 106 ms | particles + materials + energy grid |
| zarr-per-ion / stp/zarr.json | 1.3 KB | 13 ms | array metadata |
| zarr-per-ion / H-1 shard → water STP | 137.5 KB | 66 ms | downloads c/0/0/0 (full ion shard) |
| zarr-per-ion / C-12 shard → PMMA STP | 137.3 KB | 70 ms | downloads c/9/0/0 (full ion shard) |

## Single-shard Zarr

| Request | Size | Latency | Notes |
|---------|------|---------|-------|
| zarr-single / zarr.json (root) | 86.9 KB | 77 ms | particles + materials + energy grid |
| zarr-single / stp/zarr.json | 1.3 KB | 13 ms | array metadata |
| zarr-single / H-1 inner chunk → water STP | 142.0 KB | 81 ms | shard-index Range + inner-chunk Range |
| zarr-single / C-12 inner chunk → PMMA STP | 137.3 KB | 16 ms | shard-index cached + inner-chunk Range |

## Cold-start budget — first H-1 STP fetch (zarr.json + data)

| Format | Total KB | Total ms |
|--------|----------|----------|
| Zarr per-ion | 224.4 KB | 171 ms |
| Zarr single  | 228.9 KB | 157 ms |

## STP values

**H-1 in Water (per-ion Zarr)** — STP (MeV cm²/g) at selected energies
| E index | E (MeV/u) | STP |
|---------|-----------|-----|
| 0 | 0.0011 | 2600.5818 |
| 10 | 0.003 | 1144.2577 |
| 30 | 0.025 | 190.7122 |
| 50 | 0.120 | 873.9947 |
| 80 | 2.0 | 648.7191 |
| 100 | 10 | 190.2801 |
| 130 | 200 | 21.1617 |
| 164 | 2000 | 4.3220 |
**C-12 in PMMA (per-ion Zarr)** — STP (MeV cm²/g) at selected energies
| E index | E (MeV/u) | STP |
|---------|-----------|-----|
| 0 | 0.0011 | 7801.7451 |
| 10 | 0.003 | 3432.7729 |
| 30 | 0.025 | 572.1365 |
| 50 | 0.120 | 2749.9910 |
| 80 | 2.0 | 1955.0308 |
| 100 | 10 | 572.4982 |
| 130 | 200 | 63.6020 |
| 164 | 2000 | 12.9841 |

**H-1 in Water (single-shard Zarr)** — STP (MeV cm²/g) at selected energies
| E index | E (MeV/u) | STP |
|---------|-----------|-----|
| 0 | 0.0011 | 2600.5818 |
| 10 | 0.003 | 1144.2577 |
| 30 | 0.025 | 190.7122 |
| 50 | 0.120 | 873.9947 |
| 80 | 2.0 | 648.7191 |
| 100 | 10 | 190.2801 |
| 130 | 200 | 21.1617 |
| 164 | 2000 | 4.3220 |
**C-12 in PMMA (single-shard Zarr)** — STP (MeV cm²/g) at selected energies
| E index | E (MeV/u) | STP |
|---------|-----------|-----|
| 0 | 0.0011 | 7801.7451 |
| 10 | 0.003 | 3432.7729 |
| 30 | 0.025 | 572.1365 |
| 50 | 0.120 | 2749.9910 |
| 80 | 2.0 | 1955.0308 |
| 100 | 10 | 572.4982 |
| 130 | 200 | 63.6020 |
| 164 | 2000 | 12.9841 |
