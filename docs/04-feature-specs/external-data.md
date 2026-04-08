# Feature: External Stopping-Power / Range Data

> **Status:** Draft v1 (8 April 2026)
>
> This spec defines how webdedx loads, validates, and displays user-hosted
> stopping-power and CSDA-range datasets alongside the built-in libdedx data.
>
> **Stage:** Specified in Stage 1; implementation deferred to a later stage.
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

External data is served as a **directory of static files** accessed via HTTP
Range Requests from a single binary container (see §2.2). This enables partial
fetching of individual tables without downloading the entire dataset.

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

### 2.2 File Structure — Binary Container with Index

The dataset is a single binary file with a JSON index header followed by
binary table data. This design enables HTTP Range Requests for partial reads.

```
┌──────────────────────────────────────┐
│  Header (JSON, UTF-8)                │  ← Fetched first (small, fixed-offset)
│  - magic + format version            │
│  - metadata (name, author, …)        │
│  - programs[]                        │
│  - particles[]                       │
│  - materials[]                       │
│  - tables[] with byte offsets/sizes  │
├──────────────────────────────────────┤
│  Table data (binary, IEEE 754)       │  ← Fetched on demand via Range Requests
│  - table 0: energies + stp + csda   │
│  - table 1: …                        │
│  - …                                 │
└──────────────────────────────────────┘
```

#### 2.2.1 Header

The first 4 bytes encode the header length as a big-endian unsigned 32-bit
integer. The next `headerLength` bytes are a UTF-8 JSON object:

```json
{
  "magic": "webdedx-extdata",
  "formatVersion": 1,
  "metadata": {
    "name": "SRIM 2013 tables",
    "version": "1.0.0",
    "author": "J. Ziegler",
    "description": "SRIM-2013 stopping powers for selected ions and materials",
    "license": "CC-BY-4.0",
    "generatedBy": "srim2webdedx v0.1.0",
    "generatedAt": "2026-04-08T12:00:00Z"
  },
  "programs": [
    { "id": "srim-2013", "name": "SRIM 2013", "version": "2013.00" }
  ],
  "particles": [
    { "id": "p", "name": "Proton", "symbol": "H", "Z": 1, "A": 1, "atomicMass": 1.00794 },
    { "id": "C12", "name": "Carbon-12", "symbol": "C", "Z": 6, "A": 12, "atomicMass": 12.0 }
  ],
  "materials": [
    { "id": "water", "name": "Water (liquid)", "density": 1.0, "phase": "liquid" },
    { "id": "si", "name": "Silicon", "density": 2.329, "phase": "solid" }
  ],
  "units": {
    "energy": "MeV",
    "stoppingPower": "MeV·cm²/g",
    "csdaRange": "g/cm²"
  },
  "tables": [
    {
      "program": "srim-2013",
      "particle": "p",
      "material": "water",
      "nPoints": 200,
      "byteOffset": 0,
      "byteLength": 4800,
      "energyBounds": [0.001, 10000.0]
    },
    {
      "program": "srim-2013",
      "particle": "p",
      "material": "si",
      "nPoints": 200,
      "byteOffset": 4800,
      "byteLength": 4800,
      "energyBounds": [0.001, 10000.0]
    }
  ]
}
```

**Key constraints:**
- `magic` must be `"webdedx-extdata"`.
- `formatVersion` must be a positive integer. The app rejects unknown major versions.
- IDs (`programs[].id`, `particles[].id`, `materials[].id`) are strings, not numbers.
  This avoids collisions with libdedx numeric IDs. They must match `[a-zA-Z0-9_-]+`.
- `units.energy` must be one of: `"MeV"`, `"MeV/nucl"`, `"MeV/u"`, `"keV"`, `"GeV"`.
- `units.stoppingPower` must be one of: `"MeV·cm²/g"`, `"MeV/cm"`, `"keV/µm"`.
- `units.csdaRange` must be one of: `"g/cm²"`, `"cm"`.
- `tables[].byteOffset` is relative to the start of the binary data section
  (i.e., offset 0 = first byte after the JSON header).
- `tables[].byteLength` = `nPoints * 3 * 8` (three float64 arrays: energy,
  stopping power, CSDA range — each value is an IEEE 754 double, 8 bytes).

#### 2.2.2 Binary Table Data

Each table is a contiguous block of `nPoints * 3` IEEE 754 double-precision
floats (little-endian), laid out as:

```
[energy_0, energy_1, …, energy_{n-1},
 stp_0,    stp_1,    …, stp_{n-1},
 csda_0,   csda_1,   …, csda_{n-1}]
```

Energy values must be in strictly ascending order. This layout enables
efficient typed-array construction via `Float64Array` on the fetched
`ArrayBuffer`.

#### 2.2.3 MIME Type & File Extension

- Recommended file extension: `.webdedx`
- Recommended MIME type for serving: `application/octet-stream`
- The file may also be served as `application/x-webdedx` if the host supports
  custom MIME types (not required).

### 2.3 Partial Fetch Protocol

1. **Fetch header:** `GET` with `Range: bytes=0-3` to read the 4-byte header
   length, then `Range: bytes=4-{4+headerLength-1}` to read the JSON header.
   (May be combined into a single request with a generous initial range, e.g.,
   `Range: bytes=0-65535`, if the header is expected to be < 64 KB.)
2. **Parse header.** Validate magic, format version, and schema. Build the
   index of available tables.
3. **Fetch table on demand.** When the user requests data for a specific
   (program, particle, material) triplet, fetch `Range: bytes={dataStart+byteOffset}-{dataStart+byteOffset+byteLength-1}`
   where `dataStart = 4 + headerLength`.
4. **Decode binary.** Wrap the response `ArrayBuffer` in a `Float64Array` and
   split into energy, stopping-power, and CSDA-range arrays.

If the server does not support Range Requests (returns `200` instead of `206`),
the app falls back to downloading the entire file and slicing locally. A console
warning is emitted: "Server does not support Range Requests; downloading full file."

### 2.4 Hosting Requirements

| Requirement | Details |
|-------------|---------|
| **CORS** | The server must set `Access-Control-Allow-Origin: *` (or the specific origin of the webdedx instance). Without this, the browser blocks the fetch. S3, GitHub Pages, and most CDNs support CORS configuration. See technical docs for setup guides. |
| **Range Requests** | Recommended for performance. Must return `Accept-Ranges: bytes` and handle `Range` headers per RFC 7233. S3, GitHub Pages, and nginx support this natively. |
| **HTTPS** | Required when the webdedx app is served over HTTPS (mixed-content blocking). `localhost` HTTP is exempt. |
| **Static hosting** | No server-side logic needed. The file is a static binary blob. |

---

## 3. URL Parameter Contract

### 3.1 Parameter Definition

External data sources are specified via one or more `extdata` URL parameters:

```
?extdata={url1}&extdata={url2}&...existing params...
```

| Parameter | Type | Required? | Notes |
|-----------|------|-----------|-------|
| `extdata` | URL (percent-encoded) | Optional | Absolute URL to a `.webdedx` file. May appear multiple times for multiple sources. |

**Canonical ordering:** `extdata` parameters appear **before** all other
parameters in the canonical URL form (after `urlv`):

```
?urlv=1&extdata={url1}&extdata={url2}&particle=...&material=...
```

When `extdata` is absent, the app behaves identically to today (no external
data loaded).

### 3.2 URL Encoding

The URL value must be percent-encoded per standard URL rules. Special characters
in the external URL (especially `&`, `=`, `?`) are encoded:

```
extdata=https%3A%2F%2Fexample.com%2Fdata%2Fsrim.webdedx
```

`URLSearchParams` handles this automatically.

### 3.3 Examples

Single external source:
```
/calculator?urlv=1&extdata=https%3A%2F%2Fexample.com%2Fsrim.webdedx&particle=1&material=276&program=auto&energies=100&eunit=MeV
```

Multiple external sources:
```
/plot?urlv=1&extdata=https%3A%2F%2Fcdn.example.com%2Fsrim.webdedx&extdata=https%3A%2F%2Fother.org%2Fgeant4.webdedx&particle=1&material=276&program=auto&series=srim-2013.p.water,9.1.276&stp_unit=kev-um&xscale=log&yscale=log
```

### 3.4 Persistence & Shareability

- External data URLs are persisted in the URL and shared when the user copies
  the browser address bar.
- Anyone opening the shared URL will fetch from the same external source(s).
- The external data is **not** cached in `localStorage` or IndexedDB. Each
  page load re-fetches the header (and tables on demand).
- If the external source goes offline after the URL was shared, the recipient
  sees a blocking error (§5.2).

### 3.5 ABNF Extension

Add to the formal grammar in `shareable-urls-formal.md`:

```abnf
extdata-pair        = "extdata=" url-value
url-value           = 1*(%x21-7E)   ; percent-encoded URL (no spaces)
```

`extdata-pair` is added to the `pair` alternatives and may appear multiple
times. Canonical ordering: after `urlv`, before `particle`.

---

## 4. Entity Merging & ID Namespacing

### 4.1 ID Namespacing

External entity IDs are strings (e.g., `"srim-2013"`, `"p"`, `"water"`), while
built-in libdedx IDs are numbers (e.g., `2`, `1`, `276`). To avoid collisions
and enable unambiguous references in URL parameters and series triplets:

- **Built-in entities** continue to use numeric IDs everywhere.
- **External entities** use **prefixed string IDs** in URL parameters:
  `ext:{sourceIndex}:{entityId}`

  Where `sourceIndex` is the 0-based index of the `extdata` parameter in the URL
  (stable within a given URL).

  Examples:
  - `ext:0:srim-2013` — program "srim-2013" from the first external source.
  - `ext:0:p` — particle "p" from the first external source.
  - `ext:1:water` — material "water" from the second external source.

### 4.2 Merging into Entity Lists

When external data is loaded, external programs, particles, and materials are
appended to the built-in lists:

- **Programs:** External programs appear in the program selector below built-in
  programs, in a visually separated "External" group.
- **Particles:** External particles are merged by matching on (Z, A). If an
  external particle has the same (Z, A) as a built-in particle, they are
  treated as the **same particle** — the external source simply provides
  additional program coverage for that particle. If no match exists, the
  external particle is added to the particle list in the "External" group.
- **Materials:** External materials are merged by name similarity heuristic
  (case-insensitive exact match on `name`). If a match exists, the external
  source provides additional program coverage for that material. If no match,
  the material is added to the list in the "External" group.

### 4.3 Compatibility Matrix Extension

The compatibility matrix is extended with external triplets:

- For each external table entry `(program, particle, material)`, a
  compatibility link is added.
- Bidirectional filtering in entity selection works identically for external
  and built-in entities.
- An external program may support only a subset of particles/materials.
  The greying-out behavior applies normally.

### 4.4 Series Triplet Encoding (Plot Page)

Plot series using external entities encode the prefixed IDs:

```
series=ext:0:srim-2013.ext:0:p.ext:0:water,9.1.276
```

This encodes two series:
1. External: program "srim-2013", particle "p", material "water" from source 0.
2. Built-in: program 9 (ICRU 90), particle 1 (proton), material 276 (water).

Mixed external + built-in series are fully supported.

---

## 5. Loading Lifecycle

### 5.1 Load Sequence

On page load, if `extdata` parameter(s) are present:

1. **Parse URL.** Extract `extdata` URLs (may be multiple).
2. **Show loading indicator.** Display a non-dismissible banner:
   "Loading external data from {n} source(s)…" with a spinner.
   Block all calculation and entity interaction until loading completes.
3. **Fetch headers in parallel.** For each `extdata` URL, fetch the header
   (first 4 bytes + JSON header) using Range Requests.
4. **Validate headers.** Per §6 (Validation).
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
| Invalid format (bad magic, unsupported version, schema error) | "External data file is invalid: {detail}. Expected webdedx format v1." | **Load without external data** button |
| Validation failure (physics checks) | "External data contains invalid values: {detail}" | **Load without external data** button |

**"Load without external data"** removes the `extdata` parameters from the URL
(via `replaceState`) and reloads with built-in data only.

### 5.3 Table Fetch (On Demand)

Individual table data is fetched when the user requests a calculation or plot
series involving an external triplet:

1. Look up the table's byte offset and length from the header index.
2. Fetch using `Range: bytes={start}-{end}`.
3. Decode the `Float64Array`.
4. Convert units to the app's internal units (MeV/nucl + MeV·cm²/g + g/cm²)
   using the declared `units` from the header.
5. Cache the decoded table in memory for the duration of the page session
   (no persistent cache across page loads).

If the table fetch fails (network error, Range Request not supported and full
file already attempted):
- Show a toast: "Could not load data for {program} / {particle} / {material}."
- The series or calculation row is marked as failed (not silently omitted).

---

## 6. Validation

### 6.1 Structural Validation (on header parse)

| Check | Failure action |
|-------|---------------|
| `magic !== "webdedx-extdata"` | Reject file; blocking error |
| `formatVersion` unsupported | Reject file; blocking error |
| Missing required fields (`metadata.name`, `programs`, `particles`, `materials`, `units`, `tables`) | Reject file; blocking error |
| ID format invalid (not `[a-zA-Z0-9_-]+`) | Reject file; blocking error |
| `units.energy` / `units.stoppingPower` / `units.csdaRange` not in allowed set | Reject file; blocking error |
| `tables[].byteLength !== nPoints * 3 * 8` | Reject file; blocking error |
| Duplicate IDs within same entity type | Reject file; blocking error |
| `tables[].program` / `particle` / `material` reference non-existent ID | Reject file; blocking error |
| Duplicate (program, particle, material) triplets across tables | Reject file; blocking error |

### 6.2 Size Limits (DoS prevention)

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max header size | 1 MB | Prevents excessive JSON parsing |
| Max programs per source | 100 | Reasonable upper bound |
| Max particles per source | 200 | Covers all ions up to Uranium |
| Max materials per source | 1000 | Generous for compound libraries |
| Max tables per source | 50,000 | 100 programs × 200 particles × ~2.5 materials avg |
| Max points per table | 10,000 | Far exceeds typical energy grid density |
| Max total file size (computed from header) | 100 MB | Prevents accidental multi-GB fetches |
| Max `extdata` sources | 5 | Prevents URL abuse |

Exceeding any limit → reject the source with a clear error message.

### 6.3 Physics Validation (on table decode)

Applied to each decoded table after unit conversion:

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
    CSDA range from the external table using log-log interpolation (matching
    libdedx's default interpolation behavior).
  - If the requested energy is outside the external table's energy bounds,
    mark the row as out-of-range.
- Results are displayed in the same unified table format as built-in data.

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

External data files contain only:
- A JSON header (parsed with `JSON.parse()` — no `eval()`).
- Binary IEEE 754 floating-point arrays.

No executable code, no scripts, no HTML. The format is intentionally
inert.

### 10.2 Input Sanitization

- All string fields from the JSON header (`name`, `author`, `description`,
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

A command-line tool to convert stopping-power data from common formats
(SRIM, CSV, etc.) into the `.webdedx` binary format.

### 11.2 Tool: `srim2webdedx`

Converts SRIM text output files into `.webdedx` format.

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

**Output:** A single `.webdedx` binary file.

**Usage:**
```bash
srim2webdedx manifest.yaml --output my-srim-data.webdedx
```

### 11.3 Tool: `csv2webdedx`

Converts generic CSV files (energy, stopping power, CSDA range columns)
into `.webdedx` format. Uses the same manifest format as `srim2webdedx`
but with `format: csv` and additional column-mapping fields.

### 11.4 Tool: `webdedx-inspect`

A diagnostic tool that reads a `.webdedx` file and prints:
- Header metadata (JSON, pretty-printed).
- Summary statistics: number of programs, particles, materials, tables.
- Per-table info: triplet, nPoints, energy bounds, min/max stopping power.
- Validates the file against all structural and physics checks from §6.

**Usage:**
```bash
webdedx-inspect my-srim-data.webdedx
```

### 11.5 Implementation Language

Tooling is implemented in **Python** (matching the existing `libdedx/python/`
ecosystem). Packaged as a pip-installable CLI tool.

---

## 12. Acceptance Criteria

### 12.1 External Data Loading

- [ ] App with `extdata` URL parameter fetches the header via Range Request.
- [ ] App validates the header (magic, version, schema, size limits).
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

- [ ] JSON header parsed with `JSON.parse()` only (no `eval`).
- [ ] String values rendered as `textContent` only (no `innerHTML`).
- [ ] Size limits enforced; oversized files rejected.
- [ ] IDs validated against `[a-zA-Z0-9_-]+`.

### 12.7 Tooling

- [ ] `srim2webdedx` reads SRIM output + manifest → produces valid `.webdedx` file.
- [ ] `webdedx-inspect` validates and summarizes a `.webdedx` file.
- [ ] Generated `.webdedx` file passes all app-side validation checks.

---

## 13. Open Questions

1. **Material matching heuristic:** Exact name match may miss equivalent
   materials with slightly different names (e.g., "Water" vs "Water, Liquid"
   vs "H2O"). Should we also match on chemical formula or density similarity?
   *Recommendation: start with exact case-insensitive name match; add formula
   matching in a future iteration.*

2. **Interpolation method for external data:** Log-log interpolation matches
   libdedx defaults. Should we allow the external dataset to declare a
   preferred interpolation method? *Recommendation: default to log-log; defer
   configurable interpolation to a future version.*

3. **CSDA range from stopping power:** Should the app offer an option to
   compute CSDA range by integrating the stopping-power table (for sources
   that only provide stopping power)? *Recommendation: defer to a future
   version. v1 requires both stopping power and CSDA range in the file.*

4. **Offline / local file support:** Should the app support loading `.webdedx`
   files from the local filesystem (via `<input type="file">`)? This would
   enable fully offline use without even a localhost server.
   *Recommendation: consider for a future version; keep v1 focused on URL-based
   loading.*

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
