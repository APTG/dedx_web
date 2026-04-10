# Feature: External Stopping-Power / Range Data

> **Status:** Final v4 (9 April 2026)
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

External data is served as an **Apache Parquet** file with the
`.webdedx.parquet` extension. Parquet is a columnar storage format with
built-in support for row-group-level partial reads via HTTP Range Requests,
self-describing schema, and rich metadata. This avoids inventing a custom
binary format and gives users access to mature tooling (Pandas, Polars,
DuckDB, PyArrow) for inspection and generation.

The JS reader is [`hyparquet`](https://github.com/hyparam/hyparquet) —
a pure-JS, zero-WASM Parquet reader (~15 KB) with native Range Request
support for remote files.

### 2.1 Logical Data Model

An external dataset defines:

1. **Metadata** — dataset name, version, author, description, license.
2. **Programs** — one or more named programs (e.g., "SRIM-2013", "Geant4-11.2").
3. **Particles** — particle definitions with mass data.
4. **Materials** — material definitions with density.
5. **Tables** — per (program, particle, material) triplet:
   - Array of energy values with declared unit.
   - Array of stopping-power values with declared unit.
   - Array of CSDA-range values with declared unit.

### 2.2 Parquet Schema

#### 2.2.1 File-Level Key-Value Metadata

Dataset-wide information is stored in the Parquet file's **key-value metadata**
(accessible without reading any row groups):

| Key | Type | Required | Example |
|-----|------|----------|---------|
| `webdedx.magic` | string | yes | `"webdedx-extdata"` |
| `webdedx.formatVersion` | string (integer) | yes | `"1"` |
| `webdedx.metadata.name` | string | yes | `"SRIM 2013 tables"` |
| `webdedx.metadata.version` | string | no | `"1.0.0"` |
| `webdedx.metadata.author` | string | no | `"J. Ziegler"` |
| `webdedx.metadata.description` | string | no | `"SRIM-2013 stopping powers for selected ions and materials"` |
| `webdedx.metadata.license` | string | no | `"CC-BY-4.0"` |
| `webdedx.metadata.generatedBy` | string | no | `"srim2webdedx v0.1.0"` |
| `webdedx.metadata.generatedAt` | string (ISO 8601) | no | `"2026-04-08T12:00:00Z"` |
| `webdedx.units.energy` | string | yes | `"MeV"` |
| `webdedx.units.stoppingPower` | string | yes | `"MeV·cm²/g"` |
| `webdedx.units.csdaRange` | string | yes | `"g/cm²"` |
| `webdedx.programs` | string (JSON array) | yes | see below |
| `webdedx.particles` | string (JSON array) | yes | see below |
| `webdedx.materials` | string (JSON array) | yes | see below |

JSON array values (stored as strings in Parquet key-value metadata):

```json
// webdedx.programs
[
  { "id": "srim-2013", "name": "SRIM 2013", "version": "2013.00" }
]

// webdedx.particles
[
  { "id": "p",   "name": "Proton",     "symbol": "H",  "Z": 1, "A": 1,  "atomicMass": 1.00794, "pdgCode": 2212       },
  { "id": "C12", "name": "Carbon-12",  "symbol": "C",  "Z": 6, "A": 12, "atomicMass": 12.0,    "pdgCode": 1000060120 },
  { "id": "e-",  "name": "Electron",   "symbol": "e⁻", "Z": 0, "A": 0,  "atomicMass": 0.000511,"pdgCode": 11         }
]

// webdedx.materials
[
  { "id": "water", "name": "Water (liquid)", "density": 1.0,   "phase": "liquid", "icruId": 276      },
  { "id": "si",    "name": "Silicon",        "density": 2.329, "phase": "solid",  "atomicNumber": 14 }
]
```

**Key constraints:**
- `webdedx.magic` must be `"webdedx-extdata"`.
- `webdedx.formatVersion` must be a positive integer (as string). The app
  rejects unknown major versions.
- IDs (`programs[].id`, `particles[].id`, `materials[].id`) are strings, not
  numbers. They must match `[a-zA-Z0-9_-]+`.
- `webdedx.units.energy` must be one of: `"MeV"`, `"MeV/nucl"`, `"MeV/u"`, `"keV"`, `"GeV"`.
- `webdedx.units.stoppingPower` must be one of: `"MeV·cm²/g"`, `"MeV/cm"`, `"keV/µm"`.
- `webdedx.units.csdaRange` must be one of: `"g/cm²"`, `"cm"`.

**Particle merge-key fields (`particles[]`):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Internal ID within this file. Matches `[a-zA-Z0-9_-]+`. |
| `name` | string | yes | Human-readable name. |
| `symbol` | string | yes | Chemical symbol or `"e⁻"` for electrons. |
| `Z` | integer | yes | Atomic number. 0 for electrons. |
| `A` | integer | yes | Mass number (nucleons). 0 for electrons. |
| `atomicMass` | number | yes | Atomic mass in u (daltons). Used for MeV/u conversion. |
| `pdgCode` | integer | **recommended** | PDG Monte Carlo particle number. Used as the primary merge key with built-in particles. Common values: proton = 2212, electron = 11, alpha (He-4) = 1000020040, C-12 = 1000060120. Ion convention: 1000 × Z × 10000 + A × 10. |

**Material merge-key fields (`materials[]`):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Internal ID within this file. Matches `[a-zA-Z0-9_-]+`. |
| `name` | string | yes | Human-readable name. |
| `density` | number | yes | Material density in g/cm³. |
| `phase` | string | no | `"solid"`, `"liquid"`, or `"gas"`. |
| `icruId` | integer | **recommended** | ICRU/NIST material number. Built-in libdedx material IDs are ICRU numbers, so `icruId: 276` matches built-in material 276 (water liquid) exactly. Use this for any standard ICRU/NIST material. |
| `atomicNumber` | integer | recommended for elements | Atomic number Z. Used as merge key for pure elemental targets (e.g., `atomicNumber: 14` for silicon). Takes effect only when `icruId` is absent. |

#### 2.2.2 Row Groups — One Per Table

Each Parquet **row group** contains the data for exactly one
(program, particle, material) triplet. Row groups are the unit of partial
fetch — `hyparquet` reads only the requested row groups via Range Requests.

Row-group-level key-value metadata identifies the triplet:

| Key | Type | Example |
|-----|------|---------|
| `webdedx.program` | string | `"srim-2013"` |
| `webdedx.particle` | string | `"p"` |
| `webdedx.material` | string | `"water"` |

> **Note:** Parquet row-group metadata is not universally supported by all
> writers. As a robust fallback, the triplet is also encoded as columns in the
> data (§2.2.3). The app prefers row-group metadata if present; otherwise it
> reads the first row's `program`/`particle`/`material` column values.

#### 2.2.3 Columns

Each row in the Parquet file represents one energy point. All rows within a
row group share the same (program, particle, material) triplet.

| Column | Parquet type | Nullable | Description |
|--------|-------------|----------|-------------|
| `program` | `BYTE_ARRAY` (UTF-8) | no | Program ID (e.g., `"srim-2013"`) |
| `particle` | `BYTE_ARRAY` (UTF-8) | no | Particle ID (e.g., `"p"`) |
| `material` | `BYTE_ARRAY` (UTF-8) | no | Material ID (e.g., `"water"`) |
| `energy` | `DOUBLE` | no | Energy value in declared unit |
| `stopping_power` | `DOUBLE` | no | Stopping power in declared unit |
| `csda_range` | `DOUBLE` | no | CSDA range in declared unit |

- Rows within a row group must be sorted by `energy` in strictly ascending order.
- The `program`, `particle`, `material` columns are constant within a row group
  (they enable triplet identification even without row-group metadata, and allow
  querying with standard Parquet tools like DuckDB).

#### 2.2.4 Example: Creating a File with Python

```python
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import json

# One DataFrame per table (row group)
tables = []
for program, particle, material, energies, stp, csda in data_triplets:
    df = pd.DataFrame({
        "program": program,
        "particle": particle,
        "material": material,
        "energy": energies,
        "stopping_power": stp,
        "csda_range": csda,
    })
    tables.append(pa.Table.from_pandas(df))

# Combine into one table (each original table becomes a row group)
combined = pa.concat_tables(tables)

# File-level metadata
file_metadata = {
    b"webdedx.magic": b"webdedx-extdata",
    b"webdedx.formatVersion": b"1",
    b"webdedx.metadata.name": b"SRIM 2013 tables",
    b"webdedx.metadata.author": b"J. Ziegler",
    b"webdedx.units.energy": b"MeV",
    b"webdedx.units.stoppingPower": b"MeV\xc2\xb7cm\xc2\xb2/g",
    b"webdedx.units.csdaRange": b"g/cm\xc2\xb2",
    b"webdedx.programs": json.dumps([
        {"id": "srim-2013", "name": "SRIM 2013", "version": "2013.00"}
    ]).encode(),
    b"webdedx.particles": json.dumps([
        {"id": "p", "name": "Proton", "symbol": "H", "Z": 1, "A": 1, "atomicMass": 1.00794}
    ]).encode(),
    b"webdedx.materials": json.dumps([
        {"id": "water", "name": "Water (liquid)", "density": 1.0, "phase": "liquid"}
    ]).encode(),
}

# Write with one row group per triplet
schema = combined.schema.with_metadata({
    **combined.schema.metadata or {},
    **file_metadata,
})
combined = combined.replace_schema_metadata(schema.metadata)

writer = pq.ParquetWriter("srim-data.webdedx.parquet", combined.schema)
for tbl in tables:
    tbl = tbl.replace_schema_metadata(schema.metadata)
    writer.write_table(tbl)  # Each write_table call creates one row group
writer.close()
```

#### 2.2.5 Example: Inspecting with Standard Tools

```bash
# DuckDB — query the file like a database
duckdb -c "SELECT program, particle, material, count(*) as points
           FROM 'srim-data.webdedx.parquet'
           GROUP BY ALL"

# PyArrow — read metadata without loading data
python -c "
import pyarrow.parquet as pq
f = pq.ParquetFile('srim-data.webdedx.parquet')
print(f.schema_arrow.metadata)
print(f'Row groups: {f.metadata.num_row_groups}')
"

# Pandas — read all data
python -c "
import pandas as pd
df = pd.read_parquet('srim-data.webdedx.parquet')
print(df.head())
"
```

#### 2.2.6 File Extension & MIME Type

- Required file extension: `.webdedx.parquet`
- Recommended MIME type for serving: `application/vnd.apache.parquet`
  (or `application/octet-stream` if the host doesn't support custom types).

### 2.3 Partial Fetch Protocol

`hyparquet` handles Range Requests internally. The app-level protocol:

1. **Open remote file.** Pass the `extdata` URL to `hyparquet`'s async reader
   (which fetches the Parquet footer via Range Request to learn the schema,
   metadata, and row group locations).
2. **Read file-level metadata.** Extract `webdedx.*` keys from the schema
   metadata. Validate magic, format version, and required fields. Build the
   index of available (program, particle, material) triplets from
   `webdedx.programs`, `webdedx.particles`, `webdedx.materials`, and the
   row group structure.
3. **Fetch row group on demand.** When the user requests data for a specific
   triplet, read the corresponding row group via `hyparquet`
   (which issues a targeted Range Request for that row group's byte range).
4. **Decode columns.** Extract `energy`, `stopping_power`, and `csda_range`
   columns as typed arrays.

If the server does not support Range Requests (returns `200` instead of `206`),
`hyparquet` falls back to downloading the entire file. A console warning is
emitted: "Server does not support Range Requests; downloading full file."

### 2.4 Hosting Requirements

| Requirement | Details |
|-------------|---------|
| **CORS** | The server must set `Access-Control-Allow-Origin: *` (or the specific origin of the webdedx instance). Without this, the browser blocks the fetch. S3, GitHub Pages, and most CDNs support CORS configuration. See technical docs for setup guides. |
| **Range Requests** | Recommended for performance. Must return `Accept-Ranges: bytes` and handle `Range` headers per RFC 7233. S3, GitHub Pages, and nginx support this natively. |
| **HTTPS** | Required when the webdedx app is served over HTTPS (mixed-content blocking). `localhost` HTTP is exempt. |
| **Static hosting** | No server-side logic needed. The file is a static Parquet file. |

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
| `extdata` | `{label}:{percent-encoded-url}` | Optional | `label` is a user-assigned stable identifier matching `[a-zA-Z0-9_-]+`. `url` is the absolute percent-encoded URL to a `.webdedx.parquet` file. May appear multiple times for multiple sources. Labels must be unique within a URL. |

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
extdata=srim:https%3A%2F%2Fexample.com%2Fdata%2Fsrim.webdedx.parquet
```

`URLSearchParams` handles percent-encoding of the full value automatically when
constructing URLs programmatically. When assembling manually, encode the URL
portion only; the label and separator colon are written literally.

### 3.3 Examples

Single external source (label `srim`):
```
/calculator?urlv=1&extdata=srim:https%3A%2F%2Fexample.com%2Fsrim.webdedx.parquet&particle=1&material=276&program=auto&energies=100&eunit=MeV
```

Multiple external sources (labels `srim` and `g4`):
```
/plot?urlv=1&extdata=srim:https%3A%2F%2Fcdn.example.com%2Fsrim.webdedx.parquet&extdata=g4:https%3A%2F%2Fother.org%2Fgeant4.webdedx.parquet&particle=1&material=276&program=auto&series=ext:srim:srim-2013.ext:srim:p.ext:srim:water,9.1.276&stp_unit=kev-um&xscale=log&yscale=log
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
3. **Fetch metadata in parallel.** For each `extdata` URL, open the Parquet
   file via `hyparquet` (which fetches the footer and schema metadata via
   Range Requests).
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
| Invalid format (not Parquet, missing magic, unsupported version, schema error) | "External data file is invalid: {detail}. Expected a .webdedx.parquet file with webdedx format v1." | **Load without external data** button |
| Validation failure (physics checks) | "External data contains invalid values: {detail}" | **Load without external data** button |

**"Load without external data"** removes the `extdata` parameters from the URL
(via `replaceState`) and reloads with built-in data only.

### 5.3 Table Fetch (On Demand)

Individual table data is fetched when the user requests a calculation or plot
series involving an external triplet:

1. Identify the row group corresponding to the requested (program, particle,
   material) triplet (from the index built during header parse).
2. Read the row group via `hyparquet` (which issues a targeted Range Request).
3. Extract `energy`, `stopping_power`, and `csda_range` columns as typed arrays.
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
| File is not valid Parquet (footer parse fails) | Reject file; blocking error |
| `webdedx.magic` missing or `!== "webdedx-extdata"` | Reject file; blocking error |
| `webdedx.formatVersion` unsupported | Reject file; blocking error |
| Missing required metadata keys (`webdedx.metadata.name`, `webdedx.units.*`, `webdedx.programs`, `webdedx.particles`, `webdedx.materials`) | Reject file; blocking error |
| JSON arrays in metadata keys fail to parse | Reject file; blocking error |
| ID format invalid (not `[a-zA-Z0-9_-]+`) | Reject file; blocking error |
| `webdedx.units.energy` / `.stoppingPower` / `.csdaRange` not in allowed set | Reject file; blocking error |
| Missing required columns (`program`, `particle`, `material`, `energy`, `stopping_power`, `csda_range`) | Reject file; blocking error |
| Duplicate IDs within same entity type | Reject file; blocking error |
| Row group references a program/particle/material ID not declared in file metadata | Reject file; blocking error |
| Duplicate (program, particle, material) triplets across row groups | Reject file; blocking error |
| `particles[].pdgCode` present but not a positive integer | Reject file; blocking error |
| `particles[].pdgCode` duplicated within `webdedx.particles` array | Reject file; blocking error |
| `materials[].icruId` present but not a positive integer | Reject file; blocking error |
| `materials[].atomicNumber` present but not an integer in range 1–118 | Reject file; blocking error |
| `materials[].icruId` and `materials[].atomicNumber` both present on the same entry | Reject file; blocking error (use exactly one merge key) |

### 6.2 Size Limits (DoS prevention)

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max Parquet footer + metadata size | 1 MB | Prevents excessive metadata parsing |
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
| Any CSDA range ≤ 0 | Reject table |
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
- Color assignment: same palette rotation as built-in series.
- Series label: includes 🔗 icon + external program name.

### 9.2 Preview Series

If the current entity selection includes an external program, the preview
series uses the external table data (fetched on demand).

---

## 10. Security Considerations

### 10.1 No Code Execution

External data files are Apache Parquet — a columnar data format that contains
only typed column data and key-value string metadata. Metadata values containing
JSON are parsed with `JSON.parse()` (no `eval()`). No executable code, no
scripts, no HTML. Parquet is intentionally inert.

### 10.2 Input Sanitization

- All string fields from the Parquet metadata (`name`, `author`, `description`,
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
(SRIM, CSV, etc.) into `.webdedx.parquet` files. Because the output is
standard Parquet, these tools are thin wrappers around PyArrow that
primarily handle source-format parsing and metadata embedding.

### 11.2 Tool: `srim2webdedx`

Converts SRIM text output files into `.webdedx.parquet` format.

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

**Output:** A single `.webdedx.parquet` file (one row group per table).

**Usage:**
```bash
srim2webdedx manifest.yaml --output my-srim-data.webdedx.parquet
```

### 11.3 Tool: `csv2webdedx`

Converts generic CSV files (energy, stopping power, CSDA range columns)
into `.webdedx.parquet` format. Uses the same manifest format as
`srim2webdedx` but with `format: csv` and additional column-mapping fields.

### 11.4 Tool: `webdedx-inspect`

A diagnostic/validation tool for `.webdedx.parquet` files. Since the
format is standard Parquet, users can also use DuckDB, Pandas, or PyArrow
directly (see §2.2.5). This tool adds webdedx-specific validation.

Prints:
- `webdedx.*` metadata (pretty-printed).
- Summary statistics: number of programs, particles, materials, row groups.
- Per-row-group info: triplet, nPoints, energy bounds, min/max stopping power.
- Validates the file against all structural and physics checks from §6.

**Usage:**
```bash
webdedx-inspect my-srim-data.webdedx.parquet
```

### 11.5 Implementation Language

Tooling is implemented in **Python** (matching the existing `libdedx/python/`
ecosystem). Depends on `pyarrow` and `pyyaml`. Packaged as a pip-installable
CLI tool.

---

## 12. Acceptance Criteria

### 12.1 External Data Loading

- [ ] App with `extdata` URL parameter fetches the Parquet footer & metadata via Range Request.
- [ ] App validates Parquet metadata (`webdedx.magic`, version, required keys, size limits).
- [ ] App displays a loading indicator while fetching.
- [ ] On success, external programs/particles/materials appear in selectors.
- [ ] On network error, a blocking error is shown with "Retry" and "Load without external data" options.
- [ ] On validation error, a blocking error is shown with details.
- [ ] "Load without external data" removes `extdata` from URL and reloads.

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

- [ ] Parquet metadata JSON values parsed with `JSON.parse()` only (no `eval`).
- [ ] String values rendered as `textContent` only (no `innerHTML`).
- [ ] Size limits enforced; oversized files rejected.
- [ ] IDs validated against `[a-zA-Z0-9_-]+`.

### 12.7 Tooling

- [ ] `srim2webdedx` reads SRIM output + manifest → produces valid `.webdedx.parquet` file.
- [ ] `webdedx-inspect` validates and summarizes a `.webdedx.parquet` file.
- [ ] Generated `.webdedx.parquet` file passes all app-side validation checks.
- [ ] Generated file is readable by standard Parquet tools (DuckDB, Pandas, PyArrow).

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

3. **CSDA range from stopping power:** Should the app offer an option to
   compute CSDA range by integrating the stopping-power table (for sources
   that only provide stopping power)? *Recommendation: defer to a future
   version. v1 requires both stopping power and CSDA range in the file.*

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
