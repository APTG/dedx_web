import type { StpUnit } from "$lib/wasm/types";

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
}

export interface PlotUrlDecoded {
  particleId: number | null;
  materialId: number | null;
  programId: number;
  series: Array<{ programId: number; particleId: number; materialId: number }>;
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
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
  return params;
}

export function decodePlotUrl(params: URLSearchParams): PlotUrlDecoded {
  const particleId = params.has("particle")
    ? Number(params.get("particle"))
    : null;
  const materialId = params.has("material")
    ? Number(params.get("material"))
    : null;
  const programParam = params.get("program");
  const programId = !programParam || programParam === "auto" ? -1 : Number(programParam);

  const seriesParam = params.get("series") ?? "";
  const series = seriesParam
    ? seriesParam
        .split(",")
        .map((triplet) => {
          const parts = triplet.split(".").map(Number);
          if (parts.length !== 3 || parts.some(isNaN)) return null;
          return { programId: parts[0], particleId: parts[1], materialId: parts[2] };
        })
        .filter(
          (s): s is { programId: number; particleId: number; materialId: number } =>
            s !== null,
        )
    : [];

  const stpUnit = tokenToStpUnit(params.get("stp_unit") ?? "");
  const xLog = (params.get("xscale") ?? "log") === "log";
  const yLog = (params.get("yscale") ?? "log") === "log";

  return { particleId, materialId, programId, series, stpUnit, xLog, yLog };
}
