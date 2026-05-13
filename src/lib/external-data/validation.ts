import type {
  ExternalStoreMetadata,
  ExternalProgramEntry,
  ExternalParticleEntry,
  ExternalMaterialEntry,
  ExternalEnergyUnit,
  ExternalStpUnit,
  ExternalCsdaUnit,
} from "./schema.js";
import { ExternalDataError } from "./errors.js";
import { isExternalEntityLocalId } from "./ids.js";

const SUPPORTED_FORMAT_VERSION = 1;

const VALID_ENERGY_UNITS = new Set<ExternalEnergyUnit>([
  "MeV",
  "MeV/nucl",
  "MeV/u",
  "keV",
  "GeV",
]);
const VALID_STP_UNITS = new Set<ExternalStpUnit>(["MeV·cm²/g", "MeV/cm", "keV/µm"]);
const VALID_CSDA_UNITS = new Set<ExternalCsdaUnit>(["g/cm²", "cm"]);

const VALID_PHASE = new Set(["liquid", "solid", "gas"]);

const MAX_PROGRAMS = 100;
const MAX_PARTICLES = 1000;
const MAX_MATERIALS = 10000;
const MAX_ENERGY_POINTS = 10000;

/**
 * Validate the raw attributes object from a webdedx store's root zarr.json.
 * Throws ExternalDataError on any violation.
 * Returns a fully validated ExternalStoreMetadata on success.
 */
export function validateRootAttrs(
  attrs: Record<string, unknown>,
  label: string,
  url: string,
): ExternalStoreMetadata {
  const fail = (msg: string, code: ExternalDataError["code"] = "validation-error"): never => {
    throw new ExternalDataError(code, msg);
  };

  // Magic
  if (attrs["webdedx.magic"] !== "webdedx-extdata") {
    fail("Invalid webdedx store: webdedx.magic must be 'webdedx-extdata'", "invalid-format");
  }

  // Format version
  const fv = attrs["webdedx.formatVersion"];
  if (typeof fv !== "number" || !Number.isInteger(fv) || fv < 1) {
    fail("webdedx.formatVersion must be a positive integer");
  }
  if (fv > SUPPORTED_FORMAT_VERSION) {
    fail(
      `Unsupported webdedx.formatVersion ${fv} (max supported: ${SUPPORTED_FORMAT_VERSION})`,
      "unsupported-version",
    );
  }

  // Metadata block
  const meta = attrs["webdedx.metadata"] as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== "object") {
    fail("webdedx.metadata is required");
  }
  const name = typeof meta["name"] === "string" && meta["name"] ? meta["name"] : fail("webdedx.metadata.name is required");

  // Units
  const units = attrs["webdedx.units"] as Record<string, unknown> | undefined;
  if (!units || typeof units !== "object") fail("webdedx.units is required");

  const energyUnit = units["energy"];
  if (typeof energyUnit !== "string" || !VALID_ENERGY_UNITS.has(energyUnit as ExternalEnergyUnit)) {
    fail(
      `webdedx.units.energy "${energyUnit}" is not supported. Valid: ${[...VALID_ENERGY_UNITS].join(", ")}`,
    );
  }

  const stpUnit = units["stoppingPower"];
  if (typeof stpUnit !== "string" || !VALID_STP_UNITS.has(stpUnit as ExternalStpUnit)) {
    fail(
      `webdedx.units.stoppingPower "${stpUnit}" is not supported. Valid: ${[...VALID_STP_UNITS].join(", ")}`,
    );
  }

  const csdaUnitRaw = units["csdaRange"];
  let csdaUnit: ExternalCsdaUnit | undefined;
  if (csdaUnitRaw !== undefined) {
    if (typeof csdaUnitRaw !== "string" || !VALID_CSDA_UNITS.has(csdaUnitRaw as ExternalCsdaUnit)) {
      fail(`webdedx.units.csdaRange "${csdaUnitRaw}" is not supported. Valid: ${[...VALID_CSDA_UNITS].join(", ")}`);
    }
    csdaUnit = csdaUnitRaw as ExternalCsdaUnit;
  }

  // Energy grid
  const rawGrid = attrs["webdedx.energyGrid"];
  if (!Array.isArray(rawGrid) || rawGrid.length < 2) {
    fail("webdedx.energyGrid must be an array with at least 2 elements");
  }
  if (rawGrid.length > MAX_ENERGY_POINTS) {
    fail(`webdedx.energyGrid length ${rawGrid.length} exceeds maximum ${MAX_ENERGY_POINTS}`);
  }
  for (let i = 0; i < rawGrid.length; i++) {
    const e = rawGrid[i];
    if (typeof e !== "number" || !Number.isFinite(e) || e <= 0) {
      fail(`webdedx.energyGrid[${i}] = ${e} is not a positive finite number`);
    }
    if (i > 0 && e <= rawGrid[i - 1]) {
      fail(
        `webdedx.energyGrid is not strictly increasing at index ${i} (${rawGrid[i - 1]} >= ${e})`,
      );
    }
  }

  // Programs
  const rawPrograms = attrs["webdedx.programs"];
  if (!Array.isArray(rawPrograms) || rawPrograms.length === 0) {
    fail("webdedx.programs must be a non-empty array");
  }
  if (rawPrograms.length > MAX_PROGRAMS) {
    fail(`webdedx.programs length ${rawPrograms.length} exceeds maximum ${MAX_PROGRAMS}`);
  }
  const programIds = new Set<string>();
  const programs: ExternalProgramEntry[] = [];
  for (let i = 0; i < rawPrograms.length; i++) {
    const p = rawPrograms[i] as Record<string, unknown>;
    if (!p || typeof p !== "object") fail(`webdedx.programs[${i}] is not an object`);
    const id = p["id"];
    if (typeof id !== "string" || !isExternalEntityLocalId(id)) {
      fail(`webdedx.programs[${i}].id "${id}" is invalid (must match [A-Za-z0-9_-]+)`);
    }
    if (programIds.has(id)) fail(`webdedx.programs: duplicate id "${id}"`);
    programIds.add(id);
    const pname = p["name"];
    if (typeof pname !== "string" || !pname) fail(`webdedx.programs[${i}].name is required`);
    const version = typeof p["version"] === "string" ? p["version"] : undefined;
    programs.push({ id, name: pname, version });
  }

  // Particles
  const rawParticles = attrs["webdedx.particles"];
  if (!Array.isArray(rawParticles) || rawParticles.length === 0) {
    fail("webdedx.particles must be a non-empty array");
  }
  if (rawParticles.length > MAX_PARTICLES) {
    fail(`webdedx.particles length ${rawParticles.length} exceeds maximum ${MAX_PARTICLES}`);
  }
  const particleIds = new Set<string>();
  const pdgCodes = new Set<number>();
  const particles: ExternalParticleEntry[] = [];
  for (let i = 0; i < rawParticles.length; i++) {
    const p = rawParticles[i] as Record<string, unknown>;
    if (!p || typeof p !== "object") fail(`webdedx.particles[${i}] is not an object`);
    const id = p["id"];
    if (typeof id !== "string" || !isExternalEntityLocalId(id)) {
      fail(`webdedx.particles[${i}].id "${id}" is invalid (must match [A-Za-z0-9_-]+)`);
    }
    if (particleIds.has(id)) fail(`webdedx.particles: duplicate id "${id}"`);
    particleIds.add(id);

    const pname = p["name"];
    if (typeof pname !== "string" || !pname) fail(`webdedx.particles[${i}].name is required`);
    const sym = p["symbol"];
    if (typeof sym !== "string") fail(`webdedx.particles[${i}].symbol is required`);
    const Z = p["Z"];
    if (typeof Z !== "number" || !Number.isInteger(Z) || Z < 0) {
      fail(`webdedx.particles[${i}].Z must be a non-negative integer`);
    }
    const A = p["A"];
    if (typeof A !== "number" || !Number.isInteger(A) || A < 0) {
      fail(`webdedx.particles[${i}].A must be a non-negative integer`);
    }
    const atomicMass = p["atomicMass"];
    if (typeof atomicMass !== "number" || !Number.isFinite(atomicMass) || atomicMass <= 0) {
      fail(`webdedx.particles[${i}].atomicMass must be a positive number`);
    }

    let pdgCode: number | undefined;
    if (p["pdgCode"] !== undefined) {
      const c = p["pdgCode"];
      if (typeof c !== "number" || !Number.isInteger(c) || c <= 0) {
        fail(`webdedx.particles[${i}].pdgCode must be a positive integer`);
      }
      if (pdgCodes.has(c)) fail(`webdedx.particles: duplicate pdgCode ${c}`);
      pdgCodes.add(c);
      pdgCode = c;
    }

    particles.push({
      id,
      name: pname,
      symbol: sym as string,
      Z,
      A,
      atomicMass,
      pdgCode,
      index: i,
    });
  }

  // Materials
  const rawMaterials = attrs["webdedx.materials"];
  if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) {
    fail("webdedx.materials must be a non-empty array");
  }
  if (rawMaterials.length > MAX_MATERIALS) {
    fail(`webdedx.materials length ${rawMaterials.length} exceeds maximum ${MAX_MATERIALS}`);
  }
  const materialIds = new Set<string>();
  const materials: ExternalMaterialEntry[] = [];
  for (let i = 0; i < rawMaterials.length; i++) {
    const m = rawMaterials[i] as Record<string, unknown>;
    if (!m || typeof m !== "object") fail(`webdedx.materials[${i}] is not an object`);
    const id = m["id"];
    if (typeof id !== "string" || !isExternalEntityLocalId(id)) {
      fail(`webdedx.materials[${i}].id "${id}" is invalid (must match [A-Za-z0-9_-]+)`);
    }
    if (materialIds.has(id)) fail(`webdedx.materials: duplicate id "${id}"`);
    materialIds.add(id);
    const mname = m["name"];
    if (typeof mname !== "string" || !mname) fail(`webdedx.materials[${i}].name is required`);

    let density: number | undefined;
    if (m["density"] !== undefined) {
      const d = m["density"];
      if (typeof d !== "number" || !Number.isFinite(d) || d <= 0) {
        fail(`webdedx.materials[${i}].density must be a positive finite number`);
      }
      density = d;
    }

    let phase: "liquid" | "solid" | "gas" | undefined;
    if (m["phase"] !== undefined) {
      const ph = m["phase"];
      if (typeof ph !== "string" || !VALID_PHASE.has(ph)) {
        fail(`webdedx.materials[${i}].phase "${ph}" is invalid (must be liquid, solid, or gas)`);
      }
      phase = ph as "liquid" | "solid" | "gas";
    }

    let icruId: number | undefined;
    let atomicNumber: number | undefined;
    if (m["icruId"] !== undefined) {
      const v = m["icruId"];
      if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
        fail(`webdedx.materials[${i}].icruId must be a positive integer`);
      }
      icruId = v;
    }
    if (m["atomicNumber"] !== undefined) {
      const v = m["atomicNumber"];
      if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 118) {
        fail(`webdedx.materials[${i}].atomicNumber must be an integer in 1..118`);
      }
      atomicNumber = v;
    }
    if (icruId !== undefined && atomicNumber !== undefined) {
      fail(`webdedx.materials[${i}]: cannot specify both icruId and atomicNumber`);
    }

    let ival: number | undefined;
    if (m["ival"] !== undefined) {
      const v = m["ival"];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        fail(`webdedx.materials[${i}].ival must be a positive finite number`);
      }
      ival = v;
    }

    materials.push({
      id,
      name: mname,
      density,
      phase,
      icruId,
      atomicNumber,
      ival,
      index: i,
      linearUnitsAvailable: density !== undefined,
    });
  }

  return {
    label,
    url,
    name,
    version: typeof meta["version"] === "string" ? meta["version"] : undefined,
    author: typeof meta["author"] === "string" ? meta["author"] : undefined,
    description: typeof meta["description"] === "string" ? meta["description"] : undefined,
    license: typeof meta["license"] === "string" ? meta["license"] : undefined,
    programs,
    particles,
    materials,
    energyGrid: rawGrid as number[],
    energyUnit: energyUnit as ExternalEnergyUnit,
    stpUnit: stpUnit as ExternalStpUnit,
    csdaUnit,
    hasCsdaRange: false, // updated by the loader after checking for csda_range arrays
  };
}
