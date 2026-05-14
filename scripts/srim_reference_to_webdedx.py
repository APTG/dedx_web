#!/usr/bin/env python3
"""Inspect websrim Arrow reference tables and convert them to .webdedx stores.

Usage examples from the repository root:

  python scripts/srim_reference_to_webdedx.py inspect-source \
    ~/cernbox/Documents/websrim/data/reference/gui \
    --label gui --output-dir data/srim-reference-inspection

  python scripts/srim_reference_to_webdedx.py convert \
    ~/cernbox/Documents/websrim/data/reference/gui \
    --label gui --output data/srim-gui.webdedx --force

The converter writes Zarr v3 directory stores with one LZ4-compressed shard per
projectile. Materials with any incomplete projectile table are excluded so the
resulting STP array is rectangular and valid for webdedx.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import struct
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import google_crc32c
import numcodecs
import numpy as np
import pyarrow as pa
import pyarrow.ipc as ipc


ELEMENT_SYMBOLS: dict[int, str] = {
    1: "H",
    2: "He",
    3: "Li",
    4: "Be",
    5: "B",
    6: "C",
    7: "N",
    8: "O",
    9: "F",
    10: "Ne",
    11: "Na",
    12: "Mg",
    13: "Al",
    14: "Si",
    15: "P",
    16: "S",
    17: "Cl",
    18: "Ar",
    19: "K",
    20: "Ca",
    21: "Sc",
    22: "Ti",
    23: "V",
    24: "Cr",
    25: "Mn",
    26: "Fe",
    27: "Co",
    28: "Ni",
    29: "Cu",
    30: "Zn",
    31: "Ga",
    32: "Ge",
    33: "As",
    34: "Se",
    35: "Br",
    36: "Kr",
    37: "Rb",
    38: "Sr",
    39: "Y",
    40: "Zr",
    41: "Nb",
    42: "Mo",
    43: "Tc",
    44: "Ru",
    45: "Rh",
    46: "Pd",
    47: "Ag",
    48: "Cd",
    49: "In",
    50: "Sn",
    51: "Sb",
    52: "Te",
    53: "I",
    54: "Xe",
    55: "Cs",
    56: "Ba",
    57: "La",
    58: "Ce",
    59: "Pr",
    60: "Nd",
    61: "Pm",
    62: "Sm",
    63: "Eu",
    64: "Gd",
    65: "Tb",
    66: "Dy",
    67: "Ho",
    68: "Er",
    69: "Tm",
    70: "Yb",
    71: "Lu",
    72: "Hf",
    73: "Ta",
    74: "W",
    75: "Re",
    76: "Os",
    77: "Ir",
    78: "Pt",
    79: "Au",
    80: "Hg",
    81: "Tl",
    82: "Pb",
    83: "Bi",
    84: "Po",
    85: "At",
    86: "Rn",
    87: "Fr",
    88: "Ra",
    89: "Ac",
    90: "Th",
    91: "Pa",
    92: "U",
}

ELEMENT_NAMES: dict[int, str] = {
    1: "Hydrogen",
    2: "Helium",
    3: "Lithium",
    4: "Beryllium",
    5: "Boron",
    6: "Carbon",
    7: "Nitrogen",
    8: "Oxygen",
    9: "Fluorine",
    10: "Neon",
    11: "Sodium",
    12: "Magnesium",
    13: "Aluminium",
    14: "Silicon",
    15: "Phosphorus",
    16: "Sulfur",
    17: "Chlorine",
    18: "Argon",
    19: "Potassium",
    20: "Calcium",
    21: "Scandium",
    22: "Titanium",
    23: "Vanadium",
    24: "Chromium",
    25: "Manganese",
    26: "Iron",
    27: "Cobalt",
    28: "Nickel",
    29: "Copper",
    30: "Zinc",
    31: "Gallium",
    32: "Germanium",
    33: "Arsenic",
    34: "Selenium",
    35: "Bromine",
    36: "Krypton",
    37: "Rubidium",
    38: "Strontium",
    39: "Yttrium",
    40: "Zirconium",
    41: "Niobium",
    42: "Molybdenum",
    43: "Technetium",
    44: "Ruthenium",
    45: "Rhodium",
    46: "Palladium",
    47: "Silver",
    48: "Cadmium",
    49: "Indium",
    50: "Tin",
    51: "Antimony",
    52: "Tellurium",
    53: "Iodine",
    54: "Xenon",
    55: "Caesium",
    56: "Barium",
    57: "Lanthanum",
    58: "Cerium",
    59: "Praseodymium",
    60: "Neodymium",
    61: "Promethium",
    62: "Samarium",
    63: "Europium",
    64: "Gadolinium",
    65: "Terbium",
    66: "Dysprosium",
    67: "Holmium",
    68: "Erbium",
    69: "Thulium",
    70: "Ytterbium",
    71: "Lutetium",
    72: "Hafnium",
    73: "Tantalum",
    74: "Tungsten",
    75: "Rhenium",
    76: "Osmium",
    77: "Iridium",
    78: "Platinum",
    79: "Gold",
    80: "Mercury",
    81: "Thallium",
    82: "Lead",
    83: "Bismuth",
    84: "Polonium",
    85: "Astatine",
    86: "Radon",
    87: "Francium",
    88: "Radium",
    89: "Actinium",
    90: "Thorium",
    91: "Protactinium",
    92: "Uranium",
}

ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")
ICRU_ID_PATTERN = re.compile(r"\(ICRU-(\d+)\)")


@dataclass(frozen=True)
class SourcePaths:
    source_dir: Path
    arrow_path: Path
    index_path: Path


@dataclass(frozen=True)
class BatchInfo:
    batch_index: int
    particle_z: int
    material_key: str
    row_count: int


@dataclass
class SourceInfo:
    paths: SourcePaths
    index_metadata: dict[str, Any]
    arrow_schema: pa.Schema
    projectiles: list[dict[str, Any]]
    materials: list[dict[str, Any]]
    batches: list[BatchInfo]
    row_counts: Counter[int]
    stopping_units: Counter[str]
    srim_versions: Counter[str]
    calc_dates: Counter[str]
    incomplete_material_keys: set[str]
    duplicate_material_keys: set[str]
    expected_row_count: int


def json_dump(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def find_source_paths(source_dir: Path) -> SourcePaths:
    arrow_paths = sorted(source_dir.glob("*.arrow"))
    index_paths = sorted(source_dir.glob("*.index.json"))
    if len(arrow_paths) != 1:
        raise ValueError(f"Expected exactly one .arrow file in {source_dir}, found {len(arrow_paths)}")
    if len(index_paths) != 1:
        raise ValueError(
            f"Expected exactly one .index.json file in {source_dir}, found {len(index_paths)}"
        )
    return SourcePaths(source_dir=source_dir, arrow_path=arrow_paths[0], index_path=index_paths[0])


def open_arrow_reader(arrow_path: Path) -> ipc.RecordBatchFileReader:
    source = pa.memory_map(str(arrow_path), "r")
    try:
        return ipc.open_file(source)
    except pa.ArrowInvalid:
        source.close()
        source = pa.memory_map(str(arrow_path), "r")
        return ipc.open_stream(source)


def slugify(value: str, fallback: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-_").lower()
    return slug or fallback


def unique_id(base_id: str, used_ids: set[str]) -> str:
    candidate = base_id
    suffix = 2
    while candidate in used_ids:
        candidate = f"{base_id}-{suffix}"
        suffix += 1
    if not ID_PATTERN.match(candidate):
        raise ValueError(f"Generated invalid webdedx ID: {candidate}")
    used_ids.add(candidate)
    return candidate


def material_key(target_type: str, target_id: str) -> str:
    return f"{target_type}:{target_id}"


def parse_stopping_unit(header_text: str | None) -> str:
    match = re.search(r"Stopping Units\s*=\s*([^\n]+)", header_text or "")
    return match.group(1).strip() if match else "unknown"


def parse_target_name(header_text: str | None, target_type: str, target_id: str) -> str:
    if target_type == "element":
        return ELEMENT_NAMES.get(int(target_id), ELEMENT_SYMBOLS.get(int(target_id), f"Z{target_id}"))

    patterns = [
        r"Disk File Name\s*=\s*SRIM Outputs\\Hydrogen in (.+?)\.txt\n",
        r"Disk File Name\s*=\s*Hydrogen in (.+?)\n",
    ]
    for pattern in patterns:
        match = re.search(pattern, header_text or "")
        if match:
            return match.group(1).strip()
    return target_id


def make_projectile(raw_metadata: dict[str, Any]) -> dict[str, Any]:
    atomic_number = int(raw_metadata["ion_z"])
    atomic_mass = float(raw_metadata["ion_mass_amu"])
    symbol = raw_metadata.get("ion_symbol") or ELEMENT_SYMBOLS.get(atomic_number, f"Z{atomic_number}")
    return {
        "id": f"z{atomic_number}",
        "name": ELEMENT_NAMES.get(atomic_number, symbol),
        "symbol": symbol,
        "Z": atomic_number,
        "A": max(1, int(round(atomic_mass))),
        "atomicMass": atomic_mass,
    }


def make_material(raw_metadata: dict[str, Any], target_type: str, target_id: str) -> dict[str, Any]:
    atomic_number = int(target_id) if target_type == "element" else None
    name = raw_metadata.get("target_name") or parse_target_name(
        raw_metadata.get("srim_header_text"), target_type, target_id
    )
    elements = json.loads(raw_metadata.get("elements_json") or "[]")
    material: dict[str, Any] = {
        "sourceKey": material_key(target_type, target_id),
        "sourceType": target_type,
        "sourceId": target_id,
        "name": name,
        "density": float(raw_metadata["target_density_g_cm3"]),
        "sourceComposition": elements,
    }
    if atomic_number is not None:
        material["atomicNumber"] = atomic_number
    return material


def collect_source_info(source_dir: Path) -> SourceInfo:
    paths = find_source_paths(source_dir)
    index_metadata = json.loads(paths.index_path.read_text())
    batches_metadata = index_metadata["batches"]
    arrow_reader = open_arrow_reader(paths.arrow_path)
    if arrow_reader.num_record_batches != len(batches_metadata):
        raise ValueError(
            "Arrow record-batch count does not match index metadata: "
            f"{arrow_reader.num_record_batches} != {len(batches_metadata)}"
        )

    projectiles_by_z: dict[int, dict[str, Any]] = {}
    materials_by_key: dict[str, dict[str, Any]] = {}
    batches: list[BatchInfo] = []
    row_counts: Counter[int] = Counter()
    stopping_units: Counter[str] = Counter()
    srim_versions: Counter[str] = Counter()
    calc_dates: Counter[str] = Counter()

    for batch_index, batch_metadata in enumerate(batches_metadata):
        raw_metadata = batch_metadata["metadata"]
        particle_z = int(batch_metadata["ion_z"])
        target_type = str(batch_metadata["target_type"])
        target_id = str(batch_metadata["target_id"])
        current_material_key = material_key(target_type, target_id)
        row_count = int(batch_metadata["n_records"])

        projectiles_by_z.setdefault(particle_z, make_projectile(raw_metadata))
        materials_by_key.setdefault(
            current_material_key, make_material(raw_metadata, target_type, target_id)
        )
        batches.append(
            BatchInfo(
                batch_index=batch_index,
                particle_z=particle_z,
                material_key=current_material_key,
                row_count=row_count,
            )
        )
        row_counts[row_count] += 1
        stopping_units[parse_stopping_unit(raw_metadata.get("srim_header_text"))] += 1
        srim_versions[str(raw_metadata.get("srim_version") or "unknown")] += 1
        calc_dates[str(raw_metadata.get("calc_date") or "unknown")] += 1

    expected_row_count = row_counts.most_common(1)[0][0]
    incomplete_material_keys = {
        batch.material_key for batch in batches if batch.row_count != expected_row_count
    }

    materials = sorted(
        materials_by_key.values(),
        key=lambda item: (
            item["sourceType"] != "element",
            int(item["sourceId"]) if item["sourceType"] == "element" else item["sourceId"],
        ),
    )
    assign_material_ids(materials)
    duplicate_material_keys = resolve_icru_duplicates(materials, incomplete_material_keys)

    return SourceInfo(
        paths=paths,
        index_metadata=index_metadata,
        arrow_schema=arrow_reader.schema,
        projectiles=[projectiles_by_z[atomic_number] for atomic_number in sorted(projectiles_by_z)],
        materials=materials,
        batches=batches,
        row_counts=row_counts,
        stopping_units=stopping_units,
        srim_versions=srim_versions,
        calc_dates=calc_dates,
        incomplete_material_keys=incomplete_material_keys,
        duplicate_material_keys=duplicate_material_keys,
        expected_row_count=expected_row_count,
    )


def assign_material_ids(materials: list[dict[str, Any]]) -> None:
    used_ids: set[str] = set()
    for material in materials:
        if material["sourceType"] == "element":
            atomic_number = int(material["atomicNumber"])
            symbol = ELEMENT_SYMBOLS.get(atomic_number, f"z{atomic_number}").lower()
            base_id = f"el-{atomic_number}-{symbol}"
        else:
            base_id = f"mat-{slugify(material['sourceId'], 'material')}"
        material["id"] = unique_id(base_id, used_ids)

        icru_match = ICRU_ID_PATTERN.search(material["name"])
        if material["sourceType"] == "compound" and icru_match:
            material["icruId"] = int(icru_match.group(1))


def resolve_icru_duplicates(
    materials: list[dict[str, Any]], incomplete_material_keys: set[str] | None = None
) -> set[str]:
    """Resolve groups of materials that share an icruId (modifies materials in-place).

    Same icruId + same density (rounded to 3 decimal places):
        True duplicates — keep the first entry, mark the rest for exclusion.

    Same icruId + different densities:
        Distinct formulations — remove icruId from ALL entries and append
        " ({density:.3f} g/cm³)" to each name so they remain distinguishable
        as external-only materials without merging into the built-in list.

    Returns the set of sourceKeys that should be excluded from the output.
    """
    icru_groups: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for material in materials:
        if "icruId" in material:
            icru_groups[material["icruId"]].append(material)

    duplicate_keys: set[str] = set()
    incomplete_keys = incomplete_material_keys or set()
    for group in icru_groups.values():
        if len(group) == 1:
            continue
        densities = [round(float(m.get("density") or 0.0), 3) for m in group]
        if len(set(densities)) == 1:
            # Prefer an exportable (complete) representative so complete copies are not
            # dropped when the first sorted entry for this ICRU group is incomplete.
            representative = next(
                (material for material in group if material["sourceKey"] not in incomplete_keys),
                group[0],
            )
            for material in group:
                if material is representative:
                    continue
                duplicate_keys.add(material["sourceKey"])
        else:
            for material in group:
                density = float(material.get("density") or 0.0)
                material["name"] = f"{material['name']} ({density:.3f} g/cm³)"
                del material["icruId"]
    return duplicate_keys


def kept_materials(source_info: SourceInfo) -> list[dict[str, Any]]:
    excluded = source_info.incomplete_material_keys | source_info.duplicate_material_keys
    return [
        material
        for material in source_info.materials
        if material["sourceKey"] not in excluded
    ]


def source_summary(source_info: SourceInfo) -> dict[str, Any]:
    schema_metadata = {
        key.decode(): value.decode() for key, value in (source_info.arrow_schema.metadata or {}).items()
    }
    kept = kept_materials(source_info)
    return {
        "sourceDir": str(source_info.paths.source_dir),
        "arrowPath": str(source_info.paths.arrow_path),
        "indexPath": str(source_info.paths.index_path),
        "indexSource": source_info.index_metadata.get("source"),
        "indexFormatVersion": source_info.index_metadata.get("format_version"),
        "arrowColumns": [
            {"name": field.name, "type": str(field.type)} for field in source_info.arrow_schema
        ],
        "arrowMetadata": schema_metadata,
        "srimVersions": dict(source_info.srim_versions),
        "calcDatesTop": dict(source_info.calc_dates.most_common(10)),
        "rowCounts": dict(source_info.row_counts),
        "expectedRowCount": source_info.expected_row_count,
        "incompleteMaterialCount": len(source_info.incomplete_material_keys),
        "incompleteMaterialKeys": sorted(source_info.incomplete_material_keys),
        "duplicateMaterialCount": len(source_info.duplicate_material_keys),
        "duplicateMaterialKeys": sorted(source_info.duplicate_material_keys),
        "projectileCount": len(source_info.projectiles),
        "projectileZMin": source_info.projectiles[0]["Z"],
        "projectileZMax": source_info.projectiles[-1]["Z"],
        "materialCount": len(source_info.materials),
        "keptMaterialCount": len(kept),
        "elementMaterialCount": sum(1 for material in source_info.materials if material["sourceType"] == "element"),
        "compoundMaterialCount": sum(
            1 for material in source_info.materials if material["sourceType"] == "compound"
        ),
        "stoppingUnitsRaw": dict(source_info.stopping_units),
        "storedUnits": {
            "energy_keV": "projectile kinetic energy in keV per table row",
            "Se": "electronic stopping in MeV/(mg/cm2)",
            "Sn": "nuclear stopping in MeV/(mg/cm2)",
            "stpTotal": "(Se + Sn) * 1000 converted to MeV cm2/g for webdedx",
            "range_A": "SRIM projected range in Angstrom; not exported as CSDA range",
            "long_strag_A": "longitudinal straggling in Angstrom; not exported",
            "lat_strag_A": "lateral straggling in Angstrom; not exported",
        },
    }


def write_source_inspection(source_info: SourceInfo, label: str, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    kept_keys = {material["sourceKey"] for material in kept_materials(source_info)}

    with (output_dir / f"{label}-projectiles.csv").open("w", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=["id", "name", "symbol", "Z", "A", "atomicMass"])
        writer.writeheader()
        writer.writerows(source_info.projectiles)

    with (output_dir / f"{label}-materials.csv").open("w", newline="") as csv_file:
        fieldnames = [
            "id",
            "sourceKey",
            "sourceType",
            "sourceId",
            "name",
            "density",
            "atomicNumber",
            "icruId",
            "keptForWebdedx",
            "isDuplicate",
            "sourceCompositionJson",
        ]
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for material in source_info.materials:
            writer.writerow(
                {
                    "id": material["id"],
                    "sourceKey": material["sourceKey"],
                    "sourceType": material["sourceType"],
                    "sourceId": material["sourceId"],
                    "name": material["name"],
                    "density": material["density"],
                    "atomicNumber": material.get("atomicNumber", ""),
                    "icruId": material.get("icruId", ""),
                    "keptForWebdedx": material["sourceKey"] in kept_keys,
                    "isDuplicate": material["sourceKey"] in source_info.duplicate_material_keys,
                    "sourceCompositionJson": json.dumps(
                        material["sourceComposition"], separators=(",", ":")
                    ),
                }
            )

    summary = source_summary(source_info)
    summary["projectileCsv"] = f"{label}-projectiles.csv"
    summary["materialCsv"] = f"{label}-materials.csv"
    json_dump(output_dir / f"{label}-summary.json", summary)
    write_inspection_readme(output_dir)


def write_inspection_readme(output_dir: Path) -> None:
    summary_paths = sorted(output_dir.glob("*-summary.json"))
    lines = ["# SRIM Reference Inspection", ""]
    for summary_path in summary_paths:
        label = summary_path.name.removesuffix("-summary.json")
        summary = json.loads(summary_path.read_text())
        lines.extend(
            [
                f"## {label}",
                "",
                f"- Source: `{summary['indexSource']}`; SRIM versions: `{summary['srimVersions']}`",
                f"- Projectiles: {summary['projectileCount']} elemental projectiles, "
                f"Z={summary['projectileZMin']}..{summary['projectileZMax']} "
                f"(`{summary['projectileCsv']}`)",
                f"- Materials: {summary['materialCount']} total; "
                f"{summary['keptMaterialCount']} kept for rectangular `.webdedx` export, "
                f"{summary['incompleteMaterialCount']} dropped due to incomplete batches, "
                f"{summary['duplicateMaterialCount']} dropped as duplicate same-density ICRU entries "
                f"(`{summary['materialCsv']}`)",
                f"- Dropped incomplete material keys: `{summary['incompleteMaterialKeys']}`",
                f"- Dropped duplicate material keys: `{summary['duplicateMaterialKeys']}`",
                f"- Raw energy: `energy_keV`, converted to `MeV` in `.webdedx` output",
                f"- Raw stopping: `Se`, `Sn` in `{summary['stoppingUnitsRaw']}`; "
                "exported as `(Se + Sn) * 1000` in `MeV\u00b7cm\u00b2/g`",
                "- Raw `range_A` is SRIM projected range, so it is not exported as `csda_range`.",
                "",
            ]
        )
    (output_dir / "README.md").write_text("\n".join(lines))


def program_defaults(label: str, source_info: SourceInfo) -> tuple[str, str, str]:
    srim_version = next(iter(source_info.srim_versions.keys()))
    source_name = str(source_info.index_metadata.get("source") or label)
    if source_name == "srim-gui":
        return "srim-gui-2013", "SRIM GUI", srim_version
    if source_name == "srmodule":
        return "srmodule-2012", "SR Module", srim_version
    version_slug = slugify(srim_version, "srim")
    return slugify(f"{label}-{version_slug}", "srim"), source_name, srim_version


def material_for_webdedx(material: dict[str, Any]) -> dict[str, Any]:
    webdedx_material = {
        "id": material["id"],
        "name": material["name"],
        "density": material["density"],
    }
    if "atomicNumber" in material:
        webdedx_material["atomicNumber"] = material["atomicNumber"]
    if "icruId" in material:
        webdedx_material["icruId"] = material["icruId"]
    return webdedx_material


def build_stp_array(
    source_info: SourceInfo,
    selected_materials: list[dict[str, Any]],
) -> tuple[np.ndarray, np.ndarray]:
    arrow_reader = open_arrow_reader(source_info.paths.arrow_path)
    particle_index_by_z = {
        int(projectile["Z"]): projectile_index
        for projectile_index, projectile in enumerate(source_info.projectiles)
    }
    material_index_by_key = {
        material["sourceKey"]: material_index for material_index, material in enumerate(selected_materials)
    }

    stp = np.empty(
        (len(source_info.projectiles), len(selected_materials), source_info.expected_row_count),
        dtype=np.float32,
    )
    filled = np.zeros((len(source_info.projectiles), len(selected_materials)), dtype=bool)
    reference_energy_keV: np.ndarray | None = None

    for batch in source_info.batches:
        material_index = material_index_by_key.get(batch.material_key)
        if material_index is None:
            continue
        if batch.row_count != source_info.expected_row_count:
            raise ValueError(f"Incomplete batch reached converter unexpectedly: {batch}")

        record_batch = arrow_reader.get_batch(batch.batch_index)
        energy_keV = np.asarray(record_batch.column("energy_keV").to_numpy(zero_copy_only=False))
        if reference_energy_keV is None:
            reference_energy_keV = energy_keV.astype(np.float64, copy=True)
        elif not np.array_equal(reference_energy_keV, energy_keV):
            raise ValueError(
                "Energy grid differs in complete batch "
                f"{batch.batch_index} for material {batch.material_key}, particle Z={batch.particle_z}"
            )

        electronic = np.asarray(record_batch.column("Se").to_numpy(zero_copy_only=False))
        nuclear = np.asarray(record_batch.column("Sn").to_numpy(zero_copy_only=False))
        particle_index = particle_index_by_z[batch.particle_z]
        stp[particle_index, material_index, :] = ((electronic + nuclear) * 1000.0).astype(np.float32)
        filled[particle_index, material_index] = True

    if reference_energy_keV is None:
        raise ValueError("No complete batches available for conversion")
    missing = np.argwhere(~filled)
    if missing.size:
        raise ValueError(f"Missing {len(missing)} projectile/material tables after conversion")
    if not np.all(np.isfinite(stp)):
        raise ValueError("Converted stopping-power array contains NaN or infinity")
    if not np.all(stp > 0):
        raise ValueError("Converted stopping-power array contains non-positive values")
    if not np.all(np.diff(reference_energy_keV) > 0):
        raise ValueError("Energy grid is not strictly increasing")

    return stp, reference_energy_keV * 0.001


def zarr_group_metadata(attributes: dict[str, Any]) -> dict[str, Any]:
    return {"attributes": attributes, "zarr_format": 3, "node_type": "group"}


def zarr_array_metadata(shape: tuple[int, int, int]) -> dict[str, Any]:
    chunk_shape = [1, shape[1], shape[2]]
    return {
        "shape": list(shape),
        "data_type": "float32",
        "chunk_grid": {"name": "regular", "configuration": {"chunk_shape": chunk_shape}},
        "chunk_key_encoding": {"name": "default", "configuration": {"separator": "/"}},
        "fill_value": 0.0,
        "codecs": [
            {
                "name": "sharding_indexed",
                "configuration": {
                    "chunk_shape": chunk_shape,
                    "codecs": [
                        {"name": "bytes", "configuration": {"endian": "little"}},
                        {"name": "numcodecs.lz4", "configuration": {"acceleration": 1}},
                    ],
                    "index_codecs": [
                        {"name": "bytes", "configuration": {"endian": "little"}},
                        {"name": "crc32c"},
                    ],
                    "index_location": "end",
                },
            }
        ],
        "attributes": {},
        "dimension_names": ["particle", "material", "energy"],
        "zarr_format": 3,
        "node_type": "array",
        "storage_transformers": [],
    }


def write_lz4_shards(stp: np.ndarray, chunks_dir: Path) -> list[int]:
    codec = numcodecs.LZ4(acceleration=1)
    shard_sizes: list[int] = []
    for particle_index in range(stp.shape[0]):
        shard_dir = chunks_dir / str(particle_index) / "0"
        shard_dir.mkdir(parents=True, exist_ok=True)
        particle_data = np.ascontiguousarray(stp[particle_index : particle_index + 1, :, :], dtype="<f4")
        payload = bytes(codec.encode(particle_data.tobytes(order="C")))
        shard_index = struct.pack("<QQ", 0, len(payload))
        checksum = struct.pack("<I", google_crc32c.value(shard_index))
        shard_bytes = payload + shard_index + checksum
        (shard_dir / "0").write_bytes(shard_bytes)
        shard_sizes.append(len(shard_bytes))
    return shard_sizes


def output_size(path: Path) -> tuple[int, int]:
    file_count = 0
    total_bytes = 0
    for child in path.rglob("*"):
        if child.is_file():
            file_count += 1
            total_bytes += child.stat().st_size
    return file_count, total_bytes


def write_webdedx_store(
    source_info: SourceInfo,
    label: str,
    output_path: Path,
    force: bool,
    summary_dir: Path | None,
) -> dict[str, Any]:
    selected_materials = kept_materials(source_info)
    if output_path.exists():
        if not force:
            raise ValueError(f"Output already exists: {output_path}. Pass --force to replace it.")
        shutil.rmtree(output_path)
    output_path.mkdir(parents=True)

    program_id, program_name, program_version = program_defaults(label, source_info)
    stp, energy_grid_mev = build_stp_array(source_info, selected_materials)

    excluded_materials = [
        {
            "sourceKey": material["sourceKey"],
            "name": material["name"],
            "density": material["density"],
        }
        for material in source_info.materials
        if material["sourceKey"] in source_info.incomplete_material_keys
    ]
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    root_attributes = {
        "webdedx.magic": "webdedx-extdata",
        "webdedx.formatVersion": 1,
        "webdedx.metadata": {
            "name": f"{program_name} reference stopping-power tables",
            "version": program_version,
            "author": "SRIM / websrim reference export",
            "description": (
                "Converted from websrim Arrow reference output. SRIM Se and Sn columns are "
                "summed and converted to mass stopping power; SRIM projected range is not "
                "exported as CSDA range."
            ),
            "license": "unknown",
            "generatedBy": "scripts/srim_reference_to_webdedx.py",
            "generatedAt": generated_at,
        },
        "webdedx.units": {
            "energy": "MeV",
            "stoppingPower": "MeV\u00b7cm\u00b2/g",
        },
        "webdedx.energyGrid": [float(value) for value in energy_grid_mev.tolist()],
        "webdedx.programs": [
            {"id": program_id, "name": program_name, "version": program_version}
        ],
        "webdedx.particles": source_info.projectiles,
        "webdedx.materials": [material_for_webdedx(material) for material in selected_materials],
        "webdedx.srimConversion": {
            "label": label,
            "sourceDir": str(source_info.paths.source_dir),
            "source": source_info.index_metadata.get("source"),
            "rawUnits": source_summary(source_info)["storedUnits"],
            "originalMaterialCount": len(source_info.materials),
            "keptMaterialCount": len(selected_materials),
            "droppedIncompleteMaterialCount": len(excluded_materials),
            "droppedIncompleteMaterials": excluded_materials,
            "droppedDuplicateMaterialCount": len(source_info.duplicate_material_keys),
            "csdaRangeExported": False,
            "csdaRangeReason": "SRIM range_A is projected range, not CSDA range.",
            "stpConversion": "(Se + Sn) * 1000 from MeV/(mg/cm2) to MeV cm2/g",
            "energyConversion": "energy_keV * 0.001 to MeV",
        },
    }

    json_dump(output_path / "zarr.json", zarr_group_metadata(root_attributes))
    json_dump(output_path / program_id / "zarr.json", zarr_group_metadata({}))
    json_dump(output_path / program_id / "stp" / "zarr.json", zarr_array_metadata(stp.shape))
    shard_sizes = write_lz4_shards(stp, output_path / program_id / "stp" / "c")

    file_count, total_bytes = output_size(output_path)
    conversion_summary = {
        "outputPath": str(output_path),
        "programId": program_id,
        "programName": program_name,
        "programVersion": program_version,
        "shape": list(stp.shape),
        "energyMinMeV": float(energy_grid_mev[0]),
        "energyMaxMeV": float(energy_grid_mev[-1]),
        "stpMinMeVCm2PerG": float(np.min(stp)),
        "stpMaxMeVCm2PerG": float(np.max(stp)),
        "particles": len(source_info.projectiles),
        "materials": len(selected_materials),
        "droppedIncompleteMaterials": len(excluded_materials),
        "droppedDuplicateMaterials": len(source_info.duplicate_material_keys),
        "fileCount": file_count,
        "totalBytes": total_bytes,
        "shardSizeMinBytes": min(shard_sizes),
        "shardSizeMaxBytes": max(shard_sizes),
        "codec": "numcodecs.lz4",
        "hasCsdaRange": False,
    }
    if summary_dir is not None:
        summary_dir.mkdir(parents=True, exist_ok=True)
        json_dump(summary_dir / f"{label}-conversion-summary.json", conversion_summary)
    return conversion_summary


def inspect_webdedx(path: Path) -> dict[str, Any]:
    import zarr

    root = zarr.open_group(path, mode="r")
    attributes = dict(root.attrs)
    if attributes.get("webdedx.magic") != "webdedx-extdata":
        raise ValueError("Not a webdedx external-data store")
    programs = attributes["webdedx.programs"]
    particles = attributes["webdedx.particles"]
    materials = attributes["webdedx.materials"]
    program_id = programs[0]["id"]
    stp = root[f"{program_id}/stp"]
    sample = np.asarray(stp[0, :, :])
    file_count, total_bytes = output_size(path)
    return {
        "path": str(path),
        "name": attributes["webdedx.metadata"]["name"],
        "programs": programs,
        "particleCount": len(particles),
        "materialCount": len(materials),
        "energyCount": len(attributes["webdedx.energyGrid"]),
        "energyMinMeV": attributes["webdedx.energyGrid"][0],
        "energyMaxMeV": attributes["webdedx.energyGrid"][-1],
        "shape": list(stp.shape),
        "dtype": str(stp.dtype),
        "sampleParticle0StpMin": float(np.min(sample)),
        "sampleParticle0StpMax": float(np.max(sample)),
        "hasCsdaRange": f"{program_id}/csda_range" in root,
        "fileCount": file_count,
        "totalBytes": total_bytes,
    }


def inspect_source_command(args: argparse.Namespace) -> None:
    source_info = collect_source_info(args.source_dir.expanduser())
    write_source_inspection(source_info, args.label, args.output_dir)
    print(json.dumps(source_summary(source_info), indent=2, ensure_ascii=False))


def convert_command(args: argparse.Namespace) -> None:
    source_info = collect_source_info(args.source_dir.expanduser())
    summary = write_webdedx_store(
        source_info=source_info,
        label=args.label,
        output_path=args.output,
        force=args.force,
        summary_dir=args.summary_dir,
    )
    print(json.dumps(summary, indent=2, ensure_ascii=False))


def inspect_webdedx_command(args: argparse.Namespace) -> None:
    print(json.dumps(inspect_webdedx(args.path), indent=2, ensure_ascii=False))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(required=True)

    inspect_source = subparsers.add_parser("inspect-source", help="Inspect a websrim Arrow export")
    inspect_source.add_argument("source_dir", type=Path)
    inspect_source.add_argument("--label", required=True)
    inspect_source.add_argument("--output-dir", type=Path, default=Path("data/srim-reference-inspection"))
    inspect_source.set_defaults(func=inspect_source_command)

    convert = subparsers.add_parser("convert", help="Convert a websrim Arrow export to .webdedx")
    convert.add_argument("source_dir", type=Path)
    convert.add_argument("--label", required=True)
    convert.add_argument("--output", type=Path, required=True)
    convert.add_argument("--summary-dir", type=Path, default=Path("data/srim-reference-conversion"))
    convert.add_argument("--force", action="store_true")
    convert.set_defaults(func=convert_command)

    inspect_store = subparsers.add_parser("inspect-webdedx", help="Inspect a generated .webdedx store")
    inspect_store.add_argument("path", type=Path)
    inspect_store.set_defaults(func=inspect_webdedx_command)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except Exception as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
