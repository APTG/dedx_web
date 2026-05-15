#!/usr/bin/env node

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = process.argv[2];

if (!outputDir) {
  console.error("Usage: node <path-to>/create-synthetic-webdedx-fixture.mjs <output-dir>");
  process.exit(1);
}

const programId = "srim-2013-gui";
const energyGrid = [1, 10, 100];
const stpValues = [10, 5, 2];

await rm(outputDir, { force: true, recursive: true });
await mkdir(path.join(outputDir, programId, "stp", "c", "0", "0"), { recursive: true });

await writeJson(path.join(outputDir, "zarr.json"), {
  zarr_format: 3,
  node_type: "group",
  attributes: {
    "webdedx.magic": "webdedx-extdata",
    "webdedx.formatVersion": 1,
    "webdedx.metadata": {
      name: "Synthetic SRIM Test Store",
      version: "1.0.0",
      author: "webdedx CI",
      description: "Tiny deterministic .webdedx store for runner-hosted S3 E2E tests",
      generatedBy: "create-synthetic-webdedx-fixture.mjs",
    },
    "webdedx.units": {
      energy: "MeV",
      stoppingPower: "MeV·cm²/g",
    },
    "webdedx.energyGrid": energyGrid,
    "webdedx.programs": [{ id: programId, name: "Synthetic SRIM 2013", version: "ci" }],
    "webdedx.particles": [
      {
        id: "p",
        name: "Proton",
        symbol: "H",
        Z: 1,
        A: 1,
        atomicMass: 1.007276466621,
        pdgCode: 2212,
      },
    ],
    "webdedx.materials": [
      {
        id: "water",
        name: "Water",
        density: 1,
        phase: "liquid",
        icruId: 276,
      },
    ],
  },
});

await writeJson(path.join(outputDir, programId, "zarr.json"), {
  zarr_format: 3,
  node_type: "group",
  attributes: {},
});

await writeJson(path.join(outputDir, programId, "stp", "zarr.json"), {
  zarr_format: 3,
  node_type: "array",
  shape: [1, 1, energyGrid.length],
  data_type: "float32",
  chunk_grid: { name: "regular", configuration: { chunk_shape: [1, 1, energyGrid.length] } },
  chunk_key_encoding: { name: "default", separator: "/" },
  fill_value: 0,
  codecs: [{ name: "bytes", configuration: { endian: "little" } }],
  attributes: {},
});

const chunk = Buffer.alloc(stpValues.length * Float32Array.BYTES_PER_ELEMENT);
stpValues.forEach((value, index) => {
  const byteOffset = index * Float32Array.BYTES_PER_ELEMENT;
  chunk.writeFloatLE(value, byteOffset);
});
await writeFile(path.join(outputDir, programId, "stp", "c", "0", "0", "0"), chunk);

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
