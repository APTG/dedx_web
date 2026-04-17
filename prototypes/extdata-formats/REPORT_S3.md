# Spike 4 — S3 HTTP Benchmark

**Date:** 2026-04-17 19:46 UTC  
**Base URL:** `https://s3p.cloud.cyfronet.pl/webdedx`


## Request-by-request timings

| Request | Size | Latency | Throughput | Notes |
|---------|------|---------|------------|-------|
| parquet / footer (tail Range) | 320.8 KB | 1762 ms | 0.19 MB/s | 328500 B Thrift metadata + 8 B tail |
| parquet / H-1 row group (Range) | 145.2 KB | 1189 ms | 0.13 MB/s | rg 0, all 6 columns |
| parquet / electron row group (Range) | 205.2 KB | 1040 ms | 0.20 MB/s | rg 286, all 6 columns |
| zarr-per-ion / zarr.json (root) | 86.5 KB | 902 ms | 0.10 MB/s | particles + materials + energy grid |
| zarr-per-ion / stp/zarr.json | 1.3 KB | 448 ms | 0.00 MB/s | array metadata |
| zarr-per-ion / stp H-1 shard (GET) | 137.5 KB | 1348 ms | 0.10 MB/s | c/0/0/0, ion 0 (H-1) |
| zarr-per-ion / stp electron shard (GET) | 217.7 KB | 2300 ms | 0.10 MB/s | c/286/0/0, ion 286 (e⁻) |
| zarr-per-ion / csda H-1 shard (GET) | 141.2 KB | 1046 ms | 0.14 MB/s | c/0/0/0, ion 0 (H-1) |
| zarr-single / zarr.json (root) | 86.5 KB | 812 ms | 0.11 MB/s | particles + materials + energy grid |
| zarr-single / stp/zarr.json | 1.3 KB | 152 ms | 0.01 MB/s | array metadata |
| zarr-single / stp shard index (Range tail) | 4.5 KB | 152 ms | 0.03 MB/s | last 4596 B of ~40.5 MB shard |
| zarr-single / stp H-1 inner chunk (Range) | 137.5 KB | 416 ms | 0.34 MB/s | chunk 0 @ byte 0 |

## Cold-start budget — fetch one ion (H-1 STP)

| Format | Requests | Total bytes | Total time |
|--------|----------|-------------|------------|
| Parquet | 2 (footer + row-group Range) | 466.0 KB | 2951 ms |
| Zarr per-ion | 2 (zarr.json + shard GET) | 224.0 KB | 2250 ms |
| Zarr single | 3 (zarr.json + index Range + chunk Range) | 229.7 KB | 1532 ms |

> ⚠️ Single-shard full file (~40.5 MB) was **not** downloaded.
> The Range-request path (index + inner chunk) was benchmarked instead.
