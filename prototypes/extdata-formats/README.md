# Spike 4 — External Data Storage Format

> **Status:** Complete · Gate FULLY OPEN (2026-04-18)  
> **Branch:** `prototypes/srim-parquet` (name fixed at creation)  
> **Decision:** Zarr v3 per-ion shards — see [VERDICT.md](VERDICT.md)

Prototype comparing **Zarr v3** and **Apache Parquet** as the distribution
format for the `.webdedx` external stopping-power dataset (287 particles ×
379 materials × 165 energy points). Benchmarked against a real S3 endpoint
at `https://s3p.cloud.cyfronet.pl/webdedx/`.

---

## Quick verdict

Zarr v3 per-ion shards (`shards=(1,379,165)`) win on cold-start bytes
(~226 KB vs ~466 KB for Parquet). Both zarrita and Parquet require the same
number of HTTP requests. See [VERDICT.md §5](VERDICT.md#5-decision-rationale-planmd-10-criteria) for full rationale.

---

## Directory structure

```
extdata-formats/
├── README.md               ← this file
├── PLAN.md                 ← spike plan, evaluation criteria, execution phases
├── VERDICT.md              ← decision, benchmark tables, acceptance criteria
│
├── generate_data.py        ← synthesise stopping-power dataset (Bethe-Bloch + SRIM grid)
├── write_parquet.py        ← write srim_synthetic.webdedx.parquet (87.9 MB)
├── write_zarr_v3_single.py ← write srim_synthetic_single.zarr  (82.2 MB, 6 files)
├── write_zarr_v3_per_ion.py← write srim_synthetic_per_ion.zarr (82.2 MB, 578 files)
├── run_benchmark.py        ← local round-trip benchmark → REPORT.md
├── run_s3_benchmark.py     ← S3 HTTP benchmark (Python urllib, Range requests) → REPORT_S3.md
├── requirements.txt        ← Python deps (zarr, pyarrow, numpy, requests)
│
├── REPORT.md               ← local benchmark results
├── REPORT_S3.md            ← S3 benchmark results (Python urllib, wifi)
├── REPORT_S3_ZARRITA.md    ← S3 benchmark results (zarrita 0.7.1, Bun, wifi)
├── REPORT_BROWSER.md       ← S3 benchmark results (zarrita 0.7.1, browser, wifi)
│
├── browser/
│   ├── benchmark.ts        ← Bun script — zarrita fetch + byte tracking (no UI)
│   ├── index.html          ← Vite benchmark app entry point
│   ├── vite.config.ts      ← Vite config (manualChunks for zarrita bundle size)
│   ├── tsconfig.json
│   ├── package.json        ← zarrita 0.7.1, vite 5, typescript
│   ├── src/
│   │   └── main.ts         ← benchmark logic + per-request Range capture + HAR export
│   └── spike4-zarr-2026-04-18T11-21-56.har.json  ← recorded browser HAR
│
└── data/                   ← gitignored — generated locally or copy from S3
    ├── srim_synthetic.webdedx.parquet
    ├── srim_synthetic_per_ion.zarr/
    └── srim_synthetic_single.zarr/
```

---

## Reproducing the benchmark

### 1 — Generate data (requires Python ≥ 3.10)

```bash
cd prototypes/extdata-formats
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

python generate_data.py          # writes data/particles.json, data/materials.json, data/srim_grid.npy
python write_parquet.py          # writes data/srim_synthetic.webdedx.parquet
python write_zarr_v3_single.py   # writes data/srim_synthetic_single.zarr/
python write_zarr_v3_per_ion.py  # writes data/srim_synthetic_per_ion.zarr/
python run_benchmark.py          # round-trip check → REPORT.md
```

### 2 — S3 benchmark (Python, requires wifi)

Data is already on S3 — no local copy needed.

```bash
python run_s3_benchmark.py       # → REPORT_S3.md
```

### 3 — zarrita Bun benchmark

```bash
cd browser
bun install
bun benchmark.ts                 # → ../REPORT_S3_ZARRITA.md
```

### 4 — Browser benchmark (CORS + bundle size gate)

```bash
cd browser
bun run build    # check zarrita chunk size in output
bun run dev      # open http://localhost:5173, click "Run Benchmark"
```

After running in the browser:

- Click **Export HAR JSON** for programmatic timing data (Range headers
  captured from fetch interceptor).
- Use **DevTools → Network → Save all as HAR with content** for full
  request/response headers and DNS/TLS breakdown.

---

## Documents

| Document | Purpose |
|----------|---------|
| [PLAN.md](PLAN.md) | Spike plan: goal, data shape, directory layout, evaluation questions, acceptance criteria, decision criteria |
| [VERDICT.md](VERDICT.md) | Decision, full benchmark tables, corrected request patterns, post-gate items |
| [REPORT.md](REPORT.md) | Local file size and round-trip accuracy |
| [REPORT_S3.md](REPORT_S3.md) | S3 Python urllib benchmark (mobile + wifi) |
| [REPORT_S3_ZARRITA.md](REPORT_S3_ZARRITA.md) | S3 zarrita 0.7.1 benchmark, Bun runtime |
| [REPORT_BROWSER.md](REPORT_BROWSER.md) | S3 zarrita 0.7.1 benchmark, browser — per-request Range headers, bundle sizes, STP verification |

Related project docs:

| Document | Purpose |
|----------|---------|
| [../../docs/04-feature-specs/external-data.md](../../docs/04-feature-specs/external-data.md) | Feature spec — to be amended post-gate to replace Parquet §2 with Zarr v3 per-ion spec |
| [../../docs/11-prototyping-spikes.md](../../docs/11-prototyping-spikes.md) | Spike 4 acceptance criteria and gate rule |
| [../../docs/02-tech-stack.md](../../docs/02-tech-stack.md) | Tech stack — `hyparquet` to be replaced with `zarrita` post-gate |
| [../../docs/ai-logs/2026-04-17-spike4-phase1-impl.md](../../docs/ai-logs/2026-04-17-spike4-phase1-impl.md) | Session log: data generation + local benchmark |
| [../../docs/ai-logs/2026-04-17-extdata-formats.md](../../docs/ai-logs/2026-04-17-extdata-formats.md) | Session log: Spike 4 plan + Zarr v3 upgrade |
| [../../docs/ai-logs/2026-04-18-spike4-s3-verdict.md](../../docs/ai-logs/2026-04-18-spike4-s3-verdict.md) | Session log: S3 benchmarks + VERDICT |
| [../../docs/ai-logs/2026-04-18-spike4-browser-gate.md](../../docs/ai-logs/2026-04-18-spike4-browser-gate.md) | Session log: Vite browser app, gate close, zarrita ZEP2 findings |

---

## S3 data

Bucket: `https://s3p.cloud.cyfronet.pl/webdedx/` (Cyfronet PLGrid, public-read)

| File | Size | URL |
|------|------|-----|
| `srim_synthetic.webdedx.parquet` | 87.86 MB | `…/srim_synthetic.webdedx.parquet` |
| `srim_synthetic_single.zarr/zarr.json` | 86.5 KB | `…/srim_synthetic_single.zarr/zarr.json` |
| `srim_synthetic_per_ion.zarr/zarr.json` | 86.5 KB | `…/srim_synthetic_per_ion.zarr/zarr.json` |

Upload command (Cyfronet Ares, rclone `yaptide:` remote → `webdedx` bucket):

```bash
rclone copy ./srim_synthetic_per_ion.zarr yaptide:webdedx/srim_synthetic_per_ion.zarr \
  --s3-acl public-read --s3-no-check-bucket --progress
```

---

## Key findings

- zarrita 0.7.1 fetches `.zattrs` and `.zgroup` on every `open(root(...))` — these are Zarr v2 compatibility probes. The stores are **Zarr v3** (no such files), so these return HTTP 404. zarrita handles the 404s silently; they are expected.
- zarrita uses Range requests for **both** shard variants. Per-ion ZEP2 index = 20 bytes (1 inner chunk); single-shard index = 4.5 KB (287 inner chunks).
- Actual cold-start HTTP sequence: 7 requests for both variants. See [VERDICT.md §2.5](VERDICT.md#25-per-ion-cold-start-fetch-s3-wifi--zarrita-071-browser) for the full table.
- zarrita core bundle: **38.62 kB** minified. lz4 codec: 36.59 kB (needed for ZEP2 + LZ4 data). blosc/zstd appear in Vite build but are expected to lazy-load only for stores that use those codecs.
