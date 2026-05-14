"""Unit tests for ICRU deduplication logic in srim_reference_to_webdedx.py."""

import json

from srim_reference_to_webdedx import (
    assign_material_ids,
    resolve_icru_duplicates,
    write_inspection_readme,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compound(source_id: str, name: str, density: float) -> dict:
    return {
        "sourceKey": f"compound:{source_id}",
        "sourceType": "compound",
        "sourceId": source_id,
        "name": name,
        "density": density,
        "sourceComposition": [],
    }


def _element(z: int, name: str, density: float) -> dict:
    return {
        "sourceKey": f"element:{z}",
        "sourceType": "element",
        "sourceId": str(z),
        "name": name,
        "density": density,
        "atomicNumber": z,
        "sourceComposition": [],
    }


# ---------------------------------------------------------------------------
# assign_material_ids
# ---------------------------------------------------------------------------


class TestAssignMaterialIds:
    def test_assigns_icru_id_single_entry(self):
        mats = [_compound("276a", "Water Liquid (ICRU-276)", 1.0)]
        assign_material_ids(mats)
        assert mats[0]["icruId"] == 276

    def test_assigns_icru_id_to_all_copies(self):
        """Even with 5 identical-name copies every one gets icruId — no uniqueness gate."""
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276c", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276d", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276e", "Water_liquid (ICRU-276)", 1.0),
        ]
        assign_material_ids(mats)
        for m in mats:
            assert m.get("icruId") == 276, f"icruId missing on {m['name']}"

    def test_no_icru_id_for_non_icru_compound(self):
        mats = [_compound("decene", "1 Decene", 0.74)]
        assign_material_ids(mats)
        assert "icruId" not in mats[0]

    def test_element_gets_no_icru_id(self):
        mats = [_element(14, "Silicon", 2.329)]
        assign_material_ids(mats)
        assert "icruId" not in mats[0]
        assert "atomicNumber" in mats[0]

    def test_generates_unique_ids(self):
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water_Liquid (ICRU-276)", 1.0),
        ]
        assign_material_ids(mats)
        ids = [m["id"] for m in mats]
        assert len(set(ids)) == len(ids), "generated IDs must be unique"

    def test_icru_id_parsed_correctly(self):
        mats = [_compound("99a", "A-150 Tissue-Equiv. Plastic (ICRU-099)", 1.127)]
        assign_material_ids(mats)
        assert mats[0]["icruId"] == 99

    def test_element_id_uses_atomic_number_and_symbol(self):
        mats = [_element(6, "Carbon", 2.253)]
        assign_material_ids(mats)
        assert mats[0]["id"].startswith("el-6-c")


# ---------------------------------------------------------------------------
# resolve_icru_duplicates
# ---------------------------------------------------------------------------


class TestResolveIcruDuplicates:
    def test_single_entry_unchanged(self):
        mats = [_compound("276a", "Water Liquid (ICRU-276)", 1.0)]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        assert dup_keys == set()
        assert mats[0].get("icruId") == 276
        assert "g/cm³" not in mats[0]["name"]

    def test_same_density_dedup_marks_all_but_first(self):
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276c", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276d", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276e", "Water_liquid (ICRU-276)", 1.0),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        assert len(dup_keys) == 4
        assert mats[0]["sourceKey"] not in dup_keys

    def test_same_density_dedup_icru_id_preserved_on_kept(self):
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water_Liquid (ICRU-276)", 1.0),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        kept = [m for m in mats if m["sourceKey"] not in dup_keys]
        assert len(kept) == 1
        assert kept[0].get("icruId") == 276

    def test_different_density_no_icru_id(self):
        """Lucite: same ICRU but different densities → icruId removed from both."""
        mats = [
            _compound("223a", "Lucite (ICRU-223)", 1.2),
            _compound("223b", "Polymethyl Methacrylate,Lucite,Perspex(ICRU-223)", 1.19),
        ]
        assign_material_ids(mats)
        resolve_icru_duplicates(mats)
        for m in mats:
            assert "icruId" not in m, f"icruId should be removed from {m['name']}"

    def test_different_density_not_marked_duplicate(self):
        mats = [
            _compound("223a", "Lucite (ICRU-223)", 1.2),
            _compound("223b", "Polymethyl Methacrylate,Lucite,Perspex(ICRU-223)", 1.19),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        assert dup_keys == set()

    def test_different_density_name_appended(self):
        mats = [
            _compound("223a", "Lucite (ICRU-223)", 1.2),
            _compound("223b", "Lucite (ICRU-223)", 1.19),
        ]
        assign_material_ids(mats)
        resolve_icru_duplicates(mats)
        assert mats[0]["name"] == "Lucite (ICRU-223) (1.200 g/cm³)"
        assert mats[1]["name"] == "Lucite (ICRU-223) (1.190 g/cm³)"

    def test_density_rounding_same_treated_as_identical(self):
        """Two entries with densities differing by <0.001 are treated as same."""
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water_Liquid (ICRU-276)", 1.0001),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        assert len(dup_keys) == 1

    def test_same_density_prefers_complete_representative(self):
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water_Liquid (ICRU-276)", 1.0),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats, {"compound:276a"})
        assert dup_keys == {"compound:276a"}

    def test_density_rounding_threshold_triggers_variant(self):
        """Two entries with densities differing by >=0.001 are distinct formulations."""
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water Liquid (ICRU-276)", 1.001),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        assert dup_keys == set()
        for m in mats:
            assert "icruId" not in m
            assert "g/cm³" in m["name"]

    def test_element_materials_unaffected(self):
        mats = [_element(14, "Silicon", 2.329)]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        assert dup_keys == set()

    def test_independent_icru_groups_handled_separately(self):
        """Water duplicates and a separate Mylar variant are resolved independently."""
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276c", "Water_Liquid (ICRU-276)", 1.0),
            _compound("222a", "Mylar (ICRU-222)", 1.397),
            _compound("222b", "Mylar, Melinex (ICRU-222)", 1.4),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        # Water: 2 duplicates marked, Mylar: 0 (different densities → variant treatment)
        water_dups = {k for k in dup_keys if "276" in k}
        mylar_dups = {k for k in dup_keys if "222" in k}
        assert len(water_dups) == 2
        assert len(mylar_dups) == 0
        # Mylar entries should have icruId removed
        mylar = [m for m in mats if "Mylar" in m["name"] or "Melinex" in m["name"]]
        for m in mylar:
            assert "icruId" not in m
            assert "g/cm³" in m["name"]


# ---------------------------------------------------------------------------
# Integration: full pipeline
# ---------------------------------------------------------------------------


class TestFullPipeline:
    def test_five_water_copies_yields_one_with_icru_id(self):
        mats = [
            _compound("276a", "Water Liquid (ICRU-276)", 1.0),
            _compound("276b", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276c", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276d", "Water_Liquid (ICRU-276)", 1.0),
            _compound("276e", "Water_liquid (ICRU-276)", 1.0),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        kept = [m for m in mats if m["sourceKey"] not in dup_keys]
        assert len(kept) == 1
        assert kept[0].get("icruId") == 276

    def test_glycerol_density_variants_both_kept_without_icru_id(self):
        mats = [
            _compound("469a", "Glycerol (ICRU-469)", 1.475),
            _compound("469b", "Glycerol (ICRU-469)", 1.261),
        ]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        kept = [m for m in mats if m["sourceKey"] not in dup_keys]
        assert len(kept) == 2
        for m in kept:
            assert "icruId" not in m
            assert "g/cm³" in m["name"]

    def test_non_icru_compounds_pass_through(self):
        mats = [_compound("decene", "1 Decene", 0.74)]
        assign_material_ids(mats)
        dup_keys = resolve_icru_duplicates(mats)
        assert dup_keys == set()
        assert "icruId" not in mats[0]
        assert "g/cm³" not in mats[0]["name"]


def test_write_inspection_readme_reports_duplicate_drops(tmp_path):
    summary_path = tmp_path / "demo-summary.json"
    summary_path.write_text(
        json.dumps(
            {
                "indexSource": "srim-reference",
                "srimVersions": {"SRIM-2013": 1},
                "projectileCount": 2,
                "projectileZMin": 1,
                "projectileZMax": 2,
                "projectileCsv": "demo-projectiles.csv",
                "materialCount": 3,
                "keptMaterialCount": 1,
                "incompleteMaterialCount": 1,
                "incompleteMaterialKeys": ["compound:broken"],
                "duplicateMaterialCount": 1,
                "duplicateMaterialKeys": ["compound:dup"],
                "materialCsv": "demo-materials.csv",
                "stoppingUnitsRaw": {"MeV/(mg/cm2)": 1},
            }
        )
    )
    write_inspection_readme(tmp_path)
    readme = (tmp_path / "README.md").read_text()
    assert "1 dropped as duplicate same-density ICRU entries" in readme
    assert "Dropped duplicate material keys: `['compound:dup']`" in readme
