# Spike 4 Benchmark Report — Local Sizes

Generated from: `data/srim_synthetic.webdedx.parquet`, `data/srim_synthetic_single.zarr`, `data/srim_synthetic_per_ion.zarr`


## Total File Sizes

| Format | Total size | File count |
|--------|-----------|------------|
| Parquet | 87.86 MB | 1 |
| Zarr single shard | 82.16 MB | 6 |
| Zarr per-ion | 82.16 MB | 578 |
| Uncompressed (per quantity) | 71.79 MB | — |

## Per-Ion Fetch Sizes (cold start)

| Format | What is fetched | Size | HTTP requests (cold) |
|--------|----------------|------|----------------------|
| Parquet | footer | 320.8 KB | 1 (tail Range) |
| Parquet | H-1 row group | 295.7 KB | 1 Range |
| Parquet | electron row group | 410.5 KB | 1 Range |
| Zarr single — stp | shard index | 4.5 KB | 1 Range |
| Zarr single — stp | stp shard file | 40.51 MB | (full shard) |
| Zarr single — csda | csda shard file | 41.56 MB | (full shard) |
| Zarr per-ion — stp | H-1 shard c/0/0/0 | 137.5 KB | 1 GET |
| Zarr per-ion — stp | electron shard c/286/0/0 | 217.7 KB | 1 GET |
| Zarr per-ion — csda | H-1 shard c/0/0/0 | 141.2 KB | 1 GET |

## Cold HTTP Request Budget

| Format | Requests | What |
|--------|----------|------|
| Parquet | 2 | zarr.json/footer + ion row group Range |
| Zarr single shard | 3 per quantity | zarr.json + shard-index Range + ion-chunk Range |
| Zarr per-ion | 2 per quantity | zarr.json + c/{i}/0/0 GET |

## Round-Trip Consistency
PASS — Zarr single vs per-ion max diff < 1e-5; Parquet vs Zarr max diff < 1e-4
