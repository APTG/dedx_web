import type { EnergyUnit, MstarMode, InverseMode } from "$lib/wasm/types";
import type { StpBranchState } from "$lib/utils/inverse-stp";
import { parseEnergyInput, type EnergySuffixUnit } from "$lib/utils/energy-parser";
import type { AdvancedOptions } from "$lib/wasm/types";
import type { EntityId, ExternalSourceDescriptor } from "$lib/external-data/types";
import { parseEntityIdList, formatEntityIdList } from "$lib/external-data/ids";
import { parseExtdataParams, externalDataQuerySegments } from "$lib/external-data/url";
import { parseQuery, UrlParseError } from "$lib/utils/url-parse";
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
  type CustomCompoundPartial,
} from "$lib/utils/url-shared";

export type { MatElementUrl, CustomCompoundPartial };

/**
 * URL contract major version. Bump only on breaking changes to query
 * param shape; minor/additive changes can ride along on the same major.
 * See `docs/04-feature-specs/shareable-urls.md` §3.1.
 */
export const CALCULATOR_URL_VERSION = 3;

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

/**
 * Default `sunit=` token for a material phase — condensed materials default
 * to "kev-um", gas materials to "mev-cm2-g" (mirrors `getStpDisplayUnit()` in
 * `calculator.svelte.ts`). Used to omit `sunit=` from canonical output when
 * it's redundant with the phase default (§4 item 11), not just when absent.
 */
function defaultSunitToken(materialIsGas: boolean | undefined): string {
  return materialIsGas ? "mev-cm2-g" : "kev-um";
}

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
 * Resolve the active inverse-lookup tab from the v3-canonical `calc=` token,
 * falling back to the retired `imode=` (shipped before issue #841) only when
 * `calc=` is entirely absent — an explicit `calc=forward` (or any other
 * value) always wins over a stale `imode=`.
 */
function resolveImodeToken(
  calcRaw: string | null,
  imodeRaw: string | null,
): "csda" | "stp" | undefined {
  if (calcRaw === "range") return "csda";
  if (calcRaw === "inverse-stp") return "stp";
  if (calcRaw !== null) return undefined;
  return imodeRaw === "csda" || imodeRaw === "stp" ? imodeRaw : undefined;
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
 * Backward-compat: v1 `ivalues=` param is accepted and treated as `lookups=`,
 * and the retired `imode=`/`iunit=` names (shipped before issue #841) are
 * accepted as a fallback when the v3-canonical `calc=`/`runit=`/`sunit=`
 * tokens are absent — see `shareable-urls-formal.md` §3.4.
 */
export function decodeInverseModeFromUrl(params: URLSearchParams): InverseModeUrlState | undefined {
  const imode = resolveImodeToken(params.get("calc"), params.get("imode"));

  if (!imode) return undefined;

  let lookups: InverseLookupUrlRow[] | undefined;
  let iunit: string | undefined;

  // v2 canonical param is `lookups=`; accept v1 `ivalues=` as fallback.
  const lookupsParam = params.get("lookups") ?? params.get("ivalues");
  if (lookupsParam) {
    lookups = [];
    for (const part of lookupsParam.split(URL_LIST_SPLIT_RE)) {
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

  // Validate and default iunit based on imode. Canonical wire param is
  // `runit=` (csda) / `sunit=` (stp); the retired `iunit=` is a fallback.
  if (imode === "csda") {
    const runitRaw = params.get("runit") ?? params.get("iunit") ?? undefined;
    iunit = runitRaw && VALID_CSDA_MASTER_UNITS.has(runitRaw) ? runitRaw : "cm";
  } else if (imode === "stp") {
    const sunitRaw = params.get("sunit") ?? params.get("iunit") ?? undefined;
    iunit = sunitRaw && VALID_STP_MASTER_UNITS.has(sunitRaw) ? sunitRaw : "kev-um";
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
  /**
   * Best-effort `mat_*` fields retained even on validation failure, so the
   * compound editor can pre-fill and highlight failed inputs (issue #648, Gap B).
   * Present whenever `material=custom` was seen in advanced mode.
   */
  matPartial?: CustomCompoundPartial | undefined;
  /**
   * Provenance hint (`matsrc=` URL param). `"transient"` ⇒ the sender shared a
   * custom compound that was loaded from another URL and never saved to their
   * library. Default/omitted ⇒ `"saved"`. Encoder emits only `"transient"`.
   */
  matSrc?: "transient" | "saved" | undefined;

  /** Inverse lookup fields (optional — only present when encoding/decoding inverse mode) */
  imode?: InverseMode;
  lookups?: InverseLookupUrlRow[];
  iunit?: string;
  /** STP column-visibility state (`istpbranch=` param). Only meaningful when imode=stp. */
  istpBranchState?: StpBranchState;

  /** Energy unit anchor selection (`uanchor=` URL param) when explicitly present and valid. */
  energyAnchor?: EnergyUnit;

  /** Stopping-power output unit token (`sunit=`), present only when the user
   *  has made an explicit choice. Shared with the plot page. */
  sunit?: string;
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
    // emitting the raw text could otherwise inject a separator (`,`/`~`,
    // e.g. `1,000`) or `:` and corrupt the `energies` tokenization when the
    // URL is loaded back. Decoder will treat the share-URL as having one
    // fewer row; users see an empty trailing input.
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
 * Skip rows whose `rawInput` would corrupt the `energies` tokenization once
 * embedded in the URL. The parser already rejects commas (e.g. `1,000`) and
 * colons (used as the per-row suffix separator), but we double-check here so an
 * invalid row never injects a list separator (`,` legacy / `~` canonical) or a
 * `:` into the encoded output.
 */
function isUrlSafeNumeric(s: string): boolean {
  return !s.includes(",") && !s.includes("~") && !s.includes(":");
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
    params.set("energies", encodedRows.join(URL_LIST_SEPARATOR));
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
    // Plural lists (particles, materials) are emitted when their corresponding across token is active.
    // For program dimension, the token is emitted here while programs= is emitted above.
    if (
      state.across === "particle" &&
      state.selectedParticleIds &&
      state.selectedParticleIds.length > 0
    ) {
      params.set("particles", state.selectedParticleIds.join(URL_LIST_SEPARATOR));
      params.set("across", toAcrossUrlToken(state.across));
    } else if (
      state.across === "material" &&
      state.selectedMaterialIds &&
      state.selectedMaterialIds.length > 0
    ) {
      params.set("materials", formatEntityIdList(state.selectedMaterialIds));
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
        params.set("mat_elements", encodeMatElements(state.matElements));
      }
      if (state.matIval !== undefined) {
        params.set("mat_ival", String(state.matIval));
      }
      if (state.matPhase && state.matPhase === "gas") {
        // Only encode gas; condensed is default and omitted
        params.set("mat_phase", "gas");
      }
      // Provenance hint — only emit "transient" (saved is the omitted default),
      // so existing shared URLs are byte-for-byte unchanged (issue #648).
      if (state.matSrc === "transient") {
        params.set("matsrc", "transient");
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

  // Inverse lookup params (only when imode is set). Canonical wire param is
  // `calc=range|inverse-stp` (`forward` is the default and omitted); the
  // retired `imode=csda|stp` is never emitted (§3.4).
  if (state.imode) {
    params.set("calc", state.imode === "csda" ? "range" : "inverse-stp");

    if (state.lookups?.length) {
      const encodedLookups: string[] = [];
      for (const row of state.lookups) {
        const trimmed = row.rawInput.trim();
        if (trimmed === "") continue;
        // Drop rows whose token would inject a list separator (`,`/`~`) or a `:`
        // into the canonical URL — same guard as `energies` — so a bad value
        // (e.g. `1,000` or `100~200`) can't corrupt tokenization on reload or
        // reintroduce the linkifier truncation of #672.
        if (!isUrlSafeNumeric(trimmed)) continue;
        // Encode as `rawInput:unit` when unitFromSuffix, else bare `rawInput`
        if (row.unitFromSuffix) {
          encodedLookups.push(`${trimmed}:${row.unit}`);
        } else {
          encodedLookups.push(trimmed);
        }
      }
      if (encodedLookups.length > 0) {
        params.set("lookups", encodedLookups.join(URL_LIST_SEPARATOR));
      }
    }

    // Range unit anchor — omitted when equal to the "cm" default (§4 item 10).
    // The stp equivalent is folded into the shared `sunit=` param below,
    // since `runit=`/`sunit=` and the retired `iunit=` are the same concept
    // as the Stopping Power column header unit for calc=inverse-stp (§2).
    if (state.imode === "csda" && state.iunit && state.iunit !== "cm") {
      params.set("runit", state.iunit);
    }

    if (state.imode === "stp" && state.istpBranchState === "both") {
      params.set("istpbranch", "both");
    }
  }

  if (state.energyAnchor && state.energyAnchor !== "MeV") {
    params.set("uanchor", UNIT_TO_UANCHOR[state.energyAnchor]);
  }

  // Stopping-power output unit — omitted when it matches the material-phase
  // default (§4 item 11: "kev-um" condensed / "mev-cm2-g" gas), so a
  // round-tripped link never carries a redundant explicit token.
  // `calc=inverse-stp`'s master unit (`state.iunit`) shares this same wire
  // param (§2, §3.4) and takes precedence when present.
  const defaultSunit = defaultSunitToken(state.materialIsGas);
  const rawSunit = state.imode === "stp" && state.iunit ? state.iunit : state.sunit;
  const effectiveSunit = rawSunit && rawSunit !== defaultSunit ? rawSunit : undefined;
  if (effectiveSunit) {
    params.set("sunit", effectiveSunit);
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
 * For all other params we keep `:` literal (reserved-but-permitted in the query
 * component per RFC 3986 §3.4/2.2) and restore the `~` list separator (which
 * `URLSearchParams` percent-encodes as `%7E`), so shareable URLs stay
 * human-readable and survive messenger/email auto-linkification (issue #672).
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
  const restStr = remaining
    .toString()
    .replaceAll("%3A", ":")
    .replaceAll(URL_LIST_SEPARATOR_ENCODED, URL_LIST_SEPARATOR);
  if (restStr) parts.push(restStr);

  return parts.join("&");
}

/**
 * Resolve a parsed query (AST) into calculator URL state.
 *
 * Applies §3 semantics: duplicate resolution (last-wins, via the token view),
 * defaults, advanced-mode gating, and validation. External sources are
 * resolved separately (`parseExtdataParams`) and passed in. Any `diagnostics`
 * array is appended with dropped/invalid-param messages carrying source spans.
 *
 * Separately exported so the semantic layer can be unit-tested without a page
 * render (issue #477).
 */
export function resolveCalculatorState(
  ast: QueryNode,
  externalSources: ExternalSourceDescriptor[],
  diagnostics: Diagnostic[] = [],
): CalculatorUrlState {
  const t = buildTokenView(ast);

  const parseId = (v: string | null): number | null => {
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // urlv is parsed-but-defaulted; version negotiation happens before resolution
  // (see url-version.ts). Recorded here only to document the assumption.
  const _urlv = parseInt(t.get("urlv") ?? "1", 10);
  void _urlv;

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

  const eunitRaw = t.get("eunit") ?? "MeV";
  const masterUnit: EnergyUnit = isMasterUnit(eunitRaw) ? eunitRaw : "MeV";

  const uanchorRaw = t.get("uanchor") ?? "";
  const energyAnchor: EnergyUnit | undefined = isUanchorSlug(uanchorRaw)
    ? UANCHOR_TO_UNIT[uanchorRaw]
    : undefined;

  // Stopping-power output unit token: passing it raw so the downstream decoder
  // can treat an explicit but invalid parameter as a signal to fall back to the
  // default (clearing any stale in-memory override).
  const sunit = t.get("sunit") ?? undefined;

  const rows: CalculatorUrlRow[] = [];
  const energiesParam = t.get("energies");
  if (energiesParam) {
    for (const part of energiesParam.split(URL_LIST_SPLIT_RE)) {
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
  const mode = t.get("mode");
  const isAdvancedMode = mode === "advanced";

  // across= and plural comparison lists (valid only in advanced mode per spec §3.3).
  const acrossRaw = t.get("across");
  const acrossCandidate = isAdvancedMode ? fromAcrossUrlToken(acrossRaw) : undefined;

  let selectedParticleIds: number[] | undefined;
  if (isAdvancedMode && acrossCandidate === "particle") {
    const particlesParam = t.get("particles");
    if (particlesParam) {
      const ids = particlesParam
        .split(URL_LIST_SPLIT_RE)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 118);
      if (ids.length > 0) selectedParticleIds = ids;
    }
  }

  const programsParam = t.get("programs");
  const selectedProgramIds: EntityId[] | undefined =
    isAdvancedMode && programsParam ? parseEntityIdList(programsParam) : undefined;
  const materialsParam = t.get("materials");
  const selectedMaterialIds: EntityId[] | undefined =
    isAdvancedMode && acrossCandidate === "material" && materialsParam
      ? parseEntityIdList(materialsParam)
      : undefined;

  const across: "particle" | "material" | "program" | undefined = acrossCandidate;

  // Silently drop legacy hidden_programs param (per ADR 006 / #561).
  // Parse qshow (v2) or migrate legacy qfocus (v1) per ADR 006 migration rules.
  const qshowRaw = t.get("qshow") as "stp" | "range" | null;
  const qfocusRaw = t.get("qfocus");
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
  let matPartial: CustomCompoundPartial | undefined;
  let matSrc: "transient" | "saved" | undefined;

  if (isAdvancedMode && t.get("material") === "custom") {
    const fields = parseCustomCompound(t.get, { get: t.span }, diagnostics);
    fromUrlWarning = fields.fromUrlWarning;
    // Retain best-effort fields regardless of validation so the editor can
    // pre-fill and highlight failed inputs (Gap B).
    matPartial = fields.partial;
    const matsrcRaw = t.get("matsrc");
    matSrc = matsrcRaw === "transient" ? "transient" : matsrcRaw === "saved" ? "saved" : undefined;
    // On validation failure keep the warning but drop the parsed fields; the
    // caller falls back to a built-in material (276).
    if (!fromUrlWarning) {
      materialIsCustom = true;
      matName = fields.matName;
      matDensity = fields.matDensity;
      matElements = fields.matElements;
      matIval = fields.matIval;
      matPhase = fields.matPhase;
    }
  }

  // Parse advanced options params (only in advanced mode)
  let advancedOptions: AdvancedOptions | undefined;
  if (isAdvancedMode) {
    const opts: Partial<AdvancedOptions> = {};

    const aggState = t.get("agg_state") as "gas" | "condensed" | null;
    if (aggState === "gas" || aggState === "condensed") {
      opts.aggregateState = aggState;
    }

    const interpScale = t.get("interp_scale");
    const interpMethod = t.get("interp_method");
    if (interpScale === "lin-lin" || interpMethod === "spline") {
      opts.interpolation = {
        scale: interpScale === "lin-lin" ? "linear" : "log",
        method: interpMethod === "spline" ? "cubic" : "linear",
      };
    }

    const mstarMode = t.get("mstar_mode");
    if (mstarMode && mstarMode !== "b" && ["a", "c", "d", "g", "h"].includes(mstarMode)) {
      opts.mstarMode = mstarMode as MstarMode;
    }

    const density = t.get("density");
    if (density !== null) {
      const d = parseFloat(density);
      if (Number.isFinite(d) && d > 0) {
        opts.densityOverride = d;
      }
    }

    const ival = t.get("ival");
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

  // Parse inverse lookup params (calc → imode, lookups, runit/sunit → iunit).
  // Canonical wire params are `calc=`/`runit=`/`sunit=`; the retired
  // `imode=`/`iunit=` (shipped before issue #841) are accepted as a fallback
  // when the canonical tokens are absent — see §3.4.
  const imode: InverseMode | undefined = resolveImodeToken(t.get("calc"), t.get("imode"));

  let lookups: InverseLookupUrlRow[] | undefined;
  let iunit: string | undefined;

  if (imode) {
    // v2 canonical param is `lookups=`; accept v1 `ivalues=` as fallback.
    const lookupsParam = t.get("lookups") ?? t.get("ivalues");
    if (lookupsParam) {
      lookups = [];
      for (const part of lookupsParam.split(URL_LIST_SPLIT_RE)) {
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

    // Validate and default iunit based on imode. `runit=` (csda) / `sunit=`
    // (stp, same variable as the shared Stopping Power column unit above)
    // take precedence over the retired `iunit=`.
    if (imode === "csda") {
      const runitRaw = t.get("runit") ?? t.get("iunit") ?? undefined;
      iunit = runitRaw && VALID_CSDA_MASTER_UNITS.has(runitRaw) ? runitRaw : "cm";
    } else if (imode === "stp") {
      const sunitRaw = sunit ?? t.get("iunit") ?? undefined;
      iunit = sunitRaw && VALID_STP_MASTER_UNITS.has(sunitRaw) ? sunitRaw : "kev-um";
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
  const materialRaw = t.get("material");
  let materialId: number | null = parseId(materialRaw);
  if (materialRaw === "custom" && fromUrlWarning) {
    // Validation failed - fall back to liquid water (ID 276)
    materialId = 276;
  } else if (materialRaw === "custom" && !fromUrlWarning && isAdvancedMode) {
    // Valid custom compound - materialId should be null
    materialId = null;
  }

  const result: CalculatorUrlState = {
    particleId: parseId(t.get("particle")),
    materialId,
    programId: t.get("program") === "auto" || !t.get("program") ? null : parseId(t.get("program")),
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
  if (matPartial) {
    result.matPartial = matPartial;
  }
  if (matSrc) {
    result.matSrc = matSrc;
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
    const istpBranchRaw = t.get("istpbranch");
    const istpBranchState: StpBranchState =
      istpBranchRaw === "both" || istpBranchRaw === "lo" ? istpBranchRaw : "hi";
    result.istpBranchState = istpBranchState;
  }
  if (energyAnchor) {
    result.energyAnchor = energyAnchor;
  }
  if (sunit) {
    result.sunit = sunit;
  }
  return result;
}

/**
 * Decode calculator URL state from a raw query string or `URLSearchParams`.
 * Thin wrapper over the layered pipeline: extdata is resolved on the original
 * params (ordered, may repeat), then `parseQuery` tokenizes and
 * `resolveCalculatorState` applies semantics.
 *
 * The input is always normalized through `URLSearchParams` before tokenizing so
 * percent-encoded keys (e.g. `%70article`) are decoded the same way the legacy
 * decoder saw them. As a final safety net, an unexpected tokenizer failure
 * falls back to defaults (empty AST) rather than throwing into page init.
 */
export function decodeCalculatorUrl(input: URLSearchParams | string): CalculatorUrlState {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const { sources } = parseExtdataParams(params);
  let ast: QueryNode;
  try {
    ast = parseQuery(params);
  } catch (error) {
    if (!(error instanceof UrlParseError)) throw error;
    ast = { type: "query", pairs: [] };
  }
  return resolveCalculatorState(ast, sources);
}
