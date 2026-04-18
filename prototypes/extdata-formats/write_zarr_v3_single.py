"""Write synthetic dataset to Zarr v3 — single shard variant.

shards=(287, 379, 165) → one shard file for the whole array.
chunks=(1, 379, 165)   → per-ion inner chunks.
Output: data/srim_synthetic_single.zarr/
"""

import os
import zarr

from generate_data import (
    PARTICLES, MATERIALS, ENERGIES,
    compute_stp_array, compute_csda_range_array,
)

OUT_PATH = "data/srim_synthetic_single.zarr"
PROGRAM = "srim-2013"


def _array_kwargs():
    return dict(
        shape=(287, 379, 165),
        dtype="float32",
        shards=(287, 379, 165),
        chunks=(1, 379, 165),
        compressors=zarr.codecs.BloscCodec(
            cname="zstd", clevel=5,
            shuffle=zarr.codecs.BloscShuffle.bitshuffle,
        ),
        fill_value=float("nan"),
    )


def main():
    os.makedirs("data", exist_ok=True)

    print("Computing STP …", flush=True)
    stp = compute_stp_array()
    print("Computing CSDA range …", flush=True)
    csda = compute_csda_range_array(stp)

    print(f"Writing {OUT_PATH} …", flush=True)
    root = zarr.open_group(OUT_PATH, mode="w")
    root.attrs.update({
        "webdedx.formatVersion": "1",
        "webdedx.programs": [PROGRAM],
        "webdedx.particles": [
            {"id": p["id"], "name": p["name"], "Z": p["Z"], "A": p["A"]}
            for p in PARTICLES
        ],
        "webdedx.materials": [
            {
                "id": m["id"],
                "name": m["name"],
                "source": m.get("source", "custom"),
                "density_g_cm3": m["density_g_cm3"],
                **({"libdedx_id": m["libdedx_id"]} if "libdedx_id" in m else {}),
            }
            for m in MATERIALS
        ],
        "webdedx.energyGrid_MeV_u": ENERGIES.tolist(),
    })

    grp = root.require_group(PROGRAM)
    for name, data in [("stp", stp), ("csda_range", csda)]:
        print(f"  Writing {name} …", flush=True)
        arr = grp.create_array(name=name, **_array_kwargs())
        arr[:] = data

    # Report sizes
    total = sum(
        os.path.getsize(os.path.join(dp, f))
        for dp, _, files in os.walk(OUT_PATH)
        for f in files
    )
    print(f"Done. {OUT_PATH} — {total/1e6:.1f} MB total")
    shard_stp = os.path.join(OUT_PATH, PROGRAM, "stp", "c", "0", "0", "0")
    if os.path.exists(shard_stp):
        print(f"  stp shard  : {os.path.getsize(shard_stp)/1e6:.2f} MB")
    shard_csda = os.path.join(OUT_PATH, PROGRAM, "csda_range", "c", "0", "0", "0")
    if os.path.exists(shard_csda):
        print(f"  csda shard : {os.path.getsize(shard_csda)/1e6:.2f} MB")


if __name__ == "__main__":
    main()
