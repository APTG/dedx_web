# 2026-04-17 — Spike 4: External Data Storage Format Plan

## Session Narrative

### Prompt 1: Propose a plan for Zarr vs Parquet investigation

**User request:** Give a good plan for working with Zarr files with
per-ion sharding instead of Apache Parquet. Implement a prototype and
test it before proceeding with the decision on Parquet.

**AI response:** Explored the repository to understand what was already known:

- Read `docs/04-feature-specs/external-data.md` — current spec mandates
  `.webdedx.parquet` with one row group per `(program, ion)` pair, read via
  `hyparquet` using HTTP Range Requests.
- Read `docs/11-prototyping-spikes.md` and the four existing prototype
  directories to understand naming conventions and plan structure.
- Inspected `prototypes/libdedx-investigation/data/wasm_runtime_stats.json`
  and `headers_stats.json` to confirm the material set (279 DEFAULT materials:
  98 elements + 180 ICRU compounds + Graphite at ID 906) and ion lists.
- Inspected `libdedx/src/dedx_program_const.h` directly to read
  `dedx_material_table` (material names) and `dedx_periodic_table.h`
  (element masses).
- Computed data shape projections: (286, 279, 100) float32 array = 31.9 MB
  uncompressed; per-ion Zarr chunk = 109 KB vs Parquet row group ~1 MB
  (with repeated string columns).

Key structural insight identified: Parquet repeats the 100-point energy grid
as a column in every row (27,900× per ion per program). Zarr stores it once
in `.zattrs` metadata. This is the primary efficiency advantage being measured.

Produced `prototypes/srim-parquet/PLAN.md` covering:
- Dataset: 286 stable isotopes, 279 libdedx materials, 100 energy points
- Zarr v2 writer with `chunks=(1, n_materials, n_energy)` per-ion sharding
- Parquet writer following `external-data.md §2` exactly
- `run_benchmark.py` measuring total size, per-ion bytes, HTTP request count
- Browser test (`browser/`) using `zarrita` vs `hyparquet`
- 8 acceptance criteria and decision criteria for VERDICT.md

Also created `requirements.txt` and `.gitignore`.

---

### Prompt 2: Use full stable isotopes list; use all elements + ICRU materials

**User request:** Use full list of all stable isotopes as list of ions.
As materials use all elements + all ICRU materials.

**AI response:** Revised the dataset specification:

**Ions (286 stable isotopes):**
Assembled the full list of primordially stable and long-lived radioactive
isotopes from AME2020/NUBASE2020 — all Z=1–83 nuclides, 8 long-lived
primordials (K-40, V-50, Rb-87, In-115, La-138, Lu-176, Re-187, Ta-180m),
and 3 primordial actinides (Th-232, U-235, U-238). List hardcoded as Python
tuples in `generate_data.py` — no external nuclear data package required.

**Materials (279, all from libdedx DEFAULT):**
Confirmed via `libdedx/src/dedx_program_const.h` regex parse:
- Elements IDs 1–98 (Hydrogen through Californium)
- ICRU/NIST compounds IDs 99–278 (180 entries)
- Graphite at ID 906 (separate entry)
- Exactly matches `DEDX_DEFAULT` program material list

Data projections updated: array shape (286, 279, 100) = 31.9 MB uncompressed,
~10 MB zstd-5. Per-ion chunk = 109 KB uncompressed.

---

### Prompt 3: Add 100 user-defined custom materials and electron particle

**User request:** Include about 100 user-defined materials not present in
libdedx, with custom density and chemical composition. Include electron as
a particle. Add that to the plan.

**AI response:** Extended the dataset specification significantly.

**Electron particle:**
Added as particle index 286 (last). Representation:
`{"Z": 0, "A": 0, "symbol": "e-", "name": "Electron", "type": "lepton",
"charge": -1, "mass_MeV": 0.511, "pdgCode": 11}`.

Requires a separate STP formula using Møller kinematics (identical-particle
collisions, max energy transfer = T/2):
```python
def stp_electron(I_eV, E_MeV):
    tau = E_MeV / 0.511   # T/m_e
    gamma = tau + 1.0
    beta2 = 1.0 - 1.0/gamma**2
    ln_term = log(tau²(tau+2)/2 × (m_e·10⁶/I_eV)²) − beta2
    return 0.3071 / beta2 × max(ln_term, 0.01)
```
Energy axis values reused as MeV (not MeV/u) for the electron — same
numerical grid, different physical interpretation, handled inside the function.

**100 custom materials:**
Designed to cover the full range of materials a SRIM user might need that
are absent from the ICRU 149-material list in libdedx. Grouped into:

| Category | Count | Examples |
|----------|-------|---------|
| Metal alloys | 18 | SS304, SS316L, Inconel 718, Ti-6Al-4V, Zircaloy-4, BrassCuZn37 |
| Scintillators | 10 | LYSO, LSO, LaBr₃, GAGG, PbWO₄, CdWO₄, LuAG, CLYC, SrI₂, YSO |
| Ceramics | 8 | ZrO₂, h-BN, TiN, HfO₂, Y₂O₃, Mullite, Spinel, AlN |
| Semiconductors | 9 | CZT, GaN, ZnSe, InP, GaP, SiC, InGaAs, a-Se, ZnCdTe |
| Polymers/composites | 7 | PEEK, ABS, Epoxy, PDMS, PEI, Polyimide, CFRP |
| Biological tissues | 8 | Liver, Kidney, Spleen, Breast, Heart, Red/Yellow Marrow, Cartilage |
| Medical/dosimetric | 6 | Hydroxyapatite, TCP, MgB₄O₇, Li₂SiO₃, Iohexol contrast, Gd-DTPA |
| Shielding/structural | 6 | Borated PE 5%, Baryte/Magnetite/Serpentine concrete, W-Epoxy 80%, Pb-PE |
| Liquids/solutions | 5 | Seawater, D₂O, Ethylene glycol, Physiological saline, Formalin |
| Detector gases | 6 | P10, CF₄, Ar/CO₂ 90/10, SF₆, DME, He/isobutane |
| Nuclear fuels | 4 | UO₂ natural, MOX 5%, UN, UC |
| Optical/misc | 13 | BK7 glass, SF6 glass, ZnS phosphor, DLC, Silica aerogel, Albite, Muscovite, … |

Each custom material defines `density_g_cm3` and `composition: [{Z, weight_fraction}]`
with fractions summing to 1.0. STP is computed via Bragg additivity rule:
`STP_compound = Σ w_i × STP_element(Z_ion, A_ion, Z_i, E)`.

For libdedx ICRU compounds the same additivity rule applies using a
hardcoded `ICRU_COMPOSITIONS` dict (standard NIST PSTAR composition table,
~180 entries keyed by libdedx material ID).

Updated data projections:
- n_particles = 287, n_materials = 379, shape = (287, 379, 100)
- 43.5 MB uncompressed; ~12–15 MB zstd-5
- Per-particle chunk: 379 × 100 × 4 = 148 KB uncompressed (Zarr)
- Per-particle row group: 379 × 100 rows × ~28 bytes/row ≈ 1.0 MB (Parquet)

---

### Prompt 4: Find a better name; rename directory; update master plan; add AI logs

**User request:** Find a better name for the prototype, rename the directory.
Update the master plan and keep all documents consistent. Add AI logs.
Branch name should stay as is.

**AI response (this session):**

Chose **`extdata-formats`** as the new name because:
- `srim-parquet` names one input source and one of two competing formats —
  neither captures the actual question being answered.
- `extdata-formats` names the domain (`extdata` = the external-data feature)
  and the nature of the investigation (format comparison), without
  prematurely picking a winner.
- Follows the project's two-word hyphenated convention.
- Parallels `libdedx-investigation` (domain + investigation type).

Changes made:
- Renamed `prototypes/srim-parquet/` → `prototypes/extdata-formats/`
- Updated `PLAN.md` title to "Spike 4: External Data Storage Format — Zarr vs Apache Parquet"
- Added branch disambiguation note (branch name fixed at creation)
- Added "Spike 4" section to `docs/11-prototyping-spikes.md` with goal,
  background, dataset summary, acceptance criteria, deliverables table,
  and gate rule for the external-data feature implementation
- Added `external-data.md` to the "Related Documents" table at the bottom
  of `docs/11-prototyping-spikes.md`
- Wrote this AI log
- Updated `docs/ai-logs/README.md` (new entry, top of table)
- Updated `CHANGELOG-AI.md` (new row)

## Tasks

### Spike 4 plan — external data storage format

- **Status:** Plan complete; implementation not yet started
- **Stage:** 2.7 (pre-implementation gate for external-data feature)
- **Branch:** `prototypes/srim-parquet`
- **Directory:** `prototypes/extdata-formats/`
- **Files changed:**
  - `prototypes/extdata-formats/PLAN.md` (renamed from `srim-parquet/`, title + header updated)
  - `prototypes/extdata-formats/requirements.txt` (no changes to content)
  - `prototypes/extdata-formats/.gitignore` (no changes to content)
  - `docs/11-prototyping-spikes.md` (Spike 4 section + Related Documents row added)
  - `docs/ai-logs/2026-04-17-extdata-formats.md` (this file, new)
  - `docs/ai-logs/README.md` (new entry added)
  - `CHANGELOG-AI.md` (new row added)

### Key design decisions

1. **`extdata-formats` over `zarr-parquet`**: `zarr-parquet` names both
   technologies like `jsroot-svelte5` does, but for a comparison spike
   the domain name is more useful — `extdata-formats` tells a reader what
   decision this spike feeds, not just what it tests.

2. **Branch name preserved**: the git branch `prototypes/srim-parquet` was
   created before the rename decision. Changing it would require a force-push
   and break any existing PRs or CI references. The PLAN.md includes a
   disambiguation note.

3. **287 particles, not just nuclear ions**: the electron is included because
   the external-data spec (`external-data.md §2.4`) explicitly supports
   non-nuclear particles via `pdgCode`. Testing the electron in the prototype
   validates that the format handles the lepton edge case (no Z, no A,
   different STP formula, energy axis semantics differ).

4. **100 custom materials with Bragg additivity**: a major differentiator
   between Zarr and Parquet for this use case is whether custom materials
   (with composition-defined STP) can be represented without per-material
   metadata bloat. Both formats are tested with the same 100 materials.
   The measurement of interest is whether the string-column overhead in
   Parquet grows proportionally with material count.

5. **Spike 4 gate rule**: the external-data feature must not be implemented
   until VERDICT.md is written. This is modelled on the Stage 2.6 gate rule
   that prevented Stage 3 from beginning before the WASM bundle strategy
   was confirmed.
