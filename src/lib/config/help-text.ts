/**
 * Central registry for contextual-help tooltip copy.
 *
 * Each entry is a short (≤150 char) plain-language gloss whose wording is kept
 * in sync with the canonical definitions in `docs/10-terminology.md`. Keeping
 * the strings in one place (rather than inline in components) satisfies the
 * cross-spec consistency rule in CLAUDE.md — one edit updates every call site.
 *
 * `href` is a base-relative path (the deployment base is prepended by the
 * `HelpHint` component) pointing at a deeper explanation, usually a
 * `/docs/user-guide` anchor. It renders as a "Learn more →" link so the
 * tooltip never becomes a dead end for users who need the full story.
 *
 * The registry grows over the three contextual-help PRs:
 *  - PR 1 (#769): Program / data-source concept.
 *  - PR 2 (#770): quantity & unit concepts (stopping power AND CSDA range).
 *  - PR 3 (#771): advanced-mode controls & workflow affordances.
 */

export interface HelpEntry {
  /** Short plain-language gloss, ≤150 chars. Source: docs/10-terminology.md. */
  text: string;
  /** Base-relative deep-link (e.g. "/docs/user-guide#choosing-a-program"). */
  href?: string;
}

export const HELP_TEXT = {
  program: {
    text: "The data source for the result: NIST tables, ICRU reports, the MSTAR ion model, or the analytical Bethe formula. Incompatible programs are greyed out.",
    href: "/docs/user-guide#choosing-a-program",
  },
} satisfies Record<string, HelpEntry>;

export type HelpKey = keyof typeof HELP_TEXT;
