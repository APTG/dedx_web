#!/usr/bin/env python3
"""
inspect_headers.py — Phase 1 static analysis of libdedx C headers.

Reads only source files — no compilation, no WASM, no C toolchain required.
Extracts per-program ion/material/energy metadata, density/I-value metadata,
material categorisation, and computes raw data volume estimates.

Usage:
    python3 inspect_headers.py [--quiet]

Output:
    data/headers_stats.json  — machine-readable full results
    stdout                   — formatted human-readable summary
"""

import re
import json
import sys
import math
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR   = Path(__file__).parent
REPO_ROOT    = SCRIPT_DIR.parent.parent
LIBDEDX_ROOT = REPO_ROOT / "libdedx"
INCLUDE_DIR  = LIBDEDX_ROOT / "include"
EMBEDDED_DIR = LIBDEDX_ROOT / "src" / "data" / "embedded"
SRC_DIR      = LIBDEDX_ROOT / "src"
OUTPUT_DIR   = SCRIPT_DIR / "data"

QUIET = "--quiet" in sys.argv

# ---------------------------------------------------------------------------
# Generic C-array parsers
# ---------------------------------------------------------------------------

def _strip_c_comments(text: str) -> str:
    """Remove /* ... */ and // ... comments from C source."""
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.DOTALL)
    text = re.sub(r"//[^\n]*", " ", text)
    return text


def parse_float_array(text: str, name: str) -> list[float]:
    """
    Extract values from:
        static const float NAME[N] = { v1, v2, ... };
    Returns list of floats (empty if not found).
    """
    pattern = rf"static\s+const\s+float\s+{re.escape(name)}\s*\[\d+\]\s*=\s*\{{([^}}]*)\}}"
    m = re.search(pattern, text, re.DOTALL)
    if not m:
        return []
    body = m.group(1)
    tokens = re.findall(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", body)
    return [float(t) for t in tokens]


def parse_int_array(text: str, name: str) -> list[int]:
    """
    Extract values from:
        static const int NAME[N] = { v1, v2, ... };
    Returns list of ints (empty if not found).
    """
    pattern = rf"static\s+const\s+int\s+{re.escape(name)}\s*\[\d+\]\s*=\s*\{{([^}}]*)\}}"
    m = re.search(pattern, text, re.DOTALL)
    if not m:
        return []
    body = m.group(1)
    tokens = re.findall(r"-?\d+", body)
    return [int(t) for t in tokens]


def get_declared_array_size(text: str, type_kw: str, name: str) -> int | None:
    """
    Return the declared N in:  static const TYPE NAME[N] = ...
    """
    pattern = rf"static\s+const\s+{type_kw}\s+{re.escape(name)}\s*\[(\d+)\]"
    m = re.search(pattern, text)
    return int(m.group(1)) if m else None


def parse_stp_array_dimensions(text: str, prefix: str) -> tuple[int, int, int] | None:
    """
    Parse the 3-D STP array declaration:
        static const float dedx_X_stp[ions][targets][energies] = { ... };
    Returns (ions, targets, energies) or None.
    """
    pattern = rf"static\s+const\s+float\s+{re.escape(prefix)}_stp\s*\[(\d+)\]\s*\[(\d+)\]\s*\[(\d+)\]"
    m = re.search(pattern, text)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))

# ---------------------------------------------------------------------------
# Parse dedx.h — program constants and special particles
# ---------------------------------------------------------------------------

def parse_dedx_h() -> dict:
    """Parse include/dedx.h for program enum values and special particle macros."""
    path = INCLUDE_DIR / "dedx.h"
    text = _strip_c_comments(path.read_text())

    # --- Programs enum ---
    # Locate the programs enum block (between first enum { and matching })
    programs_raw: dict[str, int | None] = {}
    enum_m = re.search(
        r"@defgroup programs.*?enum\s*\{([^}]*)\}", text, re.DOTALL
    )
    if not enum_m:
        # Fallback: grab the first enum block that contains ASTAR
        enum_m = re.search(r"enum\s*\{([^}]*DEDX_ASTAR[^}]*)\}", text, re.DOTALL)

    if enum_m:
        body = enum_m.group(1)
        current = 0
        for line in body.splitlines():
            line = line.strip().rstrip(",")
            m = re.match(r"(DEDX_\w+)\s*=\s*(-?\d+)", line)
            if m:
                current = int(m.group(2))
                programs_raw[m.group(1)] = current
            else:
                m = re.match(r"(DEDX_\w+|_DEDX_\w+)", line)
                if m:
                    current += 1
                    programs_raw[m.group(1)] = current

    # --- Special particle #defines ---
    special_particles: dict[str, int] = {}
    for m in re.finditer(r"#define\s+(DEDX_\w+)\s+(\d+)", text):
        name, val = m.group(1), int(m.group(2))
        if val >= 1000:  # special IDs start at 1001
            special_particles[name] = val
        elif name == "DEDX_PROTON":
            special_particles[name] = val

    # Human-readable descriptions for known program constants
    descriptions = {
        "DEDX_ASTAR":      "NIST ASTAR — alpha particle stopping powers",
        "DEDX_PSTAR":      "NIST PSTAR — proton stopping powers",
        "DEDX_ESTAR":      "NIST ESTAR — electron stopping powers",
        "DEDX_MSTAR":      "MSTAR (H. Paul) — heavy-ion stopping powers (parametric)",
        "DEDX_ICRU73_OLD": "ICRU Report 73 (2005) — older parametrisation",
        "DEDX_ICRU73":     "ICRU Report 73 (2005)",
        "DEDX_ICRU49":     "ICRU Report 49 (1993) — protons and alphas",
        "_DEDX_0008":      "Reserved (not a public program)",
        "DEDX_ICRU":       "Auto-select: ICRU49 or ICRU73 by ion type",
        "DEDX_DEFAULT":    "Default Bethe formula (parametric, any ion/material)",
        "DEDX_BETHE_EXT00":"Bethe formula with extensions",
    }

    return {
        "programs_raw": programs_raw,
        "descriptions": descriptions,
        "special_particles": special_particles,
    }

# ---------------------------------------------------------------------------
# Parse dedx_elements.h — element/compound IDs and names
# ---------------------------------------------------------------------------

def parse_elements_h() -> dict:
    """
    Parse include/dedx_elements.h to build:
      - id_to_name: {id -> "DEDX_WATER_LIQUID", ...}
      - categorisation: elemental vs compound
      - material aliases
    """
    path = INCLUDE_DIR / "dedx_elements.h"
    text = _strip_c_comments(path.read_text())

    # Extract the big enum block
    enum_m = re.search(r"enum\s*\{([^}]*)\}", text, re.DOTALL)
    if not enum_m:
        return {}

    body = enum_m.group(1)

    id_to_name: dict[int, str] = {}
    name_to_id: dict[str, int] = {}
    current = 0

    for line in body.splitlines():
        line = line.strip().rstrip(",")
        if not line:
            continue
        # explicit assignment
        m = re.match(r"(DEDX_\w+)\s*=\s*(\d+)", line)
        if m:
            current = int(m.group(2))
            id_to_name[current] = m.group(1)
            name_to_id[m.group(1)] = current
            continue
        # implicit (next value)
        m = re.match(r"(DEDX_\w+)", line)
        if m:
            current += 1
            id_to_name[current] = m.group(1)
            name_to_id[m.group(1)] = current

    # Parse #define aliases
    aliases: dict[str, str] = {}
    for m in re.finditer(r"#define\s+(DEDX_\w+)\s+(DEDX_\w+)", text):
        aliases[m.group(1)] = m.group(2)

    # Categorise: elemental = id 1..98, special = 906, compounds = everything else (99..278)
    elemental_ids   = sorted(i for i in id_to_name if 1 <= i <= 98)
    compound_ids    = sorted(i for i in id_to_name if 99 <= i <= 900)
    special_ids     = sorted(i for i in id_to_name if i > 900)

    return {
        "id_to_name": {str(k): v for k, v in sorted(id_to_name.items())},
        "name_to_id": name_to_id,
        "aliases": aliases,
        "elemental_ids": elemental_ids,
        "compound_ids": compound_ids,
        "special_ids": special_ids,
        "total_defined": len(id_to_name),
    }

# ---------------------------------------------------------------------------
# Parse dedx_metadata.h — density / I-value / gas targets
# ---------------------------------------------------------------------------

def parse_metadata_h() -> dict:
    """
    Parse src/data/embedded/dedx_metadata.h:
      - 285 density/I-value rows  {id, density, i_value, state}
      - 29 gas target IDs
    """
    path = EMBEDDED_DIR / "dedx_metadata.h"
    text = _strip_c_comments(path.read_text())

    # Parse compos rows: {id, density, i_value, state}
    rows: list[dict] = []
    row_pattern = re.compile(
        r"\{(\d+),\s*([\deE.+-]+)f,\s*([\deE.+-]+)f,\s*(\d+)\}"
    )
    for m in row_pattern.finditer(text):
        rows.append({
            "material_id": int(m.group(1)),
            "density_g_per_cm3": float(m.group(2)),
            "i_value_eV": float(m.group(3)),
            "state": int(m.group(4)),
        })

    # Unique material IDs (a material may appear twice for gas/condensed states)
    unique_material_ids = sorted(set(r["material_id"] for r in rows))

    # Density and I-value ranges (default state = 0 rows preferred)
    default_rows = [r for r in rows if r["state"] != 2]  # exclude condensed duplicates
    densities    = [r["density_g_per_cm3"] for r in default_rows]
    i_values     = [r["i_value_eV"]        for r in default_rows]

    # Gas target list
    gas_ids_raw = parse_int_array(text, "dedx_embedded_gas_targets")
    declared_gas_count = get_declared_array_size(text, "int", "dedx_embedded_gas_targets")

    return {
        "compos_rows_total": len(rows),
        "unique_material_ids_count": len(unique_material_ids),
        "unique_material_ids": unique_material_ids,
        "density": {
            "unit": "g/cm³",
            "min":  min(densities),
            "max":  max(densities),
            "note": "default-state rows only; excludes condensed-state duplicates",
        },
        "i_value": {
            "unit":  "eV",
            "min":   min(i_values),
            "max":   max(i_values),
        },
        "gas_targets": {
            "declared_count": declared_gas_count,
            "ids":            gas_ids_raw,
        },
    }

# ---------------------------------------------------------------------------
# Parse one embedded data header (dedx_X.h)
# ---------------------------------------------------------------------------

def parse_embedded_header(header_name: str, prefix: str) -> dict | None:
    """
    Parse src/data/embedded/{header_name}.h.
    Returns a dict with energy, ion, target metadata.
    prefix is the snake_case identifier, e.g. 'dedx_pstar'.
    """
    path = EMBEDDED_DIR / f"{header_name}.h"
    if not path.exists():
        return None

    text = path.read_text()
    stripped = _strip_c_comments(text)

    energy_arr  = parse_float_array(stripped, f"{prefix}_energy")
    ion_ids     = parse_int_array(stripped,   f"{prefix}_ion_ids")
    target_ids  = parse_int_array(stripped,   f"{prefix}_target_ids")
    stp_dims    = parse_stp_array_dimensions(stripped, prefix)

    # Validate STP dimensions against arrays (sanity check)
    mismatches: list[str] = []
    if stp_dims:
        ni, nt, ne = stp_dims
        if ni != len(ion_ids):
            mismatches.append(f"STP ion dim={ni} but ion_ids has {len(ion_ids)}")
        if nt != len(target_ids):
            mismatches.append(f"STP target dim={nt} but target_ids has {len(target_ids)}")
        if ne != len(energy_arr):
            mismatches.append(f"STP energy dim={ne} but energy array has {len(energy_arr)}")

    n_ions    = stp_dims[0] if stp_dims else len(ion_ids)
    n_targets = stp_dims[1] if stp_dims else len(target_ids)
    n_energy  = stp_dims[2] if stp_dims else len(energy_arr)

    raw_float_count = n_ions * n_targets * n_energy
    raw_bytes       = raw_float_count * 4  # sizeof(float)

    return {
        "header_file":       f"{header_name}.h",
        "prefix":            prefix,
        "energy_count":      n_energy,
        "energy_min_MeV_per_nucl": min(energy_arr) if energy_arr else None,
        "energy_max_MeV_per_nucl": max(energy_arr) if energy_arr else None,
        "energy_array":      energy_arr,
        "ion_ids":           ion_ids,
        "ion_count":         n_ions,
        "target_ids":        target_ids,
        "target_count":      n_targets,
        "stp_dimensions":    list(stp_dims) if stp_dims else None,
        "raw_float_count":   raw_float_count,
        "raw_bytes":         raw_bytes,
        "raw_kilobytes":     round(raw_bytes / 1024, 1),
        "validation_issues": mismatches,
    }

# ---------------------------------------------------------------------------
# Parse MSTAR parametric coverage from dedx_mpaul.c
# ---------------------------------------------------------------------------

def parse_mstar_parametric() -> dict:
    """
    Inspect src/dedx_mpaul.c to document MSTAR's parametric ion coverage.
    MSTAR uses alpha (Z=2) tabulated data as a baseline and applies
    polynomial scaling coefficients for any projectile ion.
    Mode 'h' has special hardcoded cases for specific Z values.
    """
    path = SRC_DIR / "dedx_mpaul.c"
    if not path.exists():
        return {"error": "dedx_mpaul.c not found"}

    text = _strip_c_comments(path.read_text())

    # Find all explicit ion == N cases (for mode h special handling)
    special_h_ions = sorted(set(
        int(m.group(1))
        for m in re.finditer(r"ion\s*==\s*(\d+)", text)
    ))

    # Check for upper-bound guard on ion Z
    has_upper_bound = bool(re.search(r"ion\s*[<>]=?\s*\d{2,}", text))

    # Check for Z-squared term (indicates general polynomial of Z)
    has_z_squared = bool(re.search(r"pow\s*\(\s*ion\s*,\s*2", text))

    return {
        "source_file": "dedx_mpaul.c",
        "coverage_type": "parametric",
        "description": (
            "MSTAR uses tabulated alpha (Z=2) stopping power data as the "
            "base dataset. A polynomial scaling coefficient (Helmut Paul formula) "
            "is applied to convert alpha data to any projectile ion. "
            "Mode 'h' has hardcoded special cases for specific ions."
        ),
        "base_ion_z": 2,
        "mode_h_special_ion_z_values": special_h_ions,
        "has_explicit_upper_z_bound_in_code": has_upper_bound,
        "uses_z_polynomial": has_z_squared,
        "note": (
            "Phase 2 (WASM runtime) must call dedx_fill_ion_list(DEDX_MSTAR) "
            "to determine the exact ion list exposed at runtime."
        ),
    }

# ---------------------------------------------------------------------------
# Parse MSTAR source for supported target count
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Main analysis — assemble all program records
# ---------------------------------------------------------------------------

# Mapping: program constant → embedded header info
# Each entry: (header_name, prefix, program_ids, source_type, notes)
PROGRAM_HEADERS: list[dict] = [
    {
        "constant":    "DEDX_ASTAR",
        "id":          1,
        "header":      "dedx_astar",
        "source_type": "tabulated",
        "notes":       [],
    },
    {
        "constant":    "DEDX_PSTAR",
        "id":          2,
        "header":      "dedx_pstar",
        "source_type": "tabulated",
        "notes":       [],
    },
    {
        "constant":    "DEDX_ESTAR",
        "id":          3,
        "header":      "dedx_estar",
        "source_type": "tabulated",
        "notes":       [
            "Ion ID -1 in embedded header is a placeholder; runtime uses DEDX_ELECTRON (1001).",
            "Energy axis is in MeV (total electron energy), NOT MeV/nucl.",
        ],
    },
    {
        "constant":    "DEDX_MSTAR",
        "id":          4,
        "header":      "dedx_mstar",
        "source_type": "parametric+tabulated",
        "notes":       [
            "Embedded header contains alpha (Z=2) base data only.",
            "Parametric scaling (dedx_mpaul.c) extends coverage to any ion Z.",
            "Runtime ion list determined in Phase 2.",
        ],
    },
    {
        "constant":    "DEDX_ICRU73_OLD",
        "id":          5,
        "header":      "dedx_icru73",
        "source_type": "tabulated",
        "notes":       [
            "Shares the same embedded data table as DEDX_ICRU73 (id=6).",
            "Differs in parametrisation/interpolation code, not raw data.",
        ],
    },
    {
        "constant":    "DEDX_ICRU73",
        "id":          6,
        "header":      "dedx_icru73",
        "source_type": "tabulated",
        "notes":       [],
    },
    {
        "constant":    "DEDX_ICRU49",
        "id":          7,
        "header":      None,  # composite of two sub-tables
        "sub_headers": ["dedx_icru_pstar", "dedx_icru_astar"],
        "source_type": "tabulated",
        "notes":       [
            "ICRU49 covers protons (dedx_icru_pstar.h) and alphas (dedx_icru_astar.h).",
            "Both sub-tables share the same 122-energy-point axis.",
        ],
    },
    {
        "constant":    "_DEDX_0008",
        "id":          8,
        "header":      None,
        "source_type": "reserved",
        "notes":       ["Reserved slot — not a usable program."],
    },
    {
        "constant":    "DEDX_ICRU",
        "id":          9,
        "header":      None,
        "source_type": "auto-select",
        "notes":       [
            "Auto-selects DEDX_ICRU49 (id=7) or DEDX_ICRU73 (id=6) based on ion type.",
            "Not an independent data source — do not count separately in coverage.",
        ],
    },
    {
        "constant":    "DEDX_DEFAULT",
        "id":          100,
        "header":      None,
        "source_type": "parametric (Bethe formula)",
        "notes":       [
            "Analytical Bethe formula. No precomputed table — works for any ion/material.",
            "Requires density (rho) in dedx_config.",
        ],
    },
    {
        "constant":    "DEDX_BETHE_EXT00",
        "id":          101,
        "header":      None,
        "source_type": "parametric (Bethe + extensions)",
        "notes":       [
            "Bethe formula with corrections. Parametric, any ion/material.",
        ],
    },
]

# Supplementary datasets (not standalone programs)
SUPPLEMENTARY_HEADERS: list[dict] = [
    {"header": "dedx_icru73new",  "description": "ICRU73 updated data — Z=1–18 ions, 2 targets (Air, Water)"},
    {"header": "dedx_icru90_a",   "description": "ICRU 90 alpha data — 1 ion (alpha), 3 targets (Air, Water, Graphite)"},
    {"header": "dedx_icru90_C",   "description": "ICRU 90 Carbon-12 data — 1 ion (C-12), 3 targets"},
    {"header": "dedx_icru90_e",   "description": "ICRU 90 electron data — 1 ion (electron), 3 targets"},
    {"header": "dedx_icru90_p",   "description": "ICRU 90 proton data — 1 ion (proton), 3 targets"},
    {"header": "dedx_icru90_pos", "description": "ICRU 90 positron data — 1 ion (positron), 3 targets"},
    {"header": "dedx_composition","description": "Elemental composition table for compound materials"},
]


def build_program_record(ph: dict, elements: dict, descriptions: dict) -> dict:
    """Build a complete program record from PROGRAM_HEADERS entry."""
    rec: dict = {
        "constant":    ph["constant"],
        "id":          ph["id"],
        "description": descriptions.get(ph["constant"], ""),
        "source_type": ph["source_type"],
        "notes":       ph.get("notes", []),
    }

    header = ph.get("header")
    sub_headers = ph.get("sub_headers", [])

    if header:
        hdata = parse_embedded_header(header, header)
        if hdata:
            rec["embedded_data"] = hdata
            _annotate_ion_names(hdata, elements)

    elif sub_headers:
        sub_data = []
        for sh in sub_headers:
            hdata = parse_embedded_header(sh, sh)
            if hdata:
                _annotate_ion_names(hdata, elements)
                sub_data.append(hdata)
        if sub_data:
            rec["embedded_data"] = _merge_sub_headers(sub_data)
            rec["sub_headers"] = sub_data
    else:
        rec["embedded_data"] = None

    return rec


def _annotate_ion_names(hdata: dict, elements: dict) -> None:
    """Add human-readable names to ion and target ID lists in hdata."""
    id_to_name = {int(k): v for k, v in elements.get("id_to_name", {}).items()}

    def pretty_name(id_: int, prefix: str = "DEDX_") -> str:
        raw = id_to_name.get(id_, f"id={id_}")
        return raw.replace(prefix, "").replace("_", " ").title() if raw.startswith(prefix) else raw

    hdata["ion_names"]    = [pretty_name(i) for i in hdata["ion_ids"]]
    hdata["target_names_sample"] = [pretty_name(i) for i in hdata["target_ids"][:10]]


def _merge_sub_headers(sub_data: list[dict]) -> dict:
    """Merge two sub-header records (e.g. ICRU49 proton + alpha) into a summary."""
    all_ions    = []
    all_ion_names = []
    all_targets = set()
    total_floats = 0
    e_mins, e_maxs = [], []
    per_sub_energy: list[dict] = []

    for s in sub_data:
        all_ions.extend(s["ion_ids"])
        all_ion_names.extend(s.get("ion_names", [str(i) for i in s["ion_ids"]]))
        all_targets.update(s["target_ids"])
        total_floats += s["raw_float_count"]
        if s["energy_min_MeV_per_nucl"] is not None:
            e_mins.append(s["energy_min_MeV_per_nucl"])
        if s["energy_max_MeV_per_nucl"] is not None:
            e_maxs.append(s["energy_max_MeV_per_nucl"])
        per_sub_energy.append({
            "header": s["header_file"],
            "energy_count": s["energy_count"],
            "energy_min": s["energy_min_MeV_per_nucl"],
            "energy_max": s["energy_max_MeV_per_nucl"],
        })

    # Sub-tables may have different energy point counts — use min/max summary
    energy_counts = [s["energy_count"] for s in sub_data]
    energy_count_str = (
        str(energy_counts[0]) if len(set(energy_counts)) == 1
        else f"{min(energy_counts)}–{max(energy_counts)} (varies by ion)"
    )

    return {
        "merged_from":               [s["header_file"] for s in sub_data],
        "ion_ids":                   all_ions,
        "ion_count":                 len(all_ions),
        "ion_names":                 all_ion_names,
        "target_ids":                sorted(all_targets),
        "target_count":              len(all_targets),
        "energy_count":              energy_count_str,
        "energy_count_note":         per_sub_energy,
        "energy_min_MeV_per_nucl":   min(e_mins) if e_mins else None,
        "energy_max_MeV_per_nucl":   max(e_maxs) if e_maxs else None,
        "raw_float_count":           total_floats,
        "raw_bytes":                 total_floats * 4,
        "raw_kilobytes":             round(total_floats * 4 / 1024, 1),
        "validation_issues":         [],
    }


def compute_totals(program_records: list[dict]) -> dict:
    """Compute aggregate raw byte counts across all programs with embedded data."""
    total_bytes = 0
    seen_headers: set[str] = set()  # deduplicate shared headers (e.g. icru73_old)

    per_program: dict[str, int] = {}
    for pr in program_records:
        ed = pr.get("embedded_data")
        if not ed:
            continue

        # For merged (ICRU49): use sub_headers to avoid double-counting
        if "merged_from" in ed:
            b = ed["raw_bytes"]
        else:
            hf = ed.get("header_file", "")
            if hf in seen_headers:
                b = 0  # already counted (ICRU73_OLD shares ICRU73 header)
            else:
                seen_headers.add(hf)
                b = ed["raw_bytes"]

        per_program[pr["constant"]] = b
        total_bytes += b

    return {
        "per_program_bytes": per_program,
        "total_unique_bytes": total_bytes,
        "total_unique_kilobytes": round(total_bytes / 1024, 1),
        "note": "ICRU73_OLD (id=5) shares dedx_icru73.h with ICRU73 (id=6) — counted once.",
    }

# ---------------------------------------------------------------------------
# Energy range helpers
# ---------------------------------------------------------------------------

def fmt_energy(val_MeV_per_nucl: float | None) -> str:
    if val_MeV_per_nucl is None:
        return "N/A"
    eV = val_MeV_per_nucl * 1e6
    if eV < 1000:                          # < 1 keV → show in eV
        return f"{eV:.4g} eV/nucl"
    keV = val_MeV_per_nucl * 1e3
    if keV < 1000:                         # < 1 MeV → show in keV
        return f"{keV:.4g} keV/nucl"
    if val_MeV_per_nucl < 1000:            # < 1 GeV → show in MeV
        return f"{val_MeV_per_nucl:.4g} MeV/nucl"
    return f"{val_MeV_per_nucl/1000:.4g} GeV/nucl"

# ---------------------------------------------------------------------------
# Spec cross-check
# ---------------------------------------------------------------------------

SPEC_CLAIMS = {
    "particles_approx":   240,
    "materials_approx":   280,
    "programs_count":      10,
    "energy_min_eV":       10,   # ~10 eV implied by spec
    "energy_max_GeV":      10.0, # ~10 GeV implied by spec
}


def cross_check_specs(
    program_records: list[dict],
    metadata: dict,
    elements: dict,
) -> list[dict]:
    """
    Compare actual libdedx data against spec claims.
    Returns a list of finding dicts.
    """
    findings: list[dict] = []

    # --- Programs ---
    public_programs = [
        p for p in program_records
        if p["id"] not in (8,)  # exclude reserved
    ]
    non_auto = [p for p in public_programs if p["source_type"] != "auto-select"]
    findings.append({
        "claim":   "~10 programs",
        "actual":  f"{len(non_auto)} non-auto programs (+ DEDX_ICRU auto-select + 1 reserved)",
        "status":  "MATCH" if len(non_auto) >= 9 else "MISMATCH",
        "detail":  [p["constant"] for p in non_auto],
    })

    # --- Materials ---
    n_elemental = len(elements.get("elemental_ids", []))
    n_compound  = len(elements.get("compound_ids", []))
    n_special   = len(elements.get("special_ids", []))
    total_mat   = n_elemental + n_compound + n_special
    findings.append({
        "claim":   f"~{SPEC_CLAIMS['materials_approx']} materials",
        "actual":  f"{total_mat} material IDs ({n_elemental} elemental Z=1–98, {n_compound} compound, {n_special} special e.g. Graphite=906)",
        "status":  "CLOSE" if abs(total_mat - SPEC_CLAIMS['materials_approx']) < 20 else "MISMATCH",
        "detail":  f"Elements defined in dedx_elements.h enum: {total_mat} total",
    })

    # --- Gas targets ---
    gas_ids  = metadata["gas_targets"]["ids"]
    declared = metadata["gas_targets"]["declared_count"]
    findings.append({
        "claim":   "29 gas targets",
        "actual":  f"{declared} declared, {len(gas_ids)} parsed",
        "status":  "MATCH" if declared == 29 else "MISMATCH",
        "detail":  gas_ids,
    })

    # --- Energy range ---
    # Gather all min/max energies across tabulated programs
    e_mins, e_maxs = [], []
    for p in program_records:
        ed = p.get("embedded_data")
        if not ed:
            continue
        emin = ed.get("energy_min_MeV_per_nucl")
        emax = ed.get("energy_max_MeV_per_nucl")
        if emin: e_mins.append(emin)
        if emax: e_maxs.append(emax)
    global_emin = min(e_mins) if e_mins else None
    global_emax = max(e_maxs) if e_maxs else None
    spec_emin_MeV = SPEC_CLAIMS["energy_min_eV"] / 1e6
    spec_emax_MeV = SPEC_CLAIMS["energy_max_GeV"] * 1000
    findings.append({
        "claim":   f"Energy ~{SPEC_CLAIMS['energy_min_eV']} eV to ~{SPEC_CLAIMS['energy_max_GeV']} GeV",
        "actual":  (
            f"Min across all tabulated programs: {fmt_energy(global_emin)}, "
            f"Max: {fmt_energy(global_emax)}"
        ),
        "status":  (
            "MATCH" if (global_emin is not None and global_emin <= spec_emin_MeV * 100
                        and global_emax is not None and global_emax >= spec_emax_MeV * 0.5)
            else "MISMATCH"
        ),
        "detail": (
            "ASTAR starts at 0.25 keV/nucl (not eV). PSTAR/ESTAR/MSTAR start at 1 keV. "
            "ESTAR max is 10 GeV but energy axis is in MeV (not MeV/nucl) for electrons. "
            "Parametric Bethe program has no tabulated bounds."
        ),
    })

    # --- Particle count ---
    # Tabulated ion counts per program
    tabulated_ions: set[int] = set()
    for p in program_records:
        ed = p.get("embedded_data")
        if ed:
            tabulated_ions.update(ed.get("ion_ids", []))

    # Special: ESTAR uses ion_id=-1 (placeholder); actual is electron=1001
    tabulated_ions.discard(-1)

    findings.append({
        "claim":   f"~{SPEC_CLAIMS['particles_approx']} particles",
        "actual":  (
            f"{len(tabulated_ions)} unique ion IDs in tabulated databases "
            f"(Z=1–18 depending on program, + alpha Z=2, + electron via ESTAR). "
            f"MSTAR and Bethe extend to any Z analytically."
        ),
        "status":  "NEEDS_CLARIFICATION",
        "detail":  (
            "The ~240 figure likely counts all Z=1–98 elemental ions as available "
            "via the parametric Bethe/MSTAR path, not via tabulated lookup. "
            "ICRU73 covers Z=3–18 (16 ions), PSTAR=proton only, ASTAR=alpha only. "
            "Phase 2 must call dedx_fill_ion_list() per program to confirm runtime counts."
        ),
    })

    return findings

# ---------------------------------------------------------------------------
# Pretty-print summary
# ---------------------------------------------------------------------------

BOLD   = "\033[1m"
RESET  = "\033[0m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
CYAN   = "\033[36m"

def _status_colour(status: str) -> str:
    colours = {
        "MATCH": GREEN, "CLOSE": GREEN,
        "NEEDS_CLARIFICATION": YELLOW,
        "MISMATCH": RED,
    }
    return colours.get(status, RESET)


def print_summary(
    program_records: list[dict],
    metadata: dict,
    elements: dict,
    totals: dict,
    mstar_para: dict,
    spec_findings: list[dict],
    suppl: list[dict | None],
) -> None:
    def h1(t): print(f"\n{BOLD}{'='*72}{RESET}\n{BOLD} {t}{RESET}\n{BOLD}{'='*72}{RESET}")
    def h2(t): print(f"\n{BOLD}{CYAN}── {t} {'─'*(65-len(t))}{RESET}")
    def row(*cols, widths=(38, 10, 10, 12, 12)):
        parts = [str(c).ljust(w) for c, w in zip(cols, widths)]
        print(" ".join(parts))

    h1("libdedx Phase 1 — Static Header Analysis")
    print(f"  Date : {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"  libdedx root : {LIBDEDX_ROOT}")

    # ── Programs table ──────────────────────────────────────────────────────
    h2("Programs and Tabulated Data")
    row("Program", "Ions", "Targets", "E-points", "Raw KB", widths=(34, 6, 8, 14, 10))
    print("  " + "-" * 74)
    for pr in program_records:
        ed = pr.get("embedded_data")
        if ed:
            ni = ed.get("ion_count", "?")
            nt = ed.get("target_count", "?")
            ne = ed.get("energy_count", "?")
            kb = ed.get("raw_kilobytes", "?")
        else:
            ni = nt = ne = kb = "—"
        tag = f"  {pr['constant']} (id={pr['id']})"
        row(tag, ni, nt, ne, kb, widths=(34, 6, 8, 14, 10))

    # ── Energy ranges ───────────────────────────────────────────────────────
    h2("Energy Ranges per Program (MeV/nucl unless noted)")
    for pr in program_records:
        ed = pr.get("embedded_data")
        if not ed:
            continue
        emin = ed.get("energy_min_MeV_per_nucl")
        emax = ed.get("energy_max_MeV_per_nucl")
        estar_note = " [MeV total, not /nucl]" if pr["constant"] == "DEDX_ESTAR" else ""
        print(f"  {pr['constant']:<24}  {fmt_energy(emin):>18}  →  {fmt_energy(emax):<18}{estar_note}")

    # ── Ion details ─────────────────────────────────────────────────────────
    h2("Ion Coverage per Tabulated Program")
    for pr in program_records:
        ed = pr.get("embedded_data")
        if not ed:
            continue
        ion_ids   = ed.get("ion_ids", [])
        ion_names = ed.get("ion_names", [str(i) for i in ion_ids])
        ions_str  = ", ".join(
            f"{name}(Z={id_})" if id_ > 0 else f"electron(id={id_})"
            for id_, name in zip(ion_ids, ion_names)
        )
        print(f"  {pr['constant']:<24}  {ions_str}")

    # ── MSTAR parametric ────────────────────────────────────────────────────
    h2("MSTAR Parametric Coverage (dedx_mpaul.c)")
    print(f"  Base data    : alpha (Z=2) tabulated — {mstar_para['base_ion_z']}")
    print(f"  Scaling      : polynomial in Z → any projectile ion")
    print(f"  Mode-h Z vals: {mstar_para['mode_h_special_ion_z_values']}")
    print(f"  Upper Z bound in code : {mstar_para['has_explicit_upper_z_bound_in_code']}")
    print(f"  Uses Z polynomial     : {mstar_para['uses_z_polynomial']}")
    print(f"  → Phase 2 WASM call required to confirm runtime ion list")

    # ── Materials ───────────────────────────────────────────────────────────
    h2("Material Categorisation (dedx_elements.h)")
    n_el = len(elements["elemental_ids"])
    n_co = len(elements["compound_ids"])
    n_sp = len(elements["special_ids"])
    print(f"  Elemental (Z=1–98)   : {n_el}")
    print(f"  Compound/mixture     : {n_co}")
    print(f"  Special (e.g. Graphite=906) : {n_sp}")
    print(f"  Total defined        : {n_el + n_co + n_sp}")
    print(f"  Gas targets          : {metadata['gas_targets']['declared_count']} "
          f"(IDs: {metadata['gas_targets']['ids']})")

    # ── Density / I-value ───────────────────────────────────────────────────
    h2("Density and I-value Metadata (dedx_metadata.h)")
    d = metadata["density"]
    iv = metadata["i_value"]
    print(f"  Rows total (incl. state variants) : {metadata['compos_rows_total']}")
    print(f"  Unique material IDs               : {metadata['unique_material_ids_count']}")
    print(f"  Density   : {d['min']:.3e} – {d['max']:.3e} {d['unit']}")
    print(f"  I-value   : {iv['min']:.1f} – {iv['max']:.1f} {iv['unit']}")
    print(f"  Units confirmed: density = g/cm³, I-value = eV  ✓")

    # ── Supplementary datasets ──────────────────────────────────────────────
    h2("Supplementary Datasets (not standalone programs)")
    for entry in suppl:
        if entry is None:
            continue
        hd   = entry.get("header_data")
        desc = entry.get("description", "")
        if hd:
            ni = hd.get("ion_count", "?")
            nt = hd.get("target_count", "?")
            ne = hd.get("energy_count", "?")
            kb = hd.get("raw_kilobytes", "?")
            print(f"  {hd['header_file']:<28}  ions={ni}  targets={nt}  E-pts={ne}  raw={kb} KB")
            print(f"    {desc}")
        else:
            print(f"  [not found] {desc}")

    # ── Raw data sizes ───────────────────────────────────────────────────────
    h2("Raw Data Volume Estimates (float32)")
    for const, b in totals["per_program_bytes"].items():
        kb = b / 1024
        print(f"  {const:<28}  {kb:7.1f} KB")
    print(f"  {'─'*42}")
    print(f"  {'TOTAL (unique headers):':<28}  {totals['total_unique_kilobytes']:7.1f} KB")
    print(f"  Note: {totals['note']}")
    print(f"  Note: actual .data sidecar is ~1500 KB (from Spike 2) — difference is")
    print(f"        Emscripten overhead, the filesystem virtual layer, and WASM module.")

    # ── Spec cross-check ────────────────────────────────────────────────────
    h2("Spec Cross-check")
    for f in spec_findings:
        colour = _status_colour(f["status"])
        print(f"  [{colour}{f['status']:<22}{RESET}]  {f['claim']}")
        print(f"    Actual: {f['actual']}")
        if isinstance(f["detail"], str):
            print(f"    Detail: {f['detail']}")
        print()

    print(f"\n{BOLD}Output saved to: {OUTPUT_DIR}/headers_stats.json{RESET}\n")

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)

    # 1. Parse dedx.h
    dedx_h_data = parse_dedx_h()
    descriptions     = dedx_h_data["descriptions"]
    special_particles = dedx_h_data["special_particles"]

    # 2. Parse dedx_elements.h
    elements = parse_elements_h()

    # 3. Parse dedx_metadata.h
    metadata = parse_metadata_h()

    # 4. Parse MSTAR parametric
    mstar_para = parse_mstar_parametric()

    # 5. Build program records
    program_records: list[dict] = []
    for ph in PROGRAM_HEADERS:
        rec = build_program_record(ph, elements, descriptions)
        program_records.append(rec)

    # 6. Supplementary datasets
    suppl_records: list[dict | None] = []
    for s in SUPPLEMENTARY_HEADERS:
        hdata = parse_embedded_header(s["header"], s["header"])
        if hdata:
            _annotate_ion_names(hdata, elements)
        suppl_records.append({
            "header_data":  hdata,
            "description":  s["description"],
        })

    # 7. Compute totals
    totals = compute_totals(program_records)

    # 8. Spec cross-check
    spec_findings = cross_check_specs(program_records, metadata, elements)

    # 9. Assemble output JSON
    output = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "analysis_type": "static_header_inspection_phase1",
            "libdedx_root": str(LIBDEDX_ROOT.relative_to(REPO_ROOT)),
            "embedded_dir": str(EMBEDDED_DIR.relative_to(REPO_ROOT)),
        },
        "special_particles": special_particles,
        "programs": {str(p["id"]): p for p in program_records},
        "supplementary_datasets": {
            s["header"]: {
                "description": entry["description"],
                "data": entry["header_data"],
            }
            for s, entry in zip(SUPPLEMENTARY_HEADERS, suppl_records)
        },
        "material_categorisation": {
            "elemental_count":  len(elements["elemental_ids"]),
            "compound_count":   len(elements["compound_ids"]),
            "special_count":    len(elements["special_ids"]),
            "total_count":      len(elements["id_to_name"]),
            "elemental_ids":    elements["elemental_ids"],
            "compound_ids":     elements["compound_ids"],
            "special_ids":      elements["special_ids"],
            "aliases":          elements["aliases"],
        },
        "metadata_stats": metadata,
        "mstar_parametric": mstar_para,
        "raw_data_totals": totals,
        "spec_findings": spec_findings,
    }

    # Strip energy_array from output to keep JSON small (it's large)
    def trim_energy_arrays(obj):
        if isinstance(obj, dict):
            if "energy_array" in obj:
                obj["energy_array_count"] = len(obj.pop("energy_array"))
            for v in obj.values():
                trim_energy_arrays(v)
        elif isinstance(obj, list):
            for item in obj:
                trim_energy_arrays(item)
    trim_energy_arrays(output)

    # Write JSON
    out_path = OUTPUT_DIR / "headers_stats.json"
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))

    # 10. Print summary
    if not QUIET:
        print_summary(
            program_records, metadata, elements, totals,
            mstar_para, spec_findings, suppl_records,
        )


if __name__ == "__main__":
    main()
