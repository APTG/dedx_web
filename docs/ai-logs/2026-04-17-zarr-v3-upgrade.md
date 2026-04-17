# 2026-04-17 — Spike 4: Zarr v3 Upgrade + Redesign Plan Integration

## Session Narrative

### Prompt: Upgrade Zarr v2 → Zarr v3; add spike to Stage 2.5

**User request:** Update the plan to use Zarr v3 instead of Zarr v2.
Also add Spike 4 to Stage 2.5 in the redesign plan. Verify Zarr v3 spec
from `https://zarr-specs.readthedocs.io/en/latest/v3/core/index.html`.

**AI response:**

Attempted to fetch the readthedocs site directly — received HTTP 403.
Fetched via GitHub raw/tree URLs instead:

- Zarr v3 vs v2 key differences (from zarr-specs repo):
  - Metadata: `zarr.json` replaces `.zarray` + `.zattrs`
  - Codecs: unified pipeline (`codecs` list replaces `filters` + `compressor`)
  - Extension points: data types, chunk grids, chunk key encoding, storage transformers
  - Fill values: mandatory in v3

- Sharding codec (ZEP2, from zarr-specs `codecs/sharding-indexed`):
  - `array → bytes` codec for Zarr v3 (v3-only feature)
  - **Outer chunks (shards)** = storage objects; **inner chunks** = subdivisions
  - Shard index: `(n_inner_chunks, 2)` uint64 array (offset + nbytes per inner chunk)
  - `index_location`: at start or end of shard; `"end"` enables tail-only Range read
  - HTTP Range reads: fetch shard index (last N bytes) → fetch specific inner chunk

- zarrita.js (from GitHub): supports "v2 or v3 protocols" + "ZEP2 Sharding";
  `FetchStore` class for HTTP access; zero dependencies; minimal & modular.

- zarr-python v3 API (from zarr-python docs):
  ```python
  zarr.create_array(
      store='path/to/array.zarr',
      shape=(287, 379, 100),
      dtype='float32',
      shards=(287, 379, 100),   # outer shard = whole array → 1 data file
      chunks=(1, 379, 100),     # inner chunk = per-ion
      compressors=zarr.codecs.BloscCodec(
          cname='zstd', clevel=5, shuffle=zarr.codecs.BloscShuffle.bitshuffle
      ),
  )
  ```

**Key insight:** Zarr v3 + sharding with `shards=(287, 379, 100)` and
`chunks=(1, 379, 100)` produces a **single shard file** (`c/0/0/0`)
containing all 287 inner chunks, each compressed independently. The
shard index at the tail is 287 × 2 × 8 = 4,592 bytes. The browser:
1. Fetches `zarr.json` (array metadata) — 1 request
2. Fetches last ~5 KB of shard for the index — 1 Range request
3. Fetches specific ion's inner chunk at `index[i].offset` — 1 Range request

This makes Zarr v3 + sharding a **near-equivalent to Parquet** in
deployment footprint (both single-file), while eliminating the Parquet
repeated string column overhead.

The `requirements.txt` change: `zarr==2.18.*` → `zarr>=3.0`.

**Redesign plan integration:**

The user noted: "I see no issues in adding this spike into 2.5."
Added Spike 4 to Stage 2.5 in `00-redesign-plan.md`. The stage now has
4 spikes. The gate is split:
- Spikes 1–3 gate: Stage 3 (already open ✅)
- Spike 4 gate: external-data feature implementation (not Stage 3)

This is architecturally clean: Stage 2.5 is "risk-reduction prototypes";
Spike 4 reduces the risk of the wrong `.webdedx` format choice before
the external-data feature is implemented in Stage 6.

---

## Tasks

### Zarr v2 → v3 upgrade

- **Status:** Plan updated; implementation not yet started
- **Stage:** 2.5 (Spike 4)
- **Files changed:**
  - `prototypes/extdata-formats/PLAN.md` — §1 motivation, §3 data shape
    (added shard structure diagram), §4 directory (`write_zarr_v3.py`),
    §5.3 rewritten (`write_zarr_v3.py` using zarr v3 sharding API),
    §5.4 benchmark metrics updated (shard index, 3 cold HTTP requests),
    §7 evaluation questions updated, §8 AC #6 updated, §9 execution
    order updated, §10 decision criteria updated (v3 primary, fallback path)
  - `prototypes/extdata-formats/requirements.txt` — `zarr>=3.0`
  - `docs/11-prototyping-spikes.md` — Spike 4 goal, background, deliverables
    table (`write_zarr_v3.py`), gate rule updated
  - `docs/00-redesign-plan.md` — Stage 2.5 updated to 4 spikes, split gate
  - `docs/ai-logs/2026-04-17-zarr-v3-upgrade.md` (this file, new)
  - `docs/ai-logs/README.md` (new entry added)
  - `CHANGELOG-AI.md` (new row; prior Stage 2.7 row updated to Stage 2.5)

### Key design decisions

1. **Zarr v3 + sharding over Zarr v2**: The multi-file problem (287 chunk
   files in v2) would have made GitHub Pages deployment and URL sharing
   impractical. v3 + sharding solves this: `shards=(287, 379, 100)` puts
   the entire dataset in one shard file, while `chunks=(1, 379, 100)`
   preserves per-ion inner-chunk granularity for HTTP Range reads.

2. **Shard index at tail**: The default sharding codec `index_location` is
   `"end"`. This allows the browser to fetch just the last ~5 KB to get
   the index, then issue a targeted Range request for the specific ion.
   Two Range requests total after the initial `zarr.json` fetch.

3. **Spike 4 in Stage 2.5, not Stage 2.7**: Stage 2.5 is the risk-reduction
   prototyping stage. Spike 4 reduces a specific risk (wrong format choice
   for the external-data feature). Adding it to Stage 2.5 is more accurate
   than a new Stage 2.7 number, and avoids a gap in the stage numbering.

4. **Separate gate from Stage 3**: Spike 4 gates only the external-data
   feature (Stage 6 feature), not Stage 3 (WASM build pipeline). The Stage 3
   gate (Spikes 1–3) is already open. This preserves the existing
   Stage 3 gate semantics.
