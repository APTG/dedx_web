"""Write synthetic dataset to Apache Parquet format.

Output: data/srim_synthetic.webdedx.parquet
One row group per particle (287 row groups), 62,535 rows each (379 × 165).
Columns: program, particle, material, energy, stopping_power, csda_range
"""

import json
import os
import pyarrow as pa
import pyarrow.parquet as pq
import numpy as np

from generate_data import (
    PARTICLES, MATERIALS, ENERGIES,
    compute_stp_array, compute_csda_range_array,
)

OUT_PATH = "data/srim_synthetic.webdedx.parquet"
PROGRAM = "srim-2013"


def main():
    os.makedirs("data", exist_ok=True)

    print("Computing STP …", flush=True)
    stp = compute_stp_array()       # (287, 379, 165) float32
    print("Computing CSDA range …", flush=True)
    csda = compute_csda_range_array(stp)  # (287, 379, 165) float32

    n_mat = len(MATERIALS)
    n_e   = len(ENERGIES)

    # File-level metadata
    file_meta = {
        "webdedx.formatVersion": "1",
        "webdedx.program": PROGRAM,
        "webdedx.particles": json.dumps([
            {"id": p["id"], "name": p["name"], "Z": p["Z"], "A": p["A"]}
            for p in PARTICLES
        ]),
        "webdedx.materials": json.dumps([
            {
                "id": m["id"],
                "name": m["name"],
                "source": m.get("source", "custom"),
                "density_g_cm3": m["density_g_cm3"],
                **({"libdedx_id": m["libdedx_id"]} if "libdedx_id" in m else {}),
                **({"composition": m["composition"]} if "composition" in m else {}),
            }
            for m in MATERIALS
        ]),
        "webdedx.energyGrid_MeV_u": "null",  # energy is a column
    }

    schema = pa.schema([
        pa.field("program",        pa.string()),
        pa.field("particle",       pa.string()),
        pa.field("material",       pa.string()),
        pa.field("energy",         pa.float64()),
        pa.field("stopping_power", pa.float64()),
        pa.field("csda_range",     pa.float64()),
    ], metadata={k: v for k, v in file_meta.items()})

    print(f"Writing {len(PARTICLES)} row groups to {OUT_PATH} …", flush=True)
    writer = pq.ParquetWriter(
        OUT_PATH, schema,
        compression="zstd",
        compression_level=5,
        use_dictionary=["program", "particle", "material"],
    )

    mat_ids   = [m["id"]   for m in MATERIALS]
    mat_names = [m["name"] for m in MATERIALS]

    for pi, particle in enumerate(PARTICLES):
        # Tile: each material × each energy
        prog_col     = pa.array([PROGRAM]           * (n_mat * n_e), type=pa.string())
        part_col     = pa.array([particle["id"]]    * (n_mat * n_e), type=pa.string())
        # Repeat material id for each energy point: [m0]*165, [m1]*165, ...
        mat_col      = pa.array(
            [mid for mid in mat_ids for _ in range(n_e)], type=pa.string()
        )
        energy_col   = pa.array(
            np.tile(ENERGIES, n_mat).tolist(), type=pa.float64()
        )
        stp_col      = pa.array(
            stp[pi].reshape(-1).astype(np.float64).tolist(), type=pa.float64()
        )
        csda_col     = pa.array(
            csda[pi].reshape(-1).astype(np.float64).tolist(), type=pa.float64()
        )

        batch = pa.record_batch(
            [prog_col, part_col, mat_col, energy_col, stp_col, csda_col],
            schema=schema,
        )
        writer.write_batch(batch)

        if (pi + 1) % 50 == 0 or pi == len(PARTICLES) - 1:
            print(f"  {pi+1}/{len(PARTICLES)} particles written", flush=True)

    writer.close()
    size_mb = os.path.getsize(OUT_PATH) / 1e6
    print(f"Done. {OUT_PATH} — {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
