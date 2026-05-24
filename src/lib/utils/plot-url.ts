import type { StpUnit, AdvancedOptions } from "$lib/wasm/types";
import type { EntityId, ExternalSourceDescriptor } from "$lib/external-data/types";
import { parseEntityId, formatEntityId } from "$lib/external-data/ids";
import {
  appendExtdataParams,
  parseExtdataParams,
  externalDataQuerySegments,
} from "$lib/external-data/url";

const STP_TOKENS: Record<StpUnit, string> = {
  "keV/µm": "kev-um",
  "MeV/cm": "mev-cm",
  "MeV·cm²/g": "mev-cm2-g",
};

/** Element specification for custom compounds in URL encoding. */
export interface MatElementUrl {
  atomicNumber: number;
  atomCount: number;
}

const TOKEN_TO_STP: Record<string, StpUnit> = Object.fromEntries(
  Object.entries(STP_TOKENS).map(([k, v]) => [v, k as StpUnit]),
);

const STRICT_NUMBER_RE = /^[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?$/;
const STRICT_INTEGER_RE = /^\d+$/;

/**
 * Resolve duplicate URL params using "last wins" semantics per §3.2.
 * Iterates all params and uses set() which overwrites earlier values.
 */
function resolveLastWins(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of params) {
    out.set(key, value);
  }
  return out;
}

function parseStrictFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  if (!STRICT_NUMBER_RE.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function parseStrictAtomicNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!STRICT_INTEGER_RE.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 1 && value <= 118 ? value : undefined;
}

export function stpUnitToToken(unit: StpUnit): string {
  return STP_TOKENS[unit];
}

export function tokenToStpUnit(token: string): StpUnit {
  return TOKEN_TO_STP[token] ?? "keV/µm";
}

/** A plot series triplet — each component is a built-in numeric ID or an ext-ref. */
export interface PlotSeriesTriplet {
  programId: EntityId;
  particleId: EntityId;
  materialId: EntityId;
}

export interface PlotUrlInput {
  particleId: number | null;
  materialId: number | null;
  programId: number;
  series: PlotSeriesTriplet[];
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
  invStpBranch?: "both";
  advancedOptions?: AdvancedOptions;

  /** External data sources declared via `extdata` URL params (in declaration order). */
  externalSources?: ExternalSourceDescriptor[];

  /** Custom compound material fields (optional — only present when materialIsCustom=true) */
  materialIsCustom?: boolean;
  matName?: string | undefined;
  matDensity?: number | undefined;
  matElements?: MatElementUrl[] | undefined;
  matIval?: number | undefined;
  matPhase?: "gas" | "condensed" | undefined;
}

export interface PlotUrlDecoded {
  particleId: number | null;
  materialId: number | null;
  programId: number;
  series: PlotSeriesTriplet[];
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
  invStpBranch?: "both";
  advancedOptions: AdvancedOptions;

  /** External data sources declared via `extdata` URL params (in declaration order). */
  externalSources?: ExternalSourceDescriptor[];

  /** Custom compound material fields (optional — only present when materialIsCustom=true) */
  materialIsCustom?: boolean;
  matName?: string | undefined;
  matDensity?: number | undefined;
  matElements?: MatElementUrl[] | undefined;
  matIval?: number | undefined;
  matPhase?: "gas" | "condensed" | undefined;
  fromUrlWarning?: string | undefined; // Set by decoder when validation fails
}

export function encodePlotUrl(input: PlotUrlInput): URLSearchParams {
  const params = new URLSearchParams();
  if (input.externalSources && input.externalSources.length > 0) {
    appendExtdataParams(params, input.externalSources);
  }

  if (input.particleId !== null) params.set("particle", String(input.particleId));

  // Custom compound material params (only when materialIsCustom=true)
  if (input.materialIsCustom && input.materialId === null) {
    params.set("material", "custom");
    if (input.matName) {
      params.set("mat_name", input.matName);
    }
    if (input.matDensity !== undefined) {
      params.set("mat_density", String(input.matDensity));
    }
    if (input.matElements && input.matElements.length > 0) {
      // Sort by ascending Z and encode as Z:count,Z:count
      const sorted = [...input.matElements].sort((a, b) => a.atomicNumber - b.atomicNumber);
      const encoded = sorted.map((e) => `${e.atomicNumber}:${e.atomCount}`).join(",");
      params.set("mat_elements", encoded);
    }
    if (input.matIval !== undefined) {
      params.set("mat_ival", String(input.matIval));
    }
    if (input.matPhase && input.matPhase === "gas") {
      // Only encode gas; condensed is default and omitted
      params.set("mat_phase", "gas");
    }
  } else if (input.materialId !== null) {
    params.set("material", String(input.materialId));
  }

  params.set("program", input.programId === -1 ? "auto" : String(input.programId));
  if (input.series.length > 0) {
    params.set(
      "series",
      input.series
        .map(
          (s) =>
            `${formatEntityId(s.programId)}.${formatEntityId(s.particleId)}.${formatEntityId(s.materialId)}`,
        )
        .join(","),
    );
  }
  params.set("stp_unit", stpUnitToToken(input.stpUnit));
  params.set("xscale", input.xLog ? "log" : "lin");
  params.set("yscale", input.yLog ? "log" : "lin");
  if (input.invStpBranch === "both") {
    params.set("inv_stp_branch", "both");
  }

  // Encode advanced options (only non-default values)
  if (input.advancedOptions) {
    const opts = input.advancedOptions;

    // Aggregate state
    if (opts.aggregateState !== undefined) {
      params.set("agg_state", opts.aggregateState);
    }

    // Interpolation scale - only if not default ("log" is default, "linear" maps to "lin-lin")
    if (opts.interpolation?.scale !== undefined && opts.interpolation.scale === "linear") {
      params.set("interp_scale", "lin-lin");
    }

    // Interpolation method - only if not default ("linear" is default, "cubic" maps to "spline")
    if (opts.interpolation?.method !== undefined && opts.interpolation.method === "cubic") {
      params.set("interp_method", "spline");
    }

    // MSTAR mode - only if not default ("b" is default)
    if (opts.mstarMode !== undefined && opts.mstarMode !== "b") {
      params.set("mstar_mode", opts.mstarMode);
    }

    // Density override
    if (opts.densityOverride !== undefined) {
      params.set("density", String(opts.densityOverride));
    }

    // I-value override
    if (opts.iValueOverride !== undefined) {
      params.set("ival", String(opts.iValueOverride));
    }
  }

  return params;
}

/**
 * Build the plot query string for the URL bar.
 * Mirrors `calculatorUrlQueryString`: urlv is not part of plot URLs, so the
 * canonical order is extdata first, then the rest with `:` and `,` kept literal.
 * The external URL portion stays percent-encoded (see calculatorUrlQueryString
 * for the full explanation).
 */
export function plotUrlQueryString(input: PlotUrlInput): string {
  const params = encodePlotUrl(input);
  const parts: string[] = [];

  if (input.externalSources && input.externalSources.length > 0) {
    parts.push(...externalDataQuerySegments(input.externalSources));
  }

  const paramsNoExtdata = new URLSearchParams();
  for (const [key, value] of params) {
    if (key !== "extdata") paramsNoExtdata.append(key, value);
  }

  const restStr = paramsNoExtdata.toString().replaceAll("%3A", ":").replaceAll("%2C", ",");
  if (restStr) parts.push(restStr);

  return parts.join("&");
}

export function decodePlotUrl(rawParams: URLSearchParams): PlotUrlDecoded {
  // Extract extdata BEFORE resolveLastWins (last-wins would collapse the list).
  const { sources: externalSources } = parseExtdataParams(rawParams);

  const paramsNoExtdata = new URLSearchParams();
  for (const [key, value] of rawParams) {
    if (key !== "extdata") paramsNoExtdata.append(key, value);
  }

  // Resolve duplicate params using "last wins" semantics per §3.2
  const params = resolveLastWins(paramsNoExtdata);

  const parseFiniteInt = (raw: string | null): number | null => {
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const particleId = params.has("particle") ? parseFiniteInt(params.get("particle")) : null;

  // Parse custom compound material params
  let materialId: number | null = null;
  let materialIsCustom: boolean | undefined;
  let matName: string | undefined;
  let matDensity: number | undefined;
  let matElements: MatElementUrl[] | undefined;
  let matIval: number | undefined;
  let matPhase: "gas" | "condensed" | undefined;
  let fromUrlWarning: string | undefined;

  const materialRaw = params.get("material");
  if (materialRaw === "custom") {
    materialIsCustom = true;
    matName = params.get("mat_name") ?? undefined;
    const matDensityRaw = params.get("mat_density");
    matDensity = parseStrictFiniteNumber(matDensityRaw);
    const matElementsRaw = params.get("mat_elements");
    const matIvalRaw = params.get("mat_ival");
    const matPhaseRaw = params.get("mat_phase");

    // Parse elements (Z:count format)
    if (matElementsRaw) {
      const elementMap = new Map<number, number>();
      const entries = matElementsRaw.split(",");
      for (const entry of entries) {
        const colonIdx = entry.indexOf(":");
        if (colonIdx <= 0) {
          fromUrlWarning = fromUrlWarning
            ? `${fromUrlWarning}; malformed mat_elements entry`
            : "mat_elements: malformed entries";
          continue;
        }
        const zStr = entry.slice(0, colonIdx);
        const countStr = entry.slice(colonIdx + 1);
        const z = parseStrictAtomicNumber(zStr);
        const count = parseStrictFiniteNumber(countStr);
        if (z === undefined) {
          if (!STRICT_INTEGER_RE.test(zStr.trim())) {
            fromUrlWarning = fromUrlWarning
              ? `${fromUrlWarning}; malformed mat_elements entry`
              : "mat_elements: malformed entries";
          }
          continue;
        }
        if (count === undefined) {
          fromUrlWarning = fromUrlWarning
            ? `${fromUrlWarning}; malformed mat_elements entry`
            : "mat_elements: malformed entries";
          continue;
        }
        if (count <= 0) {
          continue;
        }
        elementMap.set(z, (elementMap.get(z) ?? 0) + count);
      }
      if (elementMap.size > 0) {
        matElements = Array.from(elementMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([atomicNumber, atomCount]) => ({ atomicNumber, atomCount }));
      } else if (matElementsRaw) {
        fromUrlWarning = fromUrlWarning
          ? `${fromUrlWarning}; mat_elements: all entries invalid`
          : "mat_elements: all entries invalid";
      }
    }

    matIval = parseStrictFiniteNumber(matIvalRaw);
    if (matIvalRaw !== null && matIval === undefined) {
      fromUrlWarning = fromUrlWarning ? `${fromUrlWarning}; mat_ival invalid` : "mat_ival: invalid";
    }
    if (matIval !== undefined && (matIval <= 0 || matIval > 10000)) {
      matIval = undefined;
    }

    matPhase = matPhaseRaw === "gas" ? "gas" : "condensed";

    // Validate required fields for custom compounds
    if (!matName || !matName.trim()) {
      fromUrlWarning = fromUrlWarning
        ? `${fromUrlWarning}; mat_name missing`
        : "mat_name: required";
    }
    if (
      matDensity === undefined ||
      !Number.isFinite(matDensity) ||
      matDensity <= 0 ||
      matDensity > 25
    ) {
      fromUrlWarning = fromUrlWarning
        ? `${fromUrlWarning}; mat_density invalid`
        : "mat_density: required (0, 25]";
    }
    if (!matElements || matElements.length === 0) {
      fromUrlWarning = fromUrlWarning
        ? `${fromUrlWarning}; mat_elements missing/invalid`
        : "mat_elements: required";
    }

    // If validation failed, fall back to liquid water (ID 276)
    if (fromUrlWarning) {
      materialIsCustom = undefined;
      matName = undefined;
      matDensity = undefined;
      matElements = undefined;
      matIval = undefined;
      matPhase = undefined;
      materialId = 276;
    } else {
      materialId = null;
    }
  } else if (materialRaw) {
    materialId = parseFiniteInt(materialRaw);
  }

  const programParam = params.get("program");
  let programId: number;
  if (!programParam || programParam === "auto") {
    programId = -1;
  } else {
    const parsed = parseFiniteInt(programParam);
    programId = parsed ?? -1;
  }

  const seriesParam = params.get("series") ?? "";
  const series: PlotSeriesTriplet[] = seriesParam
    ? seriesParam
        .split(",")
        .map((triplet): PlotSeriesTriplet | null => {
          // Split on "." only. ext-refs use ":" not ".", so this is unambiguous.
          const parts = triplet.split(".");
          if (parts.length !== 3) return null;
          const [rawProg, rawPart, rawMat] = parts;
          const prog = parseEntityId(rawProg ?? null);
          const part = parseEntityId(rawPart ?? null);
          const mat = parseEntityId(rawMat ?? null);
          if (prog === null || part === null || mat === null) return null;
          return { programId: prog, particleId: part, materialId: mat };
        })
        .filter((s): s is PlotSeriesTriplet => s !== null)
    : [];

  const stpUnit = tokenToStpUnit(params.get("stp_unit") ?? "");
  const xLog = (params.get("xscale") ?? "log") === "log";
  const yLog = (params.get("yscale") ?? "log") === "log";
  const invStpBranch = params.get("inv_stp_branch") === "both" ? "both" : undefined;

  // Decode advanced options
  const advancedOptions: AdvancedOptions = {};

  // Aggregate state
  const aggStateParam = params.get("agg_state");
  if (aggStateParam && (aggStateParam === "gas" || aggStateParam === "condensed")) {
    advancedOptions.aggregateState = aggStateParam as "gas" | "condensed";
  }

  // Interpolation scale - "lin-lin" maps to "linear", default "log-log" is "log"
  const interpScaleParam = params.get("interp_scale");
  if (interpScaleParam && interpScaleParam === "lin-lin") {
    advancedOptions.interpolation = { ...advancedOptions.interpolation, scale: "linear" };
  }

  // Interpolation method - "spline" maps to "cubic", default is "linear"
  const interpMethodParam = params.get("interp_method");
  if (interpMethodParam && interpMethodParam === "spline") {
    advancedOptions.interpolation = { ...advancedOptions.interpolation, method: "cubic" };
  }

  // MSTAR mode - must be valid and not default "b"
  const mstarModeParam = params.get("mstar_mode");
  if (
    mstarModeParam &&
    ["a", "b", "c", "d", "g", "h"].includes(mstarModeParam) &&
    mstarModeParam !== "b"
  ) {
    advancedOptions.mstarMode = mstarModeParam as "a" | "b" | "c" | "d" | "g" | "h";
  }

  // Density override - must be positive number
  const densityParam = params.get("density");
  if (densityParam !== null) {
    const parsed = Number(densityParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      advancedOptions.densityOverride = parsed;
    }
  }

  // I-value override - must be positive and <= 10000
  const ivalParam = params.get("ival");
  if (ivalParam !== null) {
    const parsed = Number(ivalParam);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 10000) {
      advancedOptions.iValueOverride = parsed;
    }
  }

  const result: PlotUrlDecoded = {
    particleId,
    materialId,
    programId,
    series,
    stpUnit,
    xLog,
    yLog,
    advancedOptions,
  };
  if (invStpBranch) {
    result.invStpBranch = invStpBranch;
  }
  if (externalSources.length > 0) {
    result.externalSources = externalSources;
  }

  // Always include fromUrlWarning if set
  if (fromUrlWarning) {
    result.fromUrlWarning = fromUrlWarning;
  }

  // Include custom compound fields if valid
  if (materialIsCustom) {
    result.materialIsCustom = materialIsCustom;
    result.matName = matName;
    result.matDensity = matDensity;
    result.matElements = matElements;
    result.matIval = matIval;
    result.matPhase = matPhase;
  }

  return result;
}
