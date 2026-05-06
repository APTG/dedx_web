import type { EnergyUnit, MstarMode } from "$lib/wasm/types";
import { parseEnergyInput, type EnergySuffixUnit } from "$lib/utils/energy-parser";
import type { AdvancedOptions } from "$lib/wasm/types";

/**
 * URL contract major version. Bump only on breaking changes to query
 * param shape; minor/additive changes can ride along on the same major.
 * See `docs/04-feature-specs/shareable-urls.md` §3.1.
 */
export const CALCULATOR_URL_VERSION = 1;

/**
 * Master `eunit` parameter — limited to the three base `EnergyUnit` values
 * per shareable-urls.md §4.1. SI-prefixed forms (keV, GeV, TeV…) only
 * appear as per-row `:unit` suffixes, never as `eunit`.
 */
const VALID_MASTER_UNITS: ReadonlySet<EnergyUnit> = new Set<EnergyUnit>([
  "MeV",
  "MeV/nucl",
  "MeV/u",
]);

/**
 * Per-row `:unit` suffixes — every prefix the parser accepts. Mirrors
 * `EnergySuffixUnit` from energy-parser.ts so we never drift from what
 * the parser actually understands.
 */
const VALID_ROW_UNITS: ReadonlySet<EnergySuffixUnit> = new Set<EnergySuffixUnit>([
  "eV",
  "keV",
  "MeV",
  "GeV",
  "TeV",
  "MeV/nucl",
  "GeV/nucl",
  "TeV/nucl",
  "keV/nucl",
  "MeV/u",
  "GeV/u",
  "TeV/u",
  "keV/u",
]);

export interface CalculatorUrlRow {
  /**
   * The user-typed text without any `:unit` suffix — i.e. the bare
   * numeric portion as it would appear in the input box (e.g. `"500"`).
   */
  rawInput: string;
  /**
   * The unit detected for this row. May be a base `EnergyUnit` (MeV,
   * MeV/nucl, MeV/u) or any SI-prefixed `EnergySuffixUnit`.
   */
  unit: EnergySuffixUnit;
  /**
   * Whether the unit was carried as an explicit `:unit` URL suffix
   * (per-row mode) or inherited from the master `eunit` (master mode).
   */
  unitFromSuffix: boolean;
}

export interface CalculatorUrlState {
  particleId: number | null;
  materialId: number | null;
  programId: number | null;
  rows: CalculatorUrlRow[];
  masterUnit: EnergyUnit;

  /** Advanced mode fields (optional — only present when encoding/decoding advanced mode) */
  isAdvancedMode?: boolean;
  selectedProgramIds?: number[];
  hiddenProgramIds?: number[];
  quantityFocus?: "both" | "stp" | "csda";

  /** Advanced options (optional — only present when encoding/decoding advanced options) */
  advancedOptions?: AdvancedOptions;
  materialIsGas?: boolean; // Used when encoding to determine if agg_state is an override
}

function isMasterUnit(s: string): s is EnergyUnit {
  return VALID_MASTER_UNITS.has(s as EnergyUnit);
}

function isRowUnit(s: string): s is EnergySuffixUnit {
  return VALID_ROW_UNITS.has(s as EnergySuffixUnit);
}

/**
 * Normalize a row to its `(rawInput, unit)` pair as it should be encoded
 * in the URL.  We re-parse `rawInput` so a row carrying its unit inside
 * the text (e.g. `"500 keV"`) is encoded deterministically as
 * `500:keV` rather than the URL-encoded space form `500%20keV`.
 */
function normalizeRowForEncoding(
  row: CalculatorUrlRow,
  masterUnit: EnergyUnit,
): { numeric: string; unit: EnergySuffixUnit; explicit: boolean } | null {
  const trimmed = row.rawInput.trim();
  if (trimmed === "") return null;

  const parsed = parseEnergyInput(trimmed);
  if ("empty" in parsed || "error" in parsed) {
    // Invalid / unparseable rows are dropped from the encoded URL —
    // emitting the raw text could otherwise inject a `,` (e.g. `1,000`)
    // or `:` and corrupt the comma-separated `energies` tokenization
    // when the URL is loaded back. Decoder will treat the share-URL as
    // having one fewer row; users see an empty trailing input.
    return null;
  }

  const numeric = String(parsed.value);
  if (parsed.unit !== null) {
    // Suffix typed in the input — only serialise as per-row when it
    // differs from the master unit; otherwise the bare numeric form is
    // canonical (and round-trips identically through the decoder).
    if (parsed.unit === masterUnit) {
      return { numeric, unit: parsed.unit, explicit: false };
    }
    return { numeric, unit: parsed.unit, explicit: true };
  }
  // No suffix in text — fall back to the row's logical unit.
  const unit = row.unit ?? masterUnit;
  const explicit = row.unitFromSuffix && unit !== masterUnit;
  return { numeric, unit, explicit };
}

/**
 * Skip rows whose `rawInput` would corrupt the comma-separated `energies`
 * tokenization once embedded in the URL. The parser already rejects commas
 * (e.g. `1,000`) and colons (used as the per-row suffix separator), but
 * we double-check here so an invalid row never injects either character
 * into the encoded output.
 */
function isUrlSafeNumeric(s: string): boolean {
  return !s.includes(",") && !s.includes(":");
}

export function encodeCalculatorUrl(state: CalculatorUrlState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("urlv", String(CALCULATOR_URL_VERSION));
  if (state.particleId !== null) params.set("particle", String(state.particleId));
  if (state.materialId !== null) params.set("material", String(state.materialId));
  params.set("program", state.programId === null ? "auto" : String(state.programId));

  const encodedRows: string[] = [];
  for (const row of state.rows) {
    const norm = normalizeRowForEncoding(row, state.masterUnit);
    if (!norm) continue;
    if (!isUrlSafeNumeric(norm.numeric)) continue;
    encodedRows.push(norm.explicit ? `${norm.numeric}:${norm.unit}` : norm.numeric);
  }
  if (encodedRows.length > 0) {
    params.set("energies", encodedRows.join(","));
  }
  params.set("eunit", state.masterUnit);

  // Advanced mode params
  if (state.isAdvancedMode) {
    params.set("mode", "advanced");

    if (state.selectedProgramIds && state.selectedProgramIds.length > 0) {
      params.set("programs", state.selectedProgramIds.join(","));
    }

    if (state.hiddenProgramIds && state.hiddenProgramIds.length > 0) {
      params.set("hidden_programs", state.hiddenProgramIds.join(","));
    }

    // Always emit qfocus in advanced mode for canonical form
    params.set("qfocus", state.quantityFocus ?? "both");
  }

  // Advanced options params (only in advanced mode)
  if (state.isAdvancedMode && state.advancedOptions) {
    const opts = state.advancedOptions;

    // Aggregate state - only if it's an override (differs from built-in)
    if (opts.aggregateState !== undefined && state.materialIsGas !== undefined) {
      const builtInPhase = state.materialIsGas ? "gas" : "condensed";
      if (opts.aggregateState !== builtInPhase) {
        params.set("agg_state", opts.aggregateState);
      }
    } else if (opts.aggregateState !== undefined && state.materialIsGas === undefined) {
      // If materialIsGas not provided, encode the value as-is
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

    // Density override - only if set
    if (opts.densityOverride !== undefined) {
      params.set("density", String(opts.densityOverride));
    }

    // I-value override - only if set
    if (opts.iValueOverride !== undefined) {
      params.set("ival", String(opts.iValueOverride));
    }
  }

  return params;
}

/**
 * Build the query string for the URL bar. We intentionally emit `:` and
 * `,` literally (both are reserved-but-permitted in the query component
 * per RFC 3986 §3.4 / 2.2) so shareable URLs stay human-readable —
 * `?energies=100,500:keV` instead of the percent-encoded
 * `?energies=100%2C500%3AkeV` that `URLSearchParams.toString()` produces.
 */
export function calculatorUrlQueryString(state: CalculatorUrlState): string {
  const params = encodeCalculatorUrl(state);
  return params.toString().replaceAll("%3A", ":").replaceAll("%2C", ",");
}

export function decodeCalculatorUrl(params: URLSearchParams): CalculatorUrlState {
  const parseId = (v: string | null): number | null => {
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const parseProgramIds = (s: string): number[] => {
    return s
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
  };

  // urlv is parsed-but-defaulted: missing → 1 (back-compat per
  // shareable-urls §3.5). Future major bumps should branch here.
  // The value isn't returned in CalculatorUrlState because Stage 1
  // currently has no migration path; the parser just records the assumption
  // explicitly.
  const _urlv = parseInt(params.get("urlv") ?? "1", 10);
  void _urlv;

  const eunitRaw = params.get("eunit") ?? "MeV";
  const masterUnit: EnergyUnit = isMasterUnit(eunitRaw) ? eunitRaw : "MeV";

  const rows: CalculatorUrlRow[] = [];
  const energiesParam = params.get("energies");
  if (energiesParam) {
    for (const part of energiesParam.split(",")) {
      const colonIdx = part.lastIndexOf(":");
      if (colonIdx > 0) {
        const rawInput = part.slice(0, colonIdx);
        const unitStr = part.slice(colonIdx + 1);
        if (isRowUnit(unitStr)) {
          rows.push({ rawInput, unit: unitStr, unitFromSuffix: true });
          continue;
        }
      }
      rows.push({ rawInput: part, unit: masterUnit, unitFromSuffix: false });
    }
  }

  // Parse advanced mode params
  const mode = params.get("mode");
  const isAdvancedMode = mode === "advanced";
  const programsParam = params.get("programs");
  const selectedProgramIds =
    isAdvancedMode && programsParam ? parseProgramIds(programsParam) : undefined;
  const hiddenParam = params.get("hidden_programs");
  const hiddenProgramIds = hiddenParam ? parseProgramIds(hiddenParam) : undefined;
  const qfocus = params.get("qfocus") as "both" | "stp" | "csda" | null;
  const quantityFocus =
    isAdvancedMode && (qfocus === "both" || qfocus === "stp" || qfocus === "csda")
      ? qfocus
      : undefined;

  // Parse advanced options params (only in advanced mode)
  let advancedOptions: AdvancedOptions | undefined;
  if (isAdvancedMode) {
    const opts: Partial<AdvancedOptions> = {};

    const aggState = params.get("agg_state") as "gas" | "condensed" | null;
    if (aggState === "gas" || aggState === "condensed") {
      opts.aggregateState = aggState;
    }

    const interpScale = params.get("interp_scale");
    const interpMethod = params.get("interp_method");
    if (interpScale === "lin-lin" || interpMethod === "spline") {
      opts.interpolation = {
        scale: interpScale === "lin-lin" ? "linear" : "log",
        method: interpMethod === "spline" ? "cubic" : "linear",
      };
    }

    const mstarMode = params.get("mstar_mode");
    if (mstarMode && mstarMode !== "b" && ["a", "c", "d", "g", "h"].includes(mstarMode)) {
      opts.mstarMode = mstarMode as MstarMode;
    }

    const density = params.get("density");
    if (density !== null) {
      const d = parseFloat(density);
      if (Number.isFinite(d) && d > 0) {
        opts.densityOverride = d;
      }
    }

    const ival = params.get("ival");
    if (ival !== null) {
      const i = parseFloat(ival);
      if (Number.isFinite(i) && i > 0 && i <= 10000) {
        opts.iValueOverride = i;
      }
    }

    // Only include advancedOptions if at least one field is set
    if (Object.keys(opts).length > 0) {
      advancedOptions = opts as AdvancedOptions;
    }
  }

  const result: CalculatorUrlState = {
    particleId: parseId(params.get("particle")),
    materialId: parseId(params.get("material")),
    programId:
      params.get("program") === "auto" || !params.get("program")
        ? null
        : parseId(params.get("program")),
    rows: rows.length > 0 ? rows : [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
    masterUnit,
    isAdvancedMode,
  };
  if (selectedProgramIds) {
    result.selectedProgramIds = selectedProgramIds;
  }
  if (hiddenProgramIds) {
    result.hiddenProgramIds = hiddenProgramIds;
  }
  if (quantityFocus) {
    result.quantityFocus = quantityFocus;
  }
  if (advancedOptions) {
    result.advancedOptions = advancedOptions;
  }
  return result;
}
