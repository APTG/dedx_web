import type { StpUnit, AdvancedOptions } from "$lib/wasm/types";

const STP_TOKENS: Record<StpUnit, string> = {
  "keV/µm": "kev-um",
  "MeV/cm": "mev-cm",
  "MeV·cm²/g": "mev-cm2-g",
};

const TOKEN_TO_STP: Record<string, StpUnit> = Object.fromEntries(
  Object.entries(STP_TOKENS).map(([k, v]) => [v, k as StpUnit]),
);

export function stpUnitToToken(unit: StpUnit): string {
  return STP_TOKENS[unit];
}

export function tokenToStpUnit(token: string): StpUnit {
  return TOKEN_TO_STP[token] ?? "keV/µm";
}

export interface PlotUrlInput {
  particleId: number | null;
  materialId: number | null;
  programId: number;
  series: Array<{ programId: number; particleId: number; materialId: number }>;
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
  advancedOptions?: AdvancedOptions;
}

export interface PlotUrlDecoded {
  particleId: number | null;
  materialId: number | null;
  programId: number;
  series: Array<{ programId: number; particleId: number; materialId: number }>;
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
  advancedOptions: AdvancedOptions;
}

export function encodePlotUrl(input: PlotUrlInput): URLSearchParams {
  const params = new URLSearchParams();
  if (input.particleId !== null) params.set("particle", String(input.particleId));
  if (input.materialId !== null) params.set("material", String(input.materialId));
  params.set("program", input.programId === -1 ? "auto" : String(input.programId));
  if (input.series.length > 0) {
    params.set(
      "series",
      input.series.map((s) => `${s.programId}.${s.particleId}.${s.materialId}`).join(","),
    );
  }
  params.set("stp_unit", stpUnitToToken(input.stpUnit));
  params.set("xscale", input.xLog ? "log" : "lin");
  params.set("yscale", input.yLog ? "log" : "lin");

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

export function decodePlotUrl(params: URLSearchParams): PlotUrlDecoded {
  const parseFiniteInt = (raw: string | null): number | null => {
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const particleId = params.has("particle") ? parseFiniteInt(params.get("particle")) : null;
  const materialId = params.has("material") ? parseFiniteInt(params.get("material")) : null;
  const programParam = params.get("program");
  let programId: number;
  if (!programParam || programParam === "auto") {
    programId = -1;
  } else {
    const parsed = parseFiniteInt(programParam);
    programId = parsed ?? -1;
  }

  const seriesParam = params.get("series") ?? "";
  const series = seriesParam
    ? seriesParam
        .split(",")
        .map((triplet) => {
          const parts = triplet.split(".").map(Number);
          if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
          return { programId: parts[0], particleId: parts[1], materialId: parts[2] };
        })
        .filter(
          (s): s is { programId: number; particleId: number; materialId: number } => s !== null,
        )
    : [];

  const stpUnit = tokenToStpUnit(params.get("stp_unit") ?? "");
  const xLog = (params.get("xscale") ?? "log") === "log";
  const yLog = (params.get("yscale") ?? "log") === "log";

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

  return {
    particleId,
    materialId,
    programId,
    series,
    stpUnit,
    xLog,
    yLog,
    advancedOptions,
  };
}
