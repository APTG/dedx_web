/**
 * `parseQuery` — the syntactic layer of the shareable-URL pipeline.
 *
 * Tokenizes a raw query string into the AST defined in `url-ast.ts`, using the
 * Peggy grammar in `url-grammar.peggy`. This layer is pure syntax: it performs
 * no defaulting, coercion, duplicate resolution, or validation. Those are the
 * resolver's job (`url-resolve.ts`), which walks the AST.
 *
 * Values are kept as their raw (still percent-encoded) substrings so that node
 * spans remain accurate offsets into the original URL — the resolver decodes
 * scalar values when it reads them.
 */

import { parse as parseGrammar, SyntaxError as PeggySyntaxError } from "./url-grammar.peggy";
import type { QueryNode } from "./url-ast";
import { friendlyExpected, type Diagnostic } from "./url-diagnostics";

/** Thrown when a query string cannot be tokenized at all (rare; see below). */
export class UrlParseError extends Error {
  constructor(
    public readonly diagnostic: Diagnostic,
    public readonly src: string,
  ) {
    super(diagnostic.message);
    this.name = "UrlParseError";
  }
}

/** Strip a leading `?` and accept either a raw string or `URLSearchParams`. */
function toRawQuery(input: string | URLSearchParams): string {
  const raw = typeof input === "string" ? input : input.toString();
  return raw.startsWith("?") ? raw.slice(1) : raw;
}

/**
 * Tokenize a query string into its AST.
 *
 * The grammar is near-total — unknown keys are absorbed by `unknown-pair` — so
 * a hard parse failure is rare and signals genuinely malformed structure. When
 * it happens we throw `UrlParseError` with a `fatal` diagnostic pinpointing the
 * offset, which callers surface to the user (and fall back to defaults).
 */
export function parseQuery(input: string | URLSearchParams): QueryNode {
  const src = toRawQuery(input);
  try {
    return parseGrammar(src);
  } catch (error) {
    if (error instanceof PeggySyntaxError) {
      const at = error.location.start.offset;
      const diagnostic: Diagnostic = {
        severity: "fatal",
        code: "syntax",
        message: friendlyExpected(error),
        span: { start: at, end: Math.max(at + 1, error.location.end.offset) },
        hint: "Check the link near the highlighted character.",
      };
      throw new UrlParseError(diagnostic, src);
    }
    throw error;
  }
}
