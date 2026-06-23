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
 *  - PR 3 (#771): advanced-mode controls (aggregate state, density / I-value
 *    overrides, MSTAR mode, interpolation), the inverse-lookup branches
 *    (Range→ / STP→ parity + Bragg-peak validity), and workflow affordances
 *    (advanced mode, share / export, custom compounds, external data / CORS).
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

  // PR 3 (#771) — advanced-mode controls.
  aggregateState: {
    text: "Gas or condensed treatment of the material. Sets the I-value (a few-percent effect at intermediate energies) and the default stopping-power unit.",
    href: "/docs/user-guide#advanced-options",
  },
  densityOverride: {
    text: "Override the material density (g/cm³). Changes only the linear↔mass unit conversion (e.g. keV/µm), not the underlying mass stopping power.",
    href: "/docs/user-guide#advanced-options",
  },
  iValueOverride: {
    text: "Override the mean excitation energy I (eV). A higher I lowers electronic stopping power. Leave blank to use the tabulated value.",
    href: "/docs/user-guide#advanced-options",
  },
  mstarMode: {
    text: "MSTAR calculation variant (A–H) for heavy ions. B (auto special) is recommended; see the docs for the full mode table.",
    href: "/docs/user-guide#advanced-options",
  },
  interpolation: {
    text: "How values between tabulated points are filled in: log-log vs lin-lin axis scale and linear vs spline method. Applies to all data sources.",
    href: "/docs/user-guide#advanced-options",
  },

  // PR 3 (#771) — inverse lookups (Range→ and STP→ parity, plus Bragg-peak validity).
  inverseRange: {
    text: "Find the energy that yields a target CSDA range — the reverse of the forward table. Enter a range; energy and stopping power are returned.",
    href: "/docs/user-guide#inverse-lookups",
  },
  inverseStp: {
    text: "Find the energy that yields a target stopping power. Two energies can match — below and above the Bragg-peak maximum — so both are shown.",
    href: "/docs/user-guide#inverse-lookups",
  },
  braggPeak: {
    text: "Stopping power peaks just before the particle stops. A target above this maximum has no solution; near it a low-E and high-E energy both match.",
    href: "/docs/user-guide#inverse-lookups",
  },

  // PR 3 (#771) — workflow / feature affordances.
  advancedMode: {
    text: "Unlocks multi-program comparison, inverse lookups, custom compounds, MSTAR modes, and density / I-value overrides. Basic keeps the essentials.",
    href: "/docs/user-guide#advanced-options",
  },
  shareExport: {
    text: "Share URL copies a link that restores the whole state (entities, energies, units, advanced options). Export saves the current table as CSV or PDF.",
    href: "/docs/user-guide#sharing",
  },
  customCompound: {
    text: "A user-defined material set by elemental composition and density. Stopping power is computed from the elements via the Bragg additivity rule.",
    href: "/docs/user-guide#custom-compounds",
  },
  compoundComposition: {
    text: "Enter composition as atom counts per formula unit (Formula) or weight fractions in % (Weight fraction). The two views stay in sync.",
    href: "/docs/user-guide#custom-compounds",
  },
  compoundIValue: {
    text: "Optional mean excitation energy (eV). Leave blank to derive it from the elements via Bragg additivity, or set a measured value.",
    href: "/docs/user-guide#custom-compounds",
  },
  externalData: {
    text: "Load a .webdedx dataset you host yourself. Your server must send the CORS header Access-Control-Allow-Origin or the browser blocks the fetch.",
    href: "/docs/user-guide#external-data",
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
