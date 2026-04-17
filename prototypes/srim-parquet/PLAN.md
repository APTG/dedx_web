# Prototype: Zarr Per-Ion Sharding vs Apache Parquet

> **Status:** Plan (2026-04-17)
> **Branch:** `prototypes/srim-parquet`
> **Goal:** Decide whether Zarr v2 with per-ion chunking is a better fit than
> Apache Parquet for the `.webdedx` external data format before committing to
> the Parquet spec in `docs/04-feature-specs/external-data.md`.

---

## 1. Motivation

The current spec (`external-data.md §2`) uses Apache Parquet with one
row group per `(program, ion)` pair, read via `hyparquet` in the browser.
The key access pattern is: user selects **one ion** → browser fetches only
that ion's STP values for all materials via an HTTP Range Request.

Zarr v2 with chunk shape `(1, n_materials, n_energy)` maps this pattern
directly onto the file format: each ion is a separate chunk file. This
avoids the Parquet row format overhead (repeated string columns, energy
column duplicated N×278 times) and may yield a smaller per-ion payload.

This prototype measures the difference with realistic data dimensions before
any production code is written.

---

## 2. Dataset Specification

### 2.1 Ions — All Stable Isotopes (286 nuclides)

The full list of primordially stable and long-lived radioactive isotopes
from the AME2020/NUBASE2020 nuclear data tables. This matches the realistic
scope of a SRIM user running tables for every naturally occurring nuclide.

| Range | Count | Notes |
|-------|-------|-------|
| Z = 1–83 (H through Bi) | ~281 | All truly stable nuclides |
| Long-lived primordial: K-40, V-50, Rb-87, In-115, La-138, Lu-176, Re-187, Ta-180 | included | Half-lives > 10¹⁰ y |
| Th-232, U-235, U-238 | 3 | Primordial actinides (relevant for radiation physics) |
| **Total** | **286** | |

Each isotope is identified by `(Z, A)`. The synthetic STP generator uses
Z (atomic number) and A (mass number) to scale the Bethe-like formula.

### 2.2 Materials — All libdedx DEFAULT Materials (279 targets)

Sourced directly from `libdedx/src/dedx_program_const.h` (the
`dedx_material_table` and `dedx_program_available_materials` arrays).

| Category | ID range | Count | Source |
|----------|----------|-------|--------|
| Elements (H through Cf) | 1–98 | 98 | `dedx_material_table[1]`–`[98]` |
| ICRU/NIST compounds | 99–278 | 180 | `dedx_material_table[99]`–`[278]` |
| Graphite (separate entry) | 906 | 1 | `dedx_material_table[906]` |
| **Total** | | **279** | Same as `DEDX_DEFAULT` program |

Material names are taken verbatim from `dedx_material_table` (ALL-CAPS
strings). The generator script reads them directly from the C header at
runtime — no hardcoded copy.

### 2.3 Energy Grid

100 log-spaced points covering the full range of all libdedx programs:

```
E_min = 0.001 MeV/u   (below ASTAR minimum of 0.00025, but a round number)
E_max = 10000 MeV/u   (PSTAR maximum)
energies = np.geomspace(0.001, 10000, 100)   # float64 → stored once as metadata
```

The 100-point grid is stored **once** as a metadata attribute (not
repeated per row as in Parquet). This is a structural advantage of Zarr.

### 2.4 STP Formula (Synthetic)

No real SRIM binary is needed. STP values are generated with a
Bethe-like parametric formula that reproduces the correct qualitative
shape (Bragg peak, high-energy tail, Z²-scaling):

```python
def stp(Z_ion, A_ion, Z_mat, E_MeV_u):
    """
    Simplified Bethe-Bloch stopping power (MeV·cm²/g).
    E_MeV_u: kinetic energy in MeV per nucleon.
    """
    beta2 = E_MeV_u / (E_MeV_u + 931.5)   # non-relativistic approx
    beta2 = np.clip(beta2, 1e-6, 1.0)
    I_eV  = 13.5 * Z_mat   # rough mean excitation energy
    # Bethe core (no shell/density corrections)
    ln_term = np.log(2 * 0.511e6 * beta2 / (I_eV * (1 - beta2))) - beta2
    ln_term = np.maximum(ln_term, 0.01)
    # Z_ion² / beta² scaling, divided by A_ion for MeV·cm²/g units
    return (Z_ion**2 / A_ion) * (0.3071 / beta2) * ln_term
```

Values are stored as `float32`. The formula is only for benchmarking
format properties — physics accuracy is irrelevant.

---

## 3. Data Shape Summary

```
n_ions      = 286    # stable isotopes
n_materials = 279    # elements + ICRU compounds
n_energy    = 100    # log-spaced grid points
n_programs  = 1      # synthetic "srim-2013"

Array shape (per program): (286, 279, 100)   float32
Uncompressed:  ~31.9 MB per program
Est. zstd-5:   ~10–12 MB per program (smooth float arrays compress well)

Per-ion chunk:  279 × 100 × 4 bytes = 111,600 bytes ≈ 109 KB (uncompressed)
Per-ion chunk (compressed): est. ~30–50 KB
```

---

## 4. File / Directory Structure

```
prototypes/srim-parquet/
├── PLAN.md                    ← this file
├── requirements.txt           ← zarr, pyarrow, numcodecs, numpy, periodictable
├── venv/                      ← Python venv (gitignored)
├── generate_data.py           ← build stable isotope list + STP arrays
├── write_parquet.py           ← write .webdedx.parquet per current spec
├── write_zarr_v2.py           ← write Zarr v2, chunk=(1, n_mat, n_e)
├── run_benchmark.py           ← sizes, HTTP cost simulation, comparison table
├── browser/
│   ├── package.json           ← zarrita (Zarr v3 JS reader), hyparquet, vite
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts            ← fetch one ion from Zarr; fetch from Parquet; compare
│       └── index.html
├── data/                      ← generated output (gitignored)
│   ├── srim_synthetic.webdedx.parquet
│   └── srim_synthetic.zarr/   ← Zarr v2 directory store
├── REPORT.md                  ← findings after running all scripts
└── VERDICT.md                 ← go/no-go: use Zarr, keep Parquet, or hybrid
```

`.gitignore`:
```
venv/
data/
browser/node_modules/
browser/dist/
```

---

## 5. Script Specifications

### 5.1 `generate_data.py`

**Purpose:** Single source of truth for all data. Both Parquet and Zarr writers
import from this module — they never generate data themselves.

**Exports:**

```python
STABLE_ISOTOPES: list[dict]
# [{"Z": 1, "A": 1, "symbol": "H", "name": "Hydrogen-1"}, ...]
# 286 entries, sorted by (Z, A)

MATERIALS: list[dict]
# [{"id": 1, "name": "HYDROGEN"}, ..., {"id": 906, "name": "GRAPHITE"}]
# 279 entries, sorted by id; names read from dedx_program_const.h at import time

ENERGIES: np.ndarray
# shape (100,), float64, geomspace(0.001, 10000, 100), units: MeV/u

def compute_stp_array() -> np.ndarray:
    """
    Returns float32 array of shape (n_ions, n_materials, n_energy).
    Axis 0: stable isotopes in STABLE_ISOTOPES order.
    Axis 1: materials in MATERIALS order.
    Axis 2: energy points in ENERGIES order.
    """
```

**Material name extraction:** The script parses
`libdedx/src/dedx_program_const.h` with a regex to extract
`dedx_material_table` entries, using the array index as the material ID.
It also reads `dedx_program_available_materials` for program 100 (DEFAULT)
to get the canonical list of valid IDs (the 279 IDs in `DEDX_DEFAULT`).

**Isotope list:** Hardcoded in the script as a Python list of `(Z, A, symbol)`
tuples (286 entries). No external nuclear data package required — the list
is sourced from AME2020/NUBASE2020 and can be verified against the output of
`python3 -c "import periodictable; ..."` if that package is available.

---

### 5.2 `write_parquet.py`

Implements the schema from `external-data.md §2` exactly.

**Row structure:**

| Column | Parquet type | Value |
|--------|-------------|-------|
| `program` | `BYTE_ARRAY UTF-8` | `"srim-2013"` (constant within row group) |
| `particle` | `BYTE_ARRAY UTF-8` | Ion label, e.g. `"H-1"` |
| `material` | `BYTE_ARRAY UTF-8` | Material name, e.g. `"WATER"` |
| `energy` | `FLOAT` | Energy in MeV/u |
| `stp` | `FLOAT` | Stopping power in MeV·cm²/g |

**Row group layout:** One row group per ion (286 row groups).
Each row group contains `n_materials × n_energy = 279 × 100 = 27,900` rows.

**File metadata (key-value):**
- `webdedx.formatVersion = "1"`
- `webdedx.metadata.name = "Synthetic SRIM-2013 benchmark"`
- `webdedx.programs = [{"id":"srim-2013","name":"SRIM 2013","version":"2013.00"}]`
- `webdedx.particles = [{"id":"H-1","Z":1,"A":1,...}, ...]`  (286 entries)
- `webdedx.materials = [{"id":"HYDROGEN","libdedxId":1,...}, ...]` (279 entries)
- `webdedx.energyGrid_MeV_u = null`  (energy is a column, not metadata)

**Compression:** `zstd` level 5 (via `pyarrow.parquet.write_table`
`compression='zstd'`, `compression_level=5`).

**Output:** `data/srim_synthetic.webdedx.parquet`

---

### 5.3 `write_zarr_v2.py`

**Array layout:**

```python
root = zarr.open_group("data/srim_synthetic.zarr/", mode="w")
root.attrs.update({
    "webdedx.formatVersion": "1",
    "webdedx.metadata.name": "Synthetic SRIM-2013 benchmark",
    "webdedx.programs": [...],          # same JSON as Parquet metadata
    "webdedx.particles": [...],         # 286 isotopes
    "webdedx.materials": [...],         # 279 materials
    "webdedx.energyGrid_MeV_u": ENERGIES.tolist(),  # shared 100-point grid
})

grp = root.require_group("srim-2013")
grp.create_dataset(
    "stp",
    data=stp_array,                     # shape (286, 279, 100), float32
    chunks=(1, 279, 100),               # ← per-ion sharding
    dtype="float32",
    compressor=numcodecs.Blosc(cname="zstd", clevel=5, shuffle=numcodecs.Blosc.BITSHUFFLE),
)
```

**Key structural difference from Parquet:**
- Energy grid stored once in `.zattrs` (not repeated in every row).
- Material and ion axes are integer indices into the `particles`/`materials`
  metadata lists — no string repetition per data point.
- Chunk file `srim-2013/stp/N.0.0` contains all 279 materials × 100
  energy points for ion N as a flat `float32` array.

**Output:** `data/srim_synthetic.zarr/`

---

### 5.4 `run_benchmark.py`

Runs all comparisons and prints a Markdown table. Does not start a server —
all measurements are on local files, simulating HTTP cost from file sizes.

**Measurements:**

| Metric | How measured |
|--------|-------------|
| Total file size (Parquet) | `os.path.getsize()` |
| Total store size (Zarr) | `sum(os.path.getsize(f) for f in store_files)` |
| Parquet footer size | Read last 8 bytes, parse footer length from Parquet magic |
| Zarr metadata size | Size of `.zattrs` + `srim-2013/stp/.zarray` |
| Per-ion bytes (Parquet) | Parse row group offset/length from Parquet footer for row group 0 |
| Per-ion bytes (Zarr) | `os.path.getsize("data/srim_synthetic.zarr/srim-2013/stp/0.0.0")` |
| Number of files (Zarr) | `len(list(Path("data/srim_synthetic.zarr/").rglob("*")))` |
| HTTP requests (cold, Parquet) | 2: footer + row group |
| HTTP requests (cold, Zarr) | 2: `.zattrs` + chunk file |
| HTTP requests (warm, Parquet) | 1: row group only (footer cached) |
| HTTP requests (warm, Zarr) | 1: chunk file only (metadata cached) |
| Compression ratio | uncompressed / compressed for both formats |

**Output:** Prints comparison table to stdout and writes `REPORT.md`.

---

### 5.5 `browser/` — In-Browser Fetch Test

A minimal Vite + TypeScript single-page app served by `vite dev`. Both
files are served from `browser/public/` (symlinked or copied from `data/`).

**Libraries:**
- `zarrita` — Zarr v3-compatible JS reader (also reads v2 stores)
- `hyparquet` — current spec's Parquet reader

**Page layout:** Two panels side-by-side. Each panel has:
- A `<select>` to pick an ion from the 286 isotopes
- A "Fetch" button
- A display of: wall time (ms), bytes transferred
  (from `PerformanceResourceTiming`), first 5 STP values

**What it proves:**
1. Zarr v2 chunks are readable by `zarrita` in the browser without a WASM runtime.
2. The fetch latency and byte cost are measurable and comparable.
3. Both formats return identical STP values (correctness check).

**Acceptance criteria for the browser test:**
- Both panels show identical STP values for the same ion (±float32 precision).
- No CORS or MIME-type errors from Vite's dev server.
- `zarrita` bundle contribution ≤ 50 KB minified (measure with `vite build --report`).

---

## 6. Environment Setup

All Python work uses a local venv **inside** the prototype directory:

```bash
cd prototypes/srim-parquet

python3 -m venv venv
source venv/bin/activate

pip install zarr==2.18.* pyarrow numcodecs numpy
# 'periodictable' is NOT required — isotope list is hardcoded
```

`requirements.txt`:
```
zarr==2.18.*
pyarrow>=15
numcodecs>=0.12
numpy>=1.26
```

Browser:
```bash
cd browser
npm install   # or pnpm install
```

`browser/package.json` dependencies:
```json
{
  "devDependencies": { "vite": "^5", "typescript": "^5" },
  "dependencies": { "zarrita": "^0.4", "hyparquet": "^1" }
}
```

---

## 7. Evaluation Questions

The VERDICT.md must answer each of these with measured data:

| # | Question | Expected answer |
|---|----------|----------------|
| 1 | Is Zarr total size ≤ Parquet total size? | Likely yes — no string column overhead |
| 2 | Is per-ion Zarr chunk ≤ per-ion Parquet row group? | Yes — float32 array vs rows with repeated strings |
| 3 | Are HTTP round trips equal (both 2 cold, 1 warm)? | Yes — structural parity |
| 4 | Is `zarrita` bundle ≤ `hyparquet` bundle? | Unknown — zarrita is newer, possibly larger |
| 5 | Does Zarr handle the energy grid more efficiently? | Yes — stored once vs 27,900× in Parquet |
| 6 | Can a physicist generate `.zarr` as easily as `.parquet`? | Probably not — fewer CLI tools |
| 7 | Does `.zarr/` directory deploy cleanly to GitHub Pages? | Yes, but many files (288 chunk files + metadata) |
| 8 | Does Zarr support variable energy grids per ion? | No without jagged arrays — Parquet can |

---

## 8. Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|---------------|
| 1 | `generate_data.py` runs without error | Exits 0; prints isotope/material counts |
| 2 | `write_zarr_v2.py` round-trips data | Read-back values match within float32 eps |
| 3 | `write_parquet.py` round-trips data | Same |
| 4 | Per-ion Zarr chunk is smaller than Parquet row group | `zarr_chunk_bytes < parquet_rg_bytes` |
| 5 | `run_benchmark.py` prints comparison table | No exceptions; both formats measured |
| 6 | Browser: same STP values from both formats | Max abs diff < 1e-6 (float32 round-trip) |
| 7 | `zarrita` bundle ≤ 50 KB minified | `vite build --report` |
| 8 | Zarr directory deploys from Vite dev server | No CORS/404 in DevTools Network tab |

---

## 9. Execution Order

```
1. python generate_data.py         # verify data shape, print summary
2. python write_zarr_v2.py         # write Zarr store
3. python write_parquet.py         # write Parquet file
4. python run_benchmark.py         # print comparison table → REPORT.md
5. cd browser && npm install       # install JS deps
6. cd browser && npm run dev       # open http://localhost:5173, test both panels
7. write REPORT.md                 # paste benchmark table, add observations
8. write VERDICT.md                # go/no-go decision
```

---

## 10. Decision Criteria for VERDICT.md

**Keep Parquet if:**
- `zarrita` bundle > 50 KB AND adds more than `hyparquet` to total bundle
- Per-ion size difference < 10% (not worth switching)
- `.zarr/` directory structure creates CORS or deployment friction

**Switch to Zarr v2 if:**
- Per-ion bytes ≤ 60% of Parquet row group (significant bandwidth saving)
- `zarrita` bundle is comparable to `hyparquet`
- GitHub Pages deployment test passes cleanly

**Hybrid (Zarr v3 + sharding) if:**
- Zarr v2 wins on size but loses on "one file = one URL" ergonomics
- `zarrita` v0.4+ supports Zarr v3 sharding stably

---

## 11. Related Documents

| Document | Relevance |
|----------|-----------|
| [`docs/04-feature-specs/external-data.md`](../../docs/04-feature-specs/external-data.md) | Current Parquet spec — this prototype decides whether to amend it |
| [`prototypes/libdedx-investigation/data/headers_stats.json`](../libdedx-investigation/data/headers_stats.json) | Material IDs and counts used here |
| [`libdedx/src/dedx_program_const.h`](../../libdedx/src/dedx_program_const.h) | Source for material names (read at runtime by `generate_data.py`) |
| [`libdedx/src/dedx_periodic_table.h`](../../libdedx/src/dedx_periodic_table.h) | Element masses — used in STP formula |
| [`docs/02-tech-stack.md §hyparquet`](../../docs/02-tech-stack.md) | Current Parquet reader choice |
