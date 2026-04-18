# Spike 4 — S3 HTTP Benchmark

**Date:** 2026-04-18 07:31 UTC  
**Base URL:** `https://s3p.cloud.cyfronet.pl/webdedx`


## Request-by-request timings

| Request | Size | Latency | Throughput | Notes |
|---------|------|---------|------------|-------|
| parquet / footer (tail Range) | 320.8 KB | 124 ms | 2.64 MB/s | 328500 B Thrift metadata + 8 B tail |
| parquet / H-1 row group (Range) | 145.2 KB | 99 ms | 1.49 MB/s | rg 0, all 6 columns |
| parquet / electron row group (Range) | 205.2 KB | 121 ms | 1.73 MB/s | rg 286, all 6 columns |
| zarr-per-ion / zarr.json (root) | 86.5 KB | 103 ms | 0.86 MB/s | particles + materials + energy grid |
| zarr-per-ion / stp/zarr.json | 1.3 KB | 102 ms | 0.01 MB/s | array metadata |
| zarr-per-ion / stp H-1 shard (GET) | 137.5 KB | 119 ms | 1.18 MB/s | c/0/0/0, ion 0 (H-1) |
| zarr-per-ion / stp electron shard (GET) | 217.7 KB | 120 ms | 1.85 MB/s | c/286/0/0, ion 286 (e⁻) |
| zarr-per-ion / csda H-1 shard (GET) | 141.2 KB | 78 ms | 1.84 MB/s | c/0/0/0, ion 0 (H-1) |
| zarr-single / zarr.json (root) | 86.5 KB | 120 ms | 0.74 MB/s | particles + materials + energy grid |
| zarr-single / stp/zarr.json | 1.3 KB | 66 ms | 0.02 MB/s | array metadata |
| zarr-single / stp shard index (Range tail) | 4.5 KB | 58 ms | 0.08 MB/s | last 4596 B of ~40.5 MB shard |
| zarr-single / stp H-1 inner chunk (Range) | 137.5 KB | 81 ms | 1.75 MB/s | chunk 0 @ byte 0 |

## Cold-start budget — fetch one ion (H-1 STP)

| Format | Requests | Total bytes | Total time |
|--------|----------|-------------|------------|
| Parquet | 2 (footer + row-group Range) | 466.0 KB | 224 ms |
| Zarr per-ion | 2 (zarr.json + shard GET) | 224.0 KB | 222 ms |
| Zarr single | 3 (zarr.json + index Range + chunk Range) | 229.7 KB | 324 ms |

> ⚠️ Single-shard full file (~40.5 MB) was **not** downloaded.
> The Range-request path (index + inner chunk) was benchmarked instead.
