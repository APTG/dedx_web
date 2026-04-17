"""Measure local file sizes and HTTP cost simulation for all three formats.

Run after all three writers have completed. Writes REPORT.md.
"""

import os
import struct
from pathlib import Path
import numpy as np
import pyarrow.parquet as pq

PARQUET_PATH = "data/srim_synthetic.webdedx.parquet"
ZARR_SINGLE  = "data/srim_synthetic_single.zarr"
ZARR_PER_ION = "data/srim_synthetic_per_ion.zarr"
PROGRAM      = "srim-2013"


def dir_size(path: str) -> int:
    return sum(f.stat().st_size for f in Path(path).rglob("*") if f.is_file())


def file_count(path: str) -> int:
    return sum(1 for f in Path(path).rglob("*") if f.is_file())


def parquet_footer_size(path: str) -> int:
    with open(path, "rb") as f:
        f.seek(-8, 2)
        footer_len = struct.unpack("<I", f.read(4))[0]
    return footer_len + 8


def parquet_row_group_size(path: str, rg_index: int) -> int:
    pf = pq.ParquetFile(path)
    rg = pf.metadata.row_group(rg_index)
    total = sum(rg.column(c).total_compressed_size for c in range(rg.num_columns))
    return total


def shard_size(zarr_path: str, quantity: str, ion_index: int) -> int:
    p = Path(zarr_path) / PROGRAM / quantity / "c" / str(ion_index) / "0" / "0"
    return p.stat().st_size if p.exists() else 0


def shard_index_size(n_inner_chunks: int = 287) -> int:
    return n_inner_chunks * 2 * 8


def round_trip_check():
    """Verify single vs per-ion Zarr round-trip consistency."""
    import zarr

    z_single  = zarr.open_group(ZARR_SINGLE,  mode="r")
    z_per_ion = zarr.open_group(ZARR_PER_ION, mode="r")

    stp_s = z_single[f"{PROGRAM}/stp"]
    stp_p = z_per_ion[f"{PROGRAM}/stp"]

    # Check first ion, electron, and a middle ion
    for idx in [0, 143, 286]:
        diff = np.max(np.abs(stp_s[idx] - stp_p[idx]))
        assert diff < 1e-5, f"ion {idx}: max diff {diff}"

    # Check Parquet vs Zarr for ion 0 (H-1)
    pf = pq.ParquetFile(PARQUET_PATH)
    rg0 = pf.read_row_group(0)
    stp_parquet = np.array(rg0["stopping_power"].to_pylist(), dtype=np.float32)
    stp_zarr    = stp_s[0].reshape(-1)  # (379*165,)
    diff_pq = np.max(np.abs(stp_parquet - stp_zarr))
    assert diff_pq < 1e-4, f"Parquet vs Zarr H-1 max diff: {diff_pq}"
    return True


def main():
    rows = []

    # --- Sizes ---
    pq_total  = os.path.getsize(PARQUET_PATH)
    zs_total  = dir_size(ZARR_SINGLE)
    zp_total  = dir_size(ZARR_PER_ION)

    pq_footer = parquet_footer_size(PARQUET_PATH)
    zs_idx    = shard_index_size(287)

    pq_rg0    = parquet_row_group_size(PARQUET_PATH, 0)    # H-1
    pq_rg286  = parquet_row_group_size(PARQUET_PATH, 286)  # electron

    zs_stp_shard  = shard_size(ZARR_SINGLE, "stp", 0)  # single-shard stp
    zs_csda_shard = shard_size(ZARR_SINGLE, "csda_range", 0)

    # Per-ion: first inner chunk (ion 0) and electron (ion 286)
    zp_stp_ion0   = shard_size(ZARR_PER_ION, "stp", 0)
    zp_stp_ione   = shard_size(ZARR_PER_ION, "stp", 286)
    zp_csda_ion0  = shard_size(ZARR_PER_ION, "csda_range", 0)

    zs_files = file_count(ZARR_SINGLE)
    zp_files = file_count(ZARR_PER_ION)

    # Uncompressed reference
    uncomp = 287 * 379 * 165 * 4  # per quantity

    def mb(b): return f"{b/1e6:.2f} MB"
    def kb(b): return f"{b/1024:.1f} KB"

    lines = [
        "# Spike 4 Benchmark Report — Local Sizes\n",
        f"Generated from: `{PARQUET_PATH}`, `{ZARR_SINGLE}`, `{ZARR_PER_ION}`\n",
        "",
        "## Total File Sizes",
        "",
        "| Format | Total size | File count |",
        "|--------|-----------|------------|",
        f"| Parquet | {mb(pq_total)} | 1 |",
        f"| Zarr single shard | {mb(zs_total)} | {zs_files} |",
        f"| Zarr per-ion | {mb(zp_total)} | {zp_files} |",
        f"| Uncompressed (per quantity) | {mb(uncomp)} | — |",
        "",
        "## Per-Ion Fetch Sizes (cold start)",
        "",
        "| Format | What is fetched | Size | HTTP requests (cold) |",
        "|--------|----------------|------|----------------------|",
        f"| Parquet | footer | {kb(pq_footer)} | 1 (tail Range) |",
        f"| Parquet | H-1 row group | {kb(pq_rg0)} | 1 Range |",
        f"| Parquet | electron row group | {kb(pq_rg286)} | 1 Range |",
        f"| Zarr single — stp | shard index | {kb(zs_idx)} | 1 Range |",
        f"| Zarr single — stp | stp shard file | {mb(zs_stp_shard)} | (full shard) |",
        f"| Zarr single — csda | csda shard file | {mb(zs_csda_shard)} | (full shard) |",
        f"| Zarr per-ion — stp | H-1 shard c/0/0/0 | {kb(zp_stp_ion0)} | 1 GET |",
        f"| Zarr per-ion — stp | electron shard c/286/0/0 | {kb(zp_stp_ione)} | 1 GET |",
        f"| Zarr per-ion — csda | H-1 shard c/0/0/0 | {kb(zp_csda_ion0)} | 1 GET |",
        "",
        "## Cold HTTP Request Budget",
        "",
        "| Format | Requests | What |",
        "|--------|----------|------|",
        "| Parquet | 2 | zarr.json/footer + ion row group Range |",
        "| Zarr single shard | 3 per quantity | zarr.json + shard-index Range + ion-chunk Range |",
        "| Zarr per-ion | 2 per quantity | zarr.json + c/{i}/0/0 GET |",
        "",
        "## Round-Trip Consistency",
    ]

    try:
        ok = round_trip_check()
        lines.append("PASS — Zarr single vs per-ion max diff < 1e-5; Parquet vs Zarr max diff < 1e-4")
    except Exception as e:
        lines.append(f"FAIL — {e}")

    report = "\n".join(lines) + "\n"
    print(report)
    with open("REPORT.md", "w") as f:
        f.write(report)
    print("REPORT.md written.")


if __name__ == "__main__":
    main()
