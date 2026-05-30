import type { StpUnit } from "$lib/wasm/types";

/**
 * Single source of truth for the stopping-power unit URL codec, shared by the
 * calculator (`sunit=`) and plot pages. Tokens are stable URL values; the unit
 * strings are the in-app display labels.
 */
const STP_TOKENS: Record<StpUnit, string> = {
  "keV/µm": "kev-um",
  "MeV/cm": "mev-cm",
  "MeV·cm²/g": "mev-cm2-g",
};

const TOKEN_TO_STP: Record<string, StpUnit> = Object.fromEntries(
  Object.entries(STP_TOKENS).map(([k, v]) => [v, k as StpUnit]),
);

/** Ordered list of stopping-power units — same set and order as the picker UI. */
export const STP_UNITS: StpUnit[] = ["keV/µm", "MeV/cm", "MeV·cm²/g"];

export function stpUnitToToken(unit: StpUnit): string {
  return STP_TOKENS[unit];
}

/** Decode a `sunit=` token. Unknown / empty input falls back to the default
 *  `keV/µm` — never throws, for forward-compat with future tokens. */
export function tokenToStpUnit(token: string): StpUnit {
  return TOKEN_TO_STP[token] ?? "keV/µm";
}

/** Like {@link tokenToStpUnit} but returns `null` for unknown / empty tokens,
 *  so callers can distinguish "no explicit choice" from the default unit. */
export function tokenToStpUnitOrNull(token: string | null | undefined): StpUnit | null {
  if (!token) return null;
  return TOKEN_TO_STP[token] ?? null;
}
