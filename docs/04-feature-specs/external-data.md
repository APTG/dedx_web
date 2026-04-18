# Feature: External Stopping-Power / Range Data

> **Status:** Final v6 (18 April 2026)
>
> This spec defines how webdedx loads, validates, and displays user-hosted
> stopping-power and CSDA-range datasets alongside the built-in libdedx data.
>
> **Stage:** Specified in Stage 1; implementation deferred to a later stage.
>
> **v1** (8 April 2026): Initial draft. Parquet format, URL parameter contract,
> entity merging, loading lifecycle, validation, UI treatment, and tooling spec.
>
> **v2** (8 April 2026): Consistency pass. Added Calculator and Plot integration
> sections, security considerations, and acceptance criteria.
>
> **v3** (9 April 2026): `extdata` parameter format changed from positional index
> to explicit user-assigned label (`extdata={label}:{url}`). All entity references
> updated from `ext:{index}:{id}` to `ext:{label}:{id}`. §3.5 ABNF extension
> updated to match `shareable-urls-formal.md` v3.
>
> **v4** (9 April 2026): Particle merge key upgraded from (Z, A) to PDG Monte Carlo
> code (`pdgCode`) with (Z, A) as fallback; this correctly handles electrons
> (PDG 11) and named aliases (alpha, proton). Material merge key upgraded: external
> materials may declare `icruId` (ICRU/NIST number matching built-in libdedx IDs)
> or `atomicNumber` (pure-element matching) before falling back to name. These
> structured keys guarantee unambiguous dataset compatibility for scientific
> comparisons. Size limits raised: particles 1000, materials 10000, file size 1 GB.
> Q2 (interpolation) and Q4 (offline) resolved in §13.
>
> **v5** (18 April 2026): **Format changed from Apache Parquet to Zarr v3 per-ion
> shards.** Spike 4 (`prototypes/extdata-formats/VERDICT.md`, 2026-04-18) measured
> all three candidates (Parquet, Zarr v3 single-shard, Zarr v3 per-ion) on a real
> S3 bucket. Zarr v3 per-ion (`shards=(1, n_materials, n_energies)`) was adopted:
> cold-start bytes 225.7 KB vs 466 KB for Parquet (52% less), zarrita core bundle
> 38.62 kB. JS reader changed from `hyparquet` to `zarrita`. §2 rewritten;
> §2.3 partial fetch protocol updated to document the 7-request cold-start;
> §2.4 hosting requirements updated; §11 tooling examples updated.
>
> **v6** (18 April 2026): `csda_range` Zarr array made optional — stores that
> provide only stopping-power data are valid; CSDA columns show "—" when absent.
> Material `density` field changed from required to recommended — if absent, only
> MeV·cm²/g display is available for that material; keV/µm and MeV/cm are disabled.
> New optional material field `ival` (mean excitation energy in eV) added for
> reference. `webdedx.units.csdaRange` made optional (required only when a
> `csda_range` array is present, defaults to `"g/cm²"`). Stale Parquet-era
> "columns" / "row groups" validation language in §6.1 corrected to Zarr terms.
> [ADR 004](../decisions/004-zarr-v3-external-format.md) cross-reference added.
>
> **Related specs:**
> - Entity selection: [`entity-selection.md`](entity-selection.md)
> - Calculator: [`calculator.md`](calculator.md)
> - Plot: [`plot.md`](plot.md)
> - Unit handling: [`unit-handling.md`](unit-handling.md)
> - Shareable URLs: [`shareable-urls.md`](shareable-urls.md)
> - WASM API contract: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
> - Project vision §4.7: [`../01-project-vision.md`](../01-project-vision.md)

---

## 1. Purpose & Motivation

### 1.1 Purpose

Allow users to bring their own stopping-power and CSDA-range tables —
generated from tools like SRIM, Geant4, FLUKA, or custom Monte-Carlo
codes — and view them in webdedx alongside the built-in libdedx programs.

This enables:
- **Comparison:** Overlay user-generated data against ICRU/PSTAR/MSTAR curves.
- **Private data:** Self-host on `localhost` for unpublished experimental data.
- **Community sharing:** Publish datasets on GitHub Pages / S3 and share via URL.

### 1.2 User Stories

**As a** radiation physicist with SRIM output files,
**I want to** convert them to a webdedx-compatible format and host them on GitHub Pages,
**so that** I can share interactive plots comparing SRIM and ICRU data with colleagues
via a single URL.

**As a** Monte-Carlo developer,
**I want to** host my Geant4-generated stopping-power tables on a local web server,
**so that** I can validate my simulation results against libdedx without exposing
proprietary data to the internet.

**As a** physics teacher,
**I want to** receive a URL from a colleague that includes their custom dataset,
**so that** I can see their data overlaid on the standard ICRU curves without
installing any software or downloading files.

### 1.3 Design Principles

- **Zero UI buttons added.** The feature is activated entirely via URL parameters.
  If no `extdata` parameter is present, the app behaves identically to today.
- **External data is additive.** External programs, particles, and materials are
  *merged* with the built-in lists. They never replace or override built-in data.
- **Visually distinct.** External entities and series are always distinguishable
  from built-in data (badges, icons, or distinct styling).
- **Fail loudly.** If an external source is unreachable or invalid, the app shows
  a clear blocking error rather than silently degrading.
- **No server needed.** The entire feature works with static file hosting.

---

## 2. Data Distribution Format

External data is served as a **Zarr v3 per-ion shard store** hosted at a URL
prefix (a "Zarr directory store"). Zarr v3 is a cloud-native array format with
built-in sharding (ZEP2) that maps each particle to a separate shard file —
enabling per-ion partial reads via HTTP Range Requests without fetching
unrelated data. The store is a set of files under a common URL prefix, not a
single file.

The JS reader is [`zarrita`](https://github.com/manzt/zarrita) —
a pure-JS Zarr v3 reader with ZEP2 sharding support. Bundle sizes (validated
Spike 4): zarrita core 38.62 kB minified (gzip 12.89 kB), LZ4 codec chunk
36.59 kB.

**Why Zarr v3 over Parquet** (Spike 4 decision, 2026-04-18):
- Cold-start bytes: 225.7 KB (Zarr per-ion) vs 466 KB (Parquet) — **52% less**,
  dominated by Parquet's 320 KB footer.
- Per-ion shard size: 137.5 KB vs 145.2 KB Parquet row group (5.5% smaller).
- zarrita core bundle (38.62 kB) comparable to hyparquet (~20 kB).
- Zarr per-ion ZEP2 shard index = 20 bytes (1 inner chunk × 16 + 4 CRC),
  vs 4.5 KB for single-shard (287 inner chunks). The overhead is negligible.
- See `prototypes/extdata-formats/VERDICT.md §5` for full decision rationale and [ADR 004](../decisions/004-zarr-v3-external-format.md) for the formal decision record.

### 2.1 Logical Data Model

An external dataset defines:

1. **Metadata** — dataset name, version, author, description, license.
2. **Programs** — one or more named programs (e.g., "SRIM-2013", "Geant4-11.2").
3. **Particles** — particle definitions with mass data.
4. **Materials** — material definitions with density.
5. **Arrays** — per program: a 3-D `float32` array of shape
   `(n_particles, n_materials, n_energies)` for STP; an identically-shaped
   optional array for CSDA-range; and a shared 1-D energy grid in root
   attributes (`webdedx.energyGrid`). The `csda_range` array is optional —
   stores that provide only stopping-power data are valid.

### 2.2 Zarr v3 Store Schema

#### 2.2.1 Store Layout

A `.webdedx` Zarr store is hosted under a URL prefix (the store root). The
store contains:

```
{root}/zarr.json                        ← root group: dataset metadata (JSON, ~86 KB)
{root}/{program}/zarr.json              ← program group: per-program metadata
{root}/{program}/stp/zarr.json          ← STP array metadata (shape, chunks, codec)
{root}/{program}/stp/c/{i}/0/0          ← per-ion shard (one file per particle)
{root}/{program}/csda_range/zarr.json   ← CSDA range array metadata (optional)
{root}/{program}/csda_range/c/{i}/0/0   ← per-ion shard (optional)
```

- **`{root}` = the URL supplied in the `extdata` parameter** (without trailing slash).
- **`{program}` = program ID** as declared in `zarr.json` attributes.
- **`{i}` = particle index** in the ordered particle list (0-based).
- One shard file per particle: `c/{i}/0/0` where `i` ∈ `[0, n_particles)`.

Array codec: **LZ4** (requires zarrita lz4 codec chunk, 36.59 kB).

Array shapes and shard dimensions:

| Array | Shape | Shards | Notes |
|-------|-------|--------|-------|
| `stp` | `(n_particles, n_materials, n_energies)` | `(1, n_materials, n_energies)` | Per-ion shard |
| `csda_range` | `(n_particles, n_materials, n_energies)` | `(1, n_materials, n_energies)` | Per-ion shard |

#### 2.2.2 Root `zarr.json` Attributes

Dataset-wide metadata is stored in the root group's Zarr v3 `attributes`
object (inside `zarr.json` at the store root):

```json
{
  "zarr_format": 3,
  "node_type": "group",
  "attributes": {
    "webdedx.magic": "webdedx-extdata",
    "webdedx.formatVersion": 1,
    "webdedx.metadata": {
      "name": "SRIM 2013 tables",
      "version": "1.0.0",
      "author": "J. Ziegler",
      "description": "SRIM-2013 stopping powers for selected ions and materials",
      "license": "CC-BY-4.0",
      "generatedBy": "srim2webdedx v0.1.0",
      "generatedAt": "2026-04-18T12:00:00Z"
    },
    "webdedx.units": {
      "energy": "MeV",
      "stoppingPower": "MeV·cm²/g",
      "csdaRange": "g/cm²"
    },
    "webdedx.energyGrid": [0.001, 0.001259, 0.001585, "...", 1000.0],
    "webdedx.programs": [
      { "id": "srim-2013", "name": "SRIM 2013", "version": "2013.00" }
    ],
    "webdedx.particles": [
      { "id": "p",   "name": "Proton",    "symbol": "H",  "Z": 1, "A": 1,  "atomicMass": 1.00794, "pdgCode": 2212       },
      { "id": "C12", "name": "Carbon-12", "symbol": "C",  "Z": 6, "A": 12, "atomicMass": 12.0,    "pdgCode": 1000060120 },
      { "id": "e-",  "name": "Electron",  "symbol": "e⁻", "Z": 0, "A": 0,  "atomicMass": 0.000511,"pdgCode": 11         }
    ],
    "webdedx.materials": [
      { "id": "water", "name": "Water (liquid)", "density": 1.0,   "phase": "liquid", "icruId": 276      },
      { "id": "si",    "name": "Silicon",        "density": 2.329, "phase": "solid",  "atomicNumber": 14 }
    ]
  }
}
```

**Key constraints:**
- `webdedx.magic` must be `"webdedx-extdata"`.
- `webdedx.formatVersion` must be a positive integer. The app rejects unknown
  major versions.
- IDs (`programs[].id`, `particles[].id`, `materials[].id`) must match
  `[a-zA-Z0-9_-]+`.
- `webdedx.units.energy` must be one of: `"MeV"`, `"MeV/nucl"`, `"MeV/u"`,
  `"keV"`, `"GeV"`.
- `webdedx.units.stoppingPower` must be one of: `"MeV·cm²/g"`, `"MeV/cm"`,
  `"keV/µm"`.
- `webdedx.units.csdaRange` must be one of: `"g/cm²"`, `"cm"`.
- `webdedx.energyGrid` must be a strictly increasing numeric array with all
  values > 0.
- The particle ordering in `webdedx.particles` is the canonical ordering — index
  `i` in the array corresponds to shard file `c/{i}/0/0`.

**Particle merge-key fields (`particles[]`):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Internal ID within this store. Matches `[a-zA-Z0-9_-]+`. |
| `name` | string | yes | Human-readable name. |
| `symbol` | string | yes | Chemical symbol or `"e⁻"` for electrons. |
| `Z` | integer | yes | Atomic number. 0 for electrons. |
| `A` | integer | yes | Mass number (nucleons). 0 for electrons. |
| `atomicMass` | number | yes | Atomic mass in u (daltons). Used for MeV/u conversion. |
| `pdgCode` | integer | **recommended** | PDG Monte Carlo particle number. Used as the primary merge key with built-in particles. Common values: proton = 2212, electron = 11, alpha (He-4) = 1000020040, C-12 = 1000060120. Ion convention: 1000 × Z × 10000 + A × 10. |

**Material merge-key fields (`materials[]`):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Internal ID within this store. Matches `[a-zA-Z0-9_-]+`. |
| `name` | string | yes | Human-readable name. |
| `density` | number | **recommended** | Material density in g/cm³. If absent, linear unit display (keV/µm, MeV/cm) is disabled for that material; only mass stopping power (MeV·cm²/g) is available. |
| `ival` | number | no | Mean excitation energy in eV (I-value). Informational only — not used in calculations; external STP values are used directly. |
| `phase` | string | no | `"solid"`, `"liquid"`, or `"gas"`. |
| `icruId` | integer | **recommended** | ICRU/NIST material number. Built-in libdedx material IDs are ICRU numbers, so `icruId: 276` matches built-in material 276 (water liquid) exactly. Use this for any standard ICRU/NIST material. |
| `atomicNumber` | integer | recommended for elements | Atomic number Z. Used as merge key for pure elemental targets (e.g., `atomicNumber: 14` for silicon). Takes effect only when `icruId` is absent. |

#### 2.2.3 Array `zarr.json` Metadata

Each `{program}/stp/zarr.json` follows Zarr v3 array format. Example:

```json
{
  "zarr_format": 3,
  "node_type": "array",
  "shape": [287, 379, 165],
  "data_type": "float32",
  "chunk_grid": {
    "name": "sharding_indexed",
    "configuration": {
      "chunk_shape": [1, 379, 165],
      "codecs": [{ "name": "bytes", "configuration": { "endian": "little" } }, { "name": "lz4" }],
      "index_codecs": [{ "name": "bytes", "configuration": { "endian": "little" } }, { "name": "crc32c" }],
      "index_location": "end"
    }
  },
  "fill_value": 0.0,
  "chunk_key_encoding": { "name": "default", "separator": "/" },
  "dimension_names": ["particle", "material", "energy"]
}
```

#### 2.2.4 Example: Creating a Store with Python

```python
import zarr
import zarr.codecs
import numpy as np
import json

# Synthetic data: shape (n_particles, n_materials, n_energies)
n_particles, n_materials, n_energies = 3, 2, 165
energies = np.geomspace(0.0011, 2000.0, n_energies, dtype="float32")
stp = np.random.rand(n_particles, n_materials, n_energies).astype("float32")
# csda_range is optional — omit prog.array("csda_range", ...) if your source does not provide range data
csda = np.random.rand(n_particles, n_materials, n_energies).astype("float32")

store = zarr.storage.LocalStore("my-dataset.webdedx")
root = zarr.open_group(store, mode="w", zarr_format=3)

# Write dataset metadata to root attributes
root.attrs.update({
    "webdedx.magic": "webdedx-extdata",
    "webdedx.formatVersion": 1,
    "webdedx.metadata": {
        "name": "My SRIM tables",
        "author": "J. Ziegler",
        "generatedAt": "2026-04-18T12:00:00Z",
    },
    "webdedx.units": {
        "energy": "MeV",
        "stoppingPower": "MeV·cm²/g",
        "csdaRange": "g/cm²",
    },
    "webdedx.energyGrid": energies.tolist(),
    "webdedx.programs": [
        {"id": "srim-2013", "name": "SRIM 2013", "version": "2013.00"}
    ],
    "webdedx.particles": [
        {"id": "p",   "name": "Proton",    "symbol": "H", "Z": 1, "A": 1,  "atomicMass": 1.00794,  "pdgCode": 2212       },
        {"id": "C12", "name": "Carbon-12", "symbol": "C", "Z": 6, "A": 12, "atomicMass": 12.0,     "pdgCode": 1000060120 },
        {"id": "e-",  "name": "Electron",  "symbol": "e⁻","Z": 0, "A": 0,  "atomicMass": 0.000511, "pdgCode": 11         },
    ],
    "webdedx.materials": [
        {"id": "water", "name": "Water (liquid)", "density": 1.0,   "phase": "liquid", "icruId": 276      },
        {"id": "si",    "name": "Silicon",        "density": 2.329, "phase": "solid",  "atomicNumber": 14 },
    ],
})

# Per-program group
prog = root.require_group("srim-2013")

# Shard codec: LZ4, one shard per particle
sharding_codec = zarr.codecs.ShardingCodec(
    chunk_shape=(1, n_materials, n_energies),
    codecs=[zarr.codecs.BytesCodec(endian="little"), zarr.codecs.LZ4Codec()],
    index_codecs=[zarr.codecs.BytesCodec(endian="little"), zarr.codecs.Crc32cCodec()],
    index_location="end",
)

prog.array("stp",        data=stp,  codecs=[sharding_codec], chunks=(1, n_materials, n_energies), dimension_names=["particle","material","energy"])
prog.array("csda_range", data=csda, codecs=[sharding_codec], chunks=(1, n_materials, n_energies), dimension_names=["particle","material","energy"])
```

Upload the resulting `my-dataset.webdedx/` directory tree to your static host
(S3, GitHub Pages, nginx), preserving the directory structure.

#### 2.2.5 Example: Inspecting with Standard Tools

```python
import zarr

store = zarr.open_group("my-dataset.webdedx", mode="r")
meta = store.attrs.asdict()
print(meta["webdedx.metadata"]["name"])
print(meta["webdedx.particles"])
print(len(meta["webdedx.energyGrid"]))

# Read STP for particle index 0 (proton), all materials, all energies
stp = store["srim-2013/stp"]
proton_stp = stp[0, :, :]  # shape: (n_materials, n_energies)
```

```bash
# zarr-python CLI
python -c "import zarr; z = zarr.open('my-dataset.webdedx'); print(z.tree())"
```

#### 2.2.6 Store URL & Extension

- Canonical URL suffix: `.webdedx` (a directory, not a file)
- The `extdata` URL parameter points to the **store root** — the URL at which
  `zarr.json` is accessible as `{url}/zarr.json`.
- **No single-file MIME type.** Each file in the store is served as
  `application/json` (`zarr.json` metadata) or `application/octet-stream`
  (shard files). Static hosts typically serve both types automatically.

### 2.3 Partial Fetch Protocol

zarrita handles Zarr v3 shard reads internally via HTTP Range Requests. The
app-level protocol for a **cold start** (no prior cache):

**Measured cold-start sequence (zarrita 0.7.1, browser, Spike 4 §2.5):**

| Step | Request | Range | Bytes | Notes |
|------|---------|-------|-------|-------|
| 1 | `{root}/.zattrs` | — | 0.2 KB | zarrita v2 compat probe — expected 404 |
| 2 | `{root}/.zgroup` | — | 0.2 KB | zarrita v2 compat probe — expected 404 |
| 3 | `{root}/zarr.json` | — | ~86 KB | Root group metadata (dataset + entity lists) |
| 4 | `{root}/{program}/stp/zarr.json` | — | 1.3 KB | Array metadata (shape, codec, shard config) |
| 5 | `{root}/{program}/stp/c/{i}/0/0` | — | 0 B | HEAD probe (gets Content-Length) |
| 6 | `{root}/{program}/stp/c/{i}/0/0` | `bytes=last-20` | 20 B | ZEP2 shard index (1 inner chunk × 16 B + 4 B CRC) |
| 7 | `{root}/{program}/stp/c/{i}/0/0` | `bytes=0-{end}` | ~137 KB | Compressed ion data |

Total cold start: **7 requests, ~225 KB** (S3/wifi, measured). Steps 1–2 return
404 — zarrita handles these silently and proceeds to `zarr.json`. The store is
**valid Zarr v3** (uses only `zarr.json`, never `.zattrs`/`.zgroup`).

**App-level steps:**

1. **Create store and open root group.** Construct
   `const store = new FetchStore(extdataUrl)`, then call
   `open(root(store), { kind: "group" })`. zarrita fetches root metadata
   (steps 1–3).
2. **Read root attributes.** Extract `webdedx.*` keys. Validate magic, format
   version, and required fields. Build the entity index from
   `webdedx.programs`, `webdedx.particles`, `webdedx.materials`.
3. **Open array.** Call `open(root(store).resolve("{program}/stp"), { kind: "array" })`.
   zarrita fetches array metadata (step 4).
4. **Fetch shard on demand.** When the user requests data for particle index `i`,
   call `get(array, [i, null, null])`. zarrita issues the HEAD probe + ZEP2
   index Range + data Range (steps 5–7).
5. **Decode values.** Extract the `(n_materials, n_energies)` slice and apply
   unit conversion to the app's internal units (MeV/nucl, MeV·cm²/g, g/cm²).

Subsequent requests for the same particle shard reuse the already-fetched
shard file (browser HTTP cache; zarrita does not maintain an in-process cache).

### 2.4 Hosting Requirements

| Requirement | Details |
|-------------|---------|
| **CORS** | The server must set `Access-Control-Allow-Origin: *` (or the specific webdedx origin) for **all files** in the store (`zarr.json`, shard files, array metadata). Without this, the browser blocks every request in the cold-start sequence. S3, GitHub Pages, and most CDNs support CORS configuration. |
| **Range Requests** | **Required** for shard reads (ZEP2 index + data fetches both use `Range`). Must return `Accept-Ranges: bytes` and handle `Range` headers per RFC 7233. S3, GitHub Pages, and nginx support this natively. |
| **HTTPS** | Required when the webdedx app is served over HTTPS (mixed-content blocking). `localhost` HTTP is exempt. |
| **Static hosting** | No server-side logic needed. The store is a directory of static files. |
| **File count** | Per-ion stores have `1 + n_programs × (2 × n_particles + 3)` files (`1` root metadata file + per-program group metadata + 2 array metadata files + per-ion shard files). For a single-program dataset with 287 particles, this is 578 files. GitHub Pages and S3 handle this without friction (confirmed in Spike 4). |

---

## 3. URL Parameter Contract

### 3.1 Parameter Definition

External data sources are specified via one or more `extdata` URL parameters.
Each `extdata` value encodes a **stable user-assigned label** and the source URL,
separated by a literal colon:

```
?extdata={label}:{url1}&extdata={label}:{url2}&...existing params...
```

| Parameter | Type | Required? | Notes |
|-----------|------|-----------|-------|
| `extdata` | `{label}:{percent-encoded-url}` | Optional | `label` is a user-assigned stable identifier matching `[a-zA-Z0-9_-]+`. `url` is the absolute percent-encoded URL to the **root of a `.webdedx` Zarr store** (the URL at which `zarr.json` is served as `{url}/zarr.json`). May appear multiple times for multiple sources. Labels must be unique within a URL. |

The label is **stable across edits** — it does not depend on the position of the
`extdata` parameter in the URL. All entity references (`ext:{label}:{id}`) remain
valid even if other `extdata` sources are added or removed.

**Canonical ordering:** `extdata` parameters appear **before** all other
parameters in the canonical URL form (after `urlv`):

```
?urlv=1&extdata={label1}:{url1}&extdata={label2}:{url2}&particle=...&material=...
```

When `extdata` is absent, the app behaves identically to today (no external
data loaded).

### 3.2 URL Encoding

The URL portion of the `extdata` value must be percent-encoded per standard URL
rules. Special characters in the external URL (especially `&`, `=`, `?`, `:`) are
encoded so that the first literal `:` in the parameter value is always the
label/URL separator:

```
extdata=srim:https%3A%2F%2Fexample.com%2Fdata%2Fsrim.webdedx
```

`URLSearchParams` handles percent-encoding of the full value automatically when
constructing URLs programmatically. When assembling manually, encode the URL
portion only; the label and separator colon are written literally.

### 3.3 Examples

Single external source (label `srim`):
```
/calculator?urlv=1&extdata=srim:https%3A%2F%2Fexample.com%2Fsrim.webdedx&particle=1&material=276&program=auto&energies=100&eunit=MeV
```

Multiple external sources (labels `srim` and `g4`):
```
/plot?urlv=1&extdata=srim:https%3A%2F%2Fcdn.example.com%2Fsrim.webdedx&extdata=g4:https%3A%2F%2Fother.org%2Fgeant4.webdedx&particle=1&material=276&program=auto&series=ext:srim:srim-2013.ext:srim:p.ext:srim:water,9.1.276&stp_unit=kev-um&xscale=log&yscale=log
```

If the user later removes the `g4` source, the `srim` label and all `ext:srim:*`
references remain valid without renaming.

### 3.4 Persistence & Shareability

- External data URLs are persisted in the URL and shared when the user copies
  the browser address bar.
- Anyone opening the shared URL will fetch from the same external source(s).
- The external data is **not** cached in `localStorage` or IndexedDB. Each
  page load re-fetches the header (and tables on demand).
- If the external source goes offline after the URL was shared, the recipient
  sees a blocking error (§5.2).

### 3.5 ABNF Extension

The formal grammar in [`shareable-urls-formal.md`](shareable-urls-formal.md) (v3+)
defines `extdata-pair` and the related lexical rules:

```abnf
extdata-pair        = "extdata=" ext-label ":" url-value
ext-label           = 1*(ALPHA / DIGIT / "_" / "-")
url-value           = 1*(%x21-25 / %x27-39 / %x3B-3C / %x3E-FF)
                    ; excludes space, '&', '=', ':' — all must be percent-encoded
```

`extdata-pair` appears in the `pair` alternatives and may appear multiple times.
Canonical ordering: after `urlv`, before `particle`.

---

## 4. Entity Merging & ID Namespacing

### 4.1 ID Namespacing

External entity IDs are strings (e.g., `"srim-2013"`, `"p"`, `"water"`), while
built-in libdedx IDs are numbers (e.g., `2`, `1`, `276`). To avoid collisions
and enable unambiguous references in URL parameters and series triplets:

- **Built-in entities** continue to use numeric IDs everywhere.
- **External entities** use **prefixed string IDs** in URL parameters:
  `ext:{label}:{entityId}`

  Where `label` is the stable user-assigned label declared in the corresponding
  `extdata` parameter (see §3.1). Using the label rather than a positional index
  means references remain valid when sources are added or removed.

  Examples (assuming `extdata=srim:https://...` and `extdata=g4:https://...`):
  - `ext:srim:srim-2013` — program "srim-2013" from the source labeled `srim`.
  - `ext:srim:p` — particle "p" from the source labeled `srim`.
  - `ext:g4:water` — material "water" from the source labeled `g4`.

  If an `ext:{label}:...` reference appears in the URL but no `extdata` parameter
  with that label exists, the reference is treated as invalid and silently dropped
  (same as an unknown entity ID).

### 4.2 Merging into Entity Lists

When external data is loaded, external programs, particles, and materials are
appended to the built-in lists:

- **Programs:** External programs appear in the program selector below built-in
  programs, in a visually separated "External" group. Programs are never merged
  — each external program is always a distinct entry.

- **Particles:** Merged by the following priority chain:
  1. **PDG code (primary):** If the external particle declares `pdgCode` and a
     built-in `ParticleEntity` has a matching `pdgCode`, they are the **same
     particle**. This correctly handles electrons (PDG 11) and named aliases
     (alpha = PDG 1000020040 = same as libdedx particle 3, regardless of naming).
  2. **(Z, A) fallback:** If `pdgCode` is absent or unmatched, match on
     `(Z, A)`. A = 0 is used for electrons; ions use their nucleon count.
  3. **No match:** The external particle is added as a new entry in the
     "External" group with a 🔗 icon.

  A matched particle is the **same entity** in both sources — the external
  program simply provides additional coverage for that particle. The
  particle selector shows no special icon for matched particles.

- **Materials:** Merged by the following priority chain:
  1. **ICRU/NIST ID (primary):** If the external material declares `icruId`
     and a built-in material has the same numeric ID, they are the **same
     material**. Because libdedx material IDs are ICRU numbers, this is an
     exact, unambiguous match (e.g., `icruId: 276` = water liquid).
  2. **Atomic number (elements):** If `icruId` is absent, and the external
     material declares `atomicNumber`, match against the built-in pure-element
     material with that atomic number Z.
  3. **Name fallback:** If neither merge key is present, match by
     case-insensitive exact `name` string.
  4. **No match:** The external material is added as a new entry in the
     "External" group with a 🔗 icon.

  A matched material is the **same entity** — the material selector shows
  no special icon for matched materials.

### 4.3 Compatibility Matrix Extension

The compatibility matrix is extended with external triplets:

- For each external table entry `(program, particle, material)`, a
  compatibility link is added.
- Bidirectional filtering in entity selection works identically for external
  and built-in entities.
- An external program may support only a subset of particles/materials.
  The greying-out behavior applies normally.

### 4.4 Series Triplet Encoding (Plot Page)

Plot series using external entities encode the prefixed IDs using the source label:

```
series=ext:srim:srim-2013.ext:srim:p.ext:srim:water,9.1.276
```

Assuming `extdata=srim:https://...`, this encodes two series:
1. External: program "srim-2013", particle "p", material "water" from source `srim`.
2. Built-in: program 9 (ICRU 90), particle 1 (proton), material 276 (water).

Mixed external + built-in series are fully supported. The label-based reference
remains stable: removing an unrelated source does not renumber or invalidate this
series.

---

## 5. Loading Lifecycle

### 5.1 Load Sequence

On page load, if `extdata` parameter(s) are present:

1. **Parse URL.** Extract `extdata` URLs (may be multiple).
2. **Show loading indicator.** Display a non-dismissible banner:
   "Loading external data from {n} source(s)…" with a spinner.
   Block all calculation and entity interaction until loading completes.
3. **Fetch metadata in parallel.** For each `extdata` URL, open the Zarr
   store via zarrita (which fetches root `zarr.json` and handles the Zarr v2
   compat probe 404s — see §2.3).
4. **Validate metadata.** Per §6 (Validation).
5. **Merge entities.** Extend the compatibility matrix with external
   programs, particles, and materials.
6. **Remove loading indicator.** Enable entity interaction and calculation.
7. **Continue normal URL parsing.** Parse remaining URL params (particle,
   material, program, energies, series, etc.) against the now-extended
   entity lists.

### 5.2 Error Handling

External data loading is **blocking** — if it fails, the app cannot proceed
with the external data. Errors are displayed prominently.

| Error | User-facing message | Recovery |
|-------|-------------------|----------|
| Network error (timeout, DNS, refused) | "Could not reach external data source: {url}. Check the URL and your network connection." | **Retry** button + **Load without external data** button |
| HTTP error (4xx, 5xx) | "External data source returned error {status}: {url}" | **Load without external data** button |
| CORS blocked | "External data source blocked by browser security policy (CORS). The hosting server must allow cross-origin requests." | **Load without external data** button |
| Invalid format (not a valid Zarr store, missing magic, unsupported version, schema error) | "External data store is invalid: {detail}. Expected a .webdedx Zarr v3 store with webdedx format v1." | **Load without external data** button |
| Validation failure (physics checks) | "External data contains invalid values: {detail}" | **Load without external data** button |

**"Load without external data"** removes the `extdata` parameters from the URL
(via `replaceState`) and reloads with built-in data only.

### 5.3 Table Fetch (On Demand)

Individual table data is fetched when the user requests a calculation or plot
series involving an external triplet:

1. Identify the particle index `i` for the requested particle (from the ordered
   particle list in root `zarr.json` attributes).
2. Read the shard for particle `i` via zarrita (issues HEAD probe + ZEP2 index
   Range + data Range — steps 5–7 of the §2.3 cold-start sequence).
3. Extract the `(n_materials, n_energies)` slice for the target material index.
4. Convert units to the app's internal units (MeV/nucl + MeV·cm²/g + g/cm²)
   using the declared `webdedx.units.*` metadata from the file.
5. Cache the decoded table in memory for the duration of the page session
   (no persistent cache across page loads).

If the row group fetch fails (network error, Range Request not supported and
full file already attempted):
- Show a toast: "Could not load data for {program} / {particle} / {material}."
- The series or calculation row is marked as failed (not silently omitted).

---

## 6. Validation

### 6.1 Structural Validation (on file open)

| Check | Failure action |
|-------|---------------|
| Store root `zarr.json` is absent or not valid JSON | Reject store; blocking error |
| `webdedx.magic` missing or `!== "webdedx-extdata"` | Reject file; blocking error |
| `webdedx.formatVersion` unsupported | Reject file; blocking error |
| Missing required metadata keys (`webdedx.metadata.name`, `webdedx.units.*`, `webdedx.energyGrid`, `webdedx.programs`, `webdedx.particles`, `webdedx.materials`) | Reject file; blocking error |
| JSON arrays in metadata keys fail to parse | Reject file; blocking error |
| ID format invalid (not `[a-zA-Z0-9_-]+`) | Reject file; blocking error |
| `webdedx.units.energy` or `.stoppingPower` not in allowed set | Reject file; blocking error |
| `webdedx.units.csdaRange` present but not in allowed set (`"g/cm²"`, `"cm"`) | Reject file; blocking error |
| `webdedx.units.csdaRange` absent and a `csda_range` array is present in the store | Reject source; blocking error |
| `{program}/stp/zarr.json` missing for a declared program | Reject source; blocking error |
| `{program}/csda_range/zarr.json` missing for a declared program | Accept; CSDA features disabled for that source |
| `stp` array shape does not match `[len(particles), len(materials), n_energies]` | Reject source; blocking error |
| Duplicate IDs within same entity type | Reject file; blocking error |
| A Zarr group name in the store matches a program not declared in `webdedx.programs` | Ignore silently |
| `materials[].density` present but ≤ 0 or not finite | Reject file; blocking error |
| `materials[].ival` present but ≤ 0 or not finite | Reject file; blocking error |
| `particles[].pdgCode` present but not a positive integer | Reject file; blocking error |
| `particles[].pdgCode` duplicated within `webdedx.particles` array | Reject file; blocking error |
| `materials[].icruId` present but not a positive integer | Reject file; blocking error |
| `materials[].atomicNumber` present but not an integer in range 1–118 | Reject file; blocking error |
| `materials[].icruId` and `materials[].atomicNumber` both present on the same entry | Reject file; blocking error (use exactly one merge key) |

### 6.2 Size Limits (DoS prevention)

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max root `zarr.json` size | 1 MB | Prevents excessive metadata parsing |
| Max programs per source | 100 | Reasonable upper bound |
| Max particles per source | 1000 | Covers all ions up to Uranium plus isotopes and exotic particles |
| Max materials per source | 10000 | Supports large compound libraries (FLUKA, Geant4 material databases) |
| Max tables (row groups) per source | 1,000,000 | 100 programs × 1000 particles × 10 materials avg |
| Max points per table | 10,000 | Far exceeds typical energy grid density |
| Max total file size (computed from header) | 1 GB | Partial Range Requests are used; full file is never downloaded |
| Max `extdata` sources | 5 | Prevents URL abuse |

Exceeding any limit → reject the source with a clear error message.

### 6.3 Physics Validation (on row group decode)

Applied to each decoded row group after unit conversion:

| Check | Failure action |
|-------|---------------|
| Energies not in strictly ascending order | Reject table; mark series as failed |
| Any energy ≤ 0 | Reject table |
| Any stopping power ≤ 0 | Reject table |
| Any CSDA range ≤ 0 *(when `csda_range` array present)* | Reject table |
| Any value is `NaN` or `Infinity` | Reject table |
| `nPoints < 2` | Reject table (need at least 2 points for a curve) |
| Energy range implausible (min > 1 GeV/nucl or max < 1 eV) | Warning (toast), but allow |
| Stopping power non-monotonic check | Warning only (some datasets legitimately have Bragg peak structure) |

---

## 7. UI Treatment

### 7.1 Visual Distinction

External entities must be visually distinguishable from built-in data at
every point in the UI:

| UI element | Built-in | External |
|-----------|----------|----------|
| **Program selector** | Normal text | Prefixed with 🔗 icon + "(ext)" suffix, grouped under "External" divider |
| **Particle selector** | Normal text | Merged particles show no special treatment. New external-only particles show 🔗 icon |
| **Material selector** | Normal text | Merged materials show no special treatment. New external-only materials show 🔗 icon |
| **Calculator result columns** | Normal styling | Column header shows 🔗 icon next to program name |
| **Plot series label** | Normal label | Label includes 🔗 icon prefix |
| **Plot series line style** | Solid lines | Dashed lines (to visually separate from built-in solid lines) |

### 7.2 Loading State

While external data is loading:
- A full-width banner appears below the navigation bar:
  "Loading external data…" with a progress indicator.
- Entity selectors are disabled (greyed out).
- The calculator table and plot canvas show a placeholder message.
- No calculation or interaction is possible until loading completes.

### 7.3 Source Attribution

When external data is loaded, a collapsible "External Data Sources" info
panel appears below the entity selection area (Calculator) or at the
bottom of the sidebar (Plot):

| Field | Content |
|-------|---------|
| Source name | From `metadata.name` |
| Version | From `metadata.version` |
| Author | From `metadata.author` |
| Description | From `metadata.description` (truncated to 200 chars) |
| License | From `metadata.license` |
| Coverage | "{n} programs, {m} particles, {k} materials, {t} tables" |
| URL | The `extdata` URL (clickable, opens in new tab) |

This panel is collapsed by default and can be expanded by clicking.
Multiple sources each get their own section.

---

## 8. Calculator Integration

### 8.1 Program Selection

When external data is loaded:
- External programs appear in the Program combobox (compact mode) under an
  "External" separator/group.
- Auto-select does **not** consider external programs. Auto-select only
  resolves to built-in libdedx programs. Users must explicitly select an
  external program.

### 8.2 Calculation

When an external program is selected:
- The app looks up the table for the current (program, particle, material)
  triplet in the external header index.
- Fetches the table data via Range Request (if not already cached in memory).
- Instead of calling the WASM API, the app performs a **lookup + interpolation**
  on the external table:
  - For each user-requested energy value, interpolate the stopping power and
    CSDA range from the external table using the session-level interpolation
    settings (`interpolationScale` + `interpolationMethod` from
    `AdvancedOptions`). The default combination (Log-log + Linear) matches
    libdedx's built-in behaviour, ensuring that built-in and external series
    are directly comparable.
  - If the requested energy is outside the external table's energy bounds,
    mark the row as out-of-range.
- Results are displayed in the same unified table format as built-in data.

**Interpolation configurability:** Both interpolation settings — axis scale
(Log-log / Lin-lin) and fitting method (Linear / Spline) — are session-level
and apply uniformly to WASM calculations and external data JS interpolation.
Mixing interpolation settings across series is not supported. This is required
for scientific validity: comparing a built-in curve using one interpolation
scheme against an external curve using another would be misleading. See
[`advanced-options.md`](advanced-options.md) §4.

**CSDA data absent:** If the external source contains no `csda_range` array,
the CSDA range column for all rows under that program shows "—". The STP
column is unaffected.

**Density absent:** If a material in the external source has no `density` field,
linear unit display (keV/µm, MeV/cm) is disabled for that material. The unit
selector defaults to and is locked to MeV·cm²/g for calculations involving
that material.

### 8.3 Multi-Program (Advanced Mode)

External programs participate in multi-program comparison identically to
built-in programs. They can be added to the `programs` list, hidden via
`hidden_programs`, etc.

---

## 9. Plot Integration

### 9.1 Series with External Data

External (program, particle, material) triplets can be added as plot series:
- The series uses the external table's native energy grid (no resampling to
  a common grid). Each series is plotted on its own grid.
- Line style: dashed (to distinguish from solid built-in series).
- If the external source has no `csda_range` array, the CSDA plot quantity is
  unavailable for that source (grayed out in the quantity selector).
- Color assignment: same palette rotation as built-in series.
- Series label: includes 🔗 icon + external program name.

### 9.2 Preview Series

If the current entity selection includes an external program, the preview
series uses the external table data (fetched on demand).

---

## 10. Security Considerations

### 10.1 No Code Execution

External data stores are Zarr v3 — binary array shards plus JSON metadata
files (`zarr.json`). Metadata attributes are plain JSON objects parsed with
`JSON.parse()` (no `eval()`). Shard files are typed binary arrays decoded as
`float32` by zarrita — no executable code, no scripts, no HTML. The format is
intentionally inert.

### 10.2 Input Sanitization

- All string fields from the Zarr root attributes (`name`, `author`, `description`,
  etc.) are treated as plain text. They are **never** inserted into the DOM
  via `innerHTML`. Use `textContent` or framework-level text interpolation
  only.
- String fields are truncated to reasonable lengths (name: 200 chars,
  description: 2000 chars, author: 200 chars).
- IDs are validated against `[a-zA-Z0-9_-]+` regex before use.

### 10.3 URL Trust Model

- The `extdata` URL is user-supplied and fetched at runtime. The app trusts
  the data structurally (validated per §6) but not semantically — external
  data may be wrong, outdated, or fabricated.
- Users clicking a shared URL with `extdata` will fetch from the specified
  external source. This is intentional and documented.
- The app does **not** proxy or cache external data server-side. All fetches
  are direct browser-to-server.

### 10.4 CORS & Mixed Content

- External sources must set appropriate CORS headers. The app does not
  provide a CORS proxy.
- When webdedx is served over HTTPS, external sources must also use HTTPS
  (except `localhost`). This is enforced by the browser's mixed-content policy.

---

## 11. Converter Tooling (Specification)

### 11.1 Purpose

Command-line tools to convert stopping-power data from common formats
(SRIM, CSV, etc.) into `.webdedx` Zarr v3 stores. Because the output is
standard Zarr v3, these tools are thin wrappers around the Python `zarr`
library that primarily handle source-format parsing and metadata embedding.

### 11.2 Tool: `srim2webdedx`

Converts SRIM text output files into `.webdedx` Zarr v3 store format.

**Input:** A directory of SRIM output files + a manifest file describing
the dataset metadata, particle/material mappings, and file locations.

**Manifest format (YAML):**

```yaml
metadata:
  name: "SRIM 2013 tables"
  version: "1.0.0"
  author: "J. Ziegler"
  description: "SRIM-2013 stopping powers for selected ions and materials"
  license: "CC-BY-4.0"

units:
  energy: "MeV"
  stoppingPower: "MeV·cm²/g"
  csdaRange: "g/cm²"

programs:
  - id: srim-2013
    name: "SRIM 2013"
    version: "2013.00"

particles:
  - id: p
    name: "Proton"
    symbol: "H"
    Z: 1
    A: 1
    atomicMass: 1.00794

  - id: C12
    name: "Carbon-12"
    symbol: "C"
    Z: 6
    A: 12
    atomicMass: 12.0

materials:
  - id: water
    name: "Water (liquid)"
    density: 1.0
    phase: liquid

  - id: si
    name: "Silicon"
    density: 2.329
    phase: solid

tables:
  - program: srim-2013
    particle: p
    material: water
    file: "srim_output/proton_water.txt"
    format: srim  # Parser to use

  - program: srim-2013
    particle: C12
    material: si
    file: "srim_output/carbon_silicon.txt"
    format: srim
```

**Output:** A `.webdedx` Zarr v3 store directory (one shard file per particle
per program, plus `zarr.json` metadata files).

**Usage:**
```bash
srim2webdedx manifest.yaml --output my-srim-data.webdedx
```

### 11.3 Tool: `csv2webdedx`

Converts generic CSV files (energy, stopping power, CSDA range columns)
into `.webdedx` Zarr v3 store format. Uses the same manifest format as
`srim2webdedx` but with `format: csv` and additional column-mapping fields.

### 11.4 Tool: `webdedx-inspect`

A diagnostic/validation tool for `.webdedx` Zarr v3 stores. Since the
format is standard Zarr v3, users can also use the Python `zarr` library or
`zarr-python` CLI directly (see §2.2.5). This tool adds webdedx-specific
validation.

Prints:
- `webdedx.*` metadata (pretty-printed).
- Summary statistics: number of programs, particles, materials, shard files.
- Per-particle info: particle ID, nMaterials, nEnergies, energy bounds, min/max STP.
- Validates the store against all structural and physics checks from §6.

**Usage:**
```bash
webdedx-inspect my-srim-data.webdedx
```

### 11.5 Implementation Language

Tooling is implemented in **Python** (matching the existing `libdedx/python/`
ecosystem). Depends on `zarr`, `numcodecs`, and `pyyaml`. Packaged as a
pip-installable CLI tool.

---

## 12. Acceptance Criteria

### 12.1 External Data Loading

- [ ] App with `extdata` URL parameter fetches root `zarr.json` via zarrita (cold-start: ≤ 7 requests).
- [ ] App validates Zarr root attributes (`webdedx.magic`, version, required keys, size limits).
- [ ] App displays a loading indicator while fetching.
- [ ] On success, external programs/particles/materials appear in selectors.
- [ ] On network error, a blocking error is shown with "Retry" and "Load without external data" options.
- [ ] On validation error, a blocking error is shown with details.
- [ ] "Load without external data" removes `extdata` from URL and reloads.
- [ ] Store without `csda_range` array loads successfully; CSDA column shows "—"; CSDA plot quantity grayed out for that source.
- [ ] Store with a material missing `density` loads successfully; keV/µm and MeV/cm units are disabled for that material.

### 12.2 Entity Integration

- [ ] External programs appear under an "External" group in the program selector.
- [ ] External-only particles/materials appear with 🔗 icon.
- [ ] Merged particles (same Z, A) show no special icon — just additional program coverage.
- [ ] Bidirectional filtering works correctly with external entities.
- [ ] Auto-select never resolves to an external program.

### 12.3 Calculator

- [ ] Selecting an external program + valid particle/material performs lookup + interpolation on the external table.
- [ ] Energy values outside the external table's bounds show "out of range".
- [ ] External program columns in multi-program mode display with 🔗 badge.

### 12.4 Plot

- [ ] External series can be added and display as dashed lines.
- [ ] Mixed external + built-in series on the same plot work correctly.
- [ ] Each series uses its own native energy grid (no resampling).
- [ ] External series labels include 🔗 icon.

### 12.5 URL Shareability

- [ ] URL with `extdata` parameter can be shared; recipient sees same external data.
- [ ] Multiple `extdata` parameters work correctly.
- [ ] Removing external data rewrites URL without `extdata`.

### 12.6 Security

- [ ] Zarr root attribute values parsed with `JSON.parse()` only (no `eval`).
- [ ] String values rendered as `textContent` only (no `innerHTML`).
- [ ] Size limits enforced; oversized files rejected.
- [ ] IDs validated against `[a-zA-Z0-9_-]+`.

### 12.7 Tooling

- [ ] `srim2webdedx` reads SRIM output + manifest → produces valid `.webdedx` Zarr v3 store.
- [ ] `webdedx-inspect` validates and summarizes a `.webdedx` Zarr v3 store.
- [ ] Generated `.webdedx` store passes all app-side validation checks.
- [ ] Generated store is readable by standard Zarr tools (zarr-python, zarrita).

---

## 13. Open Questions

1. **Material matching heuristic:** Exact name match may miss equivalent
   materials with slightly different names (e.g., "Water" vs "Water, Liquid"
   vs "H2O"). Should we also match on chemical formula or density similarity?
   *Recommendation: start with exact case-insensitive name match; add formula
   matching in a future iteration.*

2. **Interpolation method for external data:** ✅ **Resolved.** Log-log +
   Linear (piecewise linear in log-log space) is the default, matching the
   libdedx C library default. Configurable interpolation is exposed via two
   independent session-level controls in `advanced-options.md` §4: **Axis
   scale** (Log-log / Lin-lin) and **Method** (Linear / Spline). Both
   controls apply consistently to WASM calculations and external data JS
   interpolation. Per-dataset interpolation declaration is not supported —
   doing so would make side-by-side comparisons scientifically unreliable.
   See §8.2 and [`advanced-options.md`](advanced-options.md) §4.

3. **CSDA range from stopping power:** ✅ **Resolved (v6).** The `csda_range`
   Zarr array is optional. Stores that contain only stopping-power data are
   valid — CSDA columns in the Calculator and the CSDA plot quantity show "—"
   for that source. Computing CSDA by integrating the external stopping-power
   table remains deferred to a future version.

4. **Offline / local file support:** ✅ **Resolved.** v1 supports URL-based
   loading only (`extdata={label}:{url}`). Local file loading via
   `<input type="file">` is not in scope.

---

## 14. Cross-Spec Consistency Checklist

- [ ] `extdata` URL parameter added to `shareable-urls.md` canonical ordering
      and ABNF grammar.
- [ ] Entity selection spec acknowledges external entity groups and 🔗 badge.
- [ ] Plot spec acknowledges dashed-line style for external series.
- [ ] Calculator spec acknowledges interpolation-based lookup for external programs.
- [ ] Unit handling spec acknowledges external data unit conversion on load.
- [ ] Project vision updated with §4.7 (or appropriate section) mentioning
      external data support as a planned feature.
