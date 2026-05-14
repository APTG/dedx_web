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

  // Format version — svelte-check doesn't narrow `unknown` through local never-returning funcs,
  // so we cast explicitly after each type-guard + fail() block.
  const fvRaw = attrs["webdedx.formatVersion"];
  if (typeof fvRaw !== "number" || !Number.isInteger(fvRaw) || fvRaw < 1) {
    fail("webdedx.formatVersion must be a positive integer");
  }
  const fv = fvRaw as number;
  if (fv > SUPPORTED_FORMAT_VERSION) {
    fail(
      `Unsupported webdedx.formatVersion ${fv} (max supported: ${SUPPORTED_FORMAT_VERSION})`,
      "unsupported-version",
    );
  }

  // Metadata block
  const rawMeta = attrs["webdedx.metadata"];
  if (!rawMeta || typeof rawMeta !== "object" || Array.isArray(rawMeta)) {
    fail("webdedx.metadata is required");
  }
  const meta = rawMeta as Record<string, unknown>;
  const name =
    typeof meta["name"] === "string" && meta["name"]
      ? meta["name"]
      : fail("webdedx.metadata.name is required");

  // Units
  const rawUnits = attrs["webdedx.units"];
  if (!rawUnits || typeof rawUnits !== "object" || Array.isArray(rawUnits)) {
    fail("webdedx.units is required");
  }
  const units = rawUnits as Record<string, unknown>;

  const energyUnitRaw = units["energy"];
  if (
    typeof energyUnitRaw !== "string" ||
    !VALID_ENERGY_UNITS.has(energyUnitRaw as ExternalEnergyUnit)
  ) {
    fail(
      `webdedx.units.energy "${energyUnitRaw}" is not supported. Valid: ${[...VALID_ENERGY_UNITS].join(", ")}`,
    );
  }
  const energyUnit = energyUnitRaw as ExternalEnergyUnit;

  const stpUnitRaw = units["stoppingPower"];
  if (typeof stpUnitRaw !== "string" || !VALID_STP_UNITS.has(stpUnitRaw as ExternalStpUnit)) {
    fail(
      `webdedx.units.stoppingPower "${stpUnitRaw}" is not supported. Valid: ${[...VALID_STP_UNITS].join(", ")}`,
    );
  }
  const stpUnit = stpUnitRaw as ExternalStpUnit;

  const csdaUnitRaw = units["csdaRange"];
  let csdaUnit: ExternalCsdaUnit | undefined;
  if (csdaUnitRaw !== undefined) {
    if (
      typeof csdaUnitRaw !== "string" ||
      !VALID_CSDA_UNITS.has(csdaUnitRaw as ExternalCsdaUnit)
    ) {
      fail(
        `webdedx.units.csdaRange "${csdaUnitRaw}" is not supported. Valid: ${[...VALID_CSDA_UNITS].join(", ")}`,
      );
    }
    csdaUnit = csdaUnitRaw as ExternalCsdaUnit;
  }

  // Energy grid
  const rawGridUnknown = attrs["webdedx.energyGrid"];
  if (!Array.isArray(rawGridUnknown) || rawGridUnknown.length < 2) {
    fail("webdedx.energyGrid must be an array with at least 2 elements");
  }
  const rawGrid = rawGridUnknown as unknown[];
  if (rawGrid.length > MAX_ENERGY_POINTS) {
    fail(`webdedx.energyGrid length ${rawGrid.length} exceeds maximum ${MAX_ENERGY_POINTS}`);
  }
  for (let i = 0; i < rawGrid.length; i++) {
    const e = rawGrid[i];
    if (typeof e !== "number" || !Number.isFinite(e) || e <= 0) {
      fail(`webdedx.energyGrid[${i}] = ${e} is not a positive finite number`);
    }
    const ePrev = rawGrid[i - 1];
    if (i > 0 && (e as number) <= (ePrev as number)) {
      fail(
        `webdedx.energyGrid is not strictly increasing at index ${i} (${ePrev} >= ${e})`,
      );
    }
  }

  // Programs
  const rawProgramsUnknown = attrs["webdedx.programs"];
  if (!Array.isArray(rawProgramsUnknown) || rawProgramsUnknown.length === 0) {
    fail("webdedx.programs must be a non-empty array");
  }
  const rawPrograms = rawProgramsUnknown as unknown[];
  if (rawPrograms.length > MAX_PROGRAMS) {
    fail(`webdedx.programs length ${rawPrograms.length} exceeds maximum ${MAX_PROGRAMS}`);
  }
  const programIds = new Set<string>();
  const programs: ExternalProgramEntry[] = [];
  for (let i = 0; i < rawPrograms.length; i++) {
    const p = rawPrograms[i];
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      fail(`webdedx.programs[${i}] is not an object`);
    }
    const prog = p as Record<string, unknown>;
    const id = prog["id"];
    if (typeof id !== "string" || !isExternalEntityLocalId(id)) {
      fail(`webdedx.programs[${i}].id "${id}" is invalid (must match [A-Za-z0-9_-]+)`);
    }
    const idStr = id as string;
    if (programIds.has(idStr)) fail(`webdedx.programs: duplicate id "${idStr}"`);
    programIds.add(idStr);
    const pname = prog["name"];
    if (typeof pname !== "string" || !pname) fail(`webdedx.programs[${i}].name is required`);
    const pnameStr = pname as string;
    const version = typeof prog["version"] === "string" ? (prog["version"] as string) : undefined;
    programs.push({ id: idStr, name: pnameStr, version });
  }

  // Particles
  const rawParticlesUnknown = attrs["webdedx.particles"];
  if (!Array.isArray(rawParticlesUnknown) || rawParticlesUnknown.length === 0) {
    fail("webdedx.particles must be a non-empty array");
  }
  const rawParticles = rawParticlesUnknown as unknown[];
  if (rawParticles.length > MAX_PARTICLES) {
    fail(`webdedx.particles length ${rawParticles.length} exceeds maximum ${MAX_PARTICLES}`);
  }
  const particleIds = new Set<string>();
  const pdgCodes = new Set<number>();
  const particles: ExternalParticleEntry[] = [];
  for (let i = 0; i < rawParticles.length; i++) {
    const p = rawParticles[i];
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      fail(`webdedx.particles[${i}] is not an object`);
    }
    const part = p as Record<string, unknown>;
    const id = part["id"];
    if (typeof id !== "string" || !isExternalEntityLocalId(id)) {
      fail(`webdedx.particles[${i}].id "${id}" is invalid (must match [A-Za-z0-9_-]+)`);
    }
    const idStr = id as string;
    if (particleIds.has(idStr)) fail(`webdedx.particles: duplicate id "${idStr}"`);
    particleIds.add(idStr);

    const pname = part["name"];
    if (typeof pname !== "string" || !pname) fail(`webdedx.particles[${i}].name is required`);
    const pnameStr = pname as string;
    const sym = part["symbol"];
    if (typeof sym !== "string") fail(`webdedx.particles[${i}].symbol is required`);
    const symStr = sym as string;
    const Z = part["Z"];
    if (typeof Z !== "number" || !Number.isInteger(Z) || Z < 0) {
      fail(`webdedx.particles[${i}].Z must be a non-negative integer`);
    }
    const ZNum = Z as number;
    const A = part["A"];
    if (typeof A !== "number" || !Number.isInteger(A) || A < 0) {
      fail(`webdedx.particles[${i}].A must be a non-negative integer`);
    }
    const ANum = A as number;
    const atomicMass = part["atomicMass"];
    if (typeof atomicMass !== "number" || !Number.isFinite(atomicMass) || atomicMass <= 0) {
      fail(`webdedx.particles[${i}].atomicMass must be a positive number`);
    }
    const atomicMassNum = atomicMass as number;

    let pdgCode: number | undefined;
    if (part["pdgCode"] !== undefined) {
      const c = part["pdgCode"];
      if (typeof c !== "number" || !Number.isInteger(c) || c <= 0) {
        fail(`webdedx.particles[${i}].pdgCode must be a positive integer`);
      }
      const cNum = c as number;
      if (pdgCodes.has(cNum)) fail(`webdedx.particles: duplicate pdgCode ${cNum}`);
      pdgCodes.add(cNum);
      pdgCode = cNum;
    }

    particles.push({
      id: idStr,
      name: pnameStr,
      symbol: symStr,
      Z: ZNum,
      A: ANum,
      atomicMass: atomicMassNum,
      pdgCode,
      index: i,
    });
  }

  // Materials
  const rawMaterialsUnknown = attrs["webdedx.materials"];
  if (!Array.isArray(rawMaterialsUnknown) || rawMaterialsUnknown.length === 0) {
    fail("webdedx.materials must be a non-empty array");
  }
  const rawMaterials = rawMaterialsUnknown as unknown[];
  if (rawMaterials.length > MAX_MATERIALS) {
    fail(`webdedx.materials length ${rawMaterials.length} exceeds maximum ${MAX_MATERIALS}`);
  }
  const materialIds = new Set<string>();
  const materials: ExternalMaterialEntry[] = [];
  for (let i = 0; i < rawMaterials.length; i++) {
    const m = rawMaterials[i];
    if (!m || typeof m !== "object" || Array.isArray(m)) {
      fail(`webdedx.materials[${i}] is not an object`);
    }
    const mat = m as Record<string, unknown>;
    const id = mat["id"];
    if (typeof id !== "string" || !isExternalEntityLocalId(id)) {
      fail(`webdedx.materials[${i}].id "${id}" is invalid (must match [A-Za-z0-9_-]+)`);
    }
    const idStr = id as string;
    if (materialIds.has(idStr)) fail(`webdedx.materials: duplicate id "${idStr}"`);
    materialIds.add(idStr);
    const mname = mat["name"];
    if (typeof mname !== "string" || !mname) fail(`webdedx.materials[${i}].name is required`);
    const mnameStr = mname as string;

    let density: number | undefined;
    if (mat["density"] !== undefined) {
      const d = mat["density"];
      if (typeof d !== "number" || !Number.isFinite(d) || d <= 0) {
        fail(`webdedx.materials[${i}].density must be a positive finite number`);
      }
      density = d as number;
    }

    let phase: "liquid" | "solid" | "gas" | undefined;
    if (mat["phase"] !== undefined) {
      const ph = mat["phase"];
      if (typeof ph !== "string" || !VALID_PHASE.has(ph)) {
        fail(`webdedx.materials[${i}].phase "${ph}" is invalid (must be liquid, solid, or gas)`);
      }
      phase = ph as "liquid" | "solid" | "gas";
    }

    let icruId: number | undefined;
    let atomicNumber: number | undefined;
    if (mat["icruId"] !== undefined) {
      const v = mat["icruId"];
      if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
        fail(`webdedx.materials[${i}].icruId must be a positive integer`);
      }
      icruId = v as number;
    }
    if (mat["atomicNumber"] !== undefined) {
      const v = mat["atomicNumber"];
      if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 118) {
        fail(`webdedx.materials[${i}].atomicNumber must be an integer in 1..118`);
      }
      atomicNumber = v as number;
    }
    if (icruId !== undefined && atomicNumber !== undefined) {
      fail(`webdedx.materials[${i}]: cannot specify both icruId and atomicNumber`);
    }

    let ival: number | undefined;
    if (mat["ival"] !== undefined) {
      const v = mat["ival"];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        fail(`webdedx.materials[${i}].ival must be a positive finite number`);
      }
      ival = v as number;
    }

    materials.push({
      id: idStr,
      name: mnameStr,
      density,
      phase,
      icruId,
      atomicNumber,
      ival,
      index: i,
      linearUnitsAvailable: density !== undefined,
    });
  }

  const metaVersion =
    typeof meta["version"] === "string" ? (meta["version"] as string) : undefined;
  const metaAuthor =
    typeof meta["author"] === "string" ? (meta["author"] as string) : undefined;
  const metaDescription =
    typeof meta["description"] === "string" ? (meta["description"] as string) : undefined;
  const metaLicense =
    typeof meta["license"] === "string" ? (meta["license"] as string) : undefined;

  return {
    label,
    url,
    name,
    ...(metaVersion !== undefined ? { version: metaVersion } : {}),
    ...(metaAuthor !== undefined ? { author: metaAuthor } : {}),
    ...(metaDescription !== undefined ? { description: metaDescription } : {}),
    ...(metaLicense !== undefined ? { license: metaLicense } : {}),
    programs,
    particles,
    materials,
    energyGrid: rawGrid as number[],
    energyUnit,
    stpUnit,
    ...(csdaUnit !== undefined ? { csdaUnit } : {}),
    hasCsdaRange: false, // updated by the loader after checking for csda_range arrays
  };
}
