"""Single source of truth for synthetic SRIM-2013-like dataset.

Run standalone to verify: python generate_data.py
"""

import math
import re
import os
import numpy as np

# ---------------------------------------------------------------------------
# Energy grid — exact SRIM-2013 values (165 points, MeV/u for ions, MeV for e-)
# ---------------------------------------------------------------------------
ENERGIES = np.array([
    0.0011, 0.0012, 0.0013, 0.0014, 0.0015, 0.0016, 0.0017, 0.0018,
    0.002,  0.00225,0.0025, 0.00275,0.003,  0.00325,0.0035, 0.00375,
    0.004,  0.0045, 0.005,  0.0055, 0.006,  0.0065, 0.007,  0.008,  0.009,
    0.01,   0.011,  0.012,  0.013,  0.014,  0.015,  0.016,  0.017,  0.018,
    0.02,   0.0225, 0.025,  0.0275, 0.03,   0.0325, 0.035,  0.0375, 0.04,
    0.045,  0.05,   0.055,  0.06,   0.065,  0.07,   0.08,   0.09,
    0.1,    0.11,   0.12,   0.13,   0.14,   0.15,   0.16,   0.17,   0.18,
    0.2,    0.225,  0.25,   0.275,  0.3,    0.325,  0.35,   0.375,  0.4,
    0.45,   0.5,    0.55,   0.6,    0.65,   0.7,    0.8,    0.9,
    1.0,    1.1,    1.2,    1.3,    1.4,    1.5,    1.6,    1.7,    1.8,
    2.0,    2.25,   2.5,    2.75,   3.0,    3.25,   3.5,    3.75,   4.0,
    4.5,    5.0,    5.5,    6.0,    6.5,    7.0,    8.0,    9.0,
    10.0,   11.0,   12.0,   13.0,   14.0,   15.0,   16.0,   17.0,   18.0,
    20.0,   22.5,   25.0,   27.5,   30.0,   32.5,   35.0,   37.5,   40.0,
    45.0,   50.0,   55.0,   60.0,   65.0,   70.0,   80.0,   90.0,
    100.0,  110.0,  120.0,  130.0,  140.0,  150.0,  160.0,  170.0,  180.0,
    200.0,  225.0,  250.0,  275.0,  300.0,  325.0,  350.0,  375.0,  400.0,
    450.0,  500.0,  550.0,  600.0,  650.0,  700.0,  800.0,  900.0,
    1000.0, 1100.0, 1200.0, 1300.0, 1400.0, 1500.0, 1600.0, 1700.0, 1800.0,
    2000.0,
], dtype=np.float64)

assert len(ENERGIES) == 165

# ---------------------------------------------------------------------------
# Particle list — 286 stable isotopes + electron
# ---------------------------------------------------------------------------

# Stable/primordial isotopes: (Z, A, symbol)
_ISOTOPES_RAW = [
    (1,1,"H"),(1,2,"H"),(2,3,"He"),(2,4,"He"),(3,6,"Li"),(3,7,"Li"),
    (4,9,"Be"),(5,10,"B"),(5,11,"B"),(6,12,"C"),(6,13,"C"),(7,14,"N"),(7,15,"N"),
    (8,16,"O"),(8,17,"O"),(8,18,"O"),(9,19,"F"),(10,20,"Ne"),(10,21,"Ne"),(10,22,"Ne"),
    (11,23,"Na"),(12,24,"Mg"),(12,25,"Mg"),(12,26,"Mg"),(13,27,"Al"),(14,28,"Si"),
    (14,29,"Si"),(14,30,"Si"),(15,31,"P"),(16,32,"S"),(16,33,"S"),(16,34,"S"),(16,36,"S"),
    (17,35,"Cl"),(17,37,"Cl"),(18,36,"Ar"),(18,38,"Ar"),(18,40,"Ar"),(19,39,"K"),
    (19,40,"K"),(19,41,"K"),(20,40,"Ca"),(20,42,"Ca"),(20,43,"Ca"),(20,44,"Ca"),
    (20,46,"Ca"),(20,48,"Ca"),(21,45,"Sc"),(22,46,"Ti"),(22,47,"Ti"),(22,48,"Ti"),
    (22,49,"Ti"),(22,50,"Ti"),(23,50,"V"),(23,51,"V"),(24,50,"Cr"),(24,52,"Cr"),
    (24,53,"Cr"),(24,54,"Cr"),(25,55,"Mn"),(26,54,"Fe"),(26,56,"Fe"),(26,57,"Fe"),
    (26,58,"Fe"),(27,59,"Co"),(28,58,"Ni"),(28,60,"Ni"),(28,61,"Ni"),(28,62,"Ni"),
    (28,64,"Ni"),(29,63,"Cu"),(29,65,"Cu"),(30,64,"Zn"),(30,66,"Zn"),(30,67,"Zn"),
    (30,68,"Zn"),(30,70,"Zn"),(31,69,"Ga"),(31,71,"Ga"),(32,70,"Ge"),(32,72,"Ge"),
    (32,73,"Ge"),(32,74,"Ge"),(32,76,"Ge"),(33,75,"As"),(34,74,"Se"),(34,76,"Se"),
    (34,77,"Se"),(34,78,"Se"),(34,80,"Se"),(34,82,"Se"),(35,79,"Br"),(35,81,"Br"),
    (36,78,"Kr"),(36,80,"Kr"),(36,82,"Kr"),(36,83,"Kr"),(36,84,"Kr"),(36,86,"Kr"),
    (37,85,"Rb"),(37,87,"Rb"),(38,84,"Sr"),(38,86,"Sr"),(38,87,"Sr"),(38,88,"Sr"),
    (39,89,"Y"),(40,90,"Zr"),(40,91,"Zr"),(40,92,"Zr"),(40,94,"Zr"),(40,96,"Zr"),
    (41,93,"Nb"),(42,92,"Mo"),(42,94,"Mo"),(42,95,"Mo"),(42,96,"Mo"),(42,97,"Mo"),
    (42,98,"Mo"),(42,100,"Mo"),(44,96,"Ru"),(44,98,"Ru"),(44,99,"Ru"),(44,100,"Ru"),
    (44,101,"Ru"),(44,102,"Ru"),(44,104,"Ru"),(45,103,"Rh"),(46,102,"Pd"),(46,104,"Pd"),
    (46,105,"Pd"),(46,106,"Pd"),(46,108,"Pd"),(46,110,"Pd"),(47,107,"Ag"),(47,109,"Ag"),
    (48,106,"Cd"),(48,108,"Cd"),(48,110,"Cd"),(48,111,"Cd"),(48,112,"Cd"),(48,113,"Cd"),
    (48,114,"Cd"),(48,116,"Cd"),(49,113,"In"),(49,115,"In"),(50,112,"Sn"),(50,114,"Sn"),
    (50,115,"Sn"),(50,116,"Sn"),(50,117,"Sn"),(50,118,"Sn"),(50,119,"Sn"),(50,120,"Sn"),
    (50,122,"Sn"),(50,124,"Sn"),(51,121,"Sb"),(51,123,"Sb"),(52,120,"Te"),(52,122,"Te"),
    (52,123,"Te"),(52,124,"Te"),(52,125,"Te"),(52,126,"Te"),(52,128,"Te"),(52,130,"Te"),
    (53,127,"I"),(54,124,"Xe"),(54,126,"Xe"),(54,128,"Xe"),(54,129,"Xe"),(54,130,"Xe"),
    (54,131,"Xe"),(54,132,"Xe"),(54,134,"Xe"),(54,136,"Xe"),(55,133,"Cs"),(56,130,"Ba"),
    (56,132,"Ba"),(56,134,"Ba"),(56,135,"Ba"),(56,136,"Ba"),(56,137,"Ba"),(56,138,"Ba"),
    (57,138,"La"),(57,139,"La"),(58,136,"Ce"),(58,138,"Ce"),(58,140,"Ce"),(58,142,"Ce"),
    (59,141,"Pr"),(60,142,"Nd"),(60,143,"Nd"),(60,144,"Nd"),(60,145,"Nd"),(60,146,"Nd"),
    (60,148,"Nd"),(60,150,"Nd"),(62,144,"Sm"),(62,147,"Sm"),(62,148,"Sm"),(62,149,"Sm"),
    (62,150,"Sm"),(62,152,"Sm"),(62,154,"Sm"),(63,151,"Eu"),(63,153,"Eu"),(64,152,"Gd"),
    (64,154,"Gd"),(64,155,"Gd"),(64,156,"Gd"),(64,157,"Gd"),(64,158,"Gd"),(64,160,"Gd"),
    (65,159,"Tb"),(66,156,"Dy"),(66,158,"Dy"),(66,160,"Dy"),(66,161,"Dy"),(66,162,"Dy"),
    (66,163,"Dy"),(66,164,"Dy"),(67,165,"Ho"),(68,162,"Er"),(68,164,"Er"),(68,166,"Er"),
    (68,167,"Er"),(68,168,"Er"),(68,170,"Er"),(69,169,"Tm"),(70,168,"Yb"),(70,170,"Yb"),
    (70,171,"Yb"),(70,172,"Yb"),(70,173,"Yb"),(70,174,"Yb"),(70,176,"Yb"),(71,175,"Lu"),
    (71,176,"Lu"),(72,174,"Hf"),(72,176,"Hf"),(72,177,"Hf"),(72,178,"Hf"),(72,179,"Hf"),
    (72,180,"Hf"),(73,180,"Ta"),(73,181,"Ta"),(74,180,"W"),(74,182,"W"),(74,183,"W"),
    (74,184,"W"),(74,186,"W"),(75,185,"Re"),(75,187,"Re"),(76,184,"Os"),(76,186,"Os"),
    (76,187,"Os"),(76,188,"Os"),(76,189,"Os"),(76,190,"Os"),(76,192,"Os"),(77,191,"Ir"),
    (77,193,"Ir"),(78,190,"Pt"),(78,192,"Pt"),(78,194,"Pt"),(78,195,"Pt"),(78,196,"Pt"),
    (78,198,"Pt"),(79,197,"Au"),(80,196,"Hg"),(80,198,"Hg"),(80,199,"Hg"),(80,200,"Hg"),
    (80,201,"Hg"),(80,202,"Hg"),(80,204,"Hg"),(81,203,"Tl"),(81,205,"Tl"),(82,204,"Pb"),
    (82,206,"Pb"),(82,207,"Pb"),(82,208,"Pb"),(83,209,"Bi"),(90,232,"Th"),(92,235,"U"),
    (92,238,"U"),
]

assert len(_ISOTOPES_RAW) == 286, f"Expected 286, got {len(_ISOTOPES_RAW)}"

STABLE_ISOTOPES = [
    {
        "Z": Z, "A": A, "symbol": sym,
        "name": f"{sym}-{A}",
        "id": f"Z{Z:02d}A{A}",
        "type": "nucleus",
        "charge": Z,
        "mass_MeV": round(Z * 938.272 + (A - Z) * 939.565 - Z * 0.511, 3),
    }
    for Z, A, sym in _ISOTOPES_RAW
]

ELECTRON = {
    "Z": 0, "A": 0, "symbol": "e-", "name": "Electron",
    "id": "electron",
    "type": "lepton", "charge": -1, "mass_MeV": 0.511,
}

PARTICLES = STABLE_ISOTOPES + [ELECTRON]   # length 287

# ---------------------------------------------------------------------------
# libdedx DEFAULT materials — parsed from C headers at import time
# ---------------------------------------------------------------------------

_HEADER_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "libdedx", "src"
)

def _load_libdedx_materials():
    const_h = os.path.join(_HEADER_DIR, "dedx_program_const.h")
    meta_h  = os.path.join(_HEADER_DIR, "data", "embedded", "dedx_metadata.h")

    # 1. Read material name table (indices 0–999, 0-based in C array)
    with open(const_h) as f:
        src = f.read()

    table_match = re.search(
        r'dedx_material_table\[1000\]\[40\]\s*=\s*\{(.*?)\};',
        src, re.DOTALL
    )
    raw = table_match.group(1)
    names_raw = re.findall(r'"([^"]*)"', raw)
    # C array index 0 = "(N/A)", index 1 = "HYDROGEN", etc.
    # Material ID n → names_raw[n]  (1-based IDs stored at index n)
    names_by_id = {i: names_raw[i] for i in range(len(names_raw))}

    # 2. DEFAULT material IDs from dedx_program_available_materials[0]
    #    (first row in the array — the ALL-materials list: IDs 1–278 + 906)
    avail_match = re.search(
        r'dedx_program_available_materials\[110\]\[290\]\s*=\s*\{[^{]*\{(.*?)\},',
        src, re.DOTALL
    )
    avail_raw = avail_match.group(1)
    # Use signed integer parse to correctly exclude the -1 sentinel
    default_ids = [int(x) for x in re.findall(r'-?\d+', avail_raw) if int(x) > 0]

    # 3. Read densities from dedx_metadata.h (take state==0 default;
    #    for IDs with no state-0 row, take first entry)
    with open(meta_h) as f:
        msrc = f.read()

    density_rows = re.findall(
        r'\{(\d+),\s*([\d.e+\-]+)f,\s*([\d.e+\-]+)f,\s*(\d+)\}', msrc
    )
    # Build: id -> (density, i_value_eV) — prefer state==0, else first found
    densities: dict[int, float] = {}
    i_values: dict[int, float] = {}
    for id_s, dens_s, ival_s, state_s in density_rows:
        mid, dens, ival, state = int(id_s), float(dens_s), float(ival_s), int(state_s)
        if mid not in densities or state == 0:
            densities[mid] = dens
            i_values[mid] = ival

    # 4. Assemble material list — elements get composition; compounds use i_value_eV directly
    materials = []
    for mid in default_ids:
        name = names_by_id.get(mid, "")
        if not name:
            continue
        is_element = 1 <= mid <= 98
        entry = {
            "id": str(mid),
            "name": name,
            "source": "libdedx",
            "libdedx_id": mid,
            "density_g_cm3": densities.get(mid, 1.0),
            "i_value_eV": i_values.get(mid),
            "is_element": is_element,
            "element_Z": mid if is_element else None,
        }
        if is_element:
            entry["composition"] = [(mid, 1.0)]
        # compounds: no composition stored; STP computed directly from i_value_eV
        materials.append(entry)
    return materials


LIBDEDX_MATERIALS = _load_libdedx_materials()

# ---------------------------------------------------------------------------
# Custom materials (100 entries)
# ---------------------------------------------------------------------------

CUSTOM_MATERIALS = [
    # Metal alloys
    {"id":"SS304",     "name":"Stainless Steel 304",                   "density_g_cm3":8.00,
     "composition":[(26,0.695),(24,0.18),(28,0.08),(25,0.02),(14,0.01),(6,0.0008)]},
    {"id":"SS316L",    "name":"Stainless Steel 316L",                  "density_g_cm3":7.99,
     "composition":[(26,0.65),(24,0.17),(28,0.12),(42,0.025),(25,0.02),(14,0.01)]},
    {"id":"SS316Ti",   "name":"Stainless Steel 316Ti",                 "density_g_cm3":7.98,
     "composition":[(26,0.643),(24,0.17),(28,0.12),(42,0.025),(22,0.007),(25,0.02)]},
    {"id":"CarbonSteel1020","name":"Carbon Steel AISI 1020",           "density_g_cm3":7.87,
     "composition":[(26,0.9875),(6,0.002),(25,0.0045),(14,0.0025)]},  # rounding to 1 handled by formula
    {"id":"Inconel718","name":"Inconel 718",                           "density_g_cm3":8.19,
     "composition":[(28,0.53),(24,0.19),(26,0.185),(41,0.051),(42,0.031),(22,0.009)]},
    {"id":"HastelloyC276","name":"Hastelloy C-276",                    "density_g_cm3":8.89,
     "composition":[(28,0.57),(42,0.16),(24,0.155),(26,0.055),(74,0.04),(27,0.02)]},
    {"id":"Kovar",     "name":"Kovar",                                 "density_g_cm3":8.36,
     "composition":[(26,0.54),(28,0.29),(27,0.17)]},
    {"id":"Al6061",    "name":"Aluminium Alloy 6061",                  "density_g_cm3":2.70,
     "composition":[(13,0.972),(12,0.01),(14,0.006),(29,0.0028),(24,0.0019)]},
    {"id":"Al7075",    "name":"Aluminium Alloy 7075",                  "density_g_cm3":2.81,
     "composition":[(13,0.872),(30,0.056),(12,0.025),(29,0.016),(24,0.0023),(14,0.004)]},
    {"id":"Ti6Al4V",   "name":"Titanium Alloy Ti-6Al-4V",              "density_g_cm3":4.43,
     "composition":[(22,0.895),(13,0.06),(23,0.04),(26,0.0025),(8,0.002)]},
    {"id":"TiGrade2",  "name":"Commercially Pure Titanium Grade 2",    "density_g_cm3":4.51,
     "composition":[(22,0.992),(8,0.0025),(26,0.003),(7,0.0003),(6,0.0008)]},
    {"id":"Zircaloy4", "name":"Zircaloy-4",                            "density_g_cm3":6.56,
     "composition":[(40,0.9768),(50,0.015),(26,0.0022),(24,0.001),(8,0.0012)]},
    {"id":"BrassCuZn37","name":"Brass CuZn37",                         "density_g_cm3":8.44,
     "composition":[(29,0.63),(30,0.37)]},
    {"id":"BronzeCuSn8","name":"Bronze CuSn8",                         "density_g_cm3":8.80,
     "composition":[(29,0.92),(50,0.08)]},
    {"id":"TungstenAlloyW90","name":"Tungsten Heavy Alloy W90Ni7Cu3",  "density_g_cm3":17.15,
     "composition":[(74,0.90),(28,0.07),(29,0.03)]},
    {"id":"MolybdenumTZM","name":"Molybdenum TZM Alloy",               "density_g_cm3":10.22,
     "composition":[(42,0.994),(22,0.005),(40,0.0008),(6,0.0002)]},
    {"id":"NiobiumZr", "name":"Niobium-1Zirconium",                    "density_g_cm3":8.57,
     "composition":[(41,0.99),(40,0.01)]},
    {"id":"BerylliumCopper","name":"Beryllium Copper C17200",          "density_g_cm3":8.25,
     "composition":[(29,0.976),(4,0.02),(27,0.004)]},
    # Scintillators
    {"id":"LYSO",  "name":"LYSO Lu1.8Y0.2SiO5",  "density_g_cm3":7.10,
     "composition":[(71,0.715),(8,0.181),(14,0.064),(39,0.040)]},
    {"id":"LSO",   "name":"LSO Lu2SiO5",          "density_g_cm3":7.40,
     "composition":[(71,0.757),(8,0.172),(14,0.071)]},
    {"id":"YSO",   "name":"YSO Y2SiO5",           "density_g_cm3":4.45,
     "composition":[(39,0.609),(8,0.279),(14,0.112)]},
    {"id":"LaBr3", "name":"Lanthanum Bromide",     "density_g_cm3":5.06,
     "composition":[(57,0.367),(35,0.633)]},
    {"id":"GAGG",  "name":"GAGG Gd3Al2Ga3O12",    "density_g_cm3":6.63,
     "composition":[(64,0.607),(31,0.248),(13,0.065),(8,0.080)]},
    {"id":"PbWO4", "name":"Lead Tungstate PbWO4",  "density_g_cm3":8.28,
     "composition":[(82,0.455),(74,0.402),(8,0.143)]},
    {"id":"CdWO4", "name":"Cadmium Tungstate",     "density_g_cm3":7.90,
     "composition":[(48,0.312),(74,0.494),(8,0.194)]},
    {"id":"LuAG",  "name":"LuAG Lu3Al5O12",        "density_g_cm3":6.73,
     "composition":[(71,0.730),(13,0.108),(8,0.162)]},
    {"id":"CLYC",  "name":"CLYC Cs2LiYCl6",        "density_g_cm3":3.31,
     "composition":[(55,0.540),(3,0.028),(39,0.180),(17,0.252)]},
    {"id":"SrI2",  "name":"Strontium Iodide SrI2", "density_g_cm3":4.55,
     "composition":[(38,0.225),(53,0.775)]},
    # Ceramics
    {"id":"ZrO2",    "name":"Zirconia ZrO2",         "density_g_cm3":5.89,
     "composition":[(40,0.740),(8,0.260)]},
    {"id":"BN_hex",  "name":"Hexagonal Boron Nitride","density_g_cm3":2.28,
     "composition":[(5,0.436),(7,0.564)]},
    {"id":"TiN",     "name":"Titanium Nitride TiN",  "density_g_cm3":5.43,
     "composition":[(22,0.774),(7,0.226)]},
    {"id":"HfO2",    "name":"Hafnium Dioxide HfO2",  "density_g_cm3":9.68,
     "composition":[(72,0.848),(8,0.152)]},
    {"id":"Y2O3",    "name":"Yttria Y2O3",            "density_g_cm3":5.01,
     "composition":[(39,0.787),(8,0.213)]},
    {"id":"Mullite", "name":"Mullite Al6Si2O13",      "density_g_cm3":3.17,
     "composition":[(13,0.383),(14,0.143),(8,0.474)]},
    {"id":"Spinel",  "name":"Spinel MgAl2O4",         "density_g_cm3":3.58,
     "composition":[(12,0.171),(13,0.379),(8,0.450)]},
    {"id":"AlN",     "name":"Aluminium Nitride AlN",  "density_g_cm3":3.26,
     "composition":[(13,0.659),(7,0.341)]},
    # Semiconductors
    {"id":"CZT",        "name":"CdZnTe Cd0.9Zn0.1Te",     "density_g_cm3":5.78,
     "composition":[(48,0.430),(52,0.537),(30,0.033)]},
    {"id":"GaN",        "name":"Gallium Nitride GaN",       "density_g_cm3":6.15,
     "composition":[(31,0.694),(7,0.306)]},
    {"id":"ZnSe",       "name":"Zinc Selenide ZnSe",        "density_g_cm3":5.27,
     "composition":[(30,0.334),(34,0.666)]},
    {"id":"InP",        "name":"Indium Phosphide InP",      "density_g_cm3":4.81,
     "composition":[(49,0.782),(15,0.218)]},
    {"id":"GaP",        "name":"Gallium Phosphide GaP",     "density_g_cm3":4.13,
     "composition":[(31,0.604),(15,0.396)]},
    {"id":"SiC_3C",     "name":"Cubic Silicon Carbide 3C",  "density_g_cm3":3.21,
     "composition":[(14,0.70),(6,0.30)]},
    {"id":"InGaAs",     "name":"In0.53Ga0.47As",            "density_g_cm3":5.49,
     "composition":[(49,0.446),(31,0.240),(33,0.314)]},
    {"id":"AmorphousSe","name":"Amorphous Selenium a-Se",   "density_g_cm3":4.28,
     "composition":[(34,1.0)]},
    {"id":"ZnCdTe",     "name":"ZnCdTe (CZT variant)",      "density_g_cm3":5.78,
     "composition":[(48,0.430),(52,0.537),(30,0.033)]},
    # Polymers
    {"id":"PEEK",    "name":"PEEK",         "density_g_cm3":1.32,
     "composition":[(6,0.790),(1,0.054),(8,0.156)]},
    {"id":"ABS",     "name":"ABS",          "density_g_cm3":1.07,
     "composition":[(6,0.856),(1,0.085),(7,0.059)]},
    {"id":"Epoxy",   "name":"Bisphenol-A Epoxy","density_g_cm3":1.20,
     "composition":[(6,0.734),(1,0.068),(8,0.179),(7,0.019)]},
    {"id":"PDMS",    "name":"PDMS silicone","density_g_cm3":0.97,
     "composition":[(6,0.324),(1,0.081),(8,0.216),(14,0.379)]},
    {"id":"PEI_Ultem","name":"Polyetherimide Ultem","density_g_cm3":1.27,
     "composition":[(6,0.695),(1,0.045),(8,0.170),(7,0.090)]},
    {"id":"PI",      "name":"Polyimide",    "density_g_cm3":1.42,
     "composition":[(6,0.696),(1,0.029),(8,0.176),(7,0.099)]},
    {"id":"CFRP",    "name":"CFRP 60% CF",  "density_g_cm3":1.60,
     "composition":[(6,0.834),(1,0.009),(8,0.117),(7,0.040)]},
    # Biological tissues
    {"id":"Liver",          "name":"Liver ICRP",        "density_g_cm3":1.06,
     "composition":[(8,0.716),(6,0.139),(1,0.102),(7,0.030),(15,0.003)]},
    {"id":"Kidney",         "name":"Kidney ICRP",       "density_g_cm3":1.05,
     "composition":[(8,0.731),(6,0.124),(1,0.103),(7,0.031),(15,0.002)]},
    {"id":"Spleen",         "name":"Spleen ICRP",       "density_g_cm3":1.06,
     "composition":[(8,0.731),(6,0.113),(1,0.103),(7,0.032),(15,0.003)]},
    {"id":"BreastTissue",   "name":"Breast Tissue 50/50","density_g_cm3":1.02,
     "composition":[(8,0.632),(6,0.222),(1,0.110),(7,0.027),(15,0.002)]},
    {"id":"HeartMuscle",    "name":"Heart Muscle ICRP", "density_g_cm3":1.05,
     "composition":[(8,0.729),(6,0.134),(1,0.103),(7,0.028),(15,0.002)]},
    {"id":"RedBoneMarrow",  "name":"Red Bone Marrow",   "density_g_cm3":1.03,
     "composition":[(8,0.700),(6,0.141),(1,0.105),(7,0.034),(15,0.001)]},
    {"id":"YellowBoneMarrow","name":"Yellow Bone Marrow","density_g_cm3":0.98,
     "composition":[(8,0.638),(6,0.242),(1,0.115),(7,0.004)]},
    {"id":"Cartilage",      "name":"Cartilage ICRP",    "density_g_cm3":1.10,
     "composition":[(8,0.736),(6,0.135),(1,0.096),(7,0.022),(15,0.005)]},
    # Medical/dosimetric
    {"id":"Hydroxyapatite", "name":"Hydroxyapatite",    "density_g_cm3":3.16,
     "composition":[(20,0.399),(15,0.185),(8,0.414),(1,0.002)]},
    {"id":"TCP",    "name":"Tricalcium Phosphate",      "density_g_cm3":3.14,
     "composition":[(20,0.388),(15,0.200),(8,0.412)]},
    {"id":"MgB4O7","name":"Magnesium Tetraborate",      "density_g_cm3":2.53,
     "composition":[(12,0.126),(5,0.224),(8,0.650)]},
    {"id":"Li2SiO3","name":"Lithium Metasilicate",      "density_g_cm3":2.52,
     "composition":[(3,0.097),(14,0.381),(8,0.522)]},
    {"id":"IohexolSolution","name":"Iohexol CT 350 mgI/mL","density_g_cm3":1.41,
     "composition":[(1,0.058),(6,0.235),(7,0.030),(8,0.384),(53,0.293)]},
    {"id":"GdDTPASolution","name":"Gd-DTPA 0.5 mol/L",  "density_g_cm3":1.04,
     "composition":[(1,0.097),(6,0.099),(7,0.019),(8,0.415),(64,0.370)]},
    # Shielding
    {"id":"BoratedPolyethylene5","name":"Borated Polyethylene 5%B","density_g_cm3":0.95,
     "composition":[(1,0.130),(6,0.805),(5,0.050),(8,0.015)]},
    {"id":"BaryteConcrete","name":"Baryte Concrete",    "density_g_cm3":3.35,
     "composition":[(56,0.471),(16,0.143),(8,0.288),(14,0.041),(20,0.033),(26,0.024)]},
    {"id":"MagnetiteConcrete","name":"Magnetite Concrete","density_g_cm3":3.53,
     "composition":[(26,0.364),(8,0.426),(14,0.082),(20,0.060),(13,0.037),(1,0.010)]},
    {"id":"SerpentineConcrete","name":"Serpentine Concrete","density_g_cm3":2.10,
     "composition":[(8,0.443),(14,0.217),(12,0.190),(1,0.050),(13,0.048),(20,0.042)]},
    {"id":"WEpoxy80","name":"W-Epoxy 80% W",             "density_g_cm3":10.10,
     "composition":[(74,0.800),(6,0.100),(1,0.011),(8,0.072),(7,0.017)]},
    {"id":"LeadPolyethylene50","name":"Pb-Polyethylene 50%","density_g_cm3":5.62,
     "composition":[(82,0.500),(6,0.428),(1,0.072)]},
    # Liquids
    {"id":"Seawater",          "name":"Standard Seawater",  "density_g_cm3":1.025,
     "composition":[(8,0.857),(1,0.107),(17,0.019),(11,0.011),(12,0.0013),(16,0.0009)]},
    {"id":"HeavyWater",        "name":"Heavy Water D2O",    "density_g_cm3":1.105,
     "composition":[(8,0.888),(1,0.112)]},
    {"id":"EthyleneGlycol",    "name":"Ethylene Glycol",    "density_g_cm3":1.113,
     "composition":[(6,0.387),(1,0.097),(8,0.516)]},
    {"id":"PhysiologicalSaline","name":"Physiological Saline","density_g_cm3":1.005,
     "composition":[(8,0.877),(1,0.110),(17,0.0053),(11,0.0035)]},
    {"id":"Formalin10pct",     "name":"10% Formalin",       "density_g_cm3":1.037,
     "composition":[(8,0.784),(1,0.116),(6,0.096),(7,0.004)]},
    # Detector gases
    {"id":"P10Gas",       "name":"P10 Gas 90%Ar+10%CH4", "density_g_cm3":1.56e-3,
     "composition":[(18,0.944),(6,0.0046),(1,0.015)]},
    {"id":"CF4Gas",       "name":"CF4 Gas",               "density_g_cm3":3.72e-3,
     "composition":[(6,0.136),(9,0.864)]},
    {"id":"ArCO2_90_10",  "name":"Ar/CO2 90/10",          "density_g_cm3":1.74e-3,
     "composition":[(18,0.974),(8,0.0029),(6,0.0026)]},
    {"id":"SF6Gas",       "name":"SF6 Gas",                "density_g_cm3":6.17e-3,
     "composition":[(16,0.214),(9,0.786)]},
    {"id":"DMEGas",       "name":"DME Gas",                "density_g_cm3":1.97e-3,
     "composition":[(6,0.522),(1,0.130),(8,0.348)]},
    {"id":"HeIsobutane_80_20","name":"He/isobutane 80/20","density_g_cm3":4.84e-4,
     "composition":[(2,0.986),(6,0.011),(1,0.003)]},
    # Nuclear
    {"id":"UO2_natural","name":"Natural UO2",    "density_g_cm3":10.96,
     "composition":[(92,0.882),(8,0.118)]},
    {"id":"MOX_5pct",   "name":"MOX 5% PuO2",   "density_g_cm3":10.90,
     "composition":[(92,0.834),(94,0.042),(8,0.118)]},
    {"id":"UN",         "name":"Uranium Nitride","density_g_cm3":14.32,
     "composition":[(92,0.944),(7,0.056)]},
    {"id":"UC",         "name":"Uranium Carbide","density_g_cm3":13.63,
     "composition":[(92,0.952),(6,0.048)]},
    # Optical / misc
    {"id":"BK7Glass",  "name":"BK7 Borosilicate Glass",  "density_g_cm3":2.51,
     "composition":[(8,0.460),(14,0.320),(5,0.034),(11,0.035),(19,0.074),(56,0.046),(13,0.031)]},
    {"id":"SF6Glass",  "name":"SF6 Dense Flint Glass",   "density_g_cm3":5.18,
     "composition":[(82,0.538),(8,0.236),(14,0.142),(19,0.059),(33,0.025)]},
    {"id":"ZnS_phosphor","name":"Zinc Sulfide phosphor", "density_g_cm3":4.09,
     "composition":[(30,0.671),(16,0.329)]},
    {"id":"DLC",       "name":"Diamond-Like Carbon",     "density_g_cm3":3.50,
     "composition":[(6,1.0)]},
    {"id":"SilicaAerogel","name":"Silica Aerogel",       "density_g_cm3":0.10,
     "composition":[(14,0.467),(8,0.533)]},
    {"id":"Albite",    "name":"Albite NaAlSi3O8",        "density_g_cm3":2.62,
     "composition":[(8,0.483),(14,0.321),(13,0.101),(11,0.088)]},
    # Biological / geological
    {"id":"Muscovite",  "name":"Muscovite Mica",          "density_g_cm3":2.83,
     "composition":[(8,0.470),(14,0.222),(13,0.174),(19,0.079),(1,0.021)]},
    {"id":"Hydroxyapatite_dental","name":"Dental Hydroxyapatite","density_g_cm3":2.96,
     "composition":[(20,0.399),(15,0.185),(8,0.409),(1,0.005),(11,0.003)]},
    {"id":"IonExchangeResin","name":"Sulfonated PS Ion Exchange Resin","density_g_cm3":1.20,
     "composition":[(6,0.568),(1,0.057),(16,0.115),(8,0.260)]},
    {"id":"DosimetricGel","name":"PAGAT Polymer Gel Dosimeter","density_g_cm3":1.06,
     "composition":[(8,0.848),(6,0.062),(1,0.084),(7,0.003),(16,0.003)]},
    # Additional
    {"id":"FR4",          "name":"FR4 PCB Glass-Epoxy Laminate","density_g_cm3":1.85,
     "composition":[(8,0.433),(6,0.262),(14,0.148),(1,0.025),(20,0.050),(13,0.037),(5,0.045)]},
    {"id":"PolystyreneFoam","name":"Expanded Polystyrene Foam EPS","density_g_cm3":0.025,
     "composition":[(6,0.923),(1,0.077)]},
    {"id":"SiliconeRubber","name":"Silicone Rubber cross-linked","density_g_cm3":1.15,
     "composition":[(14,0.374),(8,0.316),(6,0.223),(1,0.087)]},
]

assert len(CUSTOM_MATERIALS) == 100, f"Expected 100, got {len(CUSTOM_MATERIALS)}"

MATERIALS = LIBDEDX_MATERIALS + CUSTOM_MATERIALS   # length 279 + 100 = 379

# ---------------------------------------------------------------------------
# STP formulas (synthetic — physics accuracy is irrelevant for benchmarking)
# ---------------------------------------------------------------------------

def _A_approx(Z: int) -> float:
    """Rough A ~ 2Z approximation for mean excitation energy calculation."""
    return max(1.0, 2.0 * Z)


def _i_eff_eV(composition: list[tuple[int, float]]) -> float:
    """Bragg-Kleeman mean excitation energy from weight-fraction composition."""
    num = sum(w * Z / _A_approx(Z) * math.log(13.5 * Z) for Z, w in composition if Z > 0)
    den = sum(w * Z / _A_approx(Z) for Z, w in composition if Z > 0)
    if den <= 0:
        return 75.0
    return math.exp(num / den)


def _stp_heavy_ion(Z_ion: int, A_ion: int, I_eV: float, E: np.ndarray) -> np.ndarray:
    """Simplified Bethe-Bloch stopping power, MeV·cm²/g."""
    beta2 = E / (E + 931.5)
    beta2 = np.clip(beta2, 1e-8, 1.0 - 1e-8)
    ln_arg = 2.0 * 0.511e6 * beta2 / (I_eV * (1.0 - beta2))
    ln_term = np.maximum(np.log(np.maximum(ln_arg, 1.01)) - beta2, 0.01)
    return (Z_ion**2 / A_ion) * (0.3071 / beta2) * ln_term


def _stp_electron(I_eV: float, E: np.ndarray) -> np.ndarray:
    """Simplified Bethe for electrons, MeV·cm²/g."""
    m_e = 0.511
    tau = E / m_e
    gamma = tau + 1.0
    beta2 = np.clip(1.0 - 1.0 / gamma**2, 1e-8, 1.0 - 1e-8)
    inner = np.maximum(tau**2 * (tau + 2.0) / 2.0, 1.01)
    ln_term = np.maximum(
        np.log(inner * (m_e * 1e6 / I_eV)**2) - beta2, 0.01
    )
    return (0.3071 / beta2) * ln_term


def compute_stp_array() -> np.ndarray:
    """Returns float32 array, shape (287, 379, 165)."""
    n_p = len(PARTICLES)
    n_m = len(MATERIALS)
    n_e = len(ENERGIES)
    out = np.empty((n_p, n_m, n_e), dtype=np.float32)

    # Precompute I_eff for each material
    # libdedx compounds have i_value_eV from header; others use Bragg-Kleeman
    i_effs = []
    for mat in MATERIALS:
        if mat.get("i_value_eV") is not None:
            i_effs.append(float(mat["i_value_eV"]))
        elif "composition" in mat:
            comp = [(c[0], c[1]) for c in mat["composition"]]
            i_effs.append(_i_eff_eV(comp))
        else:
            i_effs.append(75.0)  # fallback: water-like I-value

    for pi, p in enumerate(PARTICLES):
        for mi, (mat, I_eV) in enumerate(zip(MATERIALS, i_effs)):
            if p["type"] == "lepton":
                stp = _stp_electron(I_eV, ENERGIES)
            else:
                stp = _stp_heavy_ion(p["Z"], p["A"], I_eV, ENERGIES)
            out[pi, mi, :] = stp.astype(np.float32)

    return out


def compute_csda_range_array(stp: np.ndarray) -> np.ndarray:
    """Returns float32 array, shape (287, 379, 165).

    Cumulative trapezoidal integration of 1/STP over ENERGIES (g/cm²).
    """
    inv_stp = 1.0 / np.where(stp > 0, stp, np.finfo(np.float32).tiny)
    # cumulative trapz along axis 2
    dE = np.diff(ENERGIES)  # shape (164,)
    avg = (inv_stp[:, :, :-1] + inv_stp[:, :, 1:]) / 2.0  # (287, 379, 164)
    increments = avg * dE[np.newaxis, np.newaxis, :]        # (287, 379, 164)
    csda = np.zeros_like(stp, dtype=np.float64)
    csda[:, :, 1:] = np.cumsum(increments, axis=2)
    return csda.astype(np.float32)


if __name__ == "__main__":
    print(f"Particles : {len(PARTICLES)} ({len(STABLE_ISOTOPES)} isotopes + 1 electron)")
    print(f"Materials : {len(MATERIALS)} ({len(LIBDEDX_MATERIALS)} libdedx + {len(CUSTOM_MATERIALS)} custom)")
    print(f"Energy pts: {len(ENERGIES)} ({ENERGIES[0]} – {ENERGIES[-1]} MeV/u)")
    print("Computing STP array …", flush=True)
    stp = compute_stp_array()
    print(f"  STP shape : {stp.shape}, dtype={stp.dtype}")
    print(f"  STP range : {stp.min():.3g} – {stp.max():.3g} MeV·cm²/g")
    print("Computing CSDA range array …", flush=True)
    csda = compute_csda_range_array(stp)
    print(f"  CSDA shape: {csda.shape}, dtype={csda.dtype}")
    print(f"  CSDA range: {csda.min():.3g} – {csda.max():.3g} g/cm²")
    print("OK — 287 particles, 379 materials, 165 energy points")
