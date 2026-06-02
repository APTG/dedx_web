/**
 * Shared internals for the calculator and plot URL codecs.
 *
 * These helpers were previously copy-pasted between `calculator-url.ts` and
 * `plot-url.ts`. They are consolidated here so a change to duplicate-resolution,
 * numeric parsing, or custom-compound (`mat_*`) handling cannot drift between
 * the two modules (issue #477, deviation 4).
 */

import type { Diagnostic } from "./url-diagnostics";
import type { SourceSpan, QueryNode, PairNode } from "./url-ast";

/**
 * Canonical separator between items of a list-valued query param (`energies`,
 * `particles`, `programs`, `materials`, `lookups`, `mat_elements`, `series`).
 *
 * We emit `~` (RFC 3986 *unreserved*) rather than the `,` used through `urlv=2`:
 * messenger/email auto-linkifiers are heuristic and terminate a link at the
 * first comma (sentence punctuation), so multi-item shared links were truncated
 * (issue #672). `~` is reliably kept inside auto-links, so the URL survives
 * pasting into Signal/iMessage/email.
 *
 * Note: although `~` is *unreserved*, `URLSearchParams.toString()` still
 * percent-encodes it as `%7E` (its form-urlencoded safe set excludes `~`). The
 * query-string writers (`calculatorUrlQueryString` / `plotUrlQueryString`)
 * therefore restore `%7E` → `~` for readability before the URL reaches the bar.
 */
export const URL_LIST_SEPARATOR = "~";

/**
 * The exact substring `URLSearchParams.toString()` emits for the separator
 * (`%7E`). Derived from {@link URL_LIST_SEPARATOR} — *not* a hard-coded literal —
 * so it cannot drift if the separator changes. Note `encodeURIComponent` is the
 * wrong tool here: it leaves `~` untouched (unreserved), whereas the
 * form-urlencoded serializer used by `URLSearchParams` percent-encodes it. The
 * query-string writers restore this back to `~` for readability.
 */
export const URL_LIST_SEPARATOR_ENCODED = new URLSearchParams([["x", URL_LIST_SEPARATOR]])
  .toString()
  .slice("x=".length);

/**
 * Split a list-valued query param on the canonical `~` **or** the legacy `,`,
 * so links shared/bookmarked before #672 keep decoding to the same state.
 */
export const URL_LIST_SPLIT_RE = /[,~]/;

/**
 * Decode a single query-component value the way `URLSearchParams.get` does:
 * `+` means space, then percent-decode. Malformed escapes fall through to the
 * raw text rather than throwing.
 */
export function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

const LIST_NODE_TYPES = new Set(["energies", "lookups", "series", "mat-elements", "entity-list"]);

/** A list-bearing pair node (carries a `raw` value). */
export type ListPairNode = Extract<PairNode, { raw: string }>;

/**
 * A read-only, last-wins view over a parsed query, with values decoded exactly
 * as `URLSearchParams.get` would return them. This lets the resolvers read
 * tokens the same way the legacy decoders read `URLSearchParams`, while the
 * structured list nodes and spans remain available for diagnostics.
 */
export interface TokenView {
  /** Decoded last-wins value for a key, or `null` if absent. */
  get(key: string): string | null;
  /** Source span of the last occurrence of a key, if present. */
  span(key: string): SourceSpan | undefined;
  /** Structured list node for a list-bearing key (last occurrence). */
  list(key: string): ListPairNode | undefined;
  /** Unknown pairs, in document order (for "dropped param" diagnostics). */
  unknownPairs: Extract<PairNode, { type: "unknown" }>[];
}

export function buildTokenView(ast: QueryNode): TokenView {
  const scalars = new Map<string, { value: string; span: SourceSpan }>();
  const lists = new Map<string, ListPairNode>();
  const unknownPairs: Extract<PairNode, { type: "unknown" }>[] = [];

  for (const pair of ast.pairs) {
    if (pair.type === "scalar") {
      scalars.set(pair.key, { value: decodeComponent(pair.value), span: pair.span });
    } else if (pair.type === "unknown") {
      unknownPairs.push(pair);
    } else if (LIST_NODE_TYPES.has(pair.type)) {
      lists.set(pair.key, pair as ListPairNode);
    }
    // `extdata` is resolved separately via parseExtdataParams (ordered, may repeat).
  }

  return {
    get(key) {
      const scalar = scalars.get(key);
      if (scalar) return scalar.value;
      const list = lists.get(key);
      if (list) return decodeComponent(list.raw);
      return null;
    },
    span(key) {
      return scalars.get(key)?.span ?? lists.get(key)?.span;
    },
    list(key) {
      return lists.get(key);
    },
    unknownPairs,
  };
}

export const STRICT_NUMBER_RE = /^[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?$/;
export const STRICT_INTEGER_RE = /^\d+$/;

export function parseStrictFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  if (!STRICT_NUMBER_RE.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export function parseStrictAtomicNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!STRICT_INTEGER_RE.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 1 && value <= 118 ? value : undefined;
}

/** Element specification for custom compounds in URL encoding. */
export interface MatElementUrl {
  atomicNumber: number;
  atomCount: number;
}

/** Decoded `material=custom` fields plus a validation summary. */
export interface CustomCompoundFields {
  materialIsCustom: true;
  matName: string | undefined;
  matDensity: number | undefined;
  matElements: MatElementUrl[] | undefined;
  matIval: number | undefined;
  matPhase: "gas" | "condensed";
  /** Non-empty when one or more required fields were missing/invalid. */
  fromUrlWarning: string | undefined;
}

function appendWarning(current: string | undefined, message: string): string {
  return current ? `${current}; ${message}` : message;
}

/**
 * Parse the custom-compound `mat_*` params from a decoded token getter.
 *
 * This is the exact validation the legacy decoders performed (it sets the same
 * `fromUrlWarning` strings), now in one place. Callers decide whether to apply
 * it (advanced mode only, for the calculator). Optional `spans`/`diagnostics`
 * let callers surface precise, span-accurate messages without changing the
 * legacy warning text.
 */
export function parseCustomCompound(
  get: (key: string) => string | null,
  spans?: { get: (key: string) => SourceSpan | undefined },
  diagnostics?: Diagnostic[],
): CustomCompoundFields {
  const pushDiag = (code: string, message: string, param: string) => {
    if (!diagnostics) return;
    const span = spans?.get(param);
    diagnostics.push({ severity: "warning", code, message, param, ...(span ? { span } : {}) });
  };

  let matName: string | undefined = get("mat_name") ?? undefined;
  const matDensityRaw = get("mat_density");
  let matDensity = parseStrictFiniteNumber(matDensityRaw);
  const matElementsRaw = get("mat_elements");
  const matIvalRaw = get("mat_ival");
  const matPhaseRaw = get("mat_phase");

  let matElements: MatElementUrl[] | undefined;
  let fromUrlWarning: string | undefined;

  if (matElementsRaw) {
    const elementMap = new Map<number, number>();
    for (const entry of matElementsRaw.split(URL_LIST_SPLIT_RE)) {
      const colonIdx = entry.indexOf(":");
      if (colonIdx <= 0) {
        fromUrlWarning = appendWarning(fromUrlWarning, "mat_elements: malformed entries");
        continue;
      }
      const zStr = entry.slice(0, colonIdx);
      const countStr = entry.slice(colonIdx + 1);
      const z = parseStrictAtomicNumber(zStr);
      const count = parseStrictFiniteNumber(countStr);
      if (z === undefined) {
        if (!STRICT_INTEGER_RE.test(zStr.trim())) {
          fromUrlWarning = appendWarning(fromUrlWarning, "mat_elements: malformed entries");
        }
        continue;
      }
      if (count === undefined) {
        fromUrlWarning = appendWarning(fromUrlWarning, "mat_elements: malformed entries");
        continue;
      }
      if (count <= 0) continue;
      elementMap.set(z, (elementMap.get(z) ?? 0) + count);
    }
    if (elementMap.size > 0) {
      matElements = Array.from(elementMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([atomicNumber, atomCount]) => ({ atomicNumber, atomCount }));
    } else if (matElementsRaw) {
      fromUrlWarning = appendWarning(fromUrlWarning, "mat_elements: all entries invalid");
    }
  }

  let matIval = parseStrictFiniteNumber(matIvalRaw);
  if (matIvalRaw !== null && matIval === undefined) {
    fromUrlWarning = appendWarning(fromUrlWarning, "mat_ival invalid");
  }
  if (matIval !== undefined && (matIval <= 0 || matIval > 10000)) {
    matIval = undefined;
  }

  const matPhase: "gas" | "condensed" = matPhaseRaw === "gas" ? "gas" : "condensed";

  if (!matName || !matName.trim()) {
    fromUrlWarning = appendWarning(fromUrlWarning, "mat_name missing");
    pushDiag("compound.name-missing", "Custom compound name (mat_name) is required.", "mat_name");
  }
  if (
    matDensity === undefined ||
    !Number.isFinite(matDensity) ||
    matDensity <= 0 ||
    matDensity > 25
  ) {
    fromUrlWarning = appendWarning(fromUrlWarning, "mat_density invalid");
    pushDiag(
      "compound.density-invalid",
      `Custom compound density (mat_density) must be in (0, 25]; got ${matDensityRaw ?? "none"}.`,
      "mat_density",
    );
  }
  if (!matElements || matElements.length === 0) {
    fromUrlWarning = appendWarning(fromUrlWarning, "mat_elements missing/invalid");
    pushDiag(
      "compound.elements-invalid",
      "Custom compound needs at least one valid element (mat_elements).",
      "mat_elements",
    );
  }

  // If validation failed, drop the parsed fields (caller falls back to a
  // built-in material) but keep the warning so the UI can explain why.
  if (fromUrlWarning) {
    matName = undefined;
    matDensity = undefined;
    matElements = undefined;
    matIval = undefined;
  }

  return {
    materialIsCustom: true,
    matName,
    matDensity,
    matElements,
    matIval,
    matPhase,
    fromUrlWarning,
  };
}

/** Encode `mat_elements` as ascending-Z `Z:count~Z:count`. */
export function encodeMatElements(elements: MatElementUrl[]): string {
  return [...elements]
    .sort((a, b) => a.atomicNumber - b.atomicNumber)
    .map((e) => `${e.atomicNumber}:${e.atomCount}`)
    .join(URL_LIST_SEPARATOR);
}
