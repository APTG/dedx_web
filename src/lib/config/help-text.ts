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

import type { StpUnit, EnergyUnit } from "$lib/wasm/types";

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
  stoppingPower: {
    text: "Rate of energy loss per unit path length. Total = electronic (collisions with electrons) + nuclear (elastic collisions with nuclei).",
    href: "/docs/user-guide#quantities",
  },
  csdaRange: {
    text: "Continuous-Slowing-Down range: total path length to rest, the integral of 1/stopping power. The Bragg peak sits just before its end.",
    href: "/docs/user-guide#quantities",
  },
} satisfies Record<string, HelpEntry>;

export type HelpKey = keyof typeof HELP_TEXT;

/**
 * Per-unit help for the stopping-power output units (`StpUnit`). Mass units are
 * geometry-independent; linear units need the material density to convert.
 */
export const STP_UNIT_HELP = {
  "MeV·cm²/g": {
    text: "Mass stopping power — stopping power ÷ density. Geometry-independent, so values are comparable across materials.",
    href: "/docs/user-guide#units",
  },
  "keV/µm": {
    text: "Linear stopping power — energy lost per micron of path. Requires the material density to convert from the mass unit.",
    href: "/docs/user-guide#units",
  },
  "MeV/cm": {
    text: "Linear stopping power — energy lost per centimetre of path. Requires the material density to convert from the mass unit.",
    href: "/docs/user-guide#units",
  },
} satisfies Record<StpUnit, HelpEntry>;

/**
 * Per-unit help for the energy input units (`EnergyUnit`). MeV/nucl vs MeV/u is
 * the glossary's documented "often confused" pair; electrons (ESTAR) use MeV.
 */
export const ENERGY_UNIT_HELP = {
  MeV: {
    text: "Total kinetic energy, in megaelectronvolts. Used for electrons (ESTAR), where per-nucleon energy is undefined.",
    href: "/docs/user-guide#units",
  },
  "MeV/nucl": {
    text: "Energy ÷ mass number A (integer nucleon count). The app default for ions and what libdedx uses internally.",
    href: "/docs/user-guide#units",
  },
  "MeV/u": {
    text: "Energy ÷ actual atomic mass in u. Differs from MeV/nucl by ~0.8% for a proton; the two are equal for carbon-12.",
    href: "/docs/user-guide#units",
  },
} satisfies Record<EnergyUnit, HelpEntry>;
