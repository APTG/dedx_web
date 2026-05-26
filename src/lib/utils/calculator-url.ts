import type { EnergyUnit, MstarMode, InverseMode } from "$lib/wasm/types";
import type { StpBranchState } from "$lib/utils/inverse-stp";
import { parseEnergyInput, type EnergySuffixUnit } from "$lib/utils/energy-parser";
import type { AdvancedOptions } from "$lib/wasm/types";
import type { EntityId, ExternalSourceDescriptor } from "$lib/external-data/types";
import { parseEntityIdList, formatEntityIdList } from "$lib/external-data/ids";
import { parseExtdataParams, externalDataQuerySegments } from "$lib/external-data/url";

/**
 * URL contract major version. Bump only on breaking changes to query
 * param shape; minor/additive changes can ride along on the same major.
 * See `docs/04-feature-specs/shareable-urls.md` §3.1.
 */
export const CALCULATOR_URL_VERSION = 2;

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

/**
 * Inverse lookup row — similar to CalculatorUrlRow but for inverse mode inputs.
 * The unit is either a length suffix (nm/um/mm/cm/m for csda) or an STP unit
 * token (kev-um/mev-cm/mev-cm2-g for stp).
 */
export interface InverseLookupUrlRow {
  /** The user-typed text without any `:unit` suffix — i.e. the bare numeric portion. */
  rawInput: string;
  /** The unit detected for this row — length suffix or STP unit token. */
  unit: string;
  /** Whether the unit was carried as an explicit `:unit` URL suffix (per-row mode) or inherited from the master `iunit` (master mode). */
  unitFromSuffix: boolean;
}

/** Valid length units for CSDA range inverse mode (imode=csda). */
const VALID_CSDA_MASTER_UNITS = new Set(["nm", "um", "mm", "cm", "m"]);

/** Valid STP unit tokens for inverse STP mode (imode=stp). */
const VALID_STP_MASTER_UNITS = new Set(["kev-um", "mev-cm", "mev-cm2-g"]);

/** URL slug → EnergyUnit for the `uanchor` param. */
const UANCHOR_TO_UNIT: Readonly<Record<string, EnergyUnit>> = {
  mev: "MeV",
  "mev-nucl": "MeV/nucl",
  "mev-u": "MeV/u",
};

/** EnergyUnit → URL slug for the `uanchor` param. */
const UNIT_TO_UANCHOR: Readonly<Record<EnergyUnit, string>> = {
  MeV: "mev",
  "MeV/nucl": "mev-nucl",
  "MeV/u": "mev-u",
};

function isUanchorSlug(value: string): value is keyof typeof UANCHOR_TO_UNIT {
  return Object.hasOwn(UANCHOR_TO_UNIT, value);
}

/**
 * Decoded inverse mode from URL params.
 */
export interface InverseModeUrlState {
  imode: "csda" | "stp";
  lookups?: InverseLookupUrlRow[];
  iunit?: string;
}

/**
 * Decode inverse mode from URLSearchParams.
 * Returns { imode, lookups, iunit } or undefined if not present/invalid.
 *
 * Backward-compat: v1 `ivalues=` param is accepted and treated as `lookups=`.
 */
export function decodeInverseModeFromUrl(params: URLSearchParams): InverseModeUrlState | undefined {
  const imodeRaw = params.get("imode");
  const imode: "csda" | "stp" | undefined =
    imodeRaw === "csda" || imodeRaw === "stp" ? imodeRaw : undefined;

  if (!imode) return undefined;

  let lookups: InverseLookupUrlRow[] | undefined;
  let iunit: string | undefined;

  // v2 canonical param is `lookups=`; accept v1 `ivalues=` as fallback.
  const lookupsParam = params.get("lookups") ?? params.get("ivalues");
  if (lookupsParam) {
    lookups = [];
    for (const part of lookupsParam.split(",")) {
      const colonIdx = part.lastIndexOf(":");
      if (colonIdx > 0) {
        const rawInput = part.slice(0, colonIdx);
        const unitStr = part.slice(colonIdx + 1);
        lookups.push({ rawInput, unit: unitStr, unitFromSuffix: true });
      } else {
        lookups.push({ rawInput: part, unit: "", unitFromSuffix: false });
      }
    }
  }

  // Validate and default iunit based on imode
  const iunitRaw = params.get("iunit") ?? undefined;
  if (imode === "csda") {
    iunit = iunitRaw && VALID_CSDA_MASTER_UNITS.has(iunitRaw) ? iunitRaw : "cm";
  } else if (imode === "stp") {
    iunit = iunitRaw && VALID_STP_MASTER_UNITS.has(iunitRaw) ? iunitRaw : "kev-um";
  }

  // Assign default unit to rows that don't have per-row suffix
  if (lookups && iunit) {
    for (const row of lookups) {
      if (!row.unitFromSuffix) {
        row.unit = iunit;
      }
    }
  }

  const state: InverseModeUrlState = { imode };
  if (lookups !== undefined) state.lookups = lookups;
  if (iunit !== undefined) state.iunit = iunit;
  return state;
}

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

/** Element specification for custom compounds in URL encoding. */
export interface MatElementUrl {
  atomicNumber: number;
  atomCount: number;
}

export interface CalculatorUrlState {
  particleId: number | null;
  materialId: number | null;
  programId: number | null;
  rows: CalculatorUrlRow[];
  masterUnit: EnergyUnit;

  /** External data sources declared via `extdata` URL params (in declaration order). */
  externalSources?: ExternalSourceDescriptor[];

  /** Advanced mode fields (optional — only present when encoding/decoding advanced mode) */
  isAdvancedMode?: boolean;
  /** Compare-across dimension (advanced only). Omitted when "none"/"single". */
  across?: "particle" | "material" | "program";
  /** Multi-selected particle IDs when across=particle (advanced only). */
  selectedParticleIds?: number[];
  /** Multi-selected material IDs when across=material (advanced only). */
  selectedMaterialIds?: EntityId[];
  /** Supports mixed built-in numeric IDs and external `ext:{label}:{id}` refs. */
  selectedProgramIds?: EntityId[];
  quantityFocus?: "stp" | "range";

  /** Advanced options (optional — only present when encoding/decoding advanced options) */
  advancedOptions?: AdvancedOptions;
  materialIsGas?: boolean | undefined; // Used when encoding to determine if agg_state is an override

  /** Custom compound material fields (optional — only present when materialIsCustom=true) */
  materialIsCustom?: boolean;
  matName?: string | undefined;
  matDensity?: number | undefined;
  matElements?: MatElementUrl[] | undefined;
  matIval?: number | undefined;
  matPhase?: "gas" | "condensed" | undefined;
  fromUrlWarning?: string | undefined; // Set by decoder when validation fails

  /** Inverse lookup fields (optional — only present when encoding/decoding inverse mode) */
  imode?: InverseMode;
  lookups?: InverseLookupUrlRow[];
  iunit?: string;
  /** STP column-visibility state (`istpbranch=` param). Only meaningful when imode=stp. */
  istpBranchState?: StpBranchState;

  /** Energy unit anchor selection (`uanchor=` URL param) when explicitly present and valid. */
  energyAnchor?: EnergyUnit;
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

const ACROSS_TO_URL_TOKEN = {
  particle: "particles",
  material: "materials",
  program: "programs",
} as const;

function toAcrossUrlToken(across: "particle" | "material" | "program") {
  return ACROSS_TO_URL_TOKEN[across];
}

function fromAcrossUrlToken(raw: string | null): "particle" | "material" | "program" | undefined {
  if (!raw || raw === "none") return undefined;
  if (raw === "particle" || raw === "particles") return "particle";
  if (raw === "material" || raw === "materials") return "material";
  if (raw === "program" || raw === "programs") return "program";
  return undefined;
}

export function encodeCalculatorUrl(state: CalculatorUrlState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("urlv", String(CALCULATOR_URL_VERSION));
  // extdata is NOT added to URLSearchParams here; it is emitted by
  // calculatorUrlQueryString using externalDataQuerySegments so that the
  // URL portion stays correctly percent-encoded (see the serializer warning
  // in shareable-urls-formal.md §2 and the implementation plan).
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

    // programs= is emitted whenever selectedProgramIds is non-empty (pre-existing multi-program
    // comparison feature, independent of the across= comparison dimension).
    if (state.selectedProgramIds && state.selectedProgramIds.length > 0) {
      params.set("programs", formatEntityIdList(state.selectedProgramIds));
    }

    // across= token: emit when a comparison dimension is active.
    // particles= is only emitted when across=particle (state value) is set and the list is non-empty.
    // For material/program dimensions the token is emitted without a matching list param here
    // (the caller is responsible for populating those lists separately as needed).
    if (
      state.across === "particle" &&
      state.selectedParticleIds &&
      state.selectedParticleIds.length > 0
    ) {
      params.set("particles", state.selectedParticleIds.join(","));
      params.set("across", toAcrossUrlToken(state.across));
    } else if (state.across === "material") {
      params.set("across", toAcrossUrlToken(state.across));
    } else if (state.across === "program") {
      params.set("across", toAcrossUrlToken(state.across));
    }

    // Omit qshow when it is the default ("stp") per ADR 006 default-omission rule.
    const qfocusVal = state.quantityFocus ?? "stp";
    if (qfocusVal !== "stp") {
      params.set("qshow", qfocusVal);
    }

    // Custom compound material params (only when materialIsCustom=true)
    if (state.materialIsCustom && state.materialId === null) {
      params.set("material", "custom");
      if (state.matName) {
        params.set("mat_name", state.matName);
      }
      if (state.matDensity !== undefined) {
        params.set("mat_density", String(state.matDensity));
      }
      if (state.matElements && state.matElements.length > 0) {
        // Sort by ascending Z and encode as Z:count,Z:count
        const sorted = [...state.matElements].sort((a, b) => a.atomicNumber - b.atomicNumber);
        const encoded = sorted.map((e) => `${e.atomicNumber}:${e.atomCount}`).join(",");
        params.set("mat_elements", encoded);
      }
      if (state.matIval !== undefined) {
        params.set("mat_ival", String(state.matIval));
      }
      if (state.matPhase && state.matPhase === "gas") {
        // Only encode gas; condensed is default and omitted
        params.set("mat_phase", "gas");
      }
    }
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

  // Inverse lookup params (only when imode is set)
  if (state.imode) {
    params.set("imode", state.imode);

    if (state.lookups?.length) {
      const encodedLookups: string[] = [];
      for (const row of state.lookups) {
        const trimmed = row.rawInput.trim();
        if (trimmed === "") continue;
        // Encode as `rawInput:unit` when unitFromSuffix, else bare `rawInput`
        if (row.unitFromSuffix) {
          encodedLookups.push(`${trimmed}:${row.unit}`);
        } else {
          encodedLookups.push(trimmed);
        }
      }
      if (encodedLookups.length > 0) {
        params.set("lookups", encodedLookups.join(","));
      }
    }

    if (state.iunit) {
      params.set("iunit", state.iunit);
    }

    if (state.imode === "stp" && state.istpBranchState === "both") {
      params.set("istpbranch", "both");
    }
  }

  if (state.energyAnchor && state.energyAnchor !== "MeV") {
    params.set("uanchor", UNIT_TO_UANCHOR[state.energyAnchor]);
  }

  return params;
}

/**
 * Build the query string for the URL bar.
 *
 * Canonical order: `urlv`, then `extdata` (one per source), then the rest.
 *
 * For extdata, the URL portion is kept percent-encoded via `encodeURIComponent`
 * so that `https:` in the external store URL stays as `https%3A` and never
 * appears as a literal colon — which would break the formal grammar's
 * `extdata-pair` rule. Only the label separator colon is emitted literally.
 *
 * For all other params we keep `:` and `,` literal (both are
 * reserved-but-permitted in the query component per RFC 3986 §3.4/2.2)
 * so shareable URLs stay human-readable.
 */
export function calculatorUrlQueryString(state: CalculatorUrlState): string {
  const params = encodeCalculatorUrl(state);
  const parts: string[] = [];

  // 1. urlv first.
  const urlv = params.get("urlv");
  if (urlv !== null) parts.push(`urlv=${urlv}`);

  // 2. extdata in source declaration order (specially encoded).
  if (state.externalSources && state.externalSources.length > 0) {
    parts.push(...externalDataQuerySegments(state.externalSources));
  }

  // 3. Remaining params (excluding urlv which is already emitted).
  const remaining = new URLSearchParams();
  for (const [key, value] of params) {
    if (key !== "urlv") {
      remaining.append(key, value);
    }
  }
  const restStr = remaining.toString().replaceAll("%3A", ":").replaceAll("%2C", ",");
  if (restStr) parts.push(restStr);

  return parts.join("&");
}

export function decodeCalculatorUrl(rawParams: URLSearchParams): CalculatorUrlState {
  // Extract extdata BEFORE resolveLastWins; last-wins would drop all but the
  // last occurrence, collapsing the ordered source list.
  const { sources: externalSources } = parseExtdataParams(rawParams);

  // Strip extdata from the params we pass to last-wins resolution.
  const paramsNoExtdata = new URLSearchParams();
  for (const [key, value] of rawParams) {
    if (key !== "extdata") paramsNoExtdata.append(key, value);
  }

  // Resolve duplicate params using "last wins" semantics per §3.2
  const params = resolveLastWins(paramsNoExtdata);

  const parseId = (v: string | null): number | null => {
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
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

  const uanchorRaw = params.get("uanchor") ?? "";
  const energyAnchor: EnergyUnit | undefined = isUanchorSlug(uanchorRaw)
    ? UANCHOR_TO_UNIT[uanchorRaw]
    : undefined;

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

  // across= and plural comparison lists (valid only in advanced mode per spec §3.3).
  const acrossRaw = params.get("across");
  const acrossCandidate = isAdvancedMode ? fromAcrossUrlToken(acrossRaw) : undefined;

  let selectedParticleIds: number[] | undefined;
  if (isAdvancedMode && acrossCandidate === "particle") {
    const particlesParam = params.get("particles");
    if (particlesParam) {
      const ids = particlesParam
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 118);
      if (ids.length > 0) selectedParticleIds = ids;
    }
  }

  const programsParam = params.get("programs");
  const selectedProgramIds: EntityId[] | undefined =
    isAdvancedMode && programsParam ? parseEntityIdList(programsParam) : undefined;
  const materialsParam = params.get("materials");
  const selectedMaterialIds: EntityId[] | undefined =
    isAdvancedMode && acrossCandidate === "material" && materialsParam
      ? parseEntityIdList(materialsParam)
      : undefined;

  const across: "particle" | "material" | "program" | undefined = acrossCandidate;

  // Silently drop legacy hidden_programs param (per ADR 006 / #561).
  // Parse qshow (v2) or migrate legacy qfocus (v1) per ADR 006 migration rules.
  const qshowRaw = params.get("qshow") as "stp" | "range" | null;
  const qfocusRaw = params.get("qfocus");
  let resolvedQshow: "stp" | "range" | null = null;
  if (qshowRaw === "stp" || qshowRaw === "range") {
    resolvedQshow = qshowRaw;
  } else if (!qshowRaw && qfocusRaw) {
    // Legacy migration: qfocus=stp→stp, qfocus=csda→range, qfocus=both→null (default)
    if (qfocusRaw === "stp") resolvedQshow = "stp";
    else if (qfocusRaw === "csda") resolvedQshow = "range";
    // qfocus=both → omit (default)
  }
  const quantityFocus = isAdvancedMode && resolvedQshow !== null ? resolvedQshow : undefined;

  // Parse custom compound material params (only in advanced mode)
  let materialIsCustom: boolean | undefined;
  let matName: string | undefined;
  let matDensity: number | undefined;
  let matElements: MatElementUrl[] | undefined;
  let matIval: number | undefined;
  let matPhase: "gas" | "condensed" | undefined;
  let fromUrlWarning: string | undefined;

  if (isAdvancedMode) {
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
            // Malformed entry - skip but note the issue
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
            // Invalid Z - skip this element
            continue;
          }
          if (count === undefined) {
            fromUrlWarning = fromUrlWarning
              ? `${fromUrlWarning}; malformed mat_elements entry`
              : "mat_elements: malformed entries";
            continue;
          }
          if (count <= 0) {
            // Invalid atom count - skip this element
            continue;
          }
          // Collapse duplicates by summing counts
          elementMap.set(z, (elementMap.get(z) ?? 0) + count);
        }
        if (elementMap.size > 0) {
          matElements = Array.from(elementMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([atomicNumber, atomCount]) => ({ atomicNumber, atomCount }));
        } else if (matElementsRaw) {
          // All elements were invalid
          fromUrlWarning = fromUrlWarning
            ? `${fromUrlWarning}; mat_elements: all entries invalid`
            : "mat_elements: all entries invalid";
        }
      }

      matIval = parseStrictFiniteNumber(matIvalRaw);
      if (matIvalRaw !== null && matIval === undefined) {
        fromUrlWarning = fromUrlWarning
          ? `${fromUrlWarning}; mat_ival invalid`
          : "mat_ival: invalid";
      }
      if (matIval !== undefined && (matIval <= 0 || matIval > 10000)) {
        // Out of range - silently ignore (don't set)
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
      // But keep fromUrlWarning so we can report what went wrong
      if (fromUrlWarning) {
        materialIsCustom = undefined;
        matName = undefined;
        matDensity = undefined;
        matElements = undefined;
        matIval = undefined;
        matPhase = undefined;
      }
    }
  }

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

  // Parse inverse lookup params (imode, lookups, iunit)
  const imodeRaw = params.get("imode");
  const imode: InverseMode | undefined =
    imodeRaw === "csda" || imodeRaw === "stp" ? imodeRaw : undefined;

  let lookups: InverseLookupUrlRow[] | undefined;
  let iunit: string | undefined;

  if (imode) {
    // v2 canonical param is `lookups=`; accept v1 `ivalues=` as fallback.
    const lookupsParam = params.get("lookups") ?? params.get("ivalues");
    if (lookupsParam) {
      lookups = [];
      for (const part of lookupsParam.split(",")) {
        const colonIdx = part.lastIndexOf(":");
        if (colonIdx > 0) {
          const rawInput = part.slice(0, colonIdx);
          const unitStr = part.slice(colonIdx + 1);
          lookups.push({ rawInput, unit: unitStr, unitFromSuffix: true });
        } else {
          lookups.push({ rawInput: part, unit: "", unitFromSuffix: false });
        }
      }
    }

    // Validate and default iunit based on imode
    const iunitRaw = params.get("iunit") ?? undefined;
    if (imode === "csda") {
      iunit = iunitRaw && VALID_CSDA_MASTER_UNITS.has(iunitRaw) ? iunitRaw : "cm";
    } else if (imode === "stp") {
      iunit = iunitRaw && VALID_STP_MASTER_UNITS.has(iunitRaw) ? iunitRaw : "kev-um";
    }

    // Assign default unit to rows that don't have per-row suffix
    if (lookups && iunit) {
      for (const row of lookups) {
        if (!row.unitFromSuffix) {
          row.unit = iunit;
        }
      }
    }
  }

  // Determine materialId based on custom compound parsing
  const materialRaw = params.get("material");
  let materialId: number | null = parseId(materialRaw);
  if (materialRaw === "custom" && fromUrlWarning) {
    // Validation failed - fall back to liquid water (ID 276)
    materialId = 276;
  } else if (materialRaw === "custom" && !fromUrlWarning && isAdvancedMode) {
    // Valid custom compound - materialId should be null
    materialId = null;
  }

  const result: CalculatorUrlState = {
    particleId: parseId(params.get("particle")),
    materialId,
    programId:
      params.get("program") === "auto" || !params.get("program")
        ? null
        : parseId(params.get("program")),
    rows: rows.length > 0 ? rows : [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
    masterUnit,
    isAdvancedMode,
  };
  if (externalSources.length > 0) {
    result.externalSources = externalSources;
  }
  if (across) {
    result.across = across;
  }
  if (selectedParticleIds) {
    result.selectedParticleIds = selectedParticleIds;
  }
  if (selectedMaterialIds) {
    result.selectedMaterialIds = selectedMaterialIds;
  }
  if (selectedProgramIds && selectedProgramIds.length > 0) {
    result.selectedProgramIds = selectedProgramIds;
  }
  if (quantityFocus) {
    result.quantityFocus = quantityFocus;
  }
  if (advancedOptions) {
    result.advancedOptions = advancedOptions;
  }
  // Always include fromUrlWarning if set (even if validation failed)
  if (fromUrlWarning) {
    result.fromUrlWarning = fromUrlWarning;
  }
  if (materialIsCustom) {
    result.materialIsCustom = materialIsCustom;
    result.matName = matName;
    result.matDensity = matDensity;
    result.matElements = matElements;
    result.matIval = matIval;
    result.matPhase = matPhase;
  }
  if (imode) {
    result.imode = imode;
  }
  if (lookups) {
    result.lookups = lookups;
  }
  if (iunit) {
    result.iunit = iunit;
  }
  if (imode === "stp") {
    const istpBranchRaw = params.get("istpbranch");
    const istpBranchState: StpBranchState =
      istpBranchRaw === "both" || istpBranchRaw === "lo" ? istpBranchRaw : "hi";
    result.istpBranchState = istpBranchState;
  }
  if (energyAnchor) {
    result.energyAnchor = energyAnchor;
  }
  return result;
}
