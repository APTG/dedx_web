"""HTTP latency benchmark against S3-hosted srim_synthetic files.

Measures cold-start fetch times for all three formats from:
  https://s3p.cloud.cyfronet.pl/webdedx/

Single-shard Zarr: fetches only the shard index (4596 B) + one inner-chunk
Range (~140 KB). Does NOT download the full 40 MB shard.

Run from prototypes/extdata-formats/ with the venv active:
  python run_s3_benchmark.py

Writes REPORT_S3.md in the same directory.
"""

import struct
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq

BASE = "https://s3p.cloud.cyfronet.pl/webdedx"
PARQUET_URL = f"{BASE}/srim_synthetic.webdedx.parquet"
ZARR_SINGLE_URL = f"{BASE}/srim_synthetic_single.zarr"
ZARR_PER_ION_URL = f"{BASE}/srim_synthetic_per_ion.zarr"
PROGRAM = "srim-2013"
LOCAL_PARQUET = "data/srim_synthetic.webdedx.parquet"

# Zarr v3 ShardingCodec: n_chunks * (uint64 offset + uint64 nbytes) + 4-byte CRC32C
N_INNER_CHUNKS = 287
SHARD_INDEX_BYTES = N_INNER_CHUNKS * 16 + 4  # 4596


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get(url: str, headers: dict | None = None) -> tuple[bytes, float]:
    req = urllib.request.Request(url, headers=headers or {})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return data, time.perf_counter() - t0


def _head_size(url: str) -> int:
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=30) as r:
        return int(r.headers["Content-Length"])


def get_range(url: str, start: int, end: int) -> tuple[bytes, float]:
    return _get(url, {"Range": f"bytes={start}-{end}"})


def get_suffix(url: str, nbytes: int) -> tuple[bytes, float]:
    return _get(url, {"Range": f"bytes=-{nbytes}"})


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def _sz(b: int) -> str:
    return f"{b/1024:.1f} KB" if b < 1_000_000 else f"{b/1e6:.2f} MB"


def _ms(s: float) -> str:
    return f"{s * 1000:.0f} ms"


def _mbps(b: int, s: float) -> str:
    return f"{b / 1e6 / s:.2f} MB/s"


# ---------------------------------------------------------------------------
# Benchmark sections
# ---------------------------------------------------------------------------

class Entry:
    def __init__(self, label: str, size_b: int, elapsed_s: float, note: str = ""):
        self.label = label
        self.size_b = size_b
        self.elapsed_s = elapsed_s
        self.note = note

    def md_row(self) -> str:
        return (
            f"| {self.label} | {_sz(self.size_b)} | {_ms(self.elapsed_s)}"
            f" | {_mbps(self.size_b, self.elapsed_s)} | {self.note} |"
        )


def bench_parquet() -> list[Entry]:
    print("### Parquet")
    entries = []

    # --- footer ---
    # Last 8 bytes contain: 4-byte footer_len (LE) + 4-byte magic "PAR1"
    tail, _ = get_suffix(PARQUET_URL, 8)
    footer_len = struct.unpack("<I", tail[0:4])[0]
    footer_total = footer_len + 8

    footer_data, t = get_suffix(PARQUET_URL, footer_total)
    entries.append(Entry("parquet / footer (tail Range)", len(footer_data), t,
                         f"{footer_len} B Thrift metadata + 8 B tail"))
    print(f"  footer: {_sz(len(footer_data))} in {_ms(t)}")

    # --- row group offsets from local file (identical bytes to S3 copy) ---
    if not Path(LOCAL_PARQUET).exists():
        print("  [skip row groups — local file not found]")
        return entries

    pf = pq.ParquetFile(LOCAL_PARQUET)

    def rg_range(rg_idx: int) -> tuple[int, int]:
        rg = pf.metadata.row_group(rg_idx)
        start = min(rg.column(c).file_offset for c in range(rg.num_columns))
        end   = max(rg.column(c).file_offset + rg.column(c).total_compressed_size
                    for c in range(rg.num_columns))
        return start, end - 1  # inclusive end for Range header

    # H-1 (row group 0)
    s, e = rg_range(0)
    data, t = get_range(PARQUET_URL, s, e)
    entries.append(Entry("parquet / H-1 row group (Range)", len(data), t, "rg 0, all 6 columns"))
    print(f"  H-1 row group: {_sz(len(data))} in {_ms(t)}")

    # electron (row group 286)
    s, e = rg_range(286)
    data, t = get_range(PARQUET_URL, s, e)
    entries.append(Entry("parquet / electron row group (Range)", len(data), t, "rg 286, all 6 columns"))
    print(f"  electron row group: {_sz(len(data))} in {_ms(t)}")

    return entries


def bench_zarr_per_ion() -> list[Entry]:
    print("### Zarr per-ion")
    entries = []

    data, t = _get(f"{ZARR_PER_ION_URL}/zarr.json")
    entries.append(Entry("zarr-per-ion / zarr.json (root)", len(data), t, "particles + materials + energy grid"))
    print(f"  zarr.json: {_sz(len(data))} in {_ms(t)}")

    data, t = _get(f"{ZARR_PER_ION_URL}/{PROGRAM}/stp/zarr.json")
    entries.append(Entry("zarr-per-ion / stp/zarr.json", len(data), t, "array metadata"))
    print(f"  stp/zarr.json: {_sz(len(data))} in {_ms(t)}")

    data, t = _get(f"{ZARR_PER_ION_URL}/{PROGRAM}/stp/c/0/0/0")
    entries.append(Entry("zarr-per-ion / stp H-1 shard (GET)", len(data), t, "c/0/0/0, ion 0 (H-1)"))
    print(f"  stp H-1: {_sz(len(data))} in {_ms(t)}")

    data, t = _get(f"{ZARR_PER_ION_URL}/{PROGRAM}/stp/c/286/0/0")
    entries.append(Entry("zarr-per-ion / stp electron shard (GET)", len(data), t, "c/286/0/0, ion 286 (e⁻)"))
    print(f"  stp electron: {_sz(len(data))} in {_ms(t)}")

    data, t = _get(f"{ZARR_PER_ION_URL}/{PROGRAM}/csda_range/c/0/0/0")
    entries.append(Entry("zarr-per-ion / csda H-1 shard (GET)", len(data), t, "c/0/0/0, ion 0 (H-1)"))
    print(f"  csda H-1: {_sz(len(data))} in {_ms(t)}")

    return entries


def bench_zarr_single() -> list[Entry]:
    print("### Zarr single shard")
    entries = []

    data, t = _get(f"{ZARR_SINGLE_URL}/zarr.json")
    entries.append(Entry("zarr-single / zarr.json (root)", len(data), t, "particles + materials + energy grid"))
    print(f"  zarr.json: {_sz(len(data))} in {_ms(t)}")

    data, t = _get(f"{ZARR_SINGLE_URL}/{PROGRAM}/stp/zarr.json")
    entries.append(Entry("zarr-single / stp/zarr.json", len(data), t, "array metadata"))
    print(f"  stp/zarr.json: {_sz(len(data))} in {_ms(t)}")

    shard_url = f"{ZARR_SINGLE_URL}/{PROGRAM}/stp/c/0/0/0"
    index_data, t = get_suffix(shard_url, SHARD_INDEX_BYTES)
    entries.append(Entry("zarr-single / stp shard index (Range tail)", len(index_data), t,
                         f"last {SHARD_INDEX_BYTES} B of ~40.5 MB shard"))
    print(f"  stp shard index: {_sz(len(index_data))} in {_ms(t)}")

    # Parse index: each entry is (offset: uint64_le, nbytes: uint64_le)
    # Entries are ordered by inner chunk coordinate (C-order: ion axis first)
    chunk_offset, chunk_len = struct.unpack_from("<QQ", index_data, 0)
    print(f"  stp H-1 chunk: offset={chunk_offset}, nbytes={chunk_len} ({_sz(chunk_len)})")

    if chunk_offset != 0xFFFFFFFFFFFFFFFF and chunk_len > 0:
        data, t = get_range(shard_url, chunk_offset, chunk_offset + chunk_len - 1)
        entries.append(Entry("zarr-single / stp H-1 inner chunk (Range)", len(data), t,
                             f"chunk 0 @ byte {chunk_offset}"))
        print(f"  stp H-1 inner chunk: {_sz(len(data))} in {_ms(t)}")

    return entries


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    print(f"\nS3 HTTP Benchmark — {ts}")
    print(f"Base URL: {BASE}\n")

    pq_entries  = bench_parquet()
    zp_entries  = bench_zarr_per_ion()
    zs_entries  = bench_zarr_single()

    # --- totals for one full cold fetch of H-1 STP ---
    def total_cold(entries: list[Entry], labels: list[str]) -> tuple[int, float]:
        subset = [e for e in entries if any(lbl in e.label for lbl in labels)]
        return sum(e.size_b for e in subset), sum(e.elapsed_s for e in subset)

    pq_b,  pq_t  = total_cold(pq_entries,  ["footer", "H-1 row group"])
    zp_b,  zp_t  = total_cold(zp_entries,  ["zarr.json (root)", "stp H-1"])
    zs_b,  zs_t  = total_cold(zs_entries,  ["zarr.json (root)", "stp/zarr.json", "shard index", "H-1 inner chunk"])

    lines = [
        f"# Spike 4 — S3 HTTP Benchmark\n",
        f"**Date:** {ts}  ",
        f"**Base URL:** `{BASE}`\n",
        "",
        "## Request-by-request timings\n",
        "| Request | Size | Latency | Throughput | Notes |",
        "|---------|------|---------|------------|-------|",
    ]
    for e in pq_entries + zp_entries + zs_entries:
        lines.append(e.md_row())

    lines += [
        "",
        "## Cold-start budget — fetch one ion (H-1 STP)",
        "",
        "| Format | Requests | Total bytes | Total time |",
        "|--------|----------|-------------|------------|",
        f"| Parquet | 2 (footer + row-group Range) | {_sz(pq_b)} | {_ms(pq_t)} |",
        f"| Zarr per-ion | 2 (zarr.json + shard GET) | {_sz(zp_b)} | {_ms(zp_t)} |",
        f"| Zarr single | 3 (zarr.json + index Range + chunk Range) | {_sz(zs_b)} | {_ms(zs_t)} |",
        "",
        "> ⚠️ Single-shard full file (~40.5 MB) was **not** downloaded.",
        "> The Range-request path (index + inner chunk) was benchmarked instead.",
    ]

    report = "\n".join(lines) + "\n"
    out = Path("REPORT_S3.md")
    out.write_text(report)
    print(f"\nWritten: {out}")
    print(report)


if __name__ == "__main__":
    main()
