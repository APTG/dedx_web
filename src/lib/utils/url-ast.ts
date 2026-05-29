/**
 * Abstract syntax tree produced by the shareable-URL parser (`parseQuery`).
 *
 * The tree is **pure syntax**: every value is the raw, percent-decoded string
 * exactly as it appeared in the query. No defaulting, no coercion, no semantic
 * validation — those belong to the resolver layer (`url-resolve.ts`).
 *
 * The grammar that produces these nodes lives in `url-grammar.peggy`; the
 * normative definition is `docs/04-feature-specs/shareable-urls-formal.md` §2.
 * Keep the three in sync.
 */

/** Half-open character range `[start, end)` into the parsed query string. */
export interface SourceSpan {
  start: number;
  end: number;
}

/** A single `energies=` item — `number [":" energy-unit-token]`. */
export interface EnergyItemNode {
  value: string;
  unit: string | null;
  span: SourceSpan;
}

/** A single `lookups=` / `ivalues=` item — `number [":" lookup-unit-token]`. */
export interface LookupItemNode {
  value: string;
  unit: string | null;
  span: SourceSpan;
}

/** A single `series=` triplet — `programId.particleId.materialId`. */
export interface SeriesItemNode {
  program: string;
  particle: string;
  material: string;
  span: SourceSpan;
}

/** A single `mat_elements=` element — `Z:count`. */
export interface MatElementNode {
  z: string;
  count: string;
  span: SourceSpan;
}

/**
 * One key/value pair. List-bearing params expose a structured `items`/`ids`
 * field when their value parses cleanly against the grammar, and always expose
 * the verbatim `raw` value so the resolver can apply the same lenient
 * splitting the legacy decoder used for malformed input.
 */
export type PairNode =
  | { type: "extdata"; key: "extdata"; label: string; url: string; span: SourceSpan }
  | {
      type: "energies";
      key: "energies";
      items: EnergyItemNode[] | null;
      raw: string;
      span: SourceSpan;
    }
  | {
      type: "lookups";
      key: "lookups" | "ivalues";
      items: LookupItemNode[] | null;
      raw: string;
      span: SourceSpan;
    }
  | { type: "series"; key: "series"; items: SeriesItemNode[] | null; raw: string; span: SourceSpan }
  | {
      type: "mat-elements";
      key: "mat_elements";
      elements: MatElementNode[] | null;
      raw: string;
      span: SourceSpan;
    }
  | {
      type: "entity-list";
      key: "programs" | "particles" | "materials" | "hidden_programs";
      ids: string[] | null;
      raw: string;
      span: SourceSpan;
    }
  | { type: "scalar"; key: string; value: string; span: SourceSpan }
  | { type: "unknown"; key: string; value: string; span: SourceSpan };

/** Root node — `query = [pair *("&" [pair])]`. */
export interface QueryNode {
  type: "query";
  pairs: PairNode[];
}
