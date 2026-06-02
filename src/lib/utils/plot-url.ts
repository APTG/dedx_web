import type { StpUnit, AdvancedOptions } from "$lib/wasm/types";
import type { EntityId, ExternalSourceDescriptor } from "$lib/external-data/types";
import { parseEntityId, formatEntityId } from "$lib/external-data/ids";
import {
  appendExtdataParams,
  parseExtdataParams,
  externalDataQuerySegments,
} from "$lib/external-data/url";
import { parseQuery, UrlParseError } from "$lib/utils/url-parse";
import { CURRENT_URL_MAJOR } from "$lib/utils/url-version";
import type { QueryNode } from "$lib/utils/url-ast";
import type { Diagnostic } from "$lib/utils/url-diagnostics";
import {
  buildTokenView,
  parseCustomCompound,
  encodeMatElements,
  URL_LIST_SEPARATOR,
  URL_LIST_SEPARATOR_ENCODED,
  URL_LIST_SPLIT_RE,
  type MatElementUrl,
} from "$lib/utils/url-shared";

export type { MatElementUrl };

// STP unit codec lives in a shared module so the calculator (`sunit=`) and the
// plot page agree on the same tokens.
import { stpUnitToToken, tokenToStpUnit } from "$lib/utils/stp-unit-codec";
export { stpUnitToToken, tokenToStpUnit };

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
  // Emit the URL major so plot links carry the same version signal as calculator
  // links: an older client opening a v3 `~`-separated `series=` list sees the
  // unsupported-link banner instead of silently dropping the series (issue #672).
  params.set("urlv", String(CURRENT_URL_MAJOR));
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
      params.set("mat_elements", encodeMatElements(input.matElements));
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
        .join(URL_LIST_SEPARATOR),
    );
  }
  // `sunit` is the shared stopping-power unit param (also used by the calculator).
  params.set("sunit", stpUnitToToken(input.stpUnit));
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
 * Mirrors `calculatorUrlQueryString`: `urlv` first, then `extdata` (one per
 * source), then the rest with `:` literal and the `~` list separator restored.
 * The external URL portion stays percent-encoded (see calculatorUrlQueryString
 * for the full explanation).
 */
export function plotUrlQueryString(input: PlotUrlInput): string {
  const params = encodePlotUrl(input);
  const parts: string[] = [];

  // 1. urlv first.
  const urlv = params.get("urlv");
  if (urlv !== null) parts.push(`urlv=${urlv}`);

  // 2. extdata in source declaration order (specially encoded).
  if (input.externalSources && input.externalSources.length > 0) {
    parts.push(...externalDataQuerySegments(input.externalSources));
  }

  // 3. Remaining params (excluding urlv and extdata, already emitted).
  const paramsNoExtdata = new URLSearchParams();
  for (const [key, value] of params) {
    if (key !== "extdata" && key !== "urlv") paramsNoExtdata.append(key, value);
  }

  // Keep `:` literal (per-row/triplet sub-separator) and restore the `~` list
  // separator (which `URLSearchParams` percent-encodes as `%7E`) so shared URLs
  // stay human-readable and survive auto-linkification (issue #672).
  const restStr = paramsNoExtdata
    .toString()
    .replaceAll("%3A", ":")
    .replaceAll(URL_LIST_SEPARATOR_ENCODED, URL_LIST_SEPARATOR);
  if (restStr) parts.push(restStr);

  return parts.join("&");
}

/**
 * Resolve a parsed query (AST) into plot URL state (§3 semantics). External
 * sources are resolved separately and passed in. Collected `diagnostics`
 * describe dropped/invalid params with source spans. Separately exported for
 * unit testing without a page render (issue #477).
 */
export function resolvePlotState(
  ast: QueryNode,
  externalSources: ExternalSourceDescriptor[],
  diagnostics: Diagnostic[] = [],
): PlotUrlDecoded {
  const t = buildTokenView(ast);

  const parseFiniteInt = (raw: string | null): number | null => {
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  // Unknown params are ignored (§3.3); record them as info diagnostics.
  for (const unknown of t.unknownPairs) {
    diagnostics.push({
      severity: "info",
      code: "param.unknown",
      message: `Unknown parameter "${unknown.key}" was ignored.`,
      param: unknown.key,
      span: unknown.span,
    });
  }

  const particleId = parseFiniteInt(t.get("particle"));

  // Parse custom compound material params
  let materialId: number | null = null;
  let materialIsCustom: boolean | undefined;
  let matName: string | undefined;
  let matDensity: number | undefined;
  let matElements: MatElementUrl[] | undefined;
  let matIval: number | undefined;
  let matPhase: "gas" | "condensed" | undefined;
  let fromUrlWarning: string | undefined;

  const materialRaw = t.get("material");
  if (materialRaw === "custom") {
    const fields = parseCustomCompound(t.get, { get: t.span }, diagnostics);
    fromUrlWarning = fields.fromUrlWarning;
    if (fromUrlWarning) {
      // Validation failed — fall back to liquid water (ID 276).
      materialId = 276;
    } else {
      materialIsCustom = true;
      matName = fields.matName;
      matDensity = fields.matDensity;
      matElements = fields.matElements;
      matIval = fields.matIval;
      matPhase = fields.matPhase;
      materialId = null;
    }
  } else if (materialRaw) {
    materialId = parseFiniteInt(materialRaw);
  }

  const programParam = t.get("program");
  let programId: number;
  if (!programParam || programParam === "auto") {
    programId = -1;
  } else {
    const parsed = parseFiniteInt(programParam);
    programId = parsed ?? -1;
  }

  const seriesParam = t.get("series") ?? "";
  const series: PlotSeriesTriplet[] = seriesParam
    ? seriesParam
        .split(URL_LIST_SPLIT_RE)
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

  // Prefer the shared `sunit` param; fall back to the legacy `stp_unit` so
  // older shared plot links keep working.
  const stpUnit = tokenToStpUnit(t.get("sunit") ?? t.get("stp_unit") ?? "");
  const xLog = (t.get("xscale") ?? "log") === "log";
  const yLog = (t.get("yscale") ?? "log") === "log";
  const invStpBranch = t.get("inv_stp_branch") === "both" ? "both" : undefined;

  // Decode advanced options
  const advancedOptions: AdvancedOptions = {};

  // Aggregate state
  const aggStateParam = t.get("agg_state");
  if (aggStateParam && (aggStateParam === "gas" || aggStateParam === "condensed")) {
    advancedOptions.aggregateState = aggStateParam as "gas" | "condensed";
  }

  // Interpolation scale - "lin-lin" maps to "linear", default "log-log" is "log"
  const interpScaleParam = t.get("interp_scale");
  if (interpScaleParam && interpScaleParam === "lin-lin") {
    advancedOptions.interpolation = { ...advancedOptions.interpolation, scale: "linear" };
  }

  // Interpolation method - "spline" maps to "cubic", default is "linear"
  const interpMethodParam = t.get("interp_method");
  if (interpMethodParam && interpMethodParam === "spline") {
    advancedOptions.interpolation = { ...advancedOptions.interpolation, method: "cubic" };
  }

  // MSTAR mode - must be valid and not default "b"
  const mstarModeParam = t.get("mstar_mode");
  if (
    mstarModeParam &&
    ["a", "b", "c", "d", "g", "h"].includes(mstarModeParam) &&
    mstarModeParam !== "b"
  ) {
    advancedOptions.mstarMode = mstarModeParam as "a" | "b" | "c" | "d" | "g" | "h";
  }

  // Density override - must be positive number
  const densityParam = t.get("density");
  if (densityParam !== null) {
    const parsed = Number(densityParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      advancedOptions.densityOverride = parsed;
    }
  }

  // I-value override - must be positive and <= 10000
  const ivalParam = t.get("ival");
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

/**
 * Decode plot URL state from a raw query string or `URLSearchParams`. Thin
 * wrapper: extdata is resolved on the original params (ordered, may repeat),
 * then `parseQuery` tokenizes and `resolvePlotState` applies semantics.
 *
 * The input is normalized through `URLSearchParams` before tokenizing (so
 * percent-encoded keys decode as the legacy decoder saw them), and an
 * unexpected tokenizer failure falls back to defaults rather than throwing into
 * the restore path.
 */
export function decodePlotUrl(input: URLSearchParams | string): PlotUrlDecoded {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const { sources } = parseExtdataParams(params);
  let ast: QueryNode;
  try {
    ast = parseQuery(params);
  } catch (error) {
    if (!(error instanceof UrlParseError)) throw error;
    ast = { type: "query", pairs: [] };
  }
  return resolvePlotState(ast, sources);
}
