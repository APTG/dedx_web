# Spike 4: External Data Storage Format — Zarr vs Apache Parquet

> **Status:** Complete (2026-04-18)
> **Branch:** `prototypes/srim-parquet` (branch name fixed at creation; prototype lives in `prototypes/extdata-formats/`)
> **Goal:** Decide which storage format is best for the `.webdedx` external
> data format before committing to the Parquet spec in
> `docs/04-feature-specs/external-data.md`. Three candidates are evaluated:
> (A) Apache Parquet with one row group per ion; (B) Zarr v3 — **single shard**
> covering the whole array; (C) Zarr v3 — **per-ion shards** (one shard file
> per ion). Candidates B and C are both tested on a real S3 bucket to measure
> actual HTTP Round-Trip Times under the Range-request access pattern.

---

## 1. Motivation

The current spec (`external-data.md §2`) uses Apache Parquet with one
row group per `(program, ion)` pair, read via `hyparquet` in the browser.
The key access pattern is: user selects **one ion** → browser fetches only
that ion's STP values for all materials via an HTTP Range Request.

Two Zarr v3 configurations are evaluated against the Parquet baseline:

**Zarr v3 — single shard** (`shards=(287,379,165)`, `chunks=(1,379,165)`):
One outer shard file holds all 287 ions. Its 4.6 KB shard index (stored at
the file's tail) maps each ion to its byte range. Browser: fetch `zarr.json`
(1 request) + Range for shard index (1 request) + Range for ion's inner
chunk (1 request) = **3 cold requests**. Avoids Zarr v2's 287-file problem.

**Zarr v3 — per-ion shards** (`shards=(1,379,165)`, `chunks=(1,379,165)`):
Each ion gets its own shard file (`c/{i}/0/0`), i.e. 287 files. No shard
index fetch is needed — each file IS the ion's data. Browser: fetch
`zarr.json` (1 request) + fetch `c/{i}/0/0` (1 request) = **2 cold
requests**. Identical RTT budget to Parquet. Each S3 object is small
(~140–220 KB compressed), so S3 GET latency dominates more than Range
overhead. File count (287 + metadata) is manageable on S3 but inconvenient
for GitHub Pages.

Both Zarr configurations are uploaded to a real S3 bucket and tested in
the browser to measure actual wall-clock RTT under the Range-request
(single-shard) and direct-GET (per-ion) patterns. Local benchmarks measure
sizes only; S3 tests measure latency.

This prototype measures the difference with realistic data dimensions before
any production code is written. The dataset is deliberately large and
heterogeneous to stress-test both formats.

---

## 2. Dataset Specification

### 2.1 Particles — Stable Isotopes + Electron (287 particles)

| Category | Count | Notes |
|----------|-------|-------|
| Truly stable nuclides (Z=1–83, H through Bi) | ~278 | All with T½ = ∞ |
| Long-lived primordial: K-40, V-50, Rb-87, In-115, La-138, Lu-176, Re-187, Ta-180m | 8 | T½ > 10¹⁰ y |
| Primordial actinides: Th-232, U-235, U-238 | 3 | Relevant for radiation physics |
| **Electron** | **1** | Special case — lepton, different STP formula |
| **Total** | **287** | |

The 286 nuclear ions are identified by `(Z, A)`. The electron is a special
entry: `Z=0, A=0, charge=-1, mass_MeV=0.511`.

Isotope list is hardcoded in `generate_data.py` as a Python list of
`(Z, A, symbol)` tuples sourced from AME2020/NUBASE2020. No external
nuclear data package is needed.

---

### 2.2 Materials — libdedx DEFAULT (279 targets)

Sourced directly from `libdedx/src/dedx_program_const.h` (the
`dedx_material_table` and `dedx_program_available_materials` arrays for
program 100 = `DEDX_DEFAULT`).

| Category | ID range | Count |
|----------|----------|-------|
| Elements (H through Cf) | 1–98 | 98 |
| ICRU/NIST compounds | 99–278 | 180 |
| Graphite (separate entry) | 906 | 1 |
| **Total** | | **279** |

Names taken verbatim from `dedx_material_table` (ALL-CAPS strings).
`generate_data.py` reads them from the C header at runtime via regex —
no hardcoded copy.

---

### 2.3 Materials — User-Defined Custom Materials (100 targets)

These materials are **not present in libdedx**. They have no integer
libdedx ID. Each carries:
- A string `id` (the key used in the dataset)
- A human-readable `name`
- A `density_g_cm3` value
- A `composition` list of `{Z: int, weight_fraction: float}` entries
  that sum to 1.0

The STP for custom materials is computed via the **Bragg additivity rule**:
`STP_compound = Σ w_i × STP_element(Z_ion, A_ion, Z_i, E)`,
where `STP_element` is the same Bethe-like function used for libdedx
elemental materials (§2.5), and `w_i` is the weight fraction of element `Z_i`.

#### Full list (100 materials, hardcoded in `generate_data.py`)

**Metal alloys (18):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `SS304` | Stainless Steel 304 | 8.00 | Fe 69.5%, Cr 18%, Ni 8%, Mn 2%, Si 1%, C 0.08% |
| `SS316L` | Stainless Steel 316L | 7.99 | Fe 65%, Cr 17%, Ni 12%, Mo 2.5%, Mn 2%, Si 1% |
| `SS316Ti` | Stainless Steel 316Ti | 7.98 | Fe 64.3%, Cr 17%, Ni 12%, Mo 2.5%, Ti 0.7%, Mn 2% |
| `CarbonSteel1020` | Carbon Steel AISI 1020 | 7.87 | Fe 98.75%, C 0.2%, Mn 0.45%, Si 0.25% |
| `Inconel718` | Inconel 718 | 8.19 | Ni 53%, Cr 19%, Fe 18.5%, Nb 5.1%, Mo 3.1%, Ti 0.9% |
| `HastelloyC276` | Hastelloy C-276 | 8.89 | Ni 57%, Mo 16%, Cr 15.5%, Fe 5.5%, W 4%, Co 2% |
| `Kovar` | Kovar (FeNiCo) | 8.36 | Fe 54%, Ni 29%, Co 17% |
| `Al6061` | Aluminium Alloy 6061 | 2.70 | Al 97.2%, Mg 1.0%, Si 0.6%, Cu 0.28%, Cr 0.19% |
| `Al7075` | Aluminium Alloy 7075 | 2.81 | Al 87.2%, Zn 5.6%, Mg 2.5%, Cu 1.6%, Cr 0.23%, Si 0.4% |
| `Ti6Al4V` | Titanium Alloy Ti-6Al-4V | 4.43 | Ti 89.5%, Al 6%, V 4%, Fe 0.25%, O 0.2% |
| `TiGrade2` | Commercially Pure Titanium Grade 2 | 4.51 | Ti 99.2%, O 0.25%, Fe 0.3%, N 0.03%, C 0.08% |
| `Zircaloy4` | Zircaloy-4 | 6.56 | Zr 97.68%, Sn 1.5%, Fe 0.22%, Cr 0.1%, O 0.12% |
| `BrassCuZn37` | Brass CuZn37 | 8.44 | Cu 63%, Zn 37% |
| `BronzeCuSn8` | Bronze CuSn8 | 8.80 | Cu 92%, Sn 8% |
| `TungstenAlloyW90` | Tungsten Heavy Alloy W90Ni7Cu3 | 17.15 | W 90%, Ni 7%, Cu 3% |
| `MolybdenumTZM` | Molybdenum TZM Alloy | 10.22 | Mo 99.4%, Ti 0.5%, Zr 0.08%, C 0.02% |
| `NiobiumZr` | Niobium-1Zirconium (Nb-1Zr) | 8.57 | Nb 99%, Zr 1% |
| `BerylliumCopper` | Beryllium Copper C17200 | 8.25 | Cu 97.6%, Be 2%, Co 0.4% |

**Scintillators (10):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `LYSO` | Lutetium Yttrium Oxyorthosilicate Lu₁.₈Y₀.₂SiO₅ | 7.10 | Lu 71.5%, O 18.1%, Si 6.4%, Y 4.0% |
| `LSO` | Lutetium Oxyorthosilicate Lu₂SiO₅ | 7.40 | Lu 75.7%, O 17.2%, Si 7.1% |
| `YSO` | Yttrium Oxyorthosilicate Y₂SiO₅ | 4.45 | Y 60.9%, O 27.9%, Si 11.2% |
| `LaBr3` | Lanthanum Bromide LaBr₃ | 5.06 | La 36.7%, Br 63.3% |
| `GAGG` | Gd₃Al₂Ga₃O₁₂ garnet | 6.63 | Gd 60.7%, Ga 24.8%, Al 6.5%, O 8.0% |
| `PbWO4` | Lead Tungstate PbWO₄ | 8.28 | Pb 45.5%, W 40.2%, O 14.3% |
| `CdWO4` | Cadmium Tungstate CdWO₄ | 7.90 | Cd 31.2%, W 49.4%, O 19.4% |
| `LuAG` | Lutetium Aluminium Garnet Lu₃Al₅O₁₂ | 6.73 | Lu 73.0%, Al 10.8%, O 16.2% |
| `CLYC` | Cs₂LiYCl₆ | 3.31 | Cs 54.0%, Li 2.8%, Y 18.0%, Cl 25.2% |
| `SrI2` | Strontium Iodide SrI₂ | 4.55 | Sr 22.5%, I 77.5% |

**Ceramics and technical oxides (8):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `ZrO2` | Zirconia ZrO₂ | 5.89 | Zr 74.0%, O 26.0% |
| `BN_hex` | Hexagonal Boron Nitride h-BN | 2.28 | B 43.6%, N 56.4% |
| `TiN` | Titanium Nitride TiN | 5.43 | Ti 77.4%, N 22.6% |
| `HfO2` | Hafnium Dioxide HfO₂ | 9.68 | Hf 84.8%, O 15.2% |
| `Y2O3` | Yttria Y₂O₃ | 5.01 | Y 78.7%, O 21.3% |
| `Mullite` | Mullite Al₆Si₂O₁₃ | 3.17 | Al 38.3%, Si 14.3%, O 47.4% |
| `Spinel` | Spinel MgAl₂O₄ | 3.58 | Mg 17.1%, Al 37.9%, O 45.0% |
| `AlN` | Aluminium Nitride AlN | 3.26 | Al 65.9%, N 34.1% |

**Semiconductors (9):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `CZT` | Cadmium Zinc Telluride Cd₀.₉Zn₀.₁Te | 5.78 | Cd 43.0%, Te 53.7%, Zn 3.3% |
| `GaN` | Gallium Nitride GaN | 6.15 | Ga 69.4%, N 30.6% |
| `ZnSe` | Zinc Selenide ZnSe | 5.27 | Zn 33.4%, Se 66.6% |
| `InP` | Indium Phosphide InP | 4.81 | In 78.2%, P 21.8% |
| `GaP` | Gallium Phosphide GaP | 4.13 | Ga 60.4%, P 39.6% |
| `SiC_3C` | Cubic Silicon Carbide 3C-SiC | 3.21 | Si 70.0%, C 30.0% |
| `InGaAs` | In₀.₅₃Ga₀.₄₇As (lattice-matched) | 5.49 | In 44.6%, Ga 24.0%, As 31.4% |
| `AmorphousSe` | Amorphous Selenium a-Se | 4.28 | Se 100% (custom density) |
| `ZnCdTe` | Cd₀.₉Zn₀.₁Te (ZnCdTe) | 5.78 | same as CZT — different id/label |

**Polymers and composites (7):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `PEEK` | Poly(ether ether ketone) | 1.32 | C 79.0%, H 5.4%, O 15.6% |
| `ABS` | Acrylonitrile Butadiene Styrene | 1.07 | C 85.6%, H 8.5%, N 5.9% |
| `Epoxy` | Generic Bisphenol-A Epoxy Resin | 1.20 | C 73.4%, H 6.8%, O 17.9%, N 1.9% |
| `PDMS` | Polydimethylsiloxane (silicone) | 0.97 | C 32.4%, H 8.1%, O 21.6%, Si 37.9% |
| `PEI_Ultem` | Polyetherimide (Ultem 1000) | 1.27 | C 69.5%, H 4.5%, O 17.0%, N 9.0% |
| `PI` | Generic Polyimide | 1.42 | C 69.6%, H 2.9%, O 17.6%, N 9.9% |
| `CFRP` | Carbon Fibre Reinforced Polymer (60% CF) | 1.60 | C 83.4%, H 0.9%, O 11.7%, N 4.0% |

**Biological tissues not in libdedx (8):**

| id | Name | ρ (g/cm³) | Key composition (ICRP/ICRU values) |
|----|------|-----------|----------------|
| `Liver` | Liver (ICRP) | 1.06 | O 71.6%, C 13.9%, H 10.2%, N 3.0%, P 0.3% + trace |
| `Kidney` | Kidney (ICRP) | 1.05 | O 73.1%, C 12.4%, H 10.3%, N 3.1%, P 0.2% + trace |
| `Spleen` | Spleen (ICRP) | 1.06 | O 73.1%, C 11.3%, H 10.3%, N 3.2%, P 0.3% + trace |
| `BreastTissue` | Breast Tissue 50/50 adipose-glandular | 1.02 | O 63.2%, C 22.2%, H 11.0%, N 2.7%, P 0.2% |
| `HeartMuscle` | Heart Muscle (ICRP) | 1.05 | O 72.9%, C 13.4%, H 10.3%, N 2.8%, P 0.2% + trace |
| `RedBoneMarrow` | Red Bone Marrow (ICRP) | 1.03 | O 70.0%, C 14.1%, H 10.5%, N 3.4%, P 0.1% + trace |
| `YellowBoneMarrow` | Yellow Bone Marrow (ICRP) | 0.98 | O 63.8%, C 24.2%, H 11.5%, N 0.4% + trace |
| `Cartilage` | Cartilage (ICRP) | 1.10 | O 73.6%, C 13.5%, H 9.6%, N 2.2%, P 0.5% + trace |

**Medical and dosimetric materials (6):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `Hydroxyapatite` | Hydroxyapatite Ca₁₀(PO₄)₆(OH)₂ | 3.16 | Ca 39.9%, P 18.5%, O 41.4%, H 0.2% |
| `TCP` | Tricalcium Phosphate Ca₃(PO₄)₂ | 3.14 | Ca 38.8%, P 20.0%, O 41.2% |
| `MgB4O7` | Magnesium Tetraborate MgB₄O₇ | 2.53 | Mg 12.6%, B 22.4%, O 65.0% |
| `Li2SiO3` | Lithium Metasilicate Li₂SiO₃ | 2.52 | Li 9.7%, Si 38.1%, O 52.2% |
| `IohexolSolution` | Iohexol CT contrast solution 350 mg I/mL | 1.41 | H 5.8%, C 23.5%, N 3.0%, O 38.4%, I 29.3% |
| `GdDTPASolution` | Gadolinium-DTPA 0.5 mol/L in water | 1.04 | H 9.7%, C 9.9%, N 1.9%, O 41.5%, Gd 37.0% |

**Shielding and structural composites (6):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `BoratedPolyethylene5` | Borated Polyethylene 5% B | 0.95 | H 13.0%, C 80.5%, B 5.0%, O 1.5% |
| `BaryteConcrete` | Baryte (barium sulfate) concrete | 3.35 | Ba 47.1%, S 14.3%, O 28.8%, Si 4.1%, Ca 3.3%, Fe 2.4% |
| `MagnetiteConcrete` | Magnetite concrete | 3.53 | Fe 36.4%, O 42.6%, Si 8.2%, Ca 6.0%, Al 3.7%, H 1.0% |
| `SerpentineConcrete` | Serpentine concrete | 2.10 | O 44.3%, Si 21.7%, Mg 19.0%, H 5.0%, Al 4.8%, Ca 4.2% |
| `WEpoxy80` | Tungsten-Epoxy Composite 80% W | 10.10 | W 80.0%, C 10.0%, H 1.1%, O 7.2%, N 1.7% |
| `LeadPolyethylene50` | Lead-Polyethylene Composite 50% Pb | 5.62 | Pb 50.0%, C 42.8%, H 7.2% |

**Liquids and solutions (5):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `Seawater` | Standard Seawater (salinity 35‰) | 1.025 | O 85.7%, H 10.7%, Cl 1.9%, Na 1.1%, Mg 0.13%, S 0.09% |
| `HeavyWater` | Deuterium Oxide D₂O | 1.105 | O 88.8%, H(D) 11.2% — note: H-2 isotope |
| `EthyleneGlycol` | Ethylene Glycol C₂H₆O₂ | 1.113 | C 38.7%, H 9.7%, O 51.6% |
| `PhysiologicalSaline` | Physiological Saline 0.9% NaCl | 1.005 | O 87.7%, H 11.0%, Cl 0.53%, Na 0.35% |
| `Formalin10pct` | 10% Formalin Solution | 1.037 | O 78.4%, H 11.6%, C 9.6%, N 0.4% |

**Detector gases (6):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `P10Gas` | P10 Gas 90% Ar + 10% CH₄ (STP) | 1.56×10⁻³ | Ar 94.4%, C 0.46%, H 1.5% (by mass) |
| `CF4Gas` | Carbon Tetrafluoride CF₄ (STP) | 3.72×10⁻³ | C 13.6%, F 86.4% |
| `ArCO2_90_10` | Ar/CO₂ 90/10 vol% (STP) | 1.74×10⁻³ | Ar 97.4%, O 0.29%, C 0.26% (by mass) |
| `SF6Gas` | Sulfur Hexafluoride SF₆ (STP) | 6.17×10⁻³ | S 21.4%, F 78.6% |
| `DMEGas` | Dimethyl Ether C₂H₆O (STP) | 1.97×10⁻³ | C 52.2%, H 13.0%, O 34.8% |
| `HeIsobutane_80_20` | He/isobutane 80/20 vol% (STP) | 4.84×10⁻⁴ | He 98.6%, C 1.1%, H 0.3% (by mass) |

**Nuclear and reactor materials (4):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `UO2_natural` | Natural Uranium Dioxide UO₂ | 10.96 | U 88.2%, O 11.8% |
| `MOX_5pct` | Mixed Oxide Fuel (5% PuO₂ in UO₂) | 10.90 | U 83.4%, Pu 4.2%, O 11.8% + trace |
| `UN` | Uranium Nitride UN (fuel) | 14.32 | U 94.4%, N 5.6% |
| `UC` | Uranium Carbide UC (fuel) | 13.63 | U 95.2%, C 4.8% |

**Semiconductors — optical and miscellaneous (6):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `BK7Glass` | BK7 Borosilicate Crown Glass | 2.51 | O 46.0%, Si 32.0%, B 3.4%, Na 3.5%, K 7.4%, Ba 4.6%, Al 3.1% |
| `SF6Glass` | SF6 Dense Flint Optical Glass | 5.18 | Pb 53.8%, O 23.6%, Si 14.2%, K 5.9%, As 2.5% |
| `ZnS_phosphor` | Zinc Sulfide (phosphor) | 4.09 | Zn 67.1%, S 32.9% |
| `DLC` | Diamond-Like Carbon film | 3.50 | C 100% (custom density) |
| `SilicaAerogel` | Silica Aerogel | 0.10 | Si 46.7%, O 53.3% (low-density SiO₂) |
| `Albite` | Albite Feldspar NaAlSi₃O₈ | 2.62 | O 48.3%, Si 32.1%, Al 10.1%, Na 8.8% |

**Biological and geological (4):**

| id | Name | ρ (g/cm³) | Key composition |
|----|------|-----------|----------------|
| `Muscovite` | Muscovite Mica KAl₂Si₃AlO₁₀(OH)₂ | 2.83 | O 47.0%, Si 22.2%, Al 17.4%, K 7.9%, H 2.1% |
| `Hydroxyapatite_dental` | Dental Hydroxyapatite (enamel approx.) | 2.96 | Ca 39.9%, P 18.5%, O 40.9%, H 0.5%, Na 0.3% |
| `IonExchangeResin` | Sulfonated Polystyrene Ion Exchange Resin | 1.20 | C 56.8%, H 5.7%, S 11.5%, O 26.0% |
| `DosimetricGel` | PAGAT Polymer Gel Dosimeter | 1.06 | O 84.8%, C 6.2%, H 8.4%, N 0.3%, S 0.3% |

> **Note:** "AmorphousSe" and "ZnCdTe" are intentionally similar to
> pure Se and CZT in composition but differ in state/density declaration,
> testing the format's handling of duplicate-element single-component materials.
> Heavy water uses Z=1 for the H-2 (deuterium) component — the STP formula
> treats it as the same element as H-1 since the Bethe formula depends on
> Z, not A, of the target nuclei.

---

### 2.4 Total Material Count

| Source | Count |
|--------|-------|
| libdedx DEFAULT (elements + ICRU compounds) | 279 |
| User-defined custom materials | 100 |
| **Grand total** | **379** |

---

### 2.5 Energy Grid

165 points taken verbatim from the real SRIM-2013 dataset. The real file
has 86 (particle, material) pairs with fewer points (136–164), but those
pairs are omitted from the synthetic data — all synthetic pairs use the
full 165-point grid. This keeps the 3D array shape uniform with no NaN
padding required.

```python
ENERGIES = np.array([
    0.0011, 0.0012, 0.0013, 0.0014, 0.0015, 0.0016, 0.0017, 0.0018,
    0.002, 0.00225, 0.0025, 0.00275, 0.003, 0.00325, 0.0035, 0.00375,
    0.004, 0.0045, 0.005, 0.0055, 0.006, 0.0065, 0.007, 0.008, 0.009,
    0.01, 0.011, 0.012, 0.013, 0.014, 0.015, 0.016, 0.017, 0.018,
    0.02, 0.0225, 0.025, 0.0275, 0.03, 0.0325, 0.035, 0.0375, 0.04,
    0.045, 0.05, 0.055, 0.06, 0.065, 0.07, 0.08, 0.09, 0.1, 0.11,
    0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.2, 0.225, 0.25,
    0.275, 0.3, 0.325, 0.35, 0.375, 0.4, 0.45, 0.5, 0.55, 0.6,
    0.65, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7,
    1.8, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.5, 5.0,
    5.5, 6.0, 6.5, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0,
    16.0, 17.0, 18.0, 20.0, 22.5, 25.0, 27.5, 30.0, 32.5, 35.0, 37.5,
    40.0, 45.0, 50.0, 55.0, 60.0, 65.0, 70.0, 80.0, 90.0, 100.0, 110.0,
    120.0, 130.0, 140.0, 150.0, 160.0, 170.0, 180.0, 200.0, 225.0, 250.0,
    275.0, 300.0, 325.0, 350.0, 375.0, 400.0, 450.0, 500.0, 550.0, 600.0,
    650.0, 700.0, 800.0, 900.0, 1000.0, 1100.0, 1200.0, 1300.0, 1400.0,
    1500.0, 1600.0, 1700.0, 1800.0, 2000.0,
])  # 165 values, MeV/u for ions; MeV for electron
```

For nuclear ions the axis is kinetic energy per nucleon (MeV/u).
For the electron, the same axis values are interpreted as kinetic energy
in MeV (since electrons have no nucleons). This is handled by the STP
functions internally — the array structure is uniform.

The grid is stored **once** in Zarr `.zattrs` metadata and once in the
Parquet file-level key-value metadata (`webdedx.energyGrid_MeV_u`).
This is a structural advantage over Parquet rows, where the energy value
repeats in every row.

---

### 2.6 STP Formulas (Synthetic)

No real SRIM binary is needed. Physics accuracy is irrelevant for
benchmarking format properties. Three variants cover the three cases:

#### Heavy ions (286 stable isotopes)

Bethe-like formula using the material's **effective mean excitation energy**
`I_eff`, which is computed differently for elemental vs. compound targets:

```python
def I_eff_eV(composition):
    """Bragg-Kleeman mean excitation energy (Bragg additivity rule)."""
    # composition = [(Z_i, w_i), ...] — element Z and weight fraction
    num = sum(w * Z / A_approx(Z) * math.log(13.5 * Z) for Z, w in composition)
    den = sum(w * Z / A_approx(Z) for Z, w in composition)
    return math.exp(num / den)

def stp_heavy_ion(Z_ion, A_ion, I_eV, E_MeV_u):
    """MeV·cm²/g, simplified Bethe-Bloch."""
    beta2 = E_MeV_u / (E_MeV_u + 931.5)
    beta2 = np.clip(beta2, 1e-6, 1.0)
    ln_arg = 2 * 0.511e6 * beta2 / (I_eV * (1 - beta2))
    ln_term = np.maximum(np.log(ln_arg) - beta2, 0.01)
    return (Z_ion**2 / A_ion) * (0.3071 / beta2) * ln_term
```

For libdedx elemental targets (IDs 1–98): `composition = [(Z_mat, 1.0)]`,
so `I_eff = 13.5 × Z_mat`.
For libdedx ICRU compounds and custom materials: Bragg additivity is used
with the weight fractions from §2.3.

#### Electron

The electron STP uses a distinct formula reflecting Møller kinematics
(identical-particle collisions, max energy transfer = T/2):

```python
def stp_electron(I_eV, E_MeV):
    """Simplified Bethe for electrons (MeV·cm²/g)."""
    m_e = 0.511   # MeV/c²
    tau = E_MeV / m_e   # kinetic energy in units of rest-mass energy
    gamma = tau + 1.0
    beta2 = np.clip(1.0 - 1.0 / gamma**2, 1e-6, 1.0)
    # Møller term: ln(tau²(tau+2)/2) — simplified, no density/shell corrections
    ln_term = np.maximum(
        np.log(tau**2 * (tau + 2) / 2 * (m_e * 1e6 / I_eV)**2) - beta2,
        0.01,
    )
    return (0.3071 / beta2) * ln_term   # Z=1, A≈1 for electron
```

The energy axis values are reused as-is (same grid, interpreted as MeV
rather than MeV/u) because the electron's rest mass (0.511 MeV) is much
smaller than proton rest mass (938 MeV), making the same numerical range
physically sensible.

---

## 3. Data Shape Summary

```
n_particles = 287    # 286 stable isotopes + 1 electron
n_materials = 379    # 279 libdedx DEFAULT + 100 custom
n_energy    = 165    # exact SRIM-2013 grid points (0.0011–2000 MeV/u)
n_programs  = 1      # synthetic "srim-2013"
n_quantities = 2     # stp + csda_range (separate arrays in Zarr; separate columns in Parquet)

Array shape (per program, per quantity): (287, 379, 165)   float32
Uncompressed per quantity: 287 × 379 × 165 × 4 = 71.8 MB
Uncompressed total (stp + csda_range): ~143.6 MB
Est. zstd-5:   ~20–30 MB total (smooth float arrays compress ~3:1 to 5:1)

Per-ion inner chunk (Zarr v3):  379 × 165 × 4 bytes = 250,260 bytes ≈ 244 KB uncompressed (per quantity)
Per-ion row group (Parquet):    379 × 165 rows × ~35 bytes/row ≈ 2.18 MB uncompressed
                                (program + particle + material strings + energy + stp + csda_range floats)
Shard index overhead (Zarr):    287 inner chunks × 2 × 8 bytes = 4,592 bytes (negligible)
Expected compression ratio:  ~3–5:1 (float arrays); ~5–8:1 (Parquet with string columns)
Expected compressed per-ion:
  Zarr inner chunk (per quantity):  ~140–220 KB (measured: H-1 137.5 KB, e⁻ 217.7 KB)
  Parquet row group:                ~250–400 KB

Zarr v3 — single-shard store (shards=(287,379,165)):
  data/srim_synthetic_single.zarr/
  ├── zarr.json                        # root group metadata
  └── srim-2013/
      ├── stp/
      │   ├── zarr.json                # array metadata (sharding config)
      │   └── c/0/0/0                  # single shard (~20–30 MB compressed)
      │                                # tail: shard index (287×2×8 = 4,592 bytes)
      └── csda_range/
          ├── zarr.json
          └── c/0/0/0                  # same layout as stp

Zarr v3 — per-ion shard store (shards=(1,379,165)):
  data/srim_synthetic_per_ion.zarr/
  ├── zarr.json                        # root group metadata
  └── srim-2013/
      ├── stp/
      │   ├── zarr.json                # array metadata
      │   ├── c/0/0/0                  # H-1 shard (~138 KB compressed)
      │   ├── c/1/0/0                  # H-2 shard
      │   │   ...
      │   └── c/286/0/0               # electron shard
      └── csda_range/
          ├── zarr.json
          ├── c/0/0/0  …  c/286/0/0   # same structure as stp
```

---

## 4. File / Directory Structure

```
prototypes/extdata-formats/
├── PLAN.md                      ← this file
├── requirements.txt             ← zarr, pyarrow, numcodecs, numpy, boto3
├── .gitignore
├── venv/                        ← Python venv (gitignored)
├── generate_data.py             ← single source of truth: isotopes, materials, STP arrays
├── write_parquet.py             ← write .webdedx.parquet per current spec
├── write_zarr_v3_single.py      ← Zarr v3 single-shard: shards=(287,379,165), chunks=(1,379,165)
├── write_zarr_v3_per_ion.py     ← Zarr v3 per-ion shards: shards=(1,379,165), chunks=(1,379,165)
├── upload_to_s3.py              ← upload all three datasets to S3 bucket
├── run_benchmark.py             ← local sizes + HTTP cost simulation, comparison table
├── browser/
│   ├── package.json             ← zarrita, hyparquet, vite, typescript
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts              ← local + S3 fetch panels for all three formats
│       └── index.html
├── data/                        ← generated output (gitignored)
│   ├── srim_synthetic.webdedx.parquet
│   ├── srim_synthetic_single.zarr/    # Zarr v3 single-shard store
│   └── srim_synthetic_per_ion.zarr/   # Zarr v3 per-ion shard store
├── REPORT.md
└── VERDICT.md
```

---

## 5. Script Specifications

### 5.1 `generate_data.py`

**Purpose:** Single source of truth for all data. Both writers import from
this module — they never generate data themselves. Running the script
standalone prints a summary and exits.

**Module-level exports:**

```python
STABLE_ISOTOPES: list[dict]
# 286 entries:
# {"Z": 1, "A": 1, "symbol": "H", "name": "Hydrogen-1",
#  "type": "nucleus", "charge": 1, "mass_MeV": 938.783}
# Sorted by (Z, A).

ELECTRON: dict
# {"Z": 0, "A": 0, "symbol": "e-", "name": "Electron",
#  "type": "lepton", "charge": -1, "mass_MeV": 0.511,
#  "pdgCode": 11}

PARTICLES: list[dict]   # STABLE_ISOTOPES + [ELECTRON], length 287

LIBDEDX_MATERIALS: list[dict]
# 279 entries:
# {"id": 1, "name": "HYDROGEN", "source": "libdedx",
#  "density_g_cm3": 8.375e-5,
#  "composition": [{"Z": 1, "weight_fraction": 1.0}]}
# Names and IDs read from dedx_program_const.h at import time.
# Compositions for elements: [(Z, 1.0)].
# Compositions for ICRU compounds: Bragg-additivity approximation
#   using canonical ICRU compositions (hardcoded dict, keyed by libdedx ID).

CUSTOM_MATERIALS: list[dict]
# 100 entries (hardcoded):
# {"id": "SS316L", "name": "Stainless Steel 316L", "source": "custom",
#  "density_g_cm3": 7.99,
#  "composition": [{"Z": 26, "weight_fraction": 0.650}, ...]}

MATERIALS: list[dict]   # LIBDEDX_MATERIALS + CUSTOM_MATERIALS, length 379

ENERGIES: np.ndarray   # shape (165,), float64, exact SRIM-2013 values (0.0011–2000 MeV/u)

def compute_stp_array() -> np.ndarray:
    """
    Returns float32 array, shape (287, 379, 165).
    Axis 0: PARTICLES order (isotopes first, electron last).
    Axis 1: MATERIALS order (libdedx first, custom last).
    Axis 2: ENERGIES order.
    Heavy ions: stp_heavy_ion() with Bragg I_eff.
    Electron:   stp_electron() using electron formula.
    """

def compute_csda_range_array(stp: np.ndarray) -> np.ndarray:
    """
    Returns float32 array, shape (287, 379, 165).
    Approximate CSDA range via trapezoidal integration:
      csda_range[i, j, k] = trapz(1 / stp[i, j, :k+1], ENERGIES[:k+1])
    Units: MeV·cm²/g integrated over MeV/u → g/cm².
    Uses np.cumulative_trapezoid (numpy ≥ 2.0) or np.trapz loop for compat.
    """
```

**ICRU compound compositions:** For the 180 ICRU compounds in libdedx,
`generate_data.py` hardcodes a dict `ICRU_COMPOSITIONS: dict[int, list]`
mapping libdedx IDs to `[(Z, w_frac), ...]`. This is the standard NIST
PSTAR/ASTAR composition table — a well-known fixed dataset of ~180 entries.
Lookup is only needed for `I_eff` computation; for the benchmark the
exact values do not matter, so approximate compositions are acceptable.

---

### 5.2 `write_parquet.py`

Implements the schema from `external-data.md §2` with extensions for
the extended particle list and custom materials.

**Row structure (matches real SRIM-2013 file, with `stopping_power` renamed `stp`):**

| Column | Parquet type | Example value |
|--------|-------------|---------------|
| `program` | `BYTE_ARRAY UTF-8` | `"srim-2013"` |
| `particle` | `BYTE_ARRAY UTF-8` | `"H-1"`, `"e-"` |
| `material` | `BYTE_ARRAY UTF-8` | `"WATER"`, `"SS316L"` |
| `energy` | `DOUBLE` | 1.0 (MeV/u or MeV for electron) |
| `stopping_power` | `DOUBLE` | 2.34 (MeV·cm²/g) |
| `csda_range` | `DOUBLE` | 1.22e-3 (g/cm²) |

**Row group layout:** One row group per particle (287 row groups).
Each row group: `379 materials × 165 energy points = 62,535 rows`.

**File metadata key-value additions:**
- `webdedx.particles` — 287 entries including electron
- `webdedx.materials` — 379 entries; custom materials include
  `density_g_cm3` and `composition` fields in JSON
- `webdedx.energyGrid_MeV_u` — `null` (energy is a column)

**Compression:** `zstd` level 5.

**Output:** `data/srim_synthetic.webdedx.parquet`

---

### 5.3 `write_zarr_v3_single.py`

Uses the **zarr v3 sharding codec** with **one outer shard covering the
entire array**: all 287 ions are stored in a single file. The browser
fetches the 4.6 KB shard index at the tail, then issues one HTTP Range
Request for the specific ion's inner chunk.

```python
import zarr
from generate_data import PARTICLES, MATERIALS, ENERGIES, compute_stp_array

stp_array = compute_stp_array()       # shape (287, 379, 165), float32
csda_array = compute_csda_range_array(stp_array)  # shape (287, 379, 165), float32

root = zarr.open_group("data/srim_synthetic_single.zarr", mode="w")
root.attrs.update({
    "webdedx.formatVersion": "1",
    "webdedx.programs": ["srim-2013"],
    "webdedx.particles": PARTICLES,
    "webdedx.materials": MATERIALS,
    "webdedx.energyGrid_MeV_u": ENERGIES.tolist(),
})

grp = root.require_group("srim-2013")
for name, data in [("stp", stp_array), ("csda_range", csda_array)]:
    arr = grp.create_array(
        name=name,
        shape=(287, 379, 165),
        dtype="float32",
        shards=(287, 379, 165),     # ← one shard file for the whole array
        chunks=(1, 379, 165),       # ← per-ion inner chunk
        compressors=zarr.codecs.BloscCodec(
            cname="zstd", clevel=5,
            shuffle=zarr.codecs.BloscShuffle.bitshuffle,
        ),
        fill_value=float("nan"),
    )
    arr[:] = data
```

**Shard files:** `srim-2013/stp/c/0/0/0` and `srim-2013/csda_range/c/0/0/0`.
Each contains all 287 inner chunks, each compressed independently, with a
4,592-byte index at the tail.

**Cold HTTP cost on S3:** 3 requests per quantity — `zarr.json` GET + shard
index Range + ion inner-chunk Range. Both quantities can be fetched in
parallel (2 Range requests simultaneously after shard index reads).

---

### 5.3b `write_zarr_v3_per_ion.py`

Uses Zarr v3 sharding with **one shard per ion** (`shards=(1,379,165)`).
Each ion is stored as its own file (`c/{i}/0/0`), so no shard index
fetch is needed — the browser GETs the file directly.

```python
import zarr
from generate_data import PARTICLES, MATERIALS, ENERGIES, compute_stp_array

stp_array = compute_stp_array()       # shape (287, 379, 165), float32
csda_array = compute_csda_range_array(stp_array)  # shape (287, 379, 165), float32

root = zarr.open_group("data/srim_synthetic_per_ion.zarr", mode="w")
root.attrs.update({
    "webdedx.formatVersion": "1",
    "webdedx.programs": ["srim-2013"],
    "webdedx.particles": PARTICLES,
    "webdedx.materials": MATERIALS,
    "webdedx.energyGrid_MeV_u": ENERGIES.tolist(),
})

grp = root.require_group("srim-2013")
for name, data in [("stp", stp_array), ("csda_range", csda_array)]:
    arr = grp.create_array(
        name=name,
        shape=(287, 379, 165),
        dtype="float32",
        shards=(1, 379, 165),       # ← one shard file per ion
        chunks=(1, 379, 165),       # ← inner chunk = entire shard (no sub-index)
        compressors=zarr.codecs.BloscCodec(
            cname="zstd", clevel=5,
            shuffle=zarr.codecs.BloscShuffle.bitshuffle,
        ),
        fill_value=float("nan"),
    )
    arr[:] = data
```

**Shard files:** `stp/c/0/0/0` … `stp/c/286/0/0` and `csda_range/c/0/0/0` … `csda_range/c/286/0/0`
— 574 files total (287 per quantity), each ~140–220 KB compressed (measured).
Each shard contains exactly one inner chunk; no shard index fetch needed.

**Cold HTTP cost on S3:** 2 requests — `zarr.json` GET + `c/{i}/0/0` GET.
No Range requests needed: the ion's file is fetched in full.

**Note on S3 vs GitHub Pages:** 287 + metadata files is practical on S3
(no per-file cost limitation); it is inconvenient for GitHub Pages due to
the large number of objects but not impossible.

---

### 5.4 `run_benchmark.py`

Measures sizes and simulates HTTP cost from local file sizes. No server
needed for size metrics; S3 timing is covered in §5.6 / browser.

**Local size metrics:**

| Metric | Method |
|--------|--------|
| Total Parquet size | `os.path.getsize()` |
| Total Zarr single size | `sum(getsize(f) for f in Path(...).rglob("*") if f.is_file())` |
| Total Zarr per-ion size | same, on `srim_synthetic_per_ion.zarr/` |
| Parquet footer size | Parse last 8 bytes for footer length (Parquet magic) |
| Zarr single — shard index size | 287 × 2 × 8 = 4,592 bytes (in shard tail) |
| Per-particle Parquet RG (row group 0) | Row group byte range from footer metadata |
| Per-particle Zarr single inner chunk | Bytes at `index_entry[0]` in shard tail |
| Per-particle Zarr per-ion shard file | `getsize("c/0/0/0")` in per-ion store |
| Per-electron Parquet RG | Row group byte range for last row group |
| Per-electron Zarr single inner chunk | `index_entry[286]` in shard tail |
| Per-electron Zarr per-ion shard | `getsize("c/286/0/0")` in per-ion store |
| Zarr single file count | expect ~5 (zarr.jsons + 1 shard) |
| Zarr per-ion file count | expect ~290 (zarr.jsons + 287 shards) |
| HTTP requests cold | Parquet: 2. Zarr single: 3. Zarr per-ion: 2. |
| HTTP requests warm | Parquet: 1. Zarr single: 1 (shard index cached). Zarr per-ion: 1. |
| Compression ratio | uncompressed / compressed, all three formats |

**Output:** Prints Markdown table; writes `REPORT.md`.

---

### 5.5 `browser/` — In-Browser Fetch Test

A Vite + TypeScript SPA with two modes: **local** (files served by Vite)
and **S3** (files served from a real S3 bucket).

**Libraries:**
- `zarrita` (v0.4.x) — Zarr v2/v3 + ZEP2 sharding JS reader, zero dependencies
- `hyparquet` (v1.x) — Parquet reader

**Five-panel layout:**

| # | Panel | Source | Transport |
|---|-------|--------|-----------|
| 1 | **Ion selector** | — | — |
| 2 | **Parquet** (local) | Vite dev server | HTTP GET (full file) |
| 3 | **Zarr single shard** (local) | Vite dev server | HTTP Range requests |
| 4 | **Zarr single shard** (S3) | S3 bucket | HTTP Range requests |
| 5 | **Zarr per-ion shard** (S3) | S3 bucket | HTTP GET (whole shard file) |

Each panel shows: fetch button, wall-clock time (ms), bytes transferred,
first 5 STP values for the selected ion.

**S3 base URL:** read from `browser/.env.local` — `VITE_S3_BASE_URL=https://...` —
not committed. The upload script (`upload_to_s3.py`) prints the URL after upload.

**S3 CORS requirement:** the S3 bucket must have a CORS rule allowing:
- `AllowedOrigins: ["http://localhost:5173"]`
- `AllowedMethods: ["GET", "HEAD"]`
- `AllowedHeaders: ["Range"]`
- `ExposeHeaders: ["Content-Range", "Accept-Ranges"]`

**Correctness check:** After all fetches, assert `max|stp_A - stp_B| < 1e-5`
across all format pairs.

**Acceptance criteria:**
- All five panels show identical STP values (±float32 round-trip error).
- Electron row works in all formats.
- Custom material rows (`SS316L`, `LYSO`) are present and non-zero.
- No CORS or MIME errors from Vite dev server or S3.
- `zarrita` bundle contribution ≤ 50 KB minified (`vite build --report`).
- S3 panels record wall-clock time for at least H-1, U-238, and electron.

---

### 5.6 `upload_to_s3.py`

Uploads all three datasets to a user-supplied S3 bucket. Requires `boto3`
and standard AWS credentials (env vars or `~/.aws/credentials`).

```bash
python upload_to_s3.py --bucket my-dedx-test --prefix extdata-spike4
```

**What it uploads:**

| Local path | S3 key | Content-Type |
|-----------|--------|--------------|
| `data/srim_synthetic.webdedx.parquet` | `{prefix}/srim_synthetic.webdedx.parquet` | `application/octet-stream` |
| `data/srim_synthetic_single.zarr/**` | `{prefix}/srim_synthetic_single.zarr/…` | `application/octet-stream` |
| `data/srim_synthetic_per_ion.zarr/**` | `{prefix}/srim_synthetic_per_ion.zarr/…` | `application/octet-stream` |

All objects are uploaded with `ACL=public-read` (or a bucket policy grants
public read — whichever the bucket uses).

**CORS setup reminder:** The script prints the CORS JSON that must be
applied to the bucket:

```json
[{
  "AllowedOrigins": ["http://localhost:5173"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["Range"],
  "ExposeHeaders": ["Content-Range", "Accept-Ranges"],
  "MaxAgeSeconds": 3000
}]
```

Apply via: `aws s3api put-bucket-cors --bucket my-dedx-test --cors-configuration file://cors.json`

**Output:** Prints `VITE_S3_BASE_URL=https://{bucket}.s3.{region}.amazonaws.com/{prefix}`
— copy this into `browser/.env.local`.

---

## 6. Environment Setup

```bash
cd prototypes/extdata-formats

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

`requirements.txt`:
```
zarr>=3.0
pyarrow>=15
numcodecs>=0.12
numpy>=1.26
boto3>=1.34
```

No `periodictable` package needed — isotope list is hardcoded.

Browser:
```bash
cd browser
pnpm install    # or npm install
```

`browser/package.json`:
```json
{
  "devDependencies": { "vite": "^5", "typescript": "^5" },
  "dependencies": { "zarrita": "^0.4", "hyparquet": "^1" }
}
```

---

## 7. Evaluation Questions

| # | Question | Expected answer |
|---|----------|----------------|
| 1 | Is Zarr total size ≤ Parquet total size? | Yes — no repeated string columns |
| 2 | Is per-ion Zarr inner chunk ≤ Parquet row group? | Yes — float array vs tabular rows |
| 3 | How much does the energy grid repetition cost Parquet? | 379 × 165 energy values repeated per row group |
| 4 | Are HTTP cold-start round trips comparable? | Parquet: 2. Zarr single: 3 (zarr.json + shard index Range + chunk Range). Zarr per-ion: 2 (zarr.json + GET). |
| 5 | Is `zarrita` JS bundle ≤ `hyparquet`? | Unknown — measure it |
| 6 | Does electron inner chunk differ meaningfully in size from ion chunks? | Electron STP values may compress differently |
| 7 | Do custom materials affect inner chunk size vs libdedx materials? | No — all 379 materials are in every inner chunk |
| 8 | Does the Zarr single store deploy without friction to Vite/GitHub Pages? | Expect yes — only ~5 files (zarr.jsons + 1 shard) |
| 9 | Does Zarr handle variable energy grids per ion? | Not without jagged arrays — Parquet can |
| 10 | What is the wall-clock RTT for single-shard vs per-ion on S3? | Per-ion likely faster (no Range overhead) but more S3 objects |
| 11 | Does per-ion shard eliminate the shard index fetch entirely on S3? | Yes — each `c/{i}/0/0` is fetched in full; no Range request |
| 12 | Is per-ion usable on GitHub Pages (287 files)? | Possible but inconvenient; S3 is the natural fit |

---

## 8. Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|---------------|
| 1 | `generate_data.py` runs without error | Prints "287 particles, 379 materials, 165 energy points"; exits 0 |
| 2 | Zarr single round-trip | Values read back match within `float32` epsilon |
| 3 | Zarr per-ion round-trip | Same |
| 4 | Parquet round-trip | Same |
| 5 | Electron chunk present and non-zero | `stp_array[286, :, :]` has no NaN/inf; differs from ion values |
| 6 | Custom material STP uses Bragg additivity | `SS316L` STP ≠ `IRON` STP; plausible interpolation |
| 7 | Per-particle Zarr inner chunk < Parquet row group | `zarr_inner_chunk_bytes < parquet_rg_bytes` (compressed) |
| 8 | `run_benchmark.py` completes | Prints table with all metrics |
| 9 | Browser local panels: values match across all formats | `max_diff < 1e-5` for H-1, electron, SS316L |
| 10 | Browser S3 single-shard panel: reads successfully | Wall-clock time recorded; values match local |
| 11 | Browser S3 per-ion panel: reads successfully | Wall-clock time recorded; values match local; no Range request in DevTools |
| 12 | `zarrita` bundle ≤ 50 KB minified | `vite build --report` |
| 13 | No CORS errors from Vite dev server or S3 | DevTools console clean for all panels |

---

## 9. Execution Order

```
# Phase 1 — local data generation
1.  source venv/bin/activate
2.  python generate_data.py             # verify 287 particles, 379 materials
3.  python write_zarr_v3_single.py      # write data/srim_synthetic_single.zarr/
4.  python write_zarr_v3_per_ion.py     # write data/srim_synthetic_per_ion.zarr/
5.  python write_parquet.py             # write data/srim_synthetic.webdedx.parquet
6.  python run_benchmark.py             # print local size comparison table

# Phase 2 — S3 upload (requires AWS credentials)
7.  python upload_to_s3.py \
        --bucket <your-bucket> \
        --prefix extdata-spike4
    # copy VITE_S3_BASE_URL=... output into browser/.env.local

# Phase 3 — browser tests
8.  cd browser && pnpm install
9.  ln -sf ../data browser/public       # serve data/ from Vite static root
10. pnpm dev                            # open http://localhost:5173
    # test all 5 panels: H-1, U-238, electron, SS316L, LYSO
    # verify DevTools: single-shard S3 shows Range requests;
    #                  per-ion S3 shows plain GET, no Range
11. pnpm build --report                 # check zarrita bundle size

# Phase 4 — write outputs
12. write REPORT.md
13. write VERDICT.md
```

---

## 10. Decision Criteria for VERDICT.md

**Keep Parquet if any of:**
- `zarrita` bundle > 50 KB minified and significantly larger than `hyparquet`
- Per-ion size difference < 15% (not worth switching toolchain)
- Zarr v3 CORS or MIME friction on GitHub Pages cannot be resolved
- zarrita ZEP2 sharding unstable in browser (Range reads via `FetchStore`)

**Switch to Zarr v3 single-shard (GitHub Pages / S3) if all of:**
- Per-ion Zarr inner chunk ≤ 60% of Parquet row group (after compression)
- `zarrita` bundle comparable to `hyparquet` (within 2×)
- zarrita ZEP2 sharding confirmed working in browser
- GitHub Pages deploy passes (~5 files)
- S3 single-shard RTT comparable to Parquet (≤ 1.5× wall-clock for cold fetch)

**Switch to Zarr v3 per-ion shards (S3-only deployment) if:**
- S3 per-ion wall-clock RTT is meaningfully faster than single-shard (> 20% gain)
- Application is S3-deployed (not GitHub Pages)
- zarrita reads `c/{i}/0/0` directly as a whole-file GET (confirmed in DevTools)
- File count (287 + metadata) acceptable for the target deployment

**Fallback — plain Zarr v3 (no sharding) if:**
- Zarr v3 + sharding wins on size but zarrita sharding is unstable
- Acceptable compromise: 287 chunk files (v3 without sharding) — simpler if
  the CDN pre-compresses well and file-count limit is not a concern

---

## 11. Related Documents

| Document | Relevance |
|----------|-----------|
| [`docs/04-feature-specs/external-data.md`](../../docs/04-feature-specs/external-data.md) | Current Parquet spec — this prototype decides whether to amend §2 |
| [`prototypes/libdedx-investigation/data/headers_stats.json`](../libdedx-investigation/data/headers_stats.json) | Material counts |
| [`libdedx/src/dedx_program_const.h`](../../libdedx/src/dedx_program_const.h) | `dedx_material_table` — read at runtime by `generate_data.py` |
| [`libdedx/src/dedx_periodic_table.h`](../../libdedx/src/dedx_periodic_table.h) | Element masses for STP formula |
| [`docs/02-tech-stack.md §hyparquet`](../../docs/02-tech-stack.md) | Current Parquet reader choice |
