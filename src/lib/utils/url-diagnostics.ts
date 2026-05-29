/**
 * Diagnostics for the shareable-URL parser/resolver.
 *
 * Both the syntactic layer (`parseQuery`) and the semantic layer
 * (`resolveCalculatorState` / `resolvePlotState`) emit `Diagnostic`s carrying a
 * `SourceSpan`, so the UI can show the user exactly where a malformed or
 * invalid URL went wrong. See `docs/04-feature-specs/shareable-urls-formal.md`.
 */

import type { SourceSpan } from "./url-ast";

export type Severity = "fatal" | "error" | "warning" | "info";

export interface Diagnostic {
  /** Drives whether the calculation is blocked (`fatal`) or proceeds. */
  severity: Severity;
  /** Stable machine code, e.g. `"syntax"`, `"energy.non-positive"`. */
  code: string;
  /** Human-readable message; quotes the offending value where relevant. */
  message: string;
  /** Exact location in the query string, when known. */
  span?: SourceSpan;
  /** Parameter the diagnostic relates to, e.g. `"energies"`. */
  param?: string;
  /** Optional remediation hint. */
  hint?: string;
}

/**
 * Render the offending slice of the query string with a caret underline,
 * windowed so long URLs stay readable. Example:
 *
 * ```
 * …particle=6&energies=100,200:foo
 *                              ^^^
 * ```
 */
export function renderCaret(src: string, span: SourceSpan, context = 24): string {
  const start = Math.max(0, span.start - context);
  const end = Math.min(src.length, Math.max(span.end, span.start + 1) + context);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < src.length ? "…" : "";
  const slice = src.slice(start, end);
  const padding = prefix.length + (span.start - start);
  const caretLength = Math.max(1, span.end - span.start);
  return `${prefix}${slice}${suffix}\n${" ".repeat(padding)}${"^".repeat(caretLength)}`;
}

/** Shape of the Peggy `SyntaxError` we translate into a friendly message. */
export interface PeggyLikeError {
  expected: { type: string; description?: string; text?: string }[] | null;
  found: string | null;
  location: { start: { offset: number }; end: { offset: number } };
}

/**
 * Build a human-readable "expected … but found …" message from a Peggy
 * `SyntaxError`. Named grammar rules surface their descriptions (e.g.
 * "a number") instead of raw character classes.
 */
export function friendlyExpected(error: PeggyLikeError): string {
  const descriptions = Array.from(
    new Set(
      (error.expected ?? []).map((e) => {
        if (e.description) return e.description;
        if (e.type === "literal" && e.text) return `"${e.text}"`;
        if (e.type === "end") return "end of input";
        return e.description ?? "a different value";
      }),
    ),
  );

  const expectedPart =
    descriptions.length === 0
      ? "a valid value"
      : descriptions.length === 1
        ? descriptions[0]
        : `${descriptions.slice(0, -1).join(", ")} or ${descriptions[descriptions.length - 1]}`;

  const foundPart = error.found === null ? "end of input" : `"${error.found}"`;
  return `Expected ${expectedPart} but found ${foundPart}.`;
}
